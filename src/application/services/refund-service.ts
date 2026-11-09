/**
 * Refund and Withdrawal Service for FeeFlow.
 * Aligned with Ministry of Education (MoE) January 2024 Guidelines,
 * Rajasthan Coaching Act 2024, and Milestones 4A & 4B specifications.
 *
 * Hard Financial & Architectural Invariants:
 * 1. Inclusive calendar days: T = days(E) - days(S) + 1, c = clamp(days(W) - days(S) + 1, 0, T).
 * 2. All money in integer paise (BigInt); zero floating-point arithmetic.
 * 3. Fixed deduction = 0, percentage deduction = 0 bps.
 * 4. Part-paid shortfall (earned > paid) is strictly INFORMATIONAL ONLY (styled in neutral slate #505A66).
 *    Zero collectible debt, zero payment requests, zero collection reminders.
 * 5. Strict Maker-Checker: approverId !== requesterId. Director approves; Accounts requests.
 * 6. Append-only ledger rebase: Approved withdrawal waives unpaid ordinary instalments to ₹0
 *    via negative signed WAIVER ledger entries with referenceType: 'WITHDRAWAL_REBASE'.
 * 7. Waived instalments are marked CANCELLED, and queued reminders are marked SKIPPED.
 * 8. Multi-item refund attribution capped strictly by each captured payment's unrefunded amount.
 * 9. Milestone 4B: Razorpay Normal Refund API integration with X-Refund-Idempotency,
 *    durable ProviderEvent intake, webhook processing, server-side reconciliation, and aggregate status.
 */

import { prisma } from "@/infrastructure/db/prisma";
import {
  calculateProRataRefund,
  planRefundItems,
  generateWithdrawalWaivers,
  validateMakerChecker,
  RefundCalculationResult,
} from "@/domain/refunds";
import { deriveStudentLedgerSummary, deriveInstalmentBalance } from "@/domain/ledger";
import { Actor, canActorAccessStudent } from "@/application/actor";
import {
  RefundProvider,
  defaultRefundProvider,
  getRefundProvider,
  MockRefundProvider,
  RazorpayRefundProvider,
} from "@/infrastructure/refunds/refund-provider";
import { verifyRazorpayWebhookSignature } from "@/infrastructure/payments/payment-provider";
import { demoPaymentStore } from "@/infrastructure/db/demo-payment-store";
import { findDemoUserByEmail } from "@/infrastructure/db/demo-data";
import { financialLock } from "@/application/services/payment-service";

export interface WithdrawalCaseSummary {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  batch: string;
  centre: string;
  centreId: string;
  pathway: "STATUTORY_FULL_PAID" | "PART_PAID_EXTENSION";
  requestedDate: string;
  effectiveDate: string;
  consumedDays: number;
  totalServiceDays: number;
  netFeePaise: bigint;
  paidPaise: bigint;
  earnedPaise: bigint;
  refundPaise: bigint;
  shortfallPaise: bigint;
  status: "DRAFT" | "REQUESTED" | "APPROVED" | "REJECTED" | "EXECUTED";
  aggregateRefundStatus?: "PENDING_EXECUTION" | "PROCESSING" | "COMPLETED" | "PARTIALLY_REFUNDED" | "FAILED";
  requesterId: string;
  makerName: string;
  makerRole: string;
  approverId?: string | null;
  checkerName?: string | null;
  checkerRole?: string | null;
  approvalNotes?: string | null;
  items?: {
    id: string;
    paymentId: string;
    paymentRef: string;
    amountPaise: bigint;
    method: string;
    status: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";
    providerRef?: string | null;
    failureReason?: string | null;
    createdAt?: string;
    retryEligible?: boolean;
  }[];
}

/**
 * Derives the aggregate parent Refund status according to Milestone 4B Section 7 rules:
 * - All items successfully processed: COMPLETED
 * - Some items processed and others still pending or failed: PARTIALLY_REFUNDED
 * - No items processed and some are still processing: PROCESSING
 * - No items processed and every item has definitively failed: FAILED
 * - No items processed and all approved items are awaiting execution: PENDING_EXECUTION
 */
export type AggregateRefundStatus =
  | "PENDING_EXECUTION"
  | "PROCESSING"
  | "PARTIALLY_REFUNDED"
  | "COMPLETED"
  | "FAILED";

/**
 * Derives aggregate status of a parent Refund from its child RefundItems.
 * State Rules (Milestone 4B):
 * 1. All RefundItems SUCCEEDED → Parent Refund COMPLETED.
 * 2. At least one RefundItem SUCCEEDED, while any other item is PENDING, PROCESSING or FAILED → PARTIALLY_REFUNDED.
 * 3. No successful items, but at least one item PROCESSING → PROCESSING.
 * 4. No successful or processing items, all items FAILED → FAILED.
 * 5. All approved items awaiting execution → PENDING_EXECUTION.
 */
export function deriveRefundAggregateStatus(
  items: { status: string }[]
): {
  dbStatus: AggregateRefundStatus;
  presentationStatus: AggregateRefundStatus;
} {
  if (!items || items.length === 0) {
    return { dbStatus: "PENDING_EXECUTION", presentationStatus: "PENDING_EXECUTION" };
  }

  const allSucceeded = items.every((it) => it.status === "SUCCEEDED");
  const anySucceeded = items.some((it) => it.status === "SUCCEEDED");
  const anyProcessing = items.some((it) => it.status === "PROCESSING");
  const allFailed = items.every((it) => it.status === "FAILED");

  // Rule 1: All RefundItems SUCCEEDED → Parent Refund COMPLETED
  if (allSucceeded) {
    return { dbStatus: "COMPLETED", presentationStatus: "COMPLETED" };
  }

  // Rule 2: At least one RefundItem SUCCEEDED, while any other item is PENDING, PROCESSING or FAILED → PARTIALLY_REFUNDED
  if (anySucceeded) {
    return { dbStatus: "PARTIALLY_REFUNDED", presentationStatus: "PARTIALLY_REFUNDED" };
  }

  // Rule 3: No successful items, but at least one item PROCESSING → PROCESSING
  if (anyProcessing) {
    return { dbStatus: "PROCESSING", presentationStatus: "PROCESSING" };
  }

  // Rule 4: No successful or processing items, all items FAILED → FAILED
  if (allFailed) {
    return { dbStatus: "FAILED", presentationStatus: "FAILED" };
  }

  // Rule 5: All approved items awaiting execution → PENDING_EXECUTION
  return { dbStatus: "PENDING_EXECUTION", presentationStatus: "PENDING_EXECUTION" };
}

export class RefundService {
  constructor(private readonly refundProvider: RefundProvider = getRefundProvider()) {}

  /**
   * Retrieves active or specific refund policy with cryptographic hash and MoE 2024 terms.
   */
  async getRefundPolicy(version?: string) {
    try {
      const policy = await prisma.refundPolicy.findFirst({
        where: version ? { version } : { isActive: true },
        orderBy: { createdAt: "desc" },
      });
      if (policy) return policy;
    } catch {
      // Offline fallback
    }

    return {
      id: "pol_v1_statutory",
      version: "v1.0",
      policyHash: "7c3a88bf0a012d9e6e01a5b82098d41e739ad005fbcba72513a890989ad65e91",
      policyJson: JSON.stringify({
        guideline: "Ministry of Education (MoE) January 2024 Guidelines",
        stateCompliance: "Rajasthan Coaching Institutes (Control and Regulation) Act 2024",
        rules: "Inclusive calendar-day pro-rata proration: T = days(E) - days(S) + 1, c = clamp(days(W) - days(S) + 1, 0, T)",
        fixedDeductionPaise: "0",
        percentageDeductionBps: 0,
        slaDays: 10,
        shortfallTreatment: "INFORMATIONAL_ONLY",
      }),
      effectiveFrom: new Date("2024-01-16T00:00:00Z"),
      isActive: true,
    };
  }

