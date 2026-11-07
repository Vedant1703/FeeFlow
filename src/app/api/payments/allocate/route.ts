import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { getSessionActor } from "@/infrastructure/auth/session";
import { canActorManagePayments } from "@/application/actor";
import { deriveInstalmentBalance } from "@/domain/ledger";

export async function POST(req: Request) {
  try {
    const actor = await getSessionActor();
    if (!actor || !canActorManagePayments(actor)) {
      return NextResponse.json(
        { error: "Unauthorized: only Accounts staff can allocate payments" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { paymentId, instalmentId, amountPaise: rawAmountPaise, reason } = body;

    if (!paymentId || !instalmentId || !rawAmountPaise || !reason?.trim()) {
      return NextResponse.json(
        { error: "paymentId, instalmentId, amountPaise, and a clear reason are required" },
        { status: 400 }
      );
    }

    const amountPaise = BigInt(rawAmountPaise);
    if (amountPaise <= 0n) {
      return NextResponse.json(
        { error: "Allocation amount must be positive" },
        { status: 400 }
      );
    }

    // Atomic manual allocation transaction
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new Error("Payment record not found");
      }

      if (payment.unallocatedAmount < amountPaise) {
        throw new Error(
          `Cannot allocate ${amountPaise} paise: only ${payment.unallocatedAmount} paise unallocated`
        );
      }

      const instalment = await tx.instalment.findUnique({
        where: { id: instalmentId },
        include: {
          feePlan: {
            include: {
              student: {
                include: { ledgerEntries: true, centre: true },
              },
            },
          },
        },
      });

      if (!instalment) {
        throw new Error("Target instalment not found");
      }

      // Centre scope check
      if (
        actor.role === "ACCOUNTS" &&
        !actor.centreIds.includes(instalment.feePlan.student.centreId)
      ) {
        throw new Error("Access denied: student is outside your assigned centre scope");
      }

      // Check current outstanding on target instalment
      const student = instalment.feePlan.student;
      const currentBalance = deriveInstalmentBalance(
        {
          id: instalment.id,
          feePlanId: instalment.feePlanId,
          sequence: instalment.sequence,
          dueDate: instalment.dueDate,
          amount: instalment.amount,
        },
        student.ledgerEntries.map((e) => ({ ...e, amount: e.amount })),
        new Date()
      );

      if (amountPaise > currentBalance.outstandingBalance) {
        throw new Error(
          `Allocation of ${amountPaise} exceeds current outstanding of ${currentBalance.outstandingBalance}`
        );
      }

      // 1. Create Allocation record
      const allocation = await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          instalmentId: instalment.id,
          amount: amountPaise,
          allocatedById: actor.userId,
          allocationReason: reason,
        },
      });

      // 2. Append signed Ledger ALLOCATION entry
      await tx.ledgerEntry.create({
        data: {
          studentId: student.id,
          instalmentId: instalment.id,
          entryType: "ALLOCATION",
          amount: -amountPaise,
          entryDate: new Date(),
          referenceType: "MANUAL_ALLOCATION",
          referenceId: payment.id,
          createdById: actor.userId,
          notes: `Manual allocation by ${actor.name}: ${reason}`,
        },
      });

      // 3. Update Payment record: deduct unallocated amount and attach studentId
      const newUnallocated = payment.unallocatedAmount - amountPaise;
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          studentId: student.id,
          unallocatedAmount: newUnallocated,
          matchStatus: "MATCHED_MANUAL",
        },
      });

      // 4. Update Instalment cached status
      const newOutstanding = currentBalance.outstandingBalance - amountPaise;
      await tx.instalment.update({
        where: { id: instalment.id },
        data: {
          status: newOutstanding === 0n ? "PAID" : "PARTIAL",
        },
      });

      // 5. Immediate reminder stop if fully settled
      if (newOutstanding === 0n) {
        await tx.reminderDispatch.updateMany({
          where: {
            instalmentId: instalment.id,
            status: "QUEUED",
          },
          data: {
            status: "SKIPPED",
            skipReason: "Instalment settled",
          },
        });
      }

      // 6. Audit log
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          actorEmail: actor.email || actor.name,
          actorRole: actor.role,
          action: "PAYMENT_ALLOCATE",
          entityType: "Payment",
          entityId: payment.id,
          centreId: student.centreId,
          reason,
          afterJson: JSON.stringify({
            paymentId: payment.id,
            studentId: student.id,
            allocatedPaise: amountPaise.toString(),
            remainingUnallocated: newUnallocated.toString(),
          }),
        },
      });

      return {
        allocationId: allocation.id,
        newOutstanding: newOutstanding.toString(),
      };
    });

    return NextResponse.json({
      success: true,
      message: "Payment successfully allocated to student instalment",
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to allocate payment" },
      { status: 500 }
    );
  }
}
