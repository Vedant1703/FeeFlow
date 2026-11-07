import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { getSessionActor } from "@/infrastructure/auth/session";
import { calculateProRataRefund } from "@/domain/refunds";
import { deriveStudentLedgerSummary } from "@/domain/ledger";

export async function POST(req: Request) {
  try {
    const actor = await getSessionActor();
    if (!actor || (actor.role !== "ACCOUNTS" && actor.role !== "DIRECTOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { studentId, effectiveWithdrawalDate, requestDate: rawRequestDate, notes } = body;

    if (!studentId || !effectiveWithdrawalDate) {
      return NextResponse.json(
        { error: "studentId and effectiveWithdrawalDate are required" },
        { status: 400 }
      );
    }

    const requestDate = rawRequestDate ? new Date(rawRequestDate) : new Date();

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        feePlans: {
          where: { status: "ACTIVE" },
          include: { instalments: { orderBy: { sequence: "asc" } } },
        },
        ledgerEntries: true,
      },
    });

    if (!student || student.feePlans.length === 0) {
      return NextResponse.json(
        { error: "Active student and fee plan required" },
        { status: 404 }
      );
    }

    const plan = student.feePlans[0];

    // Compute live financial summary
    const summary = deriveStudentLedgerSummary(
      student.id,
      plan.instalments.map((i) => ({
        id: i.id,
        feePlanId: i.feePlanId,
        sequence: i.sequence,
        dueDate: i.dueDate,
        amount: i.amount,
      })),
      student.ledgerEntries.map((e) => ({ ...e, amount: e.amount })),
      requestDate
    );

    // Calculate pro-rata refund
    const refundCalc = calculateProRataRefund({
      netFee: plan.netAmount,
      totalPaid: summary.totalPaid,
      serviceStartDate: plan.serviceStartDate,
      serviceEndDate: plan.serviceEndDate,
      effectiveWithdrawalDate: new Date(effectiveWithdrawalDate),
    });

    // 10-day provisional operational SLA target
    const slaTargetDate = new Date(requestDate.getTime() + 10 * 24 * 60 * 60 * 1000);

    const withdrawal = await prisma.withdrawal.create({
      data: {
        studentId: student.id,
        requestDate,
        effectiveWithdrawalDate: new Date(effectiveWithdrawalDate),
        consumedDays: refundCalc.consumedDays,
        totalServiceDays: refundCalc.totalServiceDays,
        netFee: refundCalc.netFee,
        totalPaid: refundCalc.totalPaid,
        earnedFee: refundCalc.earnedFee,
        deductionAmount: 0n,
        potentialRefund: refundCalc.potentialRefund,
        indicativeShortfall: refundCalc.indicativeShortfall,
        slaTargetDate,
        status: "REQUESTED",
        requesterId: actor.userId,
        approvalNotes: notes || "Pro-rata withdrawal quote submitted for director review",
      },
    });

    return NextResponse.json({
      success: true,
      withdrawalId: withdrawal.id,
      calculation: {
        totalServiceDays: refundCalc.totalServiceDays,
        consumedDays: refundCalc.consumedDays,
        earnedFeePaise: refundCalc.earnedFee.toString(),
        totalPaidPaise: refundCalc.totalPaid.toString(),
        potentialRefundPaise: refundCalc.potentialRefund.toString(),
        indicativeShortfallPaise: refundCalc.indicativeShortfall.toString(),
        shortfallIsInformationalOnly: true,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create withdrawal request" },
      { status: 500 }
    );
  }
}

