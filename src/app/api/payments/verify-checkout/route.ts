import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionActor } from "@/infrastructure/auth/session";
import { paymentService } from "@/application/services/payment-service";

const VerifyCheckoutSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  paymentId: z.string().min(1, "Payment ID is required"),
  signature: z.string().min(1, "Signature is required"),
});

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

    const parseResult = VerifyCheckoutSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { orderId, paymentId, signature } = parseResult.data;

    const result = await paymentService.verifyCheckoutSignature({
      orderId,
      paymentId,
      signature,
      actor,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Signature verification failed" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      status: "pending",
      orderId: result.orderId,
      message:
        "Payment signature verified. Payment is confirming and final receipt will be generated upon bank webhook confirmation.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to verify checkout" },
      { status: 500 }
    );
  }
}
