import { NextResponse } from "next/server";
import { paymentService } from "@/application/services/payment-service";

export async function POST(req: Request) {
  try {
    // Read raw body as text for constant-time HMAC signature verification
    const rawBody = await req.text();

    const razorpaySig = req.headers.get("x-razorpay-signature");
    const mockSig =
      req.headers.get("x-feeflow-signature") || req.headers.get("x-signature");
    const razorpayEventId = req.headers.get("x-razorpay-event-id");

    const isRazorpay = Boolean(razorpaySig);
    const signature = razorpaySig || mockSig;
    const provider = isRazorpay ? "RAZORPAY" : "MOCK_GATEWAY";

    const result = await paymentService.processWebhook(rawBody, {
      provider,
      signature,
      eventId: razorpayEventId,
    });

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

