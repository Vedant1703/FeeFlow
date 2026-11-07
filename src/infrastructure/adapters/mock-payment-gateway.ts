import crypto from "crypto";

export const DEFAULT_WEBHOOK_SECRET =
  process.env.WEBHOOK_HMAC_SECRET || "feeflow_demo_webhook_hmac_secret_key_12345";

export interface PaymentWebhookPayload {
  eventId: string;
  eventType: "payment.captured" | "payment.failed";
  orderId?: string | null;
  providerPaymentId: string;
  amountPaise: string; // Serialized string representation of BigInt paise
  currency: string;
  method: string;
  payerDetails?: string | null;
  timestamp: string;
}

/**
 * Computes an HMAC SHA-256 hex digest for a raw webhook body.
 */
export function computeWebhookSignature(
  rawBody: string,
  secret: string = DEFAULT_WEBHOOK_SECRET
): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

/**
 * Validates the HMAC signature of an incoming payment webhook.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string = DEFAULT_WEBHOOK_SECRET
): boolean {
  if (!signatureHeader || !rawBody) return false;

  const expectedSignature = computeWebhookSignature(rawBody, secret);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader.trim()),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Creates a simulated mock payment order.
 */
export function createMockOrder(input: {
  studentId: string;
  instalmentId?: string;
  amountPaise: bigint;
}) {
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  const orderId = `order_${timestamp}_${randomSuffix}`;

  return {
    orderId,
    amountPaise: input.amountPaise,
    currency: "INR",
    provider: "MOCK_GATEWAY",
  };
}

/**
 * Helper to construct a signed webhook test payload.
 */
export function createMockWebhookEvent(
  orderId: string | null,
  amountPaise: bigint,
  options: {
    eventType?: "payment.captured" | "payment.failed";
    payerDetails?: string;
    method?: string;
    secret?: string;
  } = {}
) {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const providerPaymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const payload: PaymentWebhookPayload = {
    eventId,
    eventType: options.eventType || "payment.captured",
    orderId,
    providerPaymentId,
    amountPaise: amountPaise.toString(),
    currency: "INR",
    method: options.method || "UPI",
    payerDetails: options.payerDetails || "Parent UPI",
    timestamp: new Date().toISOString(),
  };

  const rawBody = JSON.stringify(payload);
  const signature = computeWebhookSignature(rawBody, options.secret || DEFAULT_WEBHOOK_SECRET);

  return {
    rawBody,
    signature,
    payload,
  };
}
