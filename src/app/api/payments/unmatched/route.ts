import { NextResponse } from "next/server";
import { getSessionActor } from "@/infrastructure/auth/session";
import { canActorManagePayments } from "@/application/actor";
import { paymentService } from "@/application/services/payment-service";

export async function GET(req: Request) {
  try {
    const actor = await getSessionActor();
    if (!actor || !canActorManagePayments(actor)) {
      return NextResponse.json(
        { error: "Unauthorized: only Accounts and Director staff can view unmatched payments" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const centreId = searchParams.get("centreId") || undefined;
    const status = (searchParams.get("status") as any) || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    const payments = await paymentService.getUnmatchedPayments(
      { search, centreId, status, dateFrom, dateTo },
      actor
    );

    const serialized = payments.map((p) => ({
      id: p.id,
      paymentReference: p.paymentReference,
      provider: p.provider,
      providerPaymentId: p.providerPaymentId,
      orderId: p.orderId,
      amount: p.amount.toString(),
      unallocatedAmount: p.unallocatedAmount.toString(),
      allocatedAmount: p.allocatedAmount.toString(),
      refundedAmount: p.refundedAmount.toString(),
      availableBalance: p.availableBalance.toString(),
      paymentDate: p.paymentDate.toISOString(),
      method: p.method,
      payerDetails: p.payerDetails,
      status: p.status,
      matchStatus: p.matchStatus,
      notes: p.notes,
      student: p.student,
      centre: p.centre,
      topCandidate: p.topCandidate
        ? {
            studentId: p.topCandidate.studentId,
            studentCode: p.topCandidate.studentCode,
            name: p.topCandidate.name,
            centreName: p.topCandidate.centreName,
            score: p.topCandidate.score,
            matchReasons: p.topCandidate.matchReasons,
            isExactAmountMatch: p.topCandidate.isExactAmountMatch,
            recommendedAction: p.topCandidate.recommendedAction,
          }
        : null,
      candidateCount: p.candidateCount,
    }));

    return NextResponse.json({
      success: true,
      payments: serialized,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to retrieve unmatched payments" },
      { status: 500 }
    );
  }
}