  /**
   * Previews a pro-rata withdrawal quote without persisting any database records.
   */
  async previewWithdrawalCalculation(params: {
    studentId: string;
    effectiveWithdrawalDate: Date | string;
    actor: Actor;
  }): Promise<{
    student: { id: string; name: string; code: string; batch: string; centre: string };
    calculation: RefundCalculationResult;
  }> {
    const { studentId, effectiveWithdrawalDate, actor } = params;

    let student: any = null;
    try {
      student = await prisma.student.findFirst({
        where: {
          OR: [{ id: studentId }, { studentCode: studentId }],
        },
        include: {
          batch: true,
          centre: true,
          feePlans: {
            where: { status: "ACTIVE" },
            include: { instalments: { orderBy: { sequence: "asc" } } },
          },
          ledgerEntries: true,
        },
      });
    } catch {
      // Prisma offline handled below
    }

    // Fallback resolution for testing & offline mode
    if (!student) {
      const isIshita = studentId.toLowerCase().includes("ishita") || studentId.includes("0587");
      const isKavya = studentId.toLowerCase().includes("kavya") || studentId.includes("1038");

      if (isIshita) {
        student = {
          id: "stu_ishita_0587",
          studentCode: "STU-0587",
          name: "Ishita Sharma",
          centreId: "cen_vaishali",
          centre: { id: "cen_vaishali", name: "Vaishali Nagar" },
          batch: { name: "JEE 2027 Evening" },
          feePlans: [
            {
              id: "plan_ishita_jee",
              netAmount: 12000000n,
              serviceStartDate: new Date("2026-06-15T00:00:00Z"),
              serviceEndDate: new Date("2027-03-31T00:00:00Z"),
              status: "ACTIVE",
              instalments: demoPaymentStore.getStudentInstalments("stu_ishita_0587"),
            },
          ],
          ledgerEntries: demoPaymentStore.getStudentLedger("stu_ishita_0587"),
        };
      } else if (isKavya) {
        student = {
          id: "stu_kavya_1038",
          studentCode: "STU-1038",
          name: "Kavya Rathore",
          centreId: "cen_tonk",
          centre: { id: "cen_tonk", name: "Tonk Road" },
          batch: { name: "NEET 2027 Morning" },
          feePlans: [
            {
              id: "plan_kavya_neet",
              netAmount: 12000000n,
              serviceStartDate: new Date("2026-06-15T00:00:00Z"),
              serviceEndDate: new Date("2027-03-31T00:00:00Z"),
              status: "ACTIVE",
              instalments: demoPaymentStore.getStudentInstalments("stu_kavya_1038"),
            },
          ],
          ledgerEntries: demoPaymentStore.getStudentLedger("stu_kavya_1038"),
        };
      }
    }

    if (!student) {
      throw new Error(`Student ${studentId} not found`);
    }

    // Role-based centre scoping check
    if (!canActorAccessStudent(actor, { id: student.id, centreId: student.centreId })) {
      throw new Error("Permission denied: Student is outside your assigned centre scope");
    }

    const activePlan = student.feePlans?.[0];
    if (!activePlan) {
      throw new Error(`Student ${student.studentCode} has no active fee plan`);
    }

    const summary = deriveStudentLedgerSummary(
      student.id,
      activePlan.instalments.map((i: any) => ({
        id: i.id,
        feePlanId: i.feePlanId,
        sequence: i.sequence,
        dueDate: i.dueDate,
        amount: i.amount,
      })),
      student.ledgerEntries.map((e: any) => ({ ...e, amount: BigInt(e.amount) })),
      new Date()
    );

    const calculation = calculateProRataRefund({
      netFee: BigInt(activePlan.netAmount),
      totalPaid: summary.totalPaid,
      serviceStartDate: activePlan.serviceStartDate,
      serviceEndDate: activePlan.serviceEndDate,
      effectiveWithdrawalDate: new Date(effectiveWithdrawalDate),
    });

    return {
      student: {
        id: student.id,
        name: student.name,
        code: student.studentCode,
        batch: student.batch?.name || "Standard Batch",
        centre: student.centre?.name || "Main Centre",
      },
      calculation,
    };
  }

  /**
   * Creates a formal withdrawal request quote (status: REQUESTED).
   * Maker: Must be ACCOUNTS or DIRECTOR.
   */
  async createWithdrawalRequest(params: {
    studentId: string;
    effectiveWithdrawalDate: Date | string;
    requestDate?: Date | string;
    notes?: string;
    actor: Actor;
  }) {
    const { studentId, effectiveWithdrawalDate, notes, actor } = params;
    const requestDate = params.requestDate ? new Date(params.requestDate) : new Date();

    if (actor.role !== "ACCOUNTS" && actor.role !== "DIRECTOR") {
      throw new Error("Unauthorized: Only Accounts or Director can create a withdrawal request");
    }

    let student: any = null;
    try {
      student = await prisma.student.findFirst({
        where: {
          OR: [{ id: studentId }, { studentCode: studentId }],
        },
        include: {
          batch: true,
          centre: true,
          feePlans: {
            where: { status: "ACTIVE" },
            include: { instalments: { orderBy: { sequence: "asc" } } },
          },
          ledgerEntries: true,
          withdrawals: {
            where: {
              status: { in: ["REQUESTED", "DRAFT", "APPROVED"] },
            },
          },
        },
      });
    } catch {
      // Prisma offline handled below
    }

    if (!student) {
      const isIshita = studentId.toLowerCase().includes("ishita") || studentId.includes("0587");
      if (isIshita) {
        student = {
          id: "stu_ishita_0587",
          studentCode: "STU-0587",
          name: "Ishita Sharma",
          status: "ACTIVE",
          centreId: "cen_vaishali",
          centre: { id: "cen_vaishali", name: "Vaishali Nagar" },
          batch: { name: "JEE 2027 Evening" },
          feePlans: [
            {
              id: "plan_ishita_jee",
              netAmount: 12000000n,
              serviceStartDate: new Date("2026-06-15T00:00:00Z"),
              serviceEndDate: new Date("2027-03-31T00:00:00Z"),
              status: "ACTIVE",
              instalments: demoPaymentStore.getStudentInstalments("stu_ishita_0587"),
            },
          ],
          ledgerEntries: demoPaymentStore.getStudentLedger("stu_ishita_0587"),
          withdrawals: [],
        };
      }
    }

    if (!student) {
      throw new Error(`Student ${studentId} not found`);
    }

    // Role-based centre scoping check
    if (!canActorAccessStudent(actor, { id: student.id, centreId: student.centreId })) {
      throw new Error("Permission denied: Student is outside your assigned centre scope");
    }

    if (student.status === "WITHDRAWN") {
      throw new Error("Student is already marked as withdrawn");
    }

    const activePlan = student.feePlans?.[0];
    if (!activePlan) {
      throw new Error(`Student ${student.studentCode} has no active fee plan`);
    }

    // Check for existing pending request
    const existingOpen = (student.withdrawals || []).find(
      (w: any) => w.status === "REQUESTED" || w.status === "DRAFT"
    );
    if (existingOpen) {
      throw new Error(`A pending withdrawal request (${existingOpen.id}) already exists for this student`);
    }

    const summary = deriveStudentLedgerSummary(
      student.id,
      activePlan.instalments.map((i: any) => ({
        id: i.id,
        feePlanId: i.feePlanId,
        sequence: i.sequence,
        dueDate: i.dueDate,
        amount: i.amount,
      })),
      student.ledgerEntries.map((e: any) => ({ ...e, amount: BigInt(e.amount) })),
      requestDate
    );

    const calc = calculateProRataRefund({
      netFee: BigInt(activePlan.netAmount),
      totalPaid: summary.totalPaid,
      serviceStartDate: activePlan.serviceStartDate,
      serviceEndDate: activePlan.serviceEndDate,
      effectiveWithdrawalDate: new Date(effectiveWithdrawalDate),
    });

    const slaTargetDate = new Date(requestDate.getTime() + 10 * 24 * 60 * 60 * 1000);

    try {
      const withdrawal = await prisma.withdrawal.create({
        data: {
          studentId: student.id,
          requestDate,
          effectiveWithdrawalDate: new Date(effectiveWithdrawalDate),
          consumedDays: calc.consumedDays,
          totalServiceDays: calc.totalServiceDays,
          netFee: calc.netFee,
          totalPaid: calc.totalPaid,
          earnedFee: calc.earnedFee,
          deductionAmount: 0n,
          potentialRefund: calc.potentialRefund,
          indicativeShortfall: calc.indicativeShortfall,
          slaTargetDate,
          status: "REQUESTED",
          requesterId: actor.userId,
          approvalNotes: notes || "Pro-rata withdrawal quote submitted for director review",
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          actorId: actor.userId,
          actorEmail: actor.email || actor.name,
          actorRole: actor.role,
          action: "WITHDRAWAL_REQUEST",
          entityType: "Withdrawal",
          entityId: withdrawal.id,
          centreId: student.centreId,
          reason: notes || "Submitted withdrawal request for Director review",
          afterJson: JSON.stringify({
            withdrawalId: withdrawal.id,
            studentId: student.id,
            potentialRefundPaise: calc.potentialRefund.toString(),
            shortfallPaise: calc.indicativeShortfall.toString(),
          }),
        },
      });

      return { withdrawal, calculation: calc };
    } catch {
      // In-memory demo store fallback
      const withdrawal = demoPaymentStore.createWithdrawal({
        studentId: student.id,
        requestDate,
        effectiveWithdrawalDate: new Date(effectiveWithdrawalDate),
        consumedDays: calc.consumedDays,
        totalServiceDays: calc.totalServiceDays,
        netFee: calc.netFee,
        totalPaid: calc.totalPaid,
        earnedFee: calc.earnedFee,
        deductionAmount: 0n,
        potentialRefund: calc.potentialRefund,
        indicativeShortfall: calc.indicativeShortfall,
        slaTargetDate,
        status: "REQUESTED",
        requesterId: actor.userId,
        approvalNotes: notes || "Pro-rata withdrawal quote submitted for director review",
      });

      return { withdrawal, calculation: calc };
    }
  }

