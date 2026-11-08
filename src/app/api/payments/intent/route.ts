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

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const { studentId, instalmentId, amountRupees, amountPaise: rawAmountPaise, provider } = body;

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
    try {
      if (rawAmountPaise !== undefined && rawAmountPaise !== null) {
        amountPaise = BigInt(rawAmountPaise);
      } else if (amountRupees !== undefined && amountRupees !== null) {
        amountPaise = rupeesToPaise(amountRupees);
      } else {
        return NextResponse.json({ error: "Payment amount is required" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid payment amount format" }, { status: 400 });
    }

    if (amountPaise <= 0n) {
      return NextResponse.json(
        { error: "Payment amount must be greater than zero" },
        { status: 400 }
      );
    }

    if (!Number.isSafeInteger(Number(amountPaise))) {
      return NextResponse.json(
        { error: "Payment amount exceeds safe integer limit" },
        { status: 400 }
      );
    }

    const intent = await paymentService.createIntent({
      studentId,
      instalmentId,
      amountPaise,
      actor,
      provider,
    });

    return NextResponse.json({
      success: true,
      orderId: intent.orderId,
      amountPaise: intent.amount.toString(),
      amountRupees: Number(intent.amount) / 100,
      currency: intent.currency || "INR",
      provider: intent.provider,
      keyId: (intent as any).keyId,
      isReused: (intent as any).isReused || false,
      checkoutUrl: `/parent/checkout?orderId=${intent.orderId}`,
    });
  } catch (err: any) {
    const msg = String(err.message || "");

    // Fail closed with 503 if Razorpay credentials are missing or invalid
    if (msg.includes("Razorpay configuration error")) {
      return NextResponse.json({ error: "Payment service temporarily unavailable" }, { status: 503 });
    }

    // Financial validation errors return 400
    if (
      msg.includes("Minimum payment amount") ||
      msg.includes("Payment amount exceeds") ||
      msg.includes("already settled") ||
      msg.includes("cancelled or waived") ||
      msg.includes("withdrawn") ||
      msg.includes("safe integer")
    ) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // RBAC errors return 403
    if (msg.includes("Access denied")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }

    return NextResponse.json(
      { error: msg || "Failed to create payment intent" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const actor = await getSessionActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const intent = await paymentService.getIntent(orderId);
    if (!intent) {
      return NextResponse.json({ error: "Payment intent not found" }, { status: 404 });
    }

    if (actor.role === "PARENT" && !actor.linkedStudentIds.includes(intent.studentId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      intent: {
        id: intent.id,
        orderId: intent.orderId,
        studentId: intent.studentId,
        studentName: intent.studentName || "Ishita Sharma",
        studentCode: intent.studentCode || "STU-0587",
        instalmentId: intent.instalmentId,
        amountPaise: intent.amount.toString(),
        amountRupees: Number(intent.amount) / 100,
        currency: intent.currency || "INR",
        provider: intent.provider,
        keyId: intent.keyId,
        status: intent.status,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch payment intent" },
      { status: 500 }
    );
  }
}
