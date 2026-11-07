import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { getSessionActor } from "@/infrastructure/auth/session";
import { validateMakerChecker, generateWithdrawalWaivers, planRefundItems } from "@/domain/refunds";
import { deriveStudentLedgerSummary } from "@/domain/ledger";

export async function POST(req: Request) {
  try {
    const actor = await getSessionActor();
    if (!actor || actor.role !== "DIRECTOR") {
      return NextResponse.json(
        { error: "Unauthorized: only Founder-Director can approve withdrawals and refunds" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { withdrawalId, notes } = body;

    if (!withdrawalId) {
      return NextResponse.json({ error: "withdrawalId is required" }, { status: 400 });
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        student: {
          include: {
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

    if (!withdrawal) {
      return NextResponse.json({ error: "Withdrawal record not found" }, { status: 404 });
    }

    // HARD INVARIANT: Maker-Checker Enforcement
    const makerChecker = validateMakerChecker(withdrawal.requesterId, actor.userId);
    if (!makerChecker.allowed) {
      return NextResponse.json(
        { error: makerChecker.error || "Maker-checker violation: requester cannot approve own request" },
        { status: 403 }
      );
    }

    // Atomic execution of withdrawal approval, ledger waivers, and refund items
    const result = await prisma.$transaction(async (tx) => {
      const student = withdrawal.student;
      const activePlan = student.feePlans[0];

      // 1. Update withdrawal status
      const approvedWithdrawal = await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: "APPROVED",
          approverId: actor.userId,
          approvedAt: new Date(),
          approvalNotes: notes || "Approved by Director under MoE 2024 pro-rata refund policy",
        },
      });

      // 2. Mark student status as WITHDRAWN
      await tx.student.update({
        where: { id: student.id },
        data: { status: "WITHDRAWN" },
      });

      // 3. Mark fee plan as WITHDRAWN
      if (activePlan) {
        await tx.feePlan.update({
          where: { id: activePlan.id },
          data: { status: "WITHDRAWN" },
        });

        // Derive current instalment balances to know exact unpaid amounts to waive
        const summary = deriveStudentLedgerSummary(
          student.id,
          activePlan.instalments.map((i) => ({
            id: i.id,
            feePlanId: i.feePlanId,
            sequence: i.sequence,
            dueDate: i.dueDate,
            amount: i.amount,
          })),
          student.ledgerEntries.map((e) => ({ ...e, amount: e.amount })),
          new Date()
        );

        // 4. Generate WAIVER entries for all unpaid ordinary instalments (waives ordinary dues to ₹0)
        const waivers = generateWithdrawalWaivers(
          student.id,
          withdrawal.id,
          summary.instalments.map((b) => ({
            id: b.instalmentId,
            sequence: b.sequence,
            outstandingBalance: b.outstandingBalance,
          })),
          new Date()
        );

        for (const w of waivers) {
          await tx.ledgerEntry.create({
            data: {
              studentId: w.studentId,
              instalmentId: w.instalmentId,
              entryType: "WAIVER",
              amount: w.amount,
              entryDate: w.entryDate,
              referenceType: w.referenceType,
              referenceId: w.referenceId,
              createdById: actor.userId,
              notes: w.notes,
            },
          });

          // Update instalment status
          if (w.instalmentId) {
            await tx.instalment.update({
              where: { id: w.instalmentId },
              data: { status: "WAIVED" },
            });
          }
        }

        // Cancel any pending reminders for this student
        await tx.reminderDispatch.updateMany({
          where: {
            studentId: student.id,
            status: "QUEUED",
          },
          data: {
            status: "SKIPPED",
            skipReason: "Student withdrawn",
          },
        });
      }

      // 5. If potentialRefund > 0, create Refund and plan RefundItems
      let refundId: string | null = null;
      if (withdrawal.potentialRefund > 0n) {
        const refund = await tx.refund.create({
          data: {
            withdrawalId: withdrawal.id,
            studentId: student.id,
            totalApprovedAmount: withdrawal.potentialRefund,
            status: "PENDING_EXECUTION",
          },
        });
        refundId = refund.id;

        // Plan items against captured payments
        const paymentSnapshots = student.payments.map((p) => {
          const refundedSoFar = p.refundItems
            .filter((ri) => ri.status === "SUCCEEDED" || ri.status === "PENDING")
            .reduce((sum, ri) => sum + ri.amount, 0n);
          return {
            id: p.id,
            capturedAmount: p.amount,
            alreadyRefundedAmount: refundedSoFar,
          };
        });

        const itemsPlan = planRefundItems(withdrawal.potentialRefund, paymentSnapshots);

        for (const item of itemsPlan) {
          if (item.allocatedRefundPaise > 0n) {
            await tx.refundItem.create({
              data: {
                refundId: refund.id,
                paymentId: item.paymentId,
                amount: item.allocatedRefundPaise,
                status: "PENDING",
              },
            });
          }
        }
      }

      // 6. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          actorEmail: actor.email || actor.name,
          actorRole: actor.role,
          action: "WITHDRAWAL_APPROVE",
          entityType: "Withdrawal",
          entityId: withdrawal.id,
          centreId: student.centreId,
          reason: notes || "Approved withdrawal & pro-rata refund",
          afterJson: JSON.stringify({
            withdrawalId: withdrawal.id,
            studentId: student.id,
            potentialRefund: withdrawal.potentialRefund.toString(),
            indicativeShortfall: withdrawal.indicativeShortfall.toString(),
            refundId,
          }),
        },
      });

      return {
        withdrawalId: approvedWithdrawal.id,
        refundId,
        potentialRefund: withdrawal.potentialRefund.toString(),
      };
    });

    return NextResponse.json({
      success: true,
      message: "Withdrawal approved; ordinary instalments waived to ₹0",
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to approve withdrawal" },
      { status: 500 }
    );
  }
}