  /**
   * Reviews and decides on a withdrawal request (APPROVED or REJECTED).
   * Checker: Must be DIRECTOR.
   * HARD INVARIANTS:
   * 1. validateMakerChecker(withdrawal.requesterId, actor.userId).
   * 2. Section 10 Scope check: only mark Student WITHDRAWN if no other active FeePlans exist.
   */
  async reviewWithdrawal(params: {
    withdrawalId: string;
    decision: "APPROVED" | "REJECTED";
    notes?: string;
    actor: Actor;
  }) {
    const { withdrawalId, decision, notes, actor } = params;

    // Checker check: Only Director role can approve/reject
    if (actor.role !== "DIRECTOR") {
      throw new Error("Unauthorized: Only Founder-Director can approve or reject withdrawals");
    }

    let withdrawal: any = null;
    try {
      withdrawal = await prisma.withdrawal.findUnique({
        where: { id: withdrawalId },
        include: {
          student: {
            include: {
              centre: true,
              feePlans: {
                where: { status: "ACTIVE" },
                include: { instalments: { orderBy: { sequence: "asc" } } },
              },
              ledgerEntries: true,
              payments: {
                where: { status: "CAPTURED" },
                include: { refundItems: true },
                orderBy: { paymentDate: "desc" },
              },
            },
          },
        },
      });
    } catch {
      // DB offline handled below
    }

    // In-memory fallback if not in DB
    if (!withdrawal) {
      const demoWd = demoPaymentStore.getWithdrawal(withdrawalId);
      if (demoWd) {
        const studentIshita = demoWd.studentId === "stu_ishita_0587";
        withdrawal = {
          ...demoWd,
          student: {
            id: demoWd.studentId,
            studentCode: studentIshita ? "STU-0587" : "STU-1038",
            name: studentIshita ? "Ishita Sharma" : "Kavya Rathore",
            centreId: studentIshita ? "cen_vaishali" : "cen_tonk",
            feePlans: [
              {
                id: studentIshita ? "plan_ishita_jee" : "plan_kavya_neet",
                status: "ACTIVE",
                instalments: demoPaymentStore.getStudentInstalments(demoWd.studentId),
              },
            ],
            ledgerEntries: demoPaymentStore.getStudentLedger(demoWd.studentId),
            payments: Array.from(demoPaymentStore.payments.values()).filter(
              (p) => p.studentId === demoWd.studentId && p.status === "CAPTURED"
            ),
          },
        };
      }
    }

    if (!withdrawal) {
      throw new Error(`Withdrawal request ${withdrawalId} not found`);
    }

    // Check status
    if (withdrawal.status === "APPROVED") {
      throw new Error("Withdrawal has already been approved");
    }
    if (withdrawal.status === "REJECTED") {
      throw new Error("Withdrawal has already been rejected");
    }
    if (withdrawal.status === "EXECUTED") {
      throw new Error("Withdrawal has already been executed");
    }

    // HARD INVARIANT: Maker-Checker Enforcement
    const makerChecker = validateMakerChecker(withdrawal.requesterId, actor.userId);
    if (!makerChecker.allowed) {
      throw new Error(
        makerChecker.error || "Maker-checker violation: Requester cannot approve their own request"
      );
    }

    const student = withdrawal.student;
    const activePlan = student.feePlans?.[0];

    try {
      // Run interactive Prisma transaction with high tolerance for Supabase cloud latency
      const result = await prisma.$transaction(
        async (tx) => {
          // 1. Update Withdrawal status
          const updatedWd = await tx.withdrawal.update({
            where: { id: withdrawal.id },
            data: {
              status: decision,
              approverId: actor.userId,
              approvedAt: new Date(),
              approvalNotes: notes || withdrawal.approvalNotes,
            },
          });

          if (decision === "REJECTED") {
            await tx.auditLog.create({
              data: {
                actorId: actor.userId,
                actorEmail: actor.email || actor.name,
                actorRole: actor.role,
                action: "WITHDRAWAL_REJECT",
                entityType: "Withdrawal",
                entityId: withdrawal.id,
                centreId: student.centreId,
                reason: notes || "Director rejected withdrawal quote",
              },
            });
            return { withdrawal: updatedWd, status: "REJECTED" };
          }

          // 2. Mark specific active fee plan WITHDRAWN
          if (activePlan) {
            await tx.feePlan.update({
              where: { id: activePlan.id },
              data: { status: "WITHDRAWN" },
            });

            // Section 10: Preserve Student status ACTIVE if other active fee plans exist for this student
            const remainingActivePlans = await tx.feePlan.count({
              where: {
                studentId: student.id,
                id: { not: activePlan.id },
                status: "ACTIVE",
              },
            });

            if (remainingActivePlans === 0) {
              await tx.student.update({
                where: { id: student.id },
                data: { status: "WITHDRAWN" },
              });
            }

            // 3. Derive instalment balances and generate WAIVER ledger entries
            const instalmentsWithBalance = activePlan.instalments.map((inst: any) => {
              const bal = deriveInstalmentBalance(
                {
                  id: inst.id,
                  feePlanId: inst.feePlanId,
                  sequence: inst.sequence,
                  dueDate: inst.dueDate,
                  amount: inst.amount,
                },
                student.ledgerEntries.map((e: any) => ({ ...e, amount: BigInt(e.amount) })),
                new Date()
              );
              return {
                id: inst.id,
                sequence: inst.sequence,
                outstandingBalance: bal.outstandingBalance,
              };
            });

            const waivers = generateWithdrawalWaivers(
              student.id,
              withdrawal.id,
              instalmentsWithBalance,
              withdrawal.effectiveWithdrawalDate
            );

            for (const w of waivers) {
              if (w.instalmentId) {
                await tx.ledgerEntry.create({
                  data: {
                    studentId: student.id,
                    instalmentId: w.instalmentId,
                    entryType: "WAIVER",
                    amount: w.amount, // Negative signed paise
                    entryDate: new Date(),
                    referenceType: "WITHDRAWAL_REBASE",
                    referenceId: withdrawal.id,
                    createdById: actor.userId,
                    notes: w.notes,
                  },
                });

                // Mark waived instalment CANCELLED
                await tx.instalment.update({
                  where: { id: w.instalmentId },
                  data: { status: "CANCELLED" },
                });

                // Suppress queued reminders
                await tx.reminderDispatch.updateMany({
                  where: {
                    instalmentId: w.instalmentId,
                    status: "QUEUED",
                  },
                  data: {
                    status: "SKIPPED",
                    skipReason: "Student withdrawn - ordinary dues waived to ₹0",
                  },
                });
              }
            }
          }

          // 4. If potential refund > 0, create Refund and plan RefundItems
          let refundRecord: any = null;
          if (withdrawal.potentialRefund > 0n) {
            refundRecord = await tx.refund.create({
              data: {
                studentId: student.id,
                withdrawalId: withdrawal.id,
                totalApprovedAmount: withdrawal.potentialRefund,
                status: "PENDING_EXECUTION",
              },
            });

            const eligiblePayments = (student.payments || []).map((p: any) => {
              const alreadyRefunded = (p.refundItems || [])
                .filter((ri: any) => ri.status === "SUCCEEDED" || ri.status === "PENDING" || ri.status === "PROCESSING")
                .reduce((acc: bigint, ri: any) => acc + BigInt(ri.amount), 0n);
              return {
                id: p.id,
                capturedAmount: BigInt(p.amount),
                alreadyRefundedAmount: alreadyRefunded,
              };
            });

            const items = planRefundItems(withdrawal.potentialRefund, eligiblePayments);

            for (const item of items) {
              if (item.allocatedRefundPaise > 0n) {
                await tx.refundItem.create({
                  data: {
                    refundId: refundRecord.id,
                    paymentId: item.paymentId,
                    amount: item.allocatedRefundPaise,
                    status: "PENDING",
                  },
                });
              }
            }
          }

          // 5. Audit log
          await tx.auditLog.create({
            data: {
              actorId: actor.userId,
              actorEmail: actor.email || actor.name,
              actorRole: actor.role,
              action: "WITHDRAWAL_APPROVE",
              entityType: "Withdrawal",
              entityId: withdrawal.id,
              centreId: student.centreId,
              reason: notes || "Director approved statutory withdrawal & refund quote",
              afterJson: JSON.stringify({
                withdrawalId: withdrawal.id,
                studentId: student.id,
                refundPaise: withdrawal.potentialRefund.toString(),
                shortfallPaise: withdrawal.indicativeShortfall.toString(),
              }),
            },
          });

          return {
            withdrawal: updatedWd,
            refund: refundRecord,
            status: "APPROVED",
          };
        },
        { maxWait: 10000, timeout: 20000 }
      );

      return result;
    } catch {
      // In-memory fallback
      const updatedWd = demoPaymentStore.updateWithdrawal(withdrawal.id, {
        status: decision,
        approverId: actor.userId,
        approvedAt: new Date(),
        approvalNotes: notes || withdrawal.approvalNotes,
      });

      if (decision === "REJECTED") {
        return { withdrawal: updatedWd, status: "REJECTED" };
      }

      // Rebase in demo store
      if (activePlan) {
        const insts = demoPaymentStore.getStudentInstalments(student.id);
        const ledgers = demoPaymentStore.getStudentLedger(student.id);

        for (const inst of insts) {
          const bal = deriveInstalmentBalance(inst, ledgers, new Date());
          if (bal.outstandingBalance > 0n) {
            demoPaymentStore.appendLedgerEntry({
              studentId: student.id,
              instalmentId: inst.id,
              entryType: "WAIVER",
              amount: -bal.outstandingBalance,
              referenceType: "WITHDRAWAL_REBASE",
              referenceId: withdrawal.id,
              notes: `Ordinary unpaid balance waived on withdrawal approval for instalment ${inst.sequence}`,
            });
            demoPaymentStore.updateInstalmentStatus(inst.id, "CANCELLED");
            demoPaymentStore.skipQueuedReminders(
              inst.id,
              "Student withdrawn - ordinary dues waived to ₹0"
            );
          }
        }
      }

      let refundRecord: any = null;
      if (withdrawal.potentialRefund > 0n) {
        refundRecord = demoPaymentStore.createRefund({
          studentId: student.id,
          withdrawalId: withdrawal.id,
          totalApprovedAmount: withdrawal.potentialRefund,
          status: "PENDING_EXECUTION",
        });

        const studentPayments = Array.from(demoPaymentStore.payments.values())
          .filter((p) => p.studentId === student.id && p.status === "CAPTURED")
          .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());

        const eligible = studentPayments.map((p) => ({
          id: p.id,
          capturedAmount: p.amount,
          alreadyRefundedAmount: 0n,
        }));

        const items = planRefundItems(withdrawal.potentialRefund, eligible);
        for (const item of items) {
          if (item.allocatedRefundPaise > 0n) {
            demoPaymentStore.createRefundItem({
              refundId: refundRecord.id,
              paymentId: item.paymentId,
              amount: item.allocatedRefundPaise,
              status: "PENDING",
            });
          }
        }
      }

      return {
        withdrawal: updatedWd,
        refund: refundRecord,
        status: "APPROVED",
      };
    }
  }

  /**
   * Asserts that a provider refund ID is unique and not already linked to another RefundItem.
   */
  async assertUniqueProviderRefundId(
    providerRefundId: string | null | undefined,
    currentItemId: string
  ) {
    if (!providerRefundId) return;

    try {
      const existing = await prisma.refundItem.findFirst({
        where: {
          providerRefundId,
          id: { not: currentItemId },
        },
      });
      if (existing) {
        throw new Error(
          `CRITICAL INVARIANT VIOLATION: Provider refund ID ${providerRefundId} is already associated with RefundItem ${existing.id}`
        );
      }
    } catch (err: any) {
      if (err.message?.includes("CRITICAL INVARIANT VIOLATION")) throw err;
      const demoExisting = demoPaymentStore.findRefundItemByProviderRefundId(providerRefundId);
      if (demoExisting && demoExisting.id !== currentItemId) {
        throw new Error(
          `CRITICAL INVARIANT VIOLATION: Provider refund ID ${providerRefundId} is already associated with RefundItem ${demoExisting.id}`
        );
      }
    }
  }

  /**
   * Executes a single planned refund item with Razorpay Normal Refund API or Mock provider.
   * Hard Invariants:
   * 1. Does not make external Razorpay call inside long-running DB transaction.
   * 2. Concurrency protection: Locks item as PROCESSING before external call.
   * 3. Stable X-Refund-Idempotency header reused on retry.
   * 4. Over-refund prevention: checks remaining eligible captured balance.
   * 5. Parent Refund aggregate status updated using Section 7 rules.
   */
  async executeRefundItem(params: {
    refundItemId: string;
    actor: Actor;
    forceStatus?: "SUCCEEDED" | "PROCESSING" | "FAILED";
    refundProvider?: RefundProvider;
  }) {
    const { refundItemId, actor, forceStatus } = params;

    if (actor.role !== "ACCOUNTS" && actor.role !== "DIRECTOR") {
      throw new Error("Unauthorized: Only Accounts or Director can execute refund items");
    }

    let refundItem: any = null;
    try {
      refundItem = await prisma.refundItem.findUnique({
        where: { id: refundItemId },
        include: {
          payment: {
            include: {
              refundItems: true,
            },
          },
          refund: {
            include: {
              items: true,
              withdrawal: { include: { student: true } },
            },
          },
        },
      });
    } catch {
      // Offline fallback
    }

    if (!refundItem) {
      const demoItem = demoPaymentStore.getRefundItem(refundItemId);
      if (demoItem) {
        const demoRefund = demoPaymentStore.getRefund(demoItem.refundId);
        const demoWd = demoRefund ? demoPaymentStore.getWithdrawal(demoRefund.withdrawalId) : null;
        const demoPayment = demoPaymentStore.payments.get(demoItem.paymentId);
        const siblingItems = demoPaymentStore.getRefundItemsByRefundId(demoItem.refundId);

        refundItem = {
          ...demoItem,
          payment: demoPayment || {
            id: demoItem.paymentId,
            providerPaymentId: `rzp_${demoItem.paymentId}`,
            amount: demoItem.amount,
            status: "CAPTURED",
            refundItems: siblingItems,
          },
          refund: {
            ...demoRefund,
            items: siblingItems,
            withdrawal: demoWd
              ? {
                  ...demoWd,
                  student: { id: demoWd.studentId, centreId: "cen_tonk" },
                }
              : null,
          },
        };
      }
    }

    if (!refundItem) {
      throw new Error(`Refund item ${refundItemId} not found`);
    }

    // 1. Prevent duplicate execution of already succeeded refund
    if (refundItem.status === "SUCCEEDED") {
      throw new Error("Refund item has already succeeded; duplicate execution rejected");
    }

    // 2. Payment association and provider resolution
    const payment = refundItem.payment;
    if (!payment) {
      throw new Error(`Original payment record not found for refund item ${refundItemId}`);
    }

    return await financialLock.acquire([`payment_${payment.id}`], async () => {
      const provider = params.refundProvider || getRefundProvider(payment.provider);

      if (payment.status !== "CAPTURED" && payment.status !== "PARTIALLY_REFUNDED") {
        throw new Error(
          `Original payment ${payment.id} status is ${payment.status}; only CAPTURED payments can be refunded`
        );
      }

    // 3. Concurrency protection: If currently in-flight, reconcile with gateway before retry
    if (refundItem.status === "PROCESSING" && !forceStatus) {
      const recon = await this.reconcileRefundItem({
        refundItemId,
        actor,
        refundProvider: provider,
      });

      if (recon.item.status === "SUCCEEDED") {
        return {
          item: recon.item,
          refund: recon.refund,
          message: "Refund item was already processed on gateway and has been reconciled to SUCCEEDED",
        };
      }

      if (recon.item.status === "PROCESSING") {
        throw new Error(
          "Refund item execution is currently in-flight; concurrent execution rejected"
        );
      }

      if (recon.item.status === "FAILED") {
        refundItem = recon.item;
      } else {
        const timeDiff = Date.now() - new Date(refundItem.createdAt).getTime();
        if (timeDiff < 2 * 60 * 1000) {
          throw new Error(
            "Refund item execution is currently in-flight; concurrent execution rejected"
          );
        }
      }
    }

    // 4. Over-refund prevention & Database-Level Locking & Reservation (BEFORE external call)
    try {
      await prisma.$transaction(async (tx) => {
        // A. Database-level row lock
        await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${payment.id} FOR UPDATE`;

        // B. Fresh read inside lock
        const freshPayment = await tx.payment.findUnique({
          where: { id: payment.id },
          include: { allocations: true, refundItems: true },
        });
        if (!freshPayment) {
          throw new Error(`Original payment record not found for refund item ${refundItemId}`);
        }
        if (freshPayment.status !== "CAPTURED" && freshPayment.status !== "PARTIALLY_REFUNDED") {
          throw new Error(
            `Original payment ${freshPayment.id} status is ${freshPayment.status}; only CAPTURED payments can be refunded`
          );
        }

        const otherItems = freshPayment.refundItems.filter((ri) => ri.id !== refundItem.id);
        const previouslyRefundedPaise = otherItems
          .filter((ri) => ri.status === "SUCCEEDED" || ri.status === "PROCESSING")
          .reduce((acc, ri) => acc + BigInt(ri.amount), 0n);

        const totalAllocatedPaise = freshPayment.allocations.reduce(
          (acc, a) => acc + BigInt(a.amount),
          0n
        );

        const remainingRefundablePaise = BigInt(freshPayment.amount) - previouslyRefundedPaise;
        const availablePaise = BigInt(freshPayment.amount) - totalAllocatedPaise - previouslyRefundedPaise;

        if (BigInt(refundItem.amount) > remainingRefundablePaise) {
          throw new Error(
            `Requested refund amount (${refundItem.amount}) exceeds remaining refundable amount (${remainingRefundablePaise}) on payment ${freshPayment.id}`
          );
        }

        if (freshPayment.allocations.length > 0 && BigInt(refundItem.amount) > availablePaise) {
          throw new Error(
            `Requested refund amount (${refundItem.amount}) exceeds available payment balance (${availablePaise}) on payment ${freshPayment.id}`
          );
        }

        // C. Reserve amount on payment (PROCESSING reservation)
        const reservedUnallocated = availablePaise > BigInt(refundItem.amount)
          ? availablePaise - BigInt(refundItem.amount)
          : 0n;

        await tx.payment.update({
          where: { id: freshPayment.id },
          data: { unallocatedAmount: reservedUnallocated },
        });

        await tx.refundItem.update({
          where: { id: refundItem.id },
          data: { status: "PROCESSING" },
        });
      });
    } catch (err: any) {
      if (err.message?.includes("exceeds") || err.message?.includes("CAPTURED")) {
        throw err;
      }
      // In-memory demo store reservation fallback
      const pay = demoPaymentStore.payments.get(payment.id);
      if (!pay) {
        throw new Error(`Original payment record not found for refund item ${refundItemId}`);
      }
      if (pay.status !== "CAPTURED" && pay.status !== "PARTIALLY_REFUNDED") {
        throw new Error(
          `Original payment ${pay.id} status is ${pay.status}; only CAPTURED payments can be refunded`
        );
      }

      const allRefunds = demoPaymentStore.getRefundItemsForPayment(pay.id);
      const otherRefunds = allRefunds.filter((r) => r.id !== refundItem.id);
      const priorRefunded = otherRefunds
        .filter((r) => r.status === "SUCCEEDED" || r.status === "PROCESSING")
        .reduce((sum, r) => sum + r.amount, 0n);

      const allAllocs = demoPaymentStore.getAllocationsForPayment(pay.id);
      const totalAllocated = allAllocs.reduce((sum, a) => sum + a.amount, 0n);

      const remainingRefundable = pay.amount - priorRefunded;
      const trueAvailable = pay.amount - totalAllocated - priorRefunded;

      if (BigInt(refundItem.amount) > remainingRefundable) {
        throw new Error(
          `Requested refund amount (${refundItem.amount}) exceeds remaining refundable amount (${remainingRefundable}) on payment ${pay.id}`
        );
      }

      if (allAllocs.length > 0 && BigInt(refundItem.amount) > trueAvailable) {
        throw new Error(
          `Requested refund amount (${refundItem.amount}) exceeds available payment balance (${trueAvailable}) on payment ${pay.id}`
        );
      }

      pay.unallocatedAmount = trueAvailable > BigInt(refundItem.amount)
        ? trueAvailable - BigInt(refundItem.amount)
        : 0n;
      demoPaymentStore.updateRefundItem(refundItem.id, { status: "PROCESSING" });
    }

    // 5. Gateway-side balance verification via fetchPaymentRefunds (including Razorpay Dashboard refunds)
    const pidToQuery = payment.providerPaymentId || payment.id;
    if (provider.fetchPaymentRefunds && pidToQuery) {
      try {
        const gatewayRefunds = await provider.fetchPaymentRefunds(pidToQuery);
        const gatewayRefundedPaise = gatewayRefunds
          .filter((gr: any) => gr.status === "processed" || gr.status === "created")
          .reduce((sum: bigint, gr: any) => sum + BigInt(gr.amount), 0n);

        const gatewayRemaining = BigInt(payment.amount) - gatewayRefundedPaise;
        if (BigInt(refundItem.amount) > gatewayRemaining) {
          throw new Error(
            `Requested refund exceeds remaining refundable balance on Razorpay gateway (gateway remaining: ${gatewayRemaining} paise, taking into account dashboard and external refunds)`
          );
        }
      } catch (gwErr: any) {
        if (gwErr.message?.includes("exceeds")) throw gwErr;
        if (provider.providerName === "RAZORPAY") {
          throw new Error(
            `Unable to verify gateway refund balance from Razorpay: ${gwErr.message}. Execution aborted for safety.`
          );
        }
      }
    }

    // 7. Stable Idempotency Key & Receipt Reference:
    // Same attempt uses identical key & receipt; retry of definitive failure gets new attempt key.
    let attemptCount = 1;
    const cleanItemId = refundItem.id.replace(/[^a-zA-Z0-9_-]/g, "");
    const isTimeoutOrUncertain =
      refundItem.failureReason?.includes("TIMEOUT") ||
      refundItem.failureReason?.includes("timeout") ||
      refundItem.failureReason?.includes("uncertain") ||
      refundItem.failureReason?.includes("ETIMEDOUT");
    const isRetryAfterDefinitiveFailure =
      refundItem.status === "FAILED" && !isTimeoutOrUncertain;

    try {
      const priorAttempts = await prisma.auditLog.count({
        where: { entityId: refundItem.id, action: "REFUND_EXECUTION_ATTEMPT" },
      });
      attemptCount = isRetryAfterDefinitiveFailure ? priorAttempts + 1 : Math.max(1, priorAttempts);
    } catch {
      // Demo store attempt tracking
      if (isRetryAfterDefinitiveFailure) {
        const att = demoPaymentStore.incrementRefundItemAttempt(refundItem.id);
        attemptCount = att.attemptCount;
      } else {
        const att = demoPaymentStore.getRefundItemAttempt(refundItem.id);
        attemptCount = att.attemptCount;
      }
    }

    const idempotencyKey =
      attemptCount > 1 ? `refitem_${cleanItemId}_att${attemptCount}` : `refitem_${cleanItemId}`;
    const receipt =
      attemptCount > 1
        ? `rfnd_${cleanItemId.slice(-8)}_a${attemptCount}`.slice(0, 40)
        : `rfnd_${cleanItemId.slice(-8)}`.slice(0, 40);

    // 8. Call external Refund Provider outside DB transaction
    let providerResult: any;
    try {
      providerResult = await provider.executeRefund({
        refundItemId: refundItem.id,
        paymentId: refundItem.paymentId,
        providerPaymentId: payment.providerPaymentId || undefined,
        amountPaise: BigInt(refundItem.amount),
        idempotencyKey,
        receipt,
        forceStatus,
      });
    } catch (netErr: any) {
      // On uncertain network error, preserve PROCESSING status for reconciliation
      throw netErr;
    }

    // 9. Enforce Provider Refund ID Uniqueness
    if (providerResult.providerRefundId) {
      await this.assertUniqueProviderRefundId(providerResult.providerRefundId, refundItem.id);
    }

    // Log Execution Attempt in AuditLog
    try {
      await prisma.auditLog.create({
        data: {
          actorId: actor.userId,
          actorEmail: actor.name,
          actorRole: actor.role,
          action: "REFUND_EXECUTION_ATTEMPT",
          entityType: "RefundItem",
          entityId: refundItem.id,
          reason: `Execution attempt ${attemptCount} (${providerResult.status})`,
        },
      });
    } catch {
      // Offline fallback
    }

    // 9. Persist execution result and re-evaluate aggregate parent status
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // Database-level row lock on Payment row
          await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${refundItem.paymentId} FOR UPDATE`;

          const updatedItem = await tx.refundItem.update({
            where: { id: refundItem.id },
            data: {
              status: providerResult.status,
              providerRefundId: providerResult.providerRefundId || refundItem.providerRefundId,
              failureReason: providerResult.failureReason || null,
            },
          });

          // Fetch all sibling items to evaluate parent Refund state
          const allItems = await tx.refundItem.findMany({
            where: { refundId: refundItem.refundId },
          });

          const aggregate = deriveRefundAggregateStatus(
            allItems.map((it) =>
              it.id === refundItem.id ? { status: providerResult.status } : { status: it.status }
            )
          );

          const updatedRefund = await tx.refund.update({
            where: { id: refundItem.refundId },
            data: {
              status: aggregate.dbStatus,
              completedAt: aggregate.dbStatus === "COMPLETED" ? new Date() : null,
            },
          });

          // If payment was refunded, update payment status and unallocatedAmount
          if (providerResult.status === "SUCCEEDED" && refundItem.payment) {
            const allPaymentRefunds = await tx.refundItem.findMany({
              where: { paymentId: refundItem.paymentId, status: "SUCCEEDED" },
            });
            const totalRefundedOnPayment = allPaymentRefunds.reduce(
              (acc, ri) => acc + BigInt(ri.amount),
              0n
            );
            const allPaymentAllocs = await tx.paymentAllocation.findMany({
              where: { paymentId: refundItem.paymentId },
            });
            const totalAllocatedOnPayment = allPaymentAllocs.reduce(
              (acc, a) => acc + BigInt(a.amount),
              0n
            );
            const paymentAmount = BigInt(refundItem.payment.amount);
            const newUnallocated =
              paymentAmount > totalAllocatedOnPayment + totalRefundedOnPayment
                ? paymentAmount - totalAllocatedOnPayment - totalRefundedOnPayment
                : 0n;
            const isFull = totalRefundedOnPayment >= paymentAmount;
            await tx.payment.update({
              where: { id: refundItem.paymentId },
              data: {
                status: isFull ? "REFUNDED" : "PARTIALLY_REFUNDED",
                unallocatedAmount: newUnallocated,
              },
            });
          } else if (providerResult.status === "FAILED" && refundItem.payment) {
            // Release reservation on failed execution
            const allPaymentRefunds = await tx.refundItem.findMany({
              where: { paymentId: refundItem.paymentId },
            });
            const otherActiveRefunds = allPaymentRefunds
              .filter((ri) => ri.id !== refundItem.id && (ri.status === "SUCCEEDED" || ri.status === "PROCESSING"))
              .reduce((acc, ri) => acc + BigInt(ri.amount), 0n);

            const allPaymentAllocs = await tx.paymentAllocation.findMany({
              where: { paymentId: refundItem.paymentId },
            });
            const totalAllocatedOnPayment = allPaymentAllocs.reduce(
              (acc, a) => acc + BigInt(a.amount),
              0n
            );
            const paymentAmount = BigInt(refundItem.payment.amount);
            const releasedUnallocated =
              paymentAmount > totalAllocatedOnPayment + otherActiveRefunds
                ? paymentAmount - totalAllocatedOnPayment - otherActiveRefunds
                : 0n;

            await tx.payment.update({
              where: { id: refundItem.paymentId },
              data: {
                unallocatedAmount: releasedUnallocated,
              },
            });
          }

          // Audit log
          await tx.auditLog.create({
            data: {
              actorId: actor.userId,
              actorEmail: actor.email || actor.name,
              actorRole: actor.role,
              action:
                providerResult.status === "SUCCEEDED"
                  ? "REFUND_ITEM_EXECUTE"
                  : providerResult.status === "FAILED"
                  ? "REFUND_ITEM_FAIL"
                  : "REFUND_ITEM_SUBMIT",
              entityType: "RefundItem",
              entityId: refundItem.id,
              reason: providerResult.failureReason || "Razorpay refund execution",
            },
          });

          return { item: updatedItem, refund: updatedRefund };
        },
        { maxWait: 10000, timeout: 20000 }
      );

      return result;
    } catch {
      // In-memory fallback
      const updatedItem = demoPaymentStore.updateRefundItem(refundItem.id, {
        status: providerResult.status,
        providerRefundId: providerResult.providerRefundId || refundItem.providerRefundId,
        failureReason: providerResult.failureReason || null,
      });

      const siblings = demoPaymentStore.getRefundItemsByRefundId(refundItem.refundId);
      const aggregate = deriveRefundAggregateStatus(siblings);

      const updatedRefund = demoPaymentStore.updateRefund(refundItem.refundId, {
        status: aggregate.dbStatus,
        completedAt: aggregate.dbStatus === "COMPLETED" ? new Date() : null,
      });

      if (providerResult.status === "SUCCEEDED") {
        const pay = demoPaymentStore.payments.get(refundItem.paymentId);
        if (pay) {
          const allPaymentRefunds = demoPaymentStore.getRefundItemsForPayment(refundItem.paymentId);
          const totalRefunded = allPaymentRefunds
            .filter((r) => r.status === "SUCCEEDED")
            .reduce((sum, r) => sum + r.amount, 0n);
          const allAllocs = demoPaymentStore.getAllocationsForPayment(refundItem.paymentId);
          const totalAllocated = allAllocs.reduce((sum, a) => sum + a.amount, 0n);
          const newUnallocated =
            pay.amount > totalAllocated + totalRefunded
              ? pay.amount - totalAllocated - totalRefunded
              : 0n;
          pay.unallocatedAmount = newUnallocated;
          pay.status = totalRefunded >= pay.amount ? "REFUNDED" : "PARTIALLY_REFUNDED";
        }
      } else if (providerResult.status === "FAILED") {
        const pay = demoPaymentStore.payments.get(refundItem.paymentId);
        if (pay) {
          const allPaymentRefunds = demoPaymentStore.getRefundItemsForPayment(refundItem.paymentId);
          const otherActiveRefunds = allPaymentRefunds
            .filter((r) => r.id !== refundItem.id && (r.status === "SUCCEEDED" || r.status === "PROCESSING"))
            .reduce((sum, r) => sum + r.amount, 0n);
          const allAllocs = demoPaymentStore.getAllocationsForPayment(refundItem.paymentId);
          const totalAllocated = allAllocs.reduce((sum, a) => sum + a.amount, 0n);
          const releasedUnallocated =
            pay.amount > totalAllocated + otherActiveRefunds
              ? pay.amount - totalAllocated - otherActiveRefunds
              : 0n;
          pay.unallocatedAmount = releasedUnallocated;
        }
      }

      return { item: updatedItem, refund: updatedRefund };
    }
    });
  }

  /**
   * Processes Razorpay refund webhook events:
   * - refund.created (marks item PROCESSING)
   * - refund.processed (marks item SUCCEEDED, updates payment status, aggregates parent refund)
   * - refund.failed (marks item FAILED, keeps retryable)
   * - refund.speed_changed (informational)
   */
  async processRefundWebhook(
    rawBody: string,
    options: {
      provider?: "RAZORPAY" | "MOCK_GATEWAY";
      signature: string | null;
      eventId?: string | null;
      secret?: string;
    }
  ): Promise<{
    success: boolean;
    duplicate?: boolean;
    status: string;
    refundItemId?: string;
    error?: string;
  }> {
    const provider = options.provider || "RAZORPAY";

    // 1. Signature Verification on exact raw body
    if (provider === "RAZORPAY") {
      const isValid = verifyRazorpayWebhookSignature(rawBody, options.signature, options.secret);
      if (!isValid) {
        return {
          success: false,
          status: "REJECTED",
          error: "Invalid Razorpay webhook signature",
        };
      }
    } else {
      if (!options.signature || (!options.signature.startsWith("sig_") && options.signature !== "valid_sig")) {
        return {
          success: false,
          status: "REJECTED",
          error: "Invalid mock webhook signature",
        };
      }
    }

    // 2. Parse payload
    let parsed: any;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return {
        success: false,
        status: "REJECTED",
        error: "Malformed JSON payload in webhook body",
      };
    }

    const eventType = parsed.event;
    if (!eventType || !eventType.startsWith("refund.")) {
      return {
        success: false,
        status: "IGNORED",
        error: `Event ${eventType} is not a refund webhook event`,
      };
    }

    const refundEntity = parsed.payload?.refund?.entity;
    const paymentEntity = parsed.payload?.payment?.entity;

    if (!refundEntity && eventType !== "refund.speed_changed") {
      return {
        success: false,
        status: "REJECTED",
        error: "Missing refund entity in webhook payload",
      };
    }

    // 3. Event-level idempotency with ProviderEvent
    const eventId =
      options.eventId ||
      parsed.id ||
      (refundEntity?.id
        ? `${parsed.account_id || "acc"}_${eventType}_${refundEntity.id}`
        : `evt_rfnd_${Date.now()}`);

    try {
      const existing = await prisma.providerEvent.findUnique({
        where: {
          provider_providerEventId: {
            provider,
            providerEventId: eventId,
          },
        },
      });

      if (existing && existing.processed) {
        return {
          success: true,
          duplicate: true,
          status: existing.processingStatus || "ALREADY_PROCESSED",
        };
      }
    } catch {
      // In demo mode or if DB offline
      const demoEvt = demoPaymentStore.findProviderEvent(provider, eventId);
      if (demoEvt && demoEvt.processed) {
        return {
          success: true,
          duplicate: true,
          status: demoEvt.processingStatus || "ALREADY_PROCESSED",
        };
      }
    }

    // 4. Currency verification
    if (refundEntity?.currency && refundEntity.currency !== "INR") {
      return {
        success: false,
        status: "REJECTED",
        error: `Unsupported currency: ${refundEntity.currency}. FeeFlow only accepts INR.`,
      };
    }

    const providerRefundId = refundEntity?.id;
    const providerPaymentId = refundEntity?.payment_id || paymentEntity?.id;
    const amountPaise = refundEntity?.amount != null ? BigInt(refundEntity.amount) : 0n;

    // 5. Handle refund.speed_changed as informational
    if (eventType === "refund.speed_changed") {
      try {
        await prisma.providerEvent.create({
          data: {
            provider,
            providerEventId: eventId,
            eventType,
            payloadJson: rawBody,
            signatureVerified: true,
            processed: true,
            processingStatus: "SPEED_CHANGED",
          },
        });
      } catch {
        demoPaymentStore.recordProviderEvent({
          provider,
          providerEventId: eventId,
          eventType,
          payloadJson: rawBody,
          signatureVerified: true,
          processed: true,
          processingStatus: "SPEED_CHANGED",
        });
      }
      return {
        success: true,
        status: "SPEED_CHANGED",
      };
    }

    // 6. Resolve corresponding RefundItem
    let refundItem: any = null;
    try {
      // Lookup A: by providerRefundId
      if (providerRefundId) {
        refundItem = await prisma.refundItem.findFirst({
          where: { providerRefundId },
          include: { payment: true, refund: true },
        });
      }

      // Lookup B: by notes.refundItemId
      if (!refundItem && refundEntity?.notes?.refundItemId) {
        refundItem = await prisma.refundItem.findUnique({
          where: { id: refundEntity.notes.refundItemId },
          include: { payment: true, refund: true },
        });
      }

      // Lookup C: by payment.providerPaymentId or payment.id and amount
      if (!refundItem && providerPaymentId) {
        refundItem = await prisma.refundItem.findFirst({
          where: {
            OR: [
              { payment: { providerPaymentId } },
              { payment: { id: providerPaymentId } },
            ],
            amount: amountPaise,
            status: { in: ["PENDING", "PROCESSING"] },
          },
          include: { payment: true, refund: true },
        });
      }
    } catch {
      // Demo store lookup
      if (providerRefundId) {
        const demoItem = demoPaymentStore.findRefundItemByProviderRefundId(providerRefundId);
        if (demoItem) {
          refundItem = {
            ...demoItem,
            payment: demoPaymentStore.payments.get(demoItem.paymentId),
            refund: demoPaymentStore.getRefund(demoItem.refundId),
          };
        }
      }
      if (!refundItem && refundEntity?.notes?.refundItemId) {
        const demoItem = demoPaymentStore.getRefundItem(refundEntity.notes.refundItemId);
        if (demoItem) {
          refundItem = {
            ...demoItem,
            payment: demoPaymentStore.payments.get(demoItem.paymentId),
            refund: demoPaymentStore.getRefund(demoItem.refundId),
          };
        }
      }
      if (!refundItem && providerPaymentId) {
        for (const it of demoPaymentStore.refundItems.values()) {
          const pay = demoPaymentStore.payments.get(it.paymentId);
          if (
            (pay?.providerPaymentId === providerPaymentId ||
              pay?.id === providerPaymentId ||
              it.paymentId === providerPaymentId) &&
            it.amount === amountPaise &&
            (it.status === "PENDING" || it.status === "PROCESSING")
          ) {
            refundItem = {
              ...it,
              payment: pay,
              refund: demoPaymentStore.getRefund(it.refundId),
            };
            break;
          }
        }
      }
    }

    // If still unmatched, record ProviderEvent as UNMATCHED without modifying financial ledger
    if (!refundItem) {
      try {
        await prisma.providerEvent.create({
          data: {
            provider,
            providerEventId: eventId,
            eventType,
            payloadJson: rawBody,
            signatureVerified: true,
            processed: true,
            processingStatus: "UNMATCHED",
            error: `No matching RefundItem found for refund ${providerRefundId} on payment ${providerPaymentId}`,
          },
        });
      } catch {
        demoPaymentStore.recordProviderEvent({
          provider,
          providerEventId: eventId,
          eventType,
          payloadJson: rawBody,
          signatureVerified: true,
          processed: true,
          processingStatus: "UNMATCHED",
          error: "Unmatched refund item",
        });
      }

      return {
        success: true,
        status: "UNMATCHED",
      };
    }

    // HARD INVARIANT: Provider refund ID uniqueness across distinct executions
    if (providerRefundId) {
      await this.assertUniqueProviderRefundId(providerRefundId, refundItem.id);
    }

    // Detect event vs. entity inconsistency (e.g. event is refund.processed but payload entity has status: "failed")
    const isEventProcessed = eventType === "refund.processed";
    const isEventFailed = eventType === "refund.failed";
    const isEntityProcessed = refundEntity?.status === "processed";
    const isEntityFailed = refundEntity?.status === "failed";

    if ((isEventProcessed && isEntityFailed) || (isEventFailed && isEntityProcessed)) {
      const recon = await this.reconcileRefundItem({
        refundItemId: refundItem.id,
        actor: {
          userId: "system_webhook",
          name: "System Webhook",
          role: "DIRECTOR",
          centreIds: [],
          linkedStudentIds: [],
          consentedStudentIds: [],
        },
      });
      return {
        success: true,
        status: recon.item.status,
        refundItemId: refundItem.id,
      };
    }

    // HARD INVARIANT: Once a refund item is SUCCEEDED, out-of-order created or failed events cannot downgrade it
    if (refundItem.status === "SUCCEEDED") {
      return {
        success: true,
        duplicate: true,
        status: "SUCCEEDED",
        refundItemId: refundItem.id,
      };
    }

    // 7. Execute State Transition
    let targetStatus: "PROCESSING" | "SUCCEEDED" | "FAILED" = "PROCESSING";
    if (eventType === "refund.processed") {
      targetStatus = "SUCCEEDED";
    } else if (eventType === "refund.failed") {
      targetStatus = "FAILED";
    } else if (eventType === "refund.created") {
      targetStatus = "PROCESSING";
    }

    try {
      await prisma.$transaction(
        async (tx) => {
          // Database-level row lock on Payment row
          await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${refundItem.paymentId} FOR UPDATE`;

          // Update RefundItem
          await tx.refundItem.update({
            where: { id: refundItem.id },
            data: {
              status: targetStatus,
              providerRefundId: providerRefundId || refundItem.providerRefundId,
              failureReason:
                targetStatus === "FAILED"
                  ? refundEntity?.error_description || "Gateway reported refund failure"
                  : null,
            },
          });

          // Fetch sibling items to re-evaluate parent Refund aggregate status
          const allItems = await tx.refundItem.findMany({
            where: { refundId: refundItem.refundId },
          });

          const aggregate = deriveRefundAggregateStatus(
            allItems.map((it) =>
              it.id === refundItem.id ? { status: targetStatus } : { status: it.status }
            )
          );

          await tx.refund.update({
            where: { id: refundItem.refundId },
            data: {
              status: aggregate.dbStatus,
              completedAt: aggregate.dbStatus === "COMPLETED" ? new Date() : null,
            },
          });

          // If succeeded, update payment status and unallocatedAmount
          if (targetStatus === "SUCCEEDED" && refundItem.payment) {
            const allPaymentRefunds = await tx.refundItem.findMany({
              where: { paymentId: refundItem.paymentId, status: "SUCCEEDED" },
            });
            const totalRefundedOnPayment = allPaymentRefunds.reduce(
              (acc, ri) => acc + BigInt(ri.amount),
              0n
            );
            const allPaymentAllocs = await tx.paymentAllocation.findMany({
              where: { paymentId: refundItem.paymentId },
            });
            const totalAllocatedOnPayment = allPaymentAllocs.reduce(
              (acc, a) => acc + BigInt(a.amount),
              0n
            );
            const paymentAmount = BigInt(refundItem.payment.amount);
            const newUnallocated =
              paymentAmount > totalAllocatedOnPayment + totalRefundedOnPayment
                ? paymentAmount - totalAllocatedOnPayment - totalRefundedOnPayment
                : 0n;
            const isFull = totalRefundedOnPayment >= paymentAmount;
            await tx.payment.update({
              where: { id: refundItem.paymentId },
              data: {
                status: isFull ? "REFUNDED" : "PARTIALLY_REFUNDED",
                unallocatedAmount: newUnallocated,
              },
            });
          } else if (targetStatus === "FAILED" && refundItem.payment) {
            // Release reservation on failed execution
            const allPaymentRefunds = await tx.refundItem.findMany({
              where: { paymentId: refundItem.paymentId },
            });
            const otherActiveRefunds = allPaymentRefunds
              .filter((ri) => ri.id !== refundItem.id && (ri.status === "SUCCEEDED" || ri.status === "PROCESSING"))
              .reduce((acc, ri) => acc + BigInt(ri.amount), 0n);

            const allPaymentAllocs = await tx.paymentAllocation.findMany({
              where: { paymentId: refundItem.paymentId },
            });
            const totalAllocatedOnPayment = allPaymentAllocs.reduce(
              (acc, a) => acc + BigInt(a.amount),
              0n
            );
            const paymentAmount = BigInt(refundItem.payment.amount);
            const releasedUnallocated =
              paymentAmount > totalAllocatedOnPayment + otherActiveRefunds
                ? paymentAmount - totalAllocatedOnPayment - otherActiveRefunds
                : 0n;

            await tx.payment.update({
              where: { id: refundItem.paymentId },
              data: {
                unallocatedAmount: releasedUnallocated,
              },
            });
          }

          // Persist ProviderEvent
          await tx.providerEvent.create({
            data: {
              provider,
              providerEventId: eventId,
              eventType,
              payloadJson: rawBody,
              signatureVerified: true,
              processed: true,
              processingStatus: targetStatus,
            },
          });

          // Audit log
          await tx.auditLog.create({
            data: {
              actorId: "system_webhook",
              actorEmail: "webhook@razorpay.com",
              actorRole: "DIRECTOR",
              action: `REFUND_WEBHOOK_${targetStatus}`,
              entityType: "RefundItem",
              entityId: refundItem.id,
              reason: `Razorpay webhook event: ${eventType}`,
            },
          });
        },
        { maxWait: 10000, timeout: 20000 }
      );

      return {
        success: true,
        status: targetStatus,
        refundItemId: refundItem.id,
      };
    } catch {
      // In-memory demo fallback
      demoPaymentStore.updateRefundItem(refundItem.id, {
        status: targetStatus,
        providerRefundId: providerRefundId || refundItem.providerRefundId,
        failureReason:
          targetStatus === "FAILED"
            ? refundEntity?.error_description || "Gateway reported refund failure"
            : null,
      });

      const siblings = demoPaymentStore.getRefundItemsByRefundId(refundItem.refundId);
      const aggregate = deriveRefundAggregateStatus(siblings);

      demoPaymentStore.updateRefund(refundItem.refundId, {
        status: aggregate.dbStatus,
        completedAt: aggregate.dbStatus === "COMPLETED" ? new Date() : null,
      });

      if (targetStatus === "SUCCEEDED") {
        const pay = demoPaymentStore.payments.get(refundItem.paymentId);
        if (pay) {
          const allPaymentRefunds = demoPaymentStore.getRefundItemsForPayment(refundItem.paymentId);
          const totalRefunded = allPaymentRefunds
            .filter((r) => r.status === "SUCCEEDED")
            .reduce((sum, r) => sum + r.amount, 0n);
          const allAllocs = demoPaymentStore.getAllocationsForPayment(refundItem.paymentId);
          const totalAllocated = allAllocs.reduce((sum, a) => sum + a.amount, 0n);
          const newUnallocated =
            pay.amount > totalAllocated + totalRefunded
              ? pay.amount - totalAllocated - totalRefunded
              : 0n;
          pay.unallocatedAmount = newUnallocated;
          pay.status = totalRefunded >= pay.amount ? "REFUNDED" : "PARTIALLY_REFUNDED";
        }
      } else if (targetStatus === "FAILED") {
        const pay = demoPaymentStore.payments.get(refundItem.paymentId);
        if (pay) {
          const allPaymentRefunds = demoPaymentStore.getRefundItemsForPayment(refundItem.paymentId);
          const otherActiveRefunds = allPaymentRefunds
            .filter((r) => r.id !== refundItem.id && (r.status === "SUCCEEDED" || r.status === "PROCESSING"))
            .reduce((sum, r) => sum + r.amount, 0n);
          const allAllocs = demoPaymentStore.getAllocationsForPayment(refundItem.paymentId);
          const totalAllocated = allAllocs.reduce((sum, a) => sum + a.amount, 0n);
          const releasedUnallocated =
            pay.amount > totalAllocated + otherActiveRefunds
              ? pay.amount - totalAllocated - otherActiveRefunds
              : 0n;
          pay.unallocatedAmount = releasedUnallocated;
        }
      }

      demoPaymentStore.recordProviderEvent({
        provider,
        providerEventId: eventId,
        eventType,
        payloadJson: rawBody,
        signatureVerified: true,
        processed: true,
        processingStatus: targetStatus,
      });

      return {
        success: true,
        status: targetStatus,
        refundItemId: refundItem.id,
      };
    }
  }

  /**
   * Reconciles a refund item by polling Razorpay's GET /v1/refunds/{id} or payment refunds API.
   * Uses identical idempotent transition logic as webhook processing.
   */
  async reconcileRefundItem(params: {
    refundItemId: string;
    actor: Actor;
    refundProvider?: RefundProvider;
  }): Promise<{
    item: any;
    refund: any;
    reconciled: boolean;
    providerStatus?: string;
  }> {
    const { refundItemId, actor } = params;

    if (actor.role !== "ACCOUNTS" && actor.role !== "DIRECTOR") {
      throw new Error("Unauthorized: Only Accounts or Director can reconcile refunds");
    }

    let refundItem: any = null;
    try {
      refundItem = await prisma.refundItem.findUnique({
        where: { id: refundItemId },
        include: { payment: true, refund: true },
      });
    } catch {
      // Offline fallback
    }

    if (!refundItem) {
      const demoItem = demoPaymentStore.getRefundItem(refundItemId);
      if (demoItem) {
        refundItem = {
          ...demoItem,
          payment: demoPaymentStore.payments.get(demoItem.paymentId),
          refund: demoPaymentStore.getRefund(demoItem.refundId),
        };
      }
    }

    if (!refundItem) {
      throw new Error(`Refund item ${refundItemId} not found`);
    }

    const provider = params.refundProvider || getRefundProvider(refundItem.payment?.provider);

    // If already succeeded, reconciliation is a no-op
    if (refundItem.status === "SUCCEEDED") {
      return {
        item: refundItem,
        refund: refundItem.refund,
        reconciled: true,
        providerStatus: "processed",
      };
    }

    let gatewayRefund: any = null;

    // Method A: Fetch by known providerRefundId
    if (refundItem.providerRefundId && provider.fetchRefund) {
      try {
        gatewayRefund = await provider.fetchRefund(refundItem.providerRefundId);
      } catch {
        // Continue to fallback
      }
    }

    // Method B: Search across payment's refunds
    if (!gatewayRefund && provider.fetchPaymentRefunds && refundItem.payment?.providerPaymentId) {
      try {
        const paymentRefunds = await provider.fetchPaymentRefunds(
          refundItem.payment.providerPaymentId
        );
        gatewayRefund = paymentRefunds.find(
          (gr: any) =>
            gr.id === refundItem.providerRefundId ||
            gr.notes?.refundItemId === refundItemId ||
            BigInt(gr.amount) === BigInt(refundItem.amount)
        );
      } catch {
        // Fallback
      }
    }

    if (!gatewayRefund) {
      return {
        item: refundItem,
        refund: refundItem.refund,
        reconciled: false,
      };
    }

    // Enforce provider refund ID uniqueness
    if (gatewayRefund.id) {
      await this.assertUniqueProviderRefundId(gatewayRefund.id, refundItem.id);
    }

    // Map status from fetched gateway refund
    const targetStatus =
      gatewayRefund.status === "processed"
        ? "SUCCEEDED"
        : gatewayRefund.status === "failed"
        ? "FAILED"
        : "PROCESSING";

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const updatedItem = await tx.refundItem.update({
            where: { id: refundItem.id },
            data: {
              status: targetStatus,
              providerRefundId: gatewayRefund.id,
              failureReason: gatewayRefund.error_description || null,
            },
          });

          const allItems = await tx.refundItem.findMany({
            where: { refundId: refundItem.refundId },
          });

          const aggregate = deriveRefundAggregateStatus(
            allItems.map((it) =>
              it.id === refundItem.id ? { status: targetStatus } : { status: it.status }
            )
          );

          const updatedRefund = await tx.refund.update({
            where: { id: refundItem.refundId },
            data: {
              status: aggregate.dbStatus,
              completedAt: aggregate.dbStatus === "COMPLETED" ? new Date() : null,
            },
          });

          return { item: updatedItem, refund: updatedRefund };
        },
        { maxWait: 10000, timeout: 20000 }
      );

      return {
        ...result,
        reconciled: true,
        providerStatus: gatewayRefund.status,
      };
    } catch {
      const updatedItem = demoPaymentStore.updateRefundItem(refundItem.id, {
        status: targetStatus,
        providerRefundId: gatewayRefund.id,
        failureReason: gatewayRefund.error_description || null,
      });

      const siblings = demoPaymentStore.getRefundItemsByRefundId(refundItem.refundId);
      const aggregate = deriveRefundAggregateStatus(siblings);

      const updatedRefund = demoPaymentStore.updateRefund(refundItem.refundId, {
        status: aggregate.dbStatus,
        completedAt: aggregate.dbStatus === "COMPLETED" ? new Date() : null,
      });

      return {
        item: updatedItem,
        refund: updatedRefund,
        reconciled: true,
        providerStatus: gatewayRefund.status,
      };
    }
  }

  /**
   * Retrieves all withdrawal cases accessible to the given actor, with optional status filter.
   */
  async getWithdrawalCases(
    actor: Actor,
    filter?: { status?: string; centreId?: string }
  ): Promise<WithdrawalCaseSummary[]> {
    let cases: WithdrawalCaseSummary[] = [];

    try {
      const allowedCentres =
        actor.role === "DIRECTOR"
          ? filter?.centreId
            ? [filter.centreId]
            : undefined
          : actor.centreIds;

      const whereClause: any = {};
      if (allowedCentres && allowedCentres.length > 0) {
        whereClause.student = { centreId: { in: allowedCentres } };
      }
      if (filter?.status) {
        whereClause.status = filter.status;
      }

      const rows = await prisma.withdrawal.findMany({
        where: whereClause,
        include: {
          student: {
            include: {
              centre: true,
              batch: true,
            },
          },
          refunds: {
            include: {
              items: {
                include: { payment: true },
              },
            },
          },
        },
        orderBy: { requestDate: "desc" },
      });

      if (rows && rows.length > 0) {
        // Collect user ids to resolve names
        const userIds = new Set<string>();
        rows.forEach((r) => {
          if (r.requesterId) userIds.add(r.requesterId);
          if (r.approverId) userIds.add(r.approverId);
        });

        const users = await prisma.user.findMany({
          where: { id: { in: Array.from(userIds) } },
        });
        const userMap = new Map<string, any>(users.map((u) => [u.id, u]));

        cases = rows.map((r) => {
          const reqUser = userMap.get(r.requesterId);
          const appUser = r.approverId ? userMap.get(r.approverId) : null;
          const refund = r.refunds?.[0];
          const items = refund?.items || [];

          const aggregate = deriveRefundAggregateStatus(
            items.map((it: any) => ({ status: it.status }))
          );

          return {
            id: r.id,
            studentId: r.student.id,
            studentCode: r.student.studentCode,
            studentName: r.student.name,
            batch: r.student.batch?.name || "Standard Batch",
            centre: r.student.centre?.name || "Main Centre",
            centreId: r.student.centreId,
            pathway: r.potentialRefund > 0n ? "STATUTORY_FULL_PAID" : "PART_PAID_EXTENSION",
            requestedDate: r.requestDate.toISOString().split("T")[0],
            effectiveDate: r.effectiveWithdrawalDate.toISOString().split("T")[0],
            consumedDays: r.consumedDays,
            totalServiceDays: r.totalServiceDays,
            netFeePaise: BigInt(r.netFee),
            paidPaise: BigInt(r.totalPaid),
            earnedPaise: BigInt(r.earnedFee),
            refundPaise: BigInt(r.potentialRefund),
            shortfallPaise: BigInt(r.indicativeShortfall),
            status: r.status as any,
            aggregateRefundStatus: aggregate.presentationStatus,
            requesterId: r.requesterId,
            makerName: reqUser?.name || "Accounts Executive",
            makerRole: reqUser?.role || "Accounts",
            approverId: r.approverId,
            checkerName: appUser?.name || null,
            checkerRole: appUser?.role || null,
            approvalNotes: r.approvalNotes,
            items: items.map((it: any) => ({
              id: it.id,
              paymentId: it.paymentId,
              paymentRef: it.payment?.paymentReference || it.paymentId,
              amountPaise: BigInt(it.amount),
              method: it.payment?.method || "Gateway",
              status: it.status as any,
              providerRef: it.providerRefundId,
              failureReason: it.failureReason,
              createdAt: it.createdAt ? it.createdAt.toISOString() : undefined,
              retryEligible: it.status === "FAILED" || it.status === "PENDING",
            })),
          };
        });
      }
    } catch {
      // Prisma offline fallback below
    }

    // If database returned no rows or is offline, check demo store
    if (cases.length === 0) {
      demoPaymentStore.seedKavyaWithdrawalData();
      const demoList = demoPaymentStore.listWithdrawals();

      cases = demoList.map((r) => {
        const isIshita = r.studentId === "stu_ishita_0587";
        const refund = demoPaymentStore.getRefundByWithdrawalId(r.id);
        const refundItems = refund ? demoPaymentStore.getRefundItemsByRefundId(refund.id) : [];
        const aggregate = deriveRefundAggregateStatus(refundItems);

        return {
          id: r.id,
          studentId: r.studentId,
          studentCode: isIshita ? "STU-0587" : "STU-1038",
          studentName: isIshita ? "Ishita Sharma" : "Kavya Rathore",
          batch: isIshita ? "JEE 2027 Evening" : "NEET 2027 Morning",
          centre: isIshita ? "Vaishali Nagar" : "Tonk Road",
          centreId: isIshita ? "cen_vaishali" : "cen_tonk",
          pathway: r.potentialRefund > 0n ? "STATUTORY_FULL_PAID" : "PART_PAID_EXTENSION",
          requestedDate: r.requestDate.toISOString().split("T")[0],
          effectiveDate: r.effectiveWithdrawalDate.toISOString().split("T")[0],
          consumedDays: r.consumedDays,
          totalServiceDays: r.totalServiceDays,
          netFeePaise: r.netFee,
          paidPaise: r.totalPaid,
          earnedPaise: r.earnedFee,
          refundPaise: r.potentialRefund,
          shortfallPaise: r.indicativeShortfall,
          status: r.status as any,
          aggregateRefundStatus: aggregate.presentationStatus,
          requesterId: r.requesterId,
          makerName: "Neha Verma",
          makerRole: "Accounts",
          approverId: r.approverId,
          checkerName: r.approverId ? "Arvind Mathur" : null,
          checkerRole: r.approverId ? "Director" : null,
          approvalNotes: r.approvalNotes,
          items: refundItems.map((it) => {
            const pay = demoPaymentStore.payments.get(it.paymentId);
            return {
              id: it.id,
              paymentId: it.paymentId,
              paymentRef: pay?.paymentReference || it.paymentId,
              amountPaise: it.amount,
              method: pay?.method || "Gateway (UPI)",
              status: it.status as any,
              providerRef: it.providerRefundId,
              failureReason: it.failureReason,
              createdAt: it.createdAt ? it.createdAt.toISOString() : undefined,
              retryEligible: it.status === "FAILED" || it.status === "PENDING",
            };
          }),
        };
      });

      // Filter by role-assigned centres if ACCOUNTS
      if (actor.role === "ACCOUNTS") {
        cases = cases.filter((c) => actor.centreIds.includes(c.centreId));
      }
      if (filter?.status) {
        cases = cases.filter((c) => c.status === filter.status);
      }
    }

    return cases;
  }
}

export const refundService = new RefundService();
