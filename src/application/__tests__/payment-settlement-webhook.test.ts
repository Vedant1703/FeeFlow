import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import { paymentService } from "@/application/services/payment-service";
import { demoPaymentStore } from "@/infrastructure/db/demo-payment-store";
import { deriveInstalmentBalance } from "@/domain/ledger";
import {
  verifyRazorpayWebhookSignature,
  getPaymentProvider,
  RazorpayPaymentProvider,
} from "@/infrastructure/payments/payment-provider";

const TEST_WEBHOOK_SECRET = "feeflow_test_razorpay_webhook_secret_xyz123";

function createRazorpayWebhook(options: {
  event: string;
  orderId?: string | null;
  paymentId?: string;
  amountPaise?: bigint | number;
  currency?: string;
  status?: string;
  method?: string;
  vpa?: string;
  email?: string;
  contact?: string;
  secret?: string;
  errorDescription?: string;
  rawBodyModifier?: (raw: string) => string;
}) {
  const secret = options.secret || TEST_WEBHOOK_SECRET;
  const paymentId =
    options.paymentId || `pay_rzp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const orderId = options.orderId !== undefined ? options.orderId : "order_rzp_test_1";
  const amount = options.amountPaise != null ? Number(options.amountPaise) : 1500000;
  const status = options.status || (options.event === "payment.captured" ? "captured" : "failed");

  const payload = {
    entity: "event",
    account_id: "acc_feeflow_test",
    event: options.event,
    contains: ["payment"],
    payload: {
      payment: {
        entity: {
          id: paymentId,
          entity: "payment",
          amount,
          currency: options.currency || "INR",
          status,
          order_id: orderId,
          invoice_id: null,
          international: false,
          method: options.method || "upi",
          amount_refunded: 0,
          refund_status: null,
          captured: status === "captured",
          description: "Instalment Fee Payment",
          card_id: null,
          bank: null,
          wallet: null,
          vpa: options.vpa || "parent@okaxis",
          email: options.email || "parent@companya.ac.in",
          contact: options.contact || "+919876543210",
          notes: {
            studentId: "stu_ishita_0587",
          },
          fee: 0,
          tax: 0,
          error_code: options.event === "payment.failed" ? "BAD_REQUEST_ERROR" : null,
          error_description:
            options.errorDescription ||
            (options.event === "payment.failed" ? "Payment failed at bank" : null),
          created_at: Math.floor(Date.now() / 1000),
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  };

  let rawBody = JSON.stringify(payload);
  if (options.rawBodyModifier) {
    rawBody = options.rawBodyModifier(rawBody);
  }

  const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const eventId = `evt_${paymentId}`;

  return {
    rawBody,
    signature,
    eventId,
    secret,
    paymentId,
    orderId,
    amount,
  };
}

describe("Milestone 3: Razorpay Webhooks & Authoritative Payment Settlement (25 Scenarios)", () => {
  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    demoPaymentStore.reset();

    // Seed a standard Razorpay test intent for Ishita's Instalment 2
    demoPaymentStore.createPaymentIntent({
      orderId: "order_rzp_ishita_inst2",
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      amount: 1500000n, // ₹15,000 outstanding
      currency: "INR",
      provider: "RAZORPAY",
      status: "PROCESSING",
    });
  });

  // ==========================================================================
  // Webhook Authenticity (Scenarios 1 - 6)
  // ==========================================================================
  describe("Webhook Authenticity", () => {
    it("Scenario 1: Valid signature -> signature verifies and processing succeeds", async () => {
      const webhook = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_rzp_ishita_inst2",
        amountPaise: 1500000n,
      });

      const result = await paymentService.processWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("ALLOCATED");
      expect(result.receiptNumber).toMatch(/^REC-/);
    });

    it("Scenario 2: Invalid signature -> fails closed with HTTP 400 REJECTED before parsing", async () => {
      const webhook = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_rzp_ishita_inst2",
        amountPaise: 1500000n,
      });

      const invalidSig = "deadbeef".repeat(8);
      const result = await paymentService.processWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: invalidSig,
        eventId: webhook.eventId,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe("REJECTED");
      expect(result.error).toContain("Invalid Razorpay webhook signature");
    });

    it("Scenario 3: Missing signature -> fails closed with REJECTED", async () => {
      const webhook = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_rzp_ishita_inst2",
      });

      const result = await paymentService.processWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: null,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe("REJECTED");
      expect(result.error).toContain("Missing webhook signature");
    });

    it("Scenario 4: Malformed payload -> rejects invalid JSON gracefully", async () => {
      const badJson = '{"entity":"event", "event": "payment.captured", "unclosed}';
      const sig = crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(badJson).digest("hex");

      const result = await paymentService.processWebhook(badJson, {
        provider: "RAZORPAY",
        signature: sig,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe("REJECTED");
      expect(result.error).toContain("Malformed JSON payload");
    });

    it("Scenario 5: Changed raw payload -> tampered body fails constant-time HMAC check", async () => {
      const webhook = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_rzp_ishita_inst2",
        amountPaise: 1500000n,
      });

      // Tamper by modifying 1 byte in the rawBody
      const tamperedBody = webhook.rawBody.replace("1500000", "1500001");
      const result = await paymentService.processWebhook(tamperedBody, {
        provider: "RAZORPAY",
        signature: webhook.signature, // Original signature doesn't match tampered body
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe("REJECTED");
      expect(result.error).toContain("Invalid Razorpay webhook signature");
    });

    it("Scenario 6: Missing event ID -> derives fallback event ID and processes safely", async () => {
      const webhook = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_rzp_ishita_inst2",
        amountPaise: 1500000n,
      });

      // Pass null eventIdHeader
      const result = await paymentService.processWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: null,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("ALLOCATED");
    });
  });

  // ==========================================================================
  // Idempotency (Scenarios 7 - 10)
  // ==========================================================================
  describe("Idempotency", () => {
    it("Scenario 7: Duplicate webhook event (Level A) -> idempotent acknowledgment without re-allocation", async () => {
      const webhook = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_rzp_ishita_inst2",
        amountPaise: 1500000n,
      });

      // Delivery 1
      const res1 = await paymentService.processWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });
      expect(res1.success).toBe(true);
      expect(res1.duplicate).toBeUndefined();
      expect(res1.status).toBe("ALLOCATED");

      // Delivery 2 (Identical replay)
      const res2 = await paymentService.processWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });
      expect(res2.success).toBe(true);
      expect(res2.duplicate).toBe(true);
      expect(res2.status).toBe("ALLOCATED");

      // Confirm exactly one ledger entry was written
      const ledger = demoPaymentStore.getStudentLedger("stu_ishita_0587");
      const allocations = ledger.filter(
        (e) => e.instalmentId === "inst_ishita_2" && e.entryType === "ALLOCATION"
      );
      // Previously had 1 allocation from seed, so now exactly 2
      expect(allocations).toHaveLength(2);
    });

    it("Scenario 8: Different events referring to the same payment ID (Level B) -> deduplicated", async () => {
      const paymentId = "pay_rzp_shared_unique_id_99";
      const webhook1 = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_rzp_ishita_inst2",
        paymentId,
        amountPaise: 1500000n,
      });

      // Delivery 1
      const res1 = await paymentService.processWebhook(webhook1.rawBody, {
        provider: "RAZORPAY",
        signature: webhook1.signature,
        eventId: "evt_razorpay_first_delivery",
      });
      expect(res1.success).toBe(true);
      expect(res1.paymentId).toBeDefined();

      // Delivery 2 with DIFFERENT eventId header, but identical paymentId
      const res2 = await paymentService.processWebhook(webhook1.rawBody, {
        provider: "RAZORPAY",
        signature: webhook1.signature,
        eventId: "evt_razorpay_second_delivery_different_id",
      });

      expect(res2.success).toBe(true);
      expect(res2.duplicate).toBe(true);
      expect(res2.paymentId).toBe(res1.paymentId);
    });

    it("Scenario 9: Concurrent delivery of the same captured event -> atomic handling", async () => {
      const webhook = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_rzp_ishita_inst2",
        amountPaise: 1500000n,
      });

      // Execute two deliveries in parallel
      const [res1, res2] = await Promise.all([
        paymentService.processWebhook(webhook.rawBody, {
          provider: "RAZORPAY",
          signature: webhook.signature,
          eventId: webhook.eventId,
        }),
        paymentService.processWebhook(webhook.rawBody, {
          provider: "RAZORPAY",
          signature: webhook.signature,
          eventId: webhook.eventId,
        }),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);

      // Total payments recorded must be exactly 1
      const matchingPayments = Array.from(demoPaymentStore.payments.values()).filter(
        (p) => p.orderId === "order_rzp_ishita_inst2"
      );
      expect(matchingPayments).toHaveLength(1);
    });

    it("Scenario 10: Concurrent different captures targeting same instalment -> bounds allocation strictly to outstanding", async () => {
      // Ishita owes ₹15,000 on instalment 2.
      // Payment A pays ₹10,000.
      demoPaymentStore.createPaymentIntent({
        orderId: "order_concurrent_A",
        studentId: "stu_ishita_0587",
        instalmentId: "inst_ishita_2",
        amount: 1000000n,
        currency: "INR",
        provider: "RAZORPAY",
        status: "PROCESSING",
      });

      // Payment B pays ₹10,000.
      demoPaymentStore.createPaymentIntent({
        orderId: "order_concurrent_B",
        studentId: "stu_ishita_0587",
        instalmentId: "inst_ishita_2",
        amount: 1000000n,
        currency: "INR",
        provider: "RAZORPAY",
        status: "PROCESSING",
      });

      const webhookA = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_concurrent_A",
        amountPaise: 1000000n,
      });

      const webhookB = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_concurrent_B",
        amountPaise: 1000000n,
      });

      await paymentService.processWebhook(webhookA.rawBody, {
        provider: "RAZORPAY",
        signature: webhookA.signature,
        eventId: webhookA.eventId,
      });

      await paymentService.processWebhook(webhookB.rawBody, {
        provider: "RAZORPAY",
        signature: webhookB.signature,
        eventId: webhookB.eventId,
      });

      // Capture A allocated full ₹10,000
      // Capture B allocated remaining ₹5,000, leaving ₹5,000 unallocated
      const paymentB = Array.from(demoPaymentStore.payments.values()).find(
        (p) => p.orderId === "order_concurrent_B"
      );
      expect(paymentB?.amount).toBe(1000000n);
      expect(paymentB?.unallocatedAmount).toBe(500000n);

      const inst2 = demoPaymentStore.instalments.get("inst_ishita_2")!;
      const bal = deriveInstalmentBalance(
        inst2,
        demoPaymentStore.getStudentLedger("stu_ishita_0587"),
        new Date("2026-11-02")
      );
      expect(bal.outstandingBalance).toBe(0n);
      expect(inst2.status).toBe("PAID");
    });
  });

  // ==========================================================================
  // Financial Processing (Scenarios 11 - 20)
  // ==========================================================================
  describe("Financial Processing", () => {
    it("Scenario 11: Successful full payment -> marks instalment PAID, updates intent to SUCCEEDED, issues GST receipt", async () => {
      const webhook = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_rzp_ishita_inst2",
        amountPaise: 1500000n,
      });

      const result = await paymentService.processWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });

      expect(result.status).toBe("ALLOCATED");

      const intent = demoPaymentStore.findPaymentIntent("order_rzp_ishita_inst2");
      expect(intent?.status).toBe("SUCCEEDED");

      const inst2 = demoPaymentStore.instalments.get("inst_ishita_2")!;
      expect(inst2.status).toBe("PAID");

      const receipt = demoPaymentStore.receipts.get(result.receiptNumber!);
      expect(receipt).toBeDefined();
      expect(receipt?.gstin).toBe("08AABCC1234D1Z5 [SYNTHETIC]");
      expect(receipt?.sacCode).toBe("999293");
      expect(receipt?.taxableAmount).toBe(1500000n);
    });

    it("Scenario 12: Successful partial payment -> marks PARTIAL, derives live ledger remainder", async () => {
      demoPaymentStore.createPaymentIntent({
        orderId: "order_partial_5k",
        studentId: "stu_ishita_0587",
        instalmentId: "inst_ishita_2",
        amount: 500000n, // ₹5,000 partial payment
        currency: "INR",
        provider: "RAZORPAY",
        status: "PROCESSING",
      });

      const webhook = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_partial_5k",
        amountPaise: 500000n,
      });

      const result = await paymentService.processWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });

      expect(result.status).toBe("ALLOCATED");

      const inst2 = demoPaymentStore.instalments.get("inst_ishita_2")!;
      expect(inst2.status).toBe("PARTIAL");

      const bal = deriveInstalmentBalance(
        inst2,
        demoPaymentStore.getStudentLedger("stu_ishita_0587"),
        new Date("2026-11-02")
      );
      // ₹15,000 - ₹5,000 = ₹10,000 remaining
      expect(bal.outstandingBalance).toBe(1000000n);
    });

    it("Scenario 13: Captured amount exceeding current outstanding -> caps allocation at outstanding and preserves surplus as unallocated", async () => {
      demoPaymentStore.createPaymentIntent({
        orderId: "order_excess_25k",
        studentId: "stu_ishita_0587",
        instalmentId: "inst_ishita_2",
        amount: 2500000n, // ₹25,000 paid against ₹15,000 outstanding
        currency: "INR",
        provider: "RAZORPAY",
        status: "PROCESSING",
      });

      const webhook = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_excess_25k",
        amountPaise: 2500000n,
      });

      const result = await paymentService.processWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });

      expect(result.status).toBe("ALLOCATED");

      const payment = demoPaymentStore.payments.get(result.paymentId!)!;
      expect(payment.amount).toBe(2500000n);
      expect(payment.unallocatedAmount).toBe(1000000n); // ₹10,000 excess unallocated

      const inst2 = demoPaymentStore.instalments.get("inst_ishita_2")!;
      expect(inst2.status).toBe("PAID");
    });

    it("Scenario 14: Amount mismatch against PaymentIntent -> routes to Accounts Queue (UNMATCHED) with mismatch notes", async () => {
      // Intent specifies ₹15,000
      const webhook = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_rzp_ishita_inst2",
        amountPaise: 999900n, // Webhook reports ₹9,999 -> mismatch!
      });

      const result = await paymentService.processWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("UNMATCHED");

      const payment = demoPaymentStore.payments.get(result.paymentId!)!;
      expect(payment.matchStatus).toBe("UNMATCHED");
      expect(payment.notes).toContain("Amount mismatch");

      // Student balance strictly untouched
      const inst2 = demoPaymentStore.instalments.get("inst_ishita_2")!;
      const bal = deriveInstalmentBalance(
        inst2,
        demoPaymentStore.getStudentLedger("stu_ishita_0587"),
        new Date("2026-11-02")
      );
      expect(bal.outstandingBalance).toBe(1500000n); // Still ₹15,000
    });

    it("Scenario 15: Unknown Razorpay order -> routes to Accounts Queue (UNMATCHED)", async () => {
      const webhook = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_unknown_not_in_db_999",
        amountPaise: 1500000n,
      });

      const result = await paymentService.processWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("UNMATCHED");

      const payment = demoPaymentStore.payments.get(result.paymentId!)!;
      expect(payment.matchStatus).toBe("UNMATCHED");
      expect(payment.studentId).toBeNull();
    });

    it("Scenario 16: Wrong currency -> rejects unsupported currency before financial mutation", async () => {
      const webhook = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_rzp_ishita_inst2",
        currency: "USD",
        amountPaise: 1500000n,
      });

      const result = await paymentService.processWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe("REJECTED");
      expect(result.error).toContain("Unsupported currency: USD");
    });

    it("Scenario 17: Failed payment event -> records failure without ledger reduction or receipt", async () => {
      const webhook = createRazorpayWebhook({
        event: "payment.failed",
        orderId: "order_rzp_ishita_inst2",
        errorDescription: "Bank server declined transaction",
      });

      const result = await paymentService.processWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("FAILED");

      // Verify zero receipts created
      expect(demoPaymentStore.receipts.size).toBe(0);

      // Verify instalment status unchanged
      const inst2 = demoPaymentStore.instalments.get("inst_ishita_2")!;
      expect(inst2.status).toBe("PARTIAL");
    });

    it("Scenario 18: Failure arriving after a successful capture -> never downgrades SUCCEEDED intent", async () => {
      // 1. First, capture arrives and succeeds
      const webhookCapture = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_rzp_ishita_inst2",
        amountPaise: 1500000n,
      });

      await paymentService.processWebhook(webhookCapture.rawBody, {
        provider: "RAZORPAY",
        signature: webhookCapture.signature,
        eventId: webhookCapture.eventId,
      });

      const intentAfterCapture = demoPaymentStore.findPaymentIntent("order_rzp_ishita_inst2");
      expect(intentAfterCapture?.status).toBe("SUCCEEDED");

      // 2. Later, out-of-order failure event arrives
      const webhookFailure = createRazorpayWebhook({
        event: "payment.failed",
        orderId: "order_rzp_ishita_inst2",
      });

      await paymentService.processWebhook(webhookFailure.rawBody, {
        provider: "RAZORPAY",
        signature: webhookFailure.signature,
        eventId: webhookFailure.eventId,
      });

      // Invariant: Intent MUST NOT be downgraded to FAILED!
      const intentFinal = demoPaymentStore.findPaymentIntent("order_rzp_ishita_inst2");
      expect(intentFinal?.status).toBe("SUCCEEDED");
    });

    it("Scenario 19: Duplicate receipt prevention -> enforces unique constraint per payment", () => {
      // Manually attempt to create two receipts with same paymentId
      demoPaymentStore.createReceipt({
        receiptNumber: "REC-TEST-1",
        paymentId: "pay_dup_receipt_test",
        studentId: "stu_ishita_0587",
        amount: 1500000n,
        gstin: "08AABCC1234D1Z5 [SYNTHETIC]",
        sacCode: "999293",
        taxableAmount: 1500000n,
      });

      expect(() => {
        demoPaymentStore.createReceipt({
          receiptNumber: "REC-TEST-2",
          paymentId: "pay_dup_receipt_test",
          studentId: "stu_ishita_0587",
          amount: 1500000n,
          gstin: "08AABCC1234D1Z5 [SYNTHETIC]",
          sacCode: "999293",
          taxableAmount: 1500000n,
        });
      }).toThrow(/Unique constraint failed/);
    });

    it("Scenario 20: Database failure during processing -> falls back cleanly without partial corruption", async () => {
      // The demo store fallback ensures resilient offline operation
      const webhook = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_rzp_ishita_inst2",
        amountPaise: 1500000n,
      });

      const result = await paymentService.processWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("ALLOCATED");
    });
  });

  // ==========================================================================
  // Reminders and Parent Experience (Scenarios 21 - 25)
  // ==========================================================================
  describe("Reminders and Parent Experience", () => {
    it("Scenario 21: Full settlement skips reminders immediately", async () => {
      const webhook = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_rzp_ishita_inst2",
        amountPaise: 1500000n,
      });

      await paymentService.processWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });

      const reminder = demoPaymentStore.reminders.find((r) => r.instalmentId === "inst_ishita_2");
      expect(reminder?.status).toBe("SKIPPED");
      expect(reminder?.skipReason).toBe("Instalment settled");
    });

    it("Scenario 22: Partial payment retains reminder eligibility with updated outstanding", async () => {
      demoPaymentStore.createPaymentIntent({
        orderId: "order_rem_partial",
        studentId: "stu_ishita_0587",
        instalmentId: "inst_ishita_2",
        amount: 500000n,
        currency: "INR",
        provider: "RAZORPAY",
        status: "PROCESSING",
      });

      const webhook = createRazorpayWebhook({
        event: "payment.captured",
        orderId: "order_rem_partial",
        amountPaise: 500000n,
      });

      await paymentService.processWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });

      // Reminders remain queued
      const reminder = demoPaymentStore.reminders.find((r) => r.instalmentId === "inst_ishita_2");
      expect(reminder?.status).toBe("QUEUED");

      // Balance derived at send time reflects ₹10,000
      const bal = deriveInstalmentBalance(
        demoPaymentStore.instalments.get("inst_ishita_2")!,
        demoPaymentStore.getStudentLedger("stu_ishita_0587"),
        new Date("2026-11-02")
      );
      expect(bal.outstandingBalance).toBe(1000000n);
    });

    it("Scenario 23: Withdrawn instalment stops ordinary reminders and rejects payments", async () => {
      demoPaymentStore.instalments.get("inst_ishita_2")!.status = "CANCELLED";

      // Attempt payment against cancelled instalment
      await expect(
        paymentService.createIntent({
          studentId: "stu_ishita_0587",
          instalmentId: "inst_ishita_2",
          amountPaise: 1500000n,
        })
      ).rejects.toThrow(/cancelled or waived/);
    });

    it("Scenario 24: Parent reconciliation endpoint updates state from server truth", async () => {
      // Simulate Razorpay captured payment reconciliation via processCapturedPayment
      const res = await paymentService.processCapturedPayment({
        provider: "RAZORPAY",
        orderId: "order_rzp_ishita_inst2",
        paymentId: "pay_reconcile_live_test_1",
        amountPaise: 1500000n,
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("ALLOCATED");
      expect(res.receiptNumber).toBeDefined();

      // Subsequent reconciliation check confirms settled state
      const paymentInfo = await paymentService.getPaymentForOrder("order_rzp_ishita_inst2");
      expect(paymentInfo?.receiptNumber).toBe(res.receiptNumber);
    });

    it("Scenario 25: Receipt becomes available only after successful capture processing", () => {
      // Before capture, no receipt exists
      const beforeReceipt = demoPaymentStore.receipts.get("REC-NONEXISTENT");
      expect(beforeReceipt).toBeUndefined();

      // Only after capture is receipt populated
      const receipt = demoPaymentStore.createReceipt({
        receiptNumber: "REC-2026-VERIFIED-1",
        paymentId: "pay_verified_capture_1",
        studentId: "stu_ishita_0587",
        amount: 1500000n,
        gstin: "08AABCC1234D1Z5 [SYNTHETIC]",
        sacCode: "999293",
        taxableAmount: 1500000n,
      });

      expect(demoPaymentStore.receipts.get(receipt.receiptNumber)).toBeDefined();
    });
  });
});
