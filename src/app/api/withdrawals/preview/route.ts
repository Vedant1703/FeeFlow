import { NextResponse } from "next/server";
import { getSessionActor } from "@/infrastructure/auth/session";
import { refundService } from "@/application/services/refund-service";

export async function POST(req: Request) {
  try {
    const actor = await getSessionActor();
    if (!actor || (actor.role !== "ACCOUNTS" && actor.role !== "DIRECTOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { studentId, effectiveWithdrawalDate } = body || {};

    if (!studentId || !effectiveWithdrawalDate) {
      return NextResponse.json(
        { error: "studentId and effectiveWithdrawalDate are required" },
        { status: 400 }
      );
    }

    const preview = await refundService.previewWithdrawalCalculation({
      studentId,
      effectiveWithdrawalDate,
      actor,
    });

    const calc = preview.calculation;
    return NextResponse.json({
      success: true,
      student: preview.student,
      calculation: {
        totalServiceDays: calc.totalServiceDays,
        consumedDays: calc.consumedDays,
        netFeePaise: calc.netFee.toString(),
        totalPaidPaise: calc.totalPaid.toString(),
        earnedFeePaise: calc.earnedFee.toString(),
        deductionAmountPaise: calc.deductionAmount.toString(),
        potentialRefundPaise: calc.potentialRefund.toString(),
        indicativeShortfallPaise: calc.indicativeShortfall.toString(),
        isShortfall: calc.isShortfall,
        shortfallIsInformationalOnly: true,
        slaTargetDays: calc.slaTargetDays,
        policyVersion: calc.policyVersion,
      },
    });
  } catch (err: any) {
    const status = err.message?.includes("Permission denied") ? 403 : 400;
    return NextResponse.json(
      { error: err.message || "Failed to preview withdrawal calculation" },
      { status }
    );
  }
}
