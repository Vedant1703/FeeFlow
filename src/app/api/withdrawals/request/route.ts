import { NextResponse } from "next/server";
import { getSessionActor } from "@/infrastructure/auth/session";
import { refundService } from "@/application/services/refund-service";

export async function POST(req: Request) {
  try {
    const actor = await getSessionActor();
    if (!actor || (actor.role !== "ACCOUNTS" && actor.role !== "DIRECTOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const { studentId, effectiveWithdrawalDate, requestDate, notes } = body || {};

    if (!studentId || !effectiveWithdrawalDate) {
      return NextResponse.json(
        { error: "studentId and effectiveWithdrawalDate are required" },
        { status: 400 }
      );
    }

    const result = await refundService.createWithdrawalRequest({
      studentId,
      effectiveWithdrawalDate,
      requestDate,
      notes,
      actor,
    });

    const calc = result.calculation;
    return NextResponse.json({
      success: true,
      withdrawalId: result.withdrawal.id,
      calculation: {
        totalServiceDays: calc.totalServiceDays,
        consumedDays: calc.consumedDays,
        netFeePaise: calc.netFee.toString(),
        totalPaidPaise: calc.totalPaid.toString(),
        earnedFeePaise: calc.earnedFee.toString(),
        potentialRefundPaise: calc.potentialRefund.toString(),
        indicativeShortfallPaise: calc.indicativeShortfall.toString(),
        shortfallIsInformationalOnly: true,
      },
    });
  } catch (err: any) {
    const status = err.message?.includes("Permission denied") ? 403 : 400;
    return NextResponse.json(
      { error: err.message || "Failed to create withdrawal request" },
      { status }
    );
  }
}
