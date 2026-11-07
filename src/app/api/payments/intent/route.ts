import { NextResponse } from "next/server";
import { getSessionActor } from "@/infrastructure/auth/session";
import { paymentService } from "@/application/services/payment-service";
import { rupeesToPaise } from "@/domain/money";

export async function POST(req: Request) {
  try {
    const actor = await getSessionActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { studentId, instalmentId, amountRupees, amountPaise: rawAmountPaise } = body;

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 });
    }

    // RBAC verification: If Parent, must be linked & consented
    if (actor.role === "PARENT") {
      if (!actor.linkedStudentIds.includes(studentId)) {
        return NextResponse.json({ error: "Access denied: student not linked" }, { status: 403 });
      }
      if (!actor.consentedStudentIds.includes(studentId)) {
        return NextResponse.json({ error: "Access denied: DPDP consent required" }, { status: 403 });
      }
    }

    let amountPaise: bigint;
    if (rawAmountPaise) {
      amountPaise = BigInt(rawAmountPaise);
    } else if (amountRupees !== undefined) {
      amountPaise = rupeesToPaise(amountRupees);
    } else {
      return NextResponse.json({ error: "Payment amount is required" }, { status: 400 });
    }

    // Labelled assumption [A-03]: Minimum payment ₹1,000 (100000n paise)
    if (amountPaise < 100000n) {
      return NextResponse.json(
        { error: "Minimum payment amount is ₹1,000" },
        { status: 400 }
      );
    }

    const intent = await paymentService.createIntent({
      studentId,
      instalmentId,
      amountPaise,
    });

    return NextResponse.json({
      success: true,
      orderId: intent.orderId,
      amountPaise: intent.amount.toString(),
      checkoutUrl: `/parent/checkout?orderId=${intent.orderId}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
