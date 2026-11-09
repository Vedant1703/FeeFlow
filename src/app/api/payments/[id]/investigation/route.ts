import { NextResponse } from "next/server";
import { getSessionActor } from "@/infrastructure/auth/session";
import { canActorManagePayments } from "@/application/actor";
import { paymentService } from "@/application/services/payment-service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getSessionActor();
    if (!actor || !canActorManagePayments(actor)) {
      return NextResponse.json(
        { error: "Unauthorized: only Accounts and Director staff can investigate payments" },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Payment ID is required" }, { status: 400 });
    }

    const details = await paymentService.getPaymentInvestigationDetails(id, actor);

    return NextResponse.json({
      success: true,
      payment: {
        ...details.payment,
        amount: details.payment.amount.toString(),
        unallocatedAmount: details.payment.unallocatedAmount.toString(),
        paymentDate: details.payment.paymentDate.toISOString(),
      },
      student: details.student,
      allocations: details.allocations.map((a) => ({
        ...a,
        amount: a.amount.toString(),
        allocatedAt: a.allocatedAt.toISOString(),
      })),
      refunds: details.refunds.map((r) => ({
        ...r,
        amount: r.amount.toString(),
        createdAt: r.createdAt.toISOString(),
      })),
      providerEvents: details.providerEvents.map((e) => ({
        ...e,
        timestamp: e.timestamp.toISOString(),
      })),
      balanceSummary: {
        capturedAmount: details.balanceSummary.capturedAmount.toString(),
        totalAllocated: details.balanceSummary.totalAllocated.toString(),
        totalRefunded: details.balanceSummary.totalRefunded.toString(),
        availableBalance: details.balanceSummary.availableBalance.toString(),
      },
    });
  } catch (err: any) {
    const msg = String(err.message || "");
    if (msg.includes("Unauthorized") || msg.includes("Access denied")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.includes("not found")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json(
      { error: err.message || "Failed to retrieve payment investigation details" },
      { status: 500 }
    );
  }
}
