/**
 * Application Payment Service for FeeFlow.
 * Handles payment order creation, webhook verification, idempotent capture,
 * atomic ledger allocation, GST receipt issuance, immediate reminder stopping,
 * and unmatched payment routing.
 *
 * Hard Invariants:
 * 1. Signature-verified webhook ONLY: Redirects never mark payments paid.
 * 2. Idempotent: Replays produce exactly one financial effect.
 * 3. Atomic: Payment, Allocation, Ledger Entry, Receipt, and Reminder Stop happen together.
 * 4. Stop on Settlement: Reminders for settled instalment marked SKIPPED immediately.
 * 5. Unknown orders route to Accounts Queue (S3) without altering any student balance.
 * 6. Integer paise throughout: Zero floating-point arithmetic.
 */

import { prisma } from "@/infrastructure/db/prisma";
import {
  verifyWebhookSignature,
  PaymentWebhookPayload,
  createMockOrder,
} from "@/infrastructure/adapters/mock-payment-gateway";
import { deriveInstalmentBalance } from "@/domain/ledger";
import { demoPaymentStore } from "@/infrastructure/db/demo-payment-store";

export interface CreatePaymentIntentInput {
  studentId: string;
  instalmentId?: string;
  amountPaise: bigint;
  idempotencyKey?: string;
}

export interface WebhookProcessingResult {
  success: boolean;
  duplicate?: boolean;
  status: "ALLOCATED" | "UNMATCHED" | "FAILED" | "REJECTED";
  paymentId?: string;
  receiptNumber?: string;
  error?: string;
}

function isPrismaConnectionError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || "");
  return (
    err.code === "P1001" ||
    msg.includes("Can't reach database server") ||
    msg.includes("localhost:5432") ||
    msg.includes("connect ECONNREFUSED")
  );
}

export class PaymentService {
  /**
   * Creates a payment intent before redirecting to hosted mock checkout.
   */
  async createIntent(input: CreatePaymentIntentInput) {
    if (input.amountPaise <= 0n) {
      throw new Error("Payment amount must be greater than zero");
    }

    const mockOrder = createMockOrder({
      studentId: input.studentId,
      instalmentId: input.instalmentId,
      amountPaise: input.amountPaise,
    });

    try {
      const intent = await prisma.paymentIntent.create({
        data: {
          orderId: mockOrder.orderId,
          studentId: input.studentId,
          instalmentId: input.instalmentId,
          amount: input.amountPaise,
          currency: "INR",
          provider: "MOCK_GATEWAY",
          idempotencyKey: input.idempotencyKey,
        },
      });

      return intent;
    } catch (err: any) {
      if (isPrismaConnectionError(err)) {
        return demoPaymentStore.createPaymentIntent({
          orderId: mockOrder.orderId,
          studentId: input.studentId,
          instalmentId: input.instalmentId,
          amount: input.amountPaise,
          currency: "INR",
          provider: "MOCK_GATEWAY",
          idempotencyKey: input.idempotencyKey,
        });
      }
      throw err;
    }
  }

  /**
   * Processes an incoming payment webhook with HMAC signature verification and transactional execution.
   */
  async processWebhook(
    rawBody: string,
    signatureHeader: string | null | undefined
  ): Promise<WebhookProcessingResult> {
    // 1. Signature verification
    const isValid = verifyWebhookSignature(rawBody, signatureHeader);
    if (!isValid) {
      return {
        success: false,
        status: "REJECTED",
        error: "Invalid webhook HMAC signature",
      };
    }

    let payload: PaymentWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return {
        success: false,
        status: "REJECTED",
        error: "Malformed JSON payload in webhook body",
      };
    }

    const {
      eventId,
      eventType,
      orderId,
      providerPaymentId,
      amountPaise: amountStr,
      currency,
      method,
      payerDetails,
    } = payload;

    // Currency verification: FeeFlow requires INR
    if (currency && currency !== "INR") {
      return {
        success: false,
        status: "REJECTED",
        error: `Unsupported currency: ${currency}. FeeFlow only accepts INR.`,
      };
    }

    let amountPaise: bigint;
    try {
      amountPaise = BigInt(amountStr);
      if (amountPaise <= 0n) {
        return {
          success: false,
          status: "REJECTED",
          error: "Invalid payment amount: must be positive integer paise",
        };
      }
    } catch {
      return {
        success: false,
        status: "REJECTED",
        error: "Invalid amount format in webhook payload",
      };
    }

