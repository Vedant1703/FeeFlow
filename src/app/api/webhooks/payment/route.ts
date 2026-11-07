import { NextResponse } from "next/server";
import { paymentService } from "@/application/services/payment-service";

export async function POST(req: Request) {
  try {
    // Read raw body as text for HMAC signature verification
    const rawBody = await req.text();

    const signatureHeader =
      req.headers.get("x-feeflow-signature") ||
      req.headers.get("x-razorpay-signature") ||
      req.headers.get("x-signature");

    const result = await paymentService.processWebhook(rawBody, signatureHeader);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Webhook verification failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      received: true,
      duplicate: !!result.duplicate,
      status: result.status,
      paymentId: result.paymentId,
      receiptNumber: result.receiptNumber,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error processing webhook" },
      { status: 500 }
    );
  }
}
