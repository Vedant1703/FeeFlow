import crypto from "crypto";

export interface CreateOrderInput {
  studentId: string;
  instalmentId?: string;
  amountPaise: bigint;
  parentId?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface OrderResult {
  orderId: string;
  amountPaise: bigint;
  currency: string;
  provider: "MOCK_GATEWAY" | "RAZORPAY";
  keyId?: string;
}

export interface VerifyCheckoutSignatureInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface PaymentProvider {
  readonly providerName: "MOCK_GATEWAY" | "RAZORPAY";
  createOrder(input: CreateOrderInput): Promise<OrderResult>;
  verifyCheckoutSignature(input: VerifyCheckoutSignatureInput): boolean;
}

/**
 * Constant-time verification of Razorpay payment signature:
 * HMAC_SHA256(order_id + "|" + payment_id, secret)
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  if (!orderId || !paymentId || !signature || !secret) {
    return false;
  }

  try {
    const payload = `${orderId}|${paymentId}`;
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    const sigBuf = Buffer.from(signature.trim());
    const expBuf = Buffer.from(expected);

    if (sigBuf.length !== expBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * Mock Payment Provider for offline tests, CI/CD, and demo sandbox mode.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly providerName = "MOCK_GATEWAY" as const;

  async createOrder(input: CreateOrderInput): Promise<OrderResult> {
    if (input.amountPaise <= 0n) {
      throw new Error("Payment amount must be greater than zero");
    }

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

  verifyCheckoutSignature(input: VerifyCheckoutSignatureInput): boolean {
    if (!input.orderId || !input.paymentId || !input.signature) {
      return false;
    }
    // Accept valid signatures or deterministic mock signature
    const secret =
      process.env.WEBHOOK_HMAC_SECRET || "feeflow_demo_webhook_hmac_secret_key_12345";
    return (
      verifyRazorpaySignature(input.orderId, input.paymentId, input.signature, secret) ||
      input.signature.startsWith("sig_mock_")
    );
  }
}

/**
 * Real Razorpay Test Mode Provider.
 * Communicates directly with Razorpay Orders API via HTTP Basic Auth.
 * Fails closed if credentials are missing or do not belong to Test Mode.
 */
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly providerName = "RAZORPAY" as const;
  private readonly keyId: string;
  private readonly keySecret: string;

  constructor(customKeyId?: string, customKeySecret?: string) {
    const rawKeyId = customKeyId ?? process.env.RAZORPAY_KEY_ID;
    const rawKeySecret = customKeySecret ?? process.env.RAZORPAY_KEY_SECRET;

    // Fail closed if either credential is missing
    if (!rawKeyId || !rawKeySecret) {
      console.error(
        "[Razorpay Configuration Error] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET. Payment provider fails closed."
      );
      throw new Error(
        "Razorpay configuration error: Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET"
      );
    }

    // Strip wrapping quotes if present
    this.keyId = rawKeyId.trim().replace(/^["\x27]|["\x27]$/g, "");
    this.keySecret = rawKeySecret.trim().replace(/^["\x27]|["\x27]$/g, "");

    // Must belong to Razorpay Test Mode (rzp_test_)
    if (!this.keyId.startsWith("rzp_test_")) {
      console.error(
        "[Razorpay Configuration Error] RAZORPAY_KEY_ID does not start with 'rzp_test_'. Production credentials rejected."
      );
      throw new Error(
        "Razorpay configuration error: Only Test Mode credentials ('rzp_test_') are permitted"
      );
    }
  }

  getPublicKeyId(): string {
    return this.keyId;
  }

  async createOrder(input: CreateOrderInput): Promise<OrderResult> {
    if (input.amountPaise <= 0n) {
      throw new Error("Payment amount must be greater than zero");
    }

    // Enforce safe integer validation at the provider boundary
    const amountNum = Number(input.amountPaise);
    if (!Number.isSafeInteger(amountNum)) {
      throw new Error("Payment amount exceeds JavaScript safe integer limit");
    }

    // Generate truncated unique receipt within Razorpay's 40-char limit
    const studentSuffix = (input.studentId || "stu").slice(-8);
    const timeSuffix = Date.now().toString(36);
    const receipt = (input.receipt || `rcpt_${studentSuffix}_${timeSuffix}`).slice(0, 40);

    const notes: Record<string, string> = {
      studentId: input.studentId,
      instalmentId: input.instalmentId || "",
      parentId: input.parentId || "",
      environment: "test",
      ...(input.notes || {}),
    };

    const payload = {
      amount: amountNum,
      currency: "INR",
      receipt,
      notes,
    };

    const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`;

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let errText = "Unknown Razorpay error";
      try {
        const errJson = await res.json();
        errText = errJson.error?.description || JSON.stringify(errJson);
      } catch {
        errText = await res.text();
      }

      // Log server error without exposing secrets
      console.error(
        `[Razorpay API Error] Order creation failed with status ${res.status}: ${errText}`
      );
      throw new Error("Failed to create Razorpay payment order");
    }

    const data = await res.json();

    return {
      orderId: data.id,
      amountPaise: BigInt(data.amount),
      currency: data.currency || "INR",
      provider: "RAZORPAY",
      keyId: this.keyId,
    };
  }

  verifyCheckoutSignature(input: VerifyCheckoutSignatureInput): boolean {
    return verifyRazorpaySignature(
      input.orderId,
      input.paymentId,
      input.signature,
      this.keySecret
    );
  }
}

/**
 * Factory to retrieve the configured payment provider.
 */
export function getPaymentProvider(
  overrideProvider?: "MOCK_GATEWAY" | "RAZORPAY"
): PaymentProvider {
  if (overrideProvider === "MOCK_GATEWAY") {
    return new MockPaymentProvider();
  }
  if (overrideProvider === "RAZORPAY") {
    return new RazorpayPaymentProvider();
  }

  const configured = (process.env.PAYMENT_PROVIDER || "").trim().toUpperCase();

  if (configured === "RAZORPAY") {
    return new RazorpayPaymentProvider();
  }

  if (configured === "MOCK_GATEWAY") {
    return new MockPaymentProvider();
  }

  // If in automated test suite, default to MockPaymentProvider unless explicitly set to RAZORPAY
  if (process.env.NODE_ENV === "test") {
    return new MockPaymentProvider();
  }

  // If Razorpay keys are available in dev/prod, use Razorpay
  const keyId = process.env.RAZORPAY_KEY_ID?.trim().replace(/^["\x27]|["\x27]$/g, "");
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim().replace(/^["\x27]|["\x27]$/g, "");

  if (keyId && keySecret && keyId.startsWith("rzp_test_")) {
    return new RazorpayPaymentProvider();
  }

  return new MockPaymentProvider();
}