    // Try processing with Prisma first; fallback to in-memory store if DB is offline
    try {
      return await this.processWithPrisma(
        rawBody,
        eventId,
        eventType,
        orderId,
        providerPaymentId,
        amountPaise,
        method,
        payerDetails
      );
    } catch (err: any) {
      if (isPrismaConnectionError(err)) {
        return this.processWithDemoStore(
          rawBody,
          eventId,
          eventType,
          orderId,
          providerPaymentId,
          amountPaise,
          method,
          payerDetails
        );
      }
      throw err;
    }
  }

  private async processWithPrisma(
    rawBody: string,
    eventId: string,
    eventType: string,
    orderId: string | null | undefined,
    providerPaymentId: string,
    amountPaise: bigint,
    method: string,
    payerDetails?: string | null
  ): Promise<WebhookProcessingResult> {
    // 2. Webhook Idempotency Check
    const existingEvent = await prisma.providerEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: "MOCK_GATEWAY",
          providerEventId: eventId,
        },
      },
    });

    if (existingEvent && existingEvent.processed) {
      return {
        success: true,
        duplicate: true,
        status: "ALLOCATED",
      };
    }

    // 3. Process inside ACID Database Transaction
    return await prisma.$transaction(async (tx) => {
      // Record provider event
      await tx.providerEvent.upsert({
        where: {
          provider_providerEventId: {
            provider: "MOCK_GATEWAY",
            providerEventId: eventId,
          },
        },
        create: {
          provider: "MOCK_GATEWAY",
          providerEventId: eventId,
          eventType,
          payloadJson: rawBody,
          signatureVerified: true,
          processed: true,
          processedAt: new Date(),
        },
        update: {
          processed: true,
          processedAt: new Date(),
        },
      });

      if (eventType === "payment.failed") {
        return {
          success: true,
          status: "FAILED",
        };
      }

      // Check if orderId matches an existing PaymentIntent
      let intent = null;
      if (orderId) {
        intent = await tx.paymentIntent.findUnique({
          where: { orderId },
        });
      }

      // If NO exact order match or no student -> Route to Unmatched Queue
      if (!intent || !intent.studentId) {
        const paymentRef = `PAY-UNMATCHED-${Date.now().toString(36).toUpperCase()}`;
        const unmatchedPayment = await tx.payment.create({
          data: {
            paymentReference: paymentRef,
            provider: "MOCK_GATEWAY",
            providerPaymentId,
            orderId: orderId || null,
            studentId: null,
            amount: amountPaise,
            unallocatedAmount: amountPaise,
            paymentDate: new Date(),
            method: method || "UPI",
            payerDetails: payerDetails || "Unknown Payer",
            status: "CAPTURED",
            matchStatus: "UNMATCHED",
            notes: "Capture received without valid order ID; routed to Accounts Queue",
          },
        });

        return {
          success: true,
          status: "UNMATCHED",
          paymentId: unmatchedPayment.id,
        };
      }

      // Find student and target instalment
      const student = await tx.student.findUnique({
        where: { id: intent.studentId },
        include: {
          feePlans: {
            where: { status: "ACTIVE" },
            include: { instalments: { orderBy: { sequence: "asc" } } },
          },
          ledgerEntries: true,
        },
      });

      if (!student || student.feePlans.length === 0) {
        throw new Error(`Active student or fee plan not found for intent ${intent.id}`);
      }

      const activePlan = student.feePlans[0];
      let targetInstalment = null;

      if (intent.instalmentId) {
        targetInstalment = activePlan.instalments.find((i) => i.id === intent.instalmentId);
      }
      if (!targetInstalment) {
        targetInstalment = activePlan.instalments.find((i) => i.status !== "PAID" && i.status !== "WAIVED");
      }
      if (!targetInstalment && activePlan.instalments.length > 0) {
        targetInstalment = activePlan.instalments[0];
      }

      if (!targetInstalment) {
        throw new Error("No eligible instalment found for payment allocation");
      }

      // Derive live balance of target instalment
      const currentBalance = deriveInstalmentBalance(
        {
          id: targetInstalment.id,
          feePlanId: activePlan.id,
          sequence: targetInstalment.sequence,
          dueDate: targetInstalment.dueDate,
          amount: targetInstalment.amount,
        },
        student.ledgerEntries.map((e) => ({
          ...e,
          amount: e.amount,
        })),
        new Date()
      );

      // Allocate up to current outstanding; excess remains unallocated
      const allocatableAmount =
        amountPaise > currentBalance.outstandingBalance
          ? currentBalance.outstandingBalance
          : amountPaise;
      const unallocatedAmount = amountPaise - allocatableAmount;

      const paymentRef = `PAY-${Date.now().toString(36).toUpperCase()}`;

      // Create Payment record
      const payment = await tx.payment.create({
        data: {
          paymentReference: paymentRef,
          provider: "MOCK_GATEWAY",
          providerPaymentId,
          orderId: intent.orderId,
          studentId: student.id,
          amount: amountPaise,
          unallocatedAmount,
          paymentDate: new Date(),
          method: method || "UPI",
          payerDetails: payerDetails || student.name,
          status: "CAPTURED",
          matchStatus: "MATCHED_AUTOMATIC",
        },
      });

      // Create Payment Allocation
      if (allocatableAmount > 0n) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            instalmentId: targetInstalment.id,
            amount: allocatableAmount,
            allocatedAt: new Date(),
            allocationReason: "Automated webhook allocation",
          },
        });

        // Append signed ledger ALLOCATION entry (negative amount reduces debt)
        await tx.ledgerEntry.create({
          data: {
            studentId: student.id,
            instalmentId: targetInstalment.id,
            entryType: "ALLOCATION",
            amount: -allocatableAmount,
            entryDate: new Date(),
            referenceType: "PAYMENT",
            referenceId: payment.id,
            notes: `Webhook payment capture for instalment ${targetInstalment.sequence}`,
          },
        });

        // Update cached status on instalment row
        const newOutstanding = currentBalance.outstandingBalance - allocatableAmount;
        await tx.instalment.update({
          where: { id: targetInstalment.id },
          data: {
            status: newOutstanding === 0n ? "PAID" : "PARTIAL",
          },
        });

        // HARD INVARIANT: Stop reminders immediately on settlement!
        if (newOutstanding === 0n) {
          await tx.reminderDispatch.updateMany({
            where: {
              instalmentId: targetInstalment.id,
              status: "QUEUED",
            },
            data: {
              status: "SKIPPED",
              skipReason: "Instalment settled",
            },
          });
        }
      }

      // Generate GST-configured receipt
      const receiptNum = `REC-${new Date().getFullYear()}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
      const receipt = await tx.receipt.create({
        data: {
          receiptNumber: receiptNum,
          paymentId: payment.id,
          studentId: student.id,
          amount: amountPaise,
          issuedAt: new Date(),
          gstin: "08AABCC1234D1Z5 [SYNTHETIC]",
          sacCode: "999293",
          taxableAmount: amountPaise,
        },
      });

      // Update Intent status
      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: "SUCCEEDED" },
      });

      return {
        success: true,
        status: "ALLOCATED",
        paymentId: payment.id,
        receiptNumber: receipt.receiptNumber,
      };
    });
  }

  private processWithDemoStore(
    rawBody: string,
    eventId: string,
    eventType: string,
    orderId: string | null | undefined,
    providerPaymentId: string,
    amountPaise: bigint,
    method: string,
    payerDetails?: string | null
  ): WebhookProcessingResult {
    // 1. Idempotency Check
    const existing = demoPaymentStore.findProviderEvent("MOCK_GATEWAY", eventId);
    if (existing && existing.processed) {
      return {
        success: true,
        duplicate: true,
        status: "ALLOCATED",
      };
    }

    // Record provider event
    demoPaymentStore.recordProviderEvent({
      provider: "MOCK_GATEWAY",
      providerEventId: eventId,
      eventType,
      payloadJson: rawBody,
      signatureVerified: true,
      processed: true,
    });

    if (eventType === "payment.failed") {
      return {
        success: true,
        status: "FAILED",
      };
    }

    // 2. Intent matching
    const intent = orderId ? demoPaymentStore.findPaymentIntent(orderId) : null;

    // If NO exact order match or no student -> Route to Unmatched Queue
    if (!intent || !intent.studentId) {
      const paymentRef = `PAY-UNMATCHED-${Date.now().toString(36).toUpperCase()}`;
      const unmatchedPayment = demoPaymentStore.recordPayment({
        paymentReference: paymentRef,
        provider: "MOCK_GATEWAY",
        providerPaymentId,
        orderId: orderId || null,
        studentId: null,
        amount: amountPaise,
        unallocatedAmount: amountPaise,
        paymentDate: new Date(),
        method: method || "UPI",
        payerDetails: payerDetails || "Unknown Payer",
        status: "CAPTURED",
        matchStatus: "UNMATCHED",
        notes: "Capture received without valid order ID; routed to Accounts Queue",
      });

      return {
        success: true,
        status: "UNMATCHED",
        paymentId: unmatchedPayment.id,
      };
    }

    // 3. Find student instalments & ledger
    const instalments = demoPaymentStore.getStudentInstalments(intent.studentId);
    const ledger = demoPaymentStore.getStudentLedger(intent.studentId);

    let targetInstalment = null;
    if (intent.instalmentId) {
      targetInstalment = instalments.find((i) => i.id === intent.instalmentId);
    }
    if (!targetInstalment) {
      targetInstalment = instalments.find((i) => i.status !== "PAID" && i.status !== "WAIVED");
    }
    if (!targetInstalment && instalments.length > 0) {
      targetInstalment = instalments[0];
    }

    if (!targetInstalment) {
      throw new Error("No eligible instalment found for payment allocation");
    }

    // 4. Derive live balance
    const currentBalance = deriveInstalmentBalance(
      targetInstalment,
      ledger,
      new Date("2026-11-02")
    );

    // 5. Allocation bounds: allocate up to outstanding, excess remains unallocated
    const allocatableAmount =
      amountPaise > currentBalance.outstandingBalance
        ? currentBalance.outstandingBalance
        : amountPaise;
    const unallocatedAmount = amountPaise - allocatableAmount;

    const paymentRef = `PAY-${Date.now().toString(36).toUpperCase()}`;
    const payment = demoPaymentStore.recordPayment({
      paymentReference: paymentRef,
      provider: "MOCK_GATEWAY",
      providerPaymentId,
      orderId: intent.orderId,
      studentId: intent.studentId,
      amount: amountPaise,
      unallocatedAmount,
      paymentDate: new Date(),
      method: method || "UPI",
      payerDetails: payerDetails || "Demo Parent",
      status: "CAPTURED",
      matchStatus: "MATCHED_AUTOMATIC",
    });

    if (allocatableAmount > 0n) {
      demoPaymentStore.recordAllocation({
        paymentId: payment.id,
        instalmentId: targetInstalment.id,
        amount: allocatableAmount,
        allocationReason: "Automated webhook allocation",
      });

      demoPaymentStore.appendLedgerEntry({
        studentId: intent.studentId,
        instalmentId: targetInstalment.id,
        entryType: "ALLOCATION",
        amount: -allocatableAmount,
        referenceType: "PAYMENT",
        referenceId: payment.id,
        notes: `Webhook payment capture for instalment ${targetInstalment.sequence}`,
      });

      const newOutstanding = currentBalance.outstandingBalance - allocatableAmount;
      demoPaymentStore.updateInstalmentStatus(
        targetInstalment.id,
        newOutstanding === 0n ? "PAID" : "PARTIAL"
      );

      // Immediately cancel queued reminders on settlement
      if (newOutstanding === 0n) {
        demoPaymentStore.skipQueuedReminders(targetInstalment.id, "Instalment settled");
      }
    }

    // Receipt creation
    const receiptNum = `REC-${new Date().getFullYear()}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    const receipt = demoPaymentStore.createReceipt({
      receiptNumber: receiptNum,
      paymentId: payment.id,
      studentId: intent.studentId,
      amount: amountPaise,
      gstin: "08AABCC1234D1Z5 [SYNTHETIC]",
      sacCode: "999293",
      taxableAmount: amountPaise,
    });

    demoPaymentStore.updatePaymentIntentStatus(intent.orderId, "SUCCEEDED");

    return {
      success: true,
      status: "ALLOCATED",
      paymentId: payment.id,
      receiptNumber: receipt.receiptNumber,
    };
  }
}

export const paymentService = new PaymentService();
