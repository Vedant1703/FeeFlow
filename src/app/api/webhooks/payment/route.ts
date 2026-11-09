import { NextResponse } from "next/server";
import { paymentService } from "@/application/services/payment-service";
import { refundService } from "@/application/services/refund-service";

export async function POST(req: Request) {
  try {
    // Read raw body as text for constant-time HMAC signature verification
    const rawBody = await req.text();

    const razorpaySig = req.headers.get("x-razorpay-signature");
    const mockSig =
      req.headers.get("x-feeflow-signature") || req.headers.get("x-signature");
    const razorpayEventId = req.headers.get("x-razorpay-event-id");

    const configuredProvider = (process.env.PAYMENT_PROVIDER || "").trim().toUpperCase();
    const isMockAllowed =
      process.env.NODE_ENV === "test" ||
      (process.env.NODE_ENV === "development" && configuredProvider === "MOCK_GATEWAY");

    // PRODUCTION MOCK ISOLATION: When RAZORPAY is configured or outside test/dev mock mode,
    // mock signatures are strictly rejected and Razorpay signatures are mandatory.
    if (configuredProvider === "RAZORPAY" || !isMockAllowed) {
      if (!razorpaySig) {
        return NextResponse.json(
          { error: "Razorpay signature header (x-razorpay-signature) is required" },
          { status: 400 }
        );
      }
    }

    const isRazorpay = Boolean(razorpaySig);
    const signature = razorpaySig || (isMockAllowed ? mockSig : null);
    const provider = isRazorpay ? "RAZORPAY" : "MOCK_GATEWAY";

    // Inspect event payload to route refund vs payment events
    let eventName = "";
    try {
      const parsed = JSON.parse(rawBody);
      eventName = parsed?.event || "";
    } catch {
      // Non-JSON payloads will be rejected cleanly by the service
    }

    if (eventName.startsWith("refund.")) {
      const refundResult = await refundService.processRefundWebhook(rawBody, {
        provider,
        signature,
        eventId: razorpayEventId,
      });

      if (!refundResult.success) {
        return NextResponse.json(
          { error: refundResult.error || "Refund webhook verification failed" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        received: true,
        duplicate: !!refundResult.duplicate,
        status: refundResult.status,
        refundItemId: refundResult.refundItemId,
      });
    }

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

