import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionActor } from "@/infrastructure/auth/session";
import { paymentService } from "@/application/services/payment-service";
import { getPaymentProvider } from "@/infrastructure/payments/payment-provider";

const ReconcileIntentSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
});

// Server-side in-memory cooldown cache: orderId -> timestamp ms
const reconciliationCooldowns = new Map<string, number>();
const RECONCILIATION_COOLDOWN_MS = 10000; // 10 seconds per order

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

    const parseResult = ReconcileIntentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { orderId } = parseResult.data;

    // 1. Locate PaymentIntent
    const intent = await paymentService.getIntent(orderId);
    if (!intent) {
      return NextResponse.json({ error: "Payment intent not found" }, { status: 404 });
    }

    // 2. Authorization check
    if (actor.role === "PARENT" && !actor.linkedStudentIds.includes(intent.studentId)) {
      return NextResponse.json(
        { error: "Access denied: student not linked to parent" },
        { status: 403 }
      );
    }

    // 3. If intent already SUCCEEDED, return settled truth with receipt snapshot
    if (intent.status === "SUCCEEDED") {
      const paymentInfo = await paymentService.getPaymentForOrder(orderId);
      return NextResponse.json({
        success: true,
        settled: true,
        status: "SUCCEEDED",
        orderId: intent.orderId,
        paymentId: paymentInfo?.paymentId,
        receiptNumber: paymentInfo?.receiptNumber,
      });
    }

    // 4. Rate-limiting check: Prevent excessive external API calls
    const now = Date.now();
    const lastReconciled = reconciliationCooldowns.get(orderId) || 0;
    if (now - lastReconciled < RECONCILIATION_COOLDOWN_MS) {
      return NextResponse.json({
        success: true,
        settled: false,
        status: intent.status,
        orderId: intent.orderId,
        message: "Payment confirmation is pending. Provider was queried recently.",
      });
    }
    reconciliationCooldowns.set(orderId, now);

    // 5. If CREATED or PROCESSING, fetch actual provider state using server-side credentials
    const provider = getPaymentProvider(intent.provider as any);
    let payments: any[] = [];
    if (typeof provider.fetchOrderPayments === "function") {
      try {
        payments = await provider.fetchOrderPayments(intent.orderId);
      } catch (err: any) {
        console.error(`[Reconcile Intent Error] Provider fetch failed: ${err.message}`);
      }
    }

    const captured = payments.find((p: any) => p.status === "captured");
    if (captured) {
      // Route captured payment through the authoritative settlement pipeline
      const result = await paymentService.processCapturedPayment({
        provider: (intent.provider || "RAZORPAY") as any,
        orderId: intent.orderId,
        paymentId: captured.id,
        amountPaise: BigInt(captured.amount),
        currency: captured.currency || "INR",
        method: captured.method || "UPI",
        payerDetails: captured.vpa || captured.email || captured.contact || null,
        actor,
      });

      return NextResponse.json({
        success: true,
        settled: result.status === "ALLOCATED",
        status: result.status,
        orderId: intent.orderId,
        paymentId: captured.id,
        receiptNumber: result.receiptNumber,
      });
    }

    // Still pending / not captured
    return NextResponse.json({
      success: true,
      settled: false,
      status: intent.status,
      orderId: intent.orderId,
      message: "Payment confirmation is still pending with the provider",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to reconcile payment intent" },
      { status: 500 }
    );
  }
}
