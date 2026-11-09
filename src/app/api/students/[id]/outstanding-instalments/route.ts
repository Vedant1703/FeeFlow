import { NextResponse } from "next/server";
import { getSessionActor } from "@/infrastructure/auth/session";
import { paymentService } from "@/application/services/payment-service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getSessionActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
    }

    const result = await paymentService.getStudentOutstandingInstalments(id, actor);

    return NextResponse.json({
      success: true,
      student: result.student,
      feePlan: result.feePlan
        ? {
            ...result.feePlan,
            totalAmount: result.feePlan.totalAmount.toString(),
          }
        : null,
      instalments: result.instalments.map((inst) => ({
        ...inst,
        dueDate: typeof inst.dueDate === "string" ? inst.dueDate : inst.dueDate.toISOString(),
        amount: inst.amount.toString(),
        outstandingBalance: inst.outstandingBalance.toString(),
      })),
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
      { error: err.message || "Failed to retrieve student instalments" },
      { status: 500 }
    );
  }
}
