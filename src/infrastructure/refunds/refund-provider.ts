/**
 * Refund Provider Interface and Implementations for FeeFlow.
 * Aligned with Milestone 4B: Razorpay Normal Refund API Integration.
 *
 * Official Razorpay Docs:
 * - Normal Refund API: https://razorpay.com/docs/build/llm-docs/api/refunds/create-normal.md
 * - Idempotent Normal Refund: https://razorpay.com/docs/build/llm-docs/api/refunds/normal-refunds-idempotent.md
 * - Refund Entity: https://razorpay.com/docs/build/llm-docs/api/refunds/entity.md
 *
 * Hard Invariants:
 * 1. POST /v1/payments/{payment_id}/refund with Basic Auth.
 * 2. Razorpay Test Mode credentials only ('rzp_test_'). Fails closed in production if missing.
 * 3. All internal financial amounts in BigInt integer paise. Convert to safe integer at HTTP boundary.
 * 4. X-Refund-Idempotency: stable idempotency key reused across retries of the same submission.
 * 5. Supports fetchRefund and fetchPaymentRefunds for server-side reconciliation.
 */

export interface ExecuteRefundInput {
  refundItemId: string;
  paymentId: string;
  providerPaymentId?: string;
  amountPaise: bigint;
  idempotencyKey?: string;
  receipt?: string;
  notes?: Record<string, string>;
  forceStatus?: "SUCCEEDED" | "PROCESSING" | "FAILED";
}

export interface RefundExecutionResult {
  providerRefundId: string;
  status: "SUCCEEDED" | "PROCESSING" | "FAILED";
  failureReason?: string | null;
  speedProcessed?: string;
  speedRequested?: string;
  rawResponse?: any;
}

export interface RefundProvider {
  readonly providerName: "MOCK_REFUND" | "RAZORPAY";
  executeRefund(input: ExecuteRefundInput): Promise<RefundExecutionResult>;
  fetchRefund?(refundId: string): Promise<any>;
  fetchPaymentRefunds?(providerPaymentId: string): Promise<any[]>;
}

/**
 * Mock Refund Provider for testing and offline sandbox execution.
 */
export class MockRefundProvider implements RefundProvider {
  readonly providerName = "MOCK_REFUND" as const;
  private inMemoryRefunds: Map<string, any> = new Map();

  async executeRefund(input: ExecuteRefundInput): Promise<RefundExecutionResult> {
    if (input.amountPaise <= 0n) {
      throw new Error("Refund amount must be greater than zero");
    }

    // Support deterministic testing of failure and retry workflows
    if (
      input.forceStatus === "FAILED" ||
      input.providerPaymentId?.toLowerCase().includes("fail") ||
      input.notes?.forceFailure === "true"
    ) {
      return {
        providerRefundId: `rfnd_mock_err_${Date.now()}`,
        status: "FAILED",
        failureReason: input.notes?.failureReason || "Simulated payment gateway timeout",
      };
    }

    if (input.forceStatus === "PROCESSING") {
      const pRefundId = `rfnd_mock_proc_${Date.now().toString(36)}`;
      const refundObj = {
        id: pRefundId,
        entity: "refund",
        amount: Number(input.amountPaise),
        currency: "INR",
        payment_id: input.providerPaymentId || "pay_mock",
        status: "created",
        notes: input.notes || {},
      };
      this.inMemoryRefunds.set(pRefundId, refundObj);
      return {
        providerRefundId: pRefundId,
        status: "PROCESSING",
        rawResponse: refundObj,
      };
    }

    const timestamp = Date.now().toString(36);
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const providerRefundId = `rfnd_mock_${timestamp}_${randomSuffix}`;

    const refundObj = {
      id: providerRefundId,
      entity: "refund",
      amount: Number(input.amountPaise),
      currency: "INR",
      payment_id: input.providerPaymentId || "pay_mock",
      status: "processed",
      notes: input.notes || {},
    };
    this.inMemoryRefunds.set(providerRefundId, refundObj);

    return {
      providerRefundId,
      status: "SUCCEEDED",
      rawResponse: refundObj,
    };
  }

  async fetchRefund(refundId: string): Promise<any> {
    return this.inMemoryRefunds.get(refundId) || null;
  }

  async fetchPaymentRefunds(providerPaymentId: string): Promise<any[]> {
    return Array.from(this.inMemoryRefunds.values()).filter(
      (r) => r.payment_id === providerPaymentId
    );
  }

  addExternalRefund(refundObj: {
    id: string;
    payment_id: string;
    amount: number;
    status: string;
    notes?: any;
  }) {
    this.inMemoryRefunds.set(refundObj.id, refundObj);
  }
}

/**
 * Real Razorpay Normal Refund API Provider.
 * Communicates with POST /v1/payments/{payment_id}/refund using Basic Auth.
 * Fails closed if credentials are missing or do not belong to Test Mode ('rzp_test_').
 */
export class RazorpayRefundProvider implements RefundProvider {
  readonly providerName = "RAZORPAY" as const;
  private readonly keyId: string;
  private readonly keySecret: string;

  constructor(
    customKeyIdOrOptions?: string | { keyId?: string; keySecret?: string },
    customKeySecret?: string
  ) {
    let rawKeyId: string | undefined;
    let rawKeySecret: string | undefined;

    if (typeof customKeyIdOrOptions === "object" && customKeyIdOrOptions !== null) {
      rawKeyId = customKeyIdOrOptions.keyId ?? process.env.RAZORPAY_KEY_ID;
      rawKeySecret = customKeyIdOrOptions.keySecret ?? process.env.RAZORPAY_KEY_SECRET;
    } else {
      rawKeyId = customKeyIdOrOptions ?? process.env.RAZORPAY_KEY_ID;
      rawKeySecret = customKeySecret ?? process.env.RAZORPAY_KEY_SECRET;
    }

    // Fail closed if either credential is missing
    if (!rawKeyId || !rawKeySecret) {
      console.error(
        "[Razorpay Refund Configuration Error] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET. Refund provider fails closed."
      );
      throw new Error(
        "Razorpay credentials missing: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required"
      );
    }

    this.keyId = rawKeyId.trim().replace(/^["\x27]|["\x27]$/g, "");
    this.keySecret = rawKeySecret.trim().replace(/^["\x27]|["\x27]$/g, "");

    // Must belong to Razorpay Test Mode (rzp_test_)
    if (!this.keyId.startsWith("rzp_test_")) {
      console.error(
        "[Razorpay Refund Configuration Error] RAZORPAY_KEY_ID does not start with 'rzp_test_'. Production credentials rejected."
      );
      throw new Error(
        "CRITICAL SAFETY VIOLATION: RAZORPAY_KEY_ID must begin with 'rzp_test_'"
      );
    }
  }

  getPublicKeyId(): string {
    return this.keyId;
  }

  async executeRefund(input: ExecuteRefundInput): Promise<RefundExecutionResult> {
    if (input.amountPaise <= 0n) {
      throw new Error("Refund amount must be greater than 0");
    }

    const paymentIdToUse = input.providerPaymentId || input.paymentId;
    if (!paymentIdToUse) {
      throw new Error(
        "Original payment ID (paymentId or providerPaymentId) is required for gateway refund execution"
      );
    }

    // Enforce safe integer validation at the provider boundary
    const amountNum = Number(input.amountPaise);
    if (!Number.isSafeInteger(amountNum)) {
      throw new Error("Refund amount exceeds JavaScript safe integer limit");
    }

    // Stable idempotency key: one stable key per logical refund submission
    const idempotencyKey =
      input.idempotencyKey || `refitem_${input.refundItemId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

    // Clean truncated receipt within Razorpay's 40-char limit
    const receipt = (input.receipt || `rfnd_${input.refundItemId.slice(-12)}`).slice(0, 40);

    const payload: any = {
      amount: amountNum,
      speed: "normal",
      receipt,
      notes: {
        refundItemId: input.refundItemId,
        feeFlowPaymentId: input.paymentId,
        environment: "test",
        ...(input.notes || {}),
      },
    };

    const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`;

    let res: Response;
    try {
      res = await fetch(
        `https://api.razorpay.com/v1/payments/${paymentIdToUse}/refund`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
            "X-Refund-Idempotency": idempotencyKey,
          },
          body: JSON.stringify(payload),
        }
      );
    } catch (netErr: any) {
      console.error(
        `[Razorpay Refund API Network Error] POST /v1/payments/${paymentIdToUse}/refund failed: ${netErr.message}`
      );
      throw new Error(
        `Razorpay refund network timeout / error: ${netErr.message}. The submission status is uncertain; reconcile before re-attempting.`
      );
    }

    if (!res.ok) {
      let errText = "Unknown Razorpay error";
      try {
        const errJson = await res.json();
        errText = errJson.error?.description || JSON.stringify(errJson);
      } catch {
        errText = await res.text();
      }

      console.error(
        `[Razorpay Refund API Error] POST /v1/payments/${input.providerPaymentId}/refund failed with status ${res.status}: ${errText}`
      );
      return {
        providerRefundId: "",
        status: "FAILED",
        failureReason: errText,
      };
    }

    const data = await res.json();

    // Map response status:
    // Razorpay status can be "processed" or "created" (or "pending")
    // If "processed" (common in Test Mode synchronous responses) -> SUCCEEDED
    // If "created" / "pending" -> PROCESSING (awaiting refund.processed webhook)
    const status =
      data.status === "processed"
        ? "SUCCEEDED"
        : data.status === "failed"
        ? "FAILED"
        : "PROCESSING";

    return {
      providerRefundId: data.id,
      status,
      speedProcessed: data.speed_processed,
      speedRequested: data.speed_requested,
      rawResponse: data,
    };
  }

  /**
   * Fetches refund details from Razorpay by refund ID.
   * GET /v1/refunds/{refund_id}
   */
  async fetchRefund(refundId: string): Promise<any> {
    const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`;
    const res = await fetch(`https://api.razorpay.com/v1/refunds/${refundId}`, {
      method: "GET",
      headers: {
        Authorization: authHeader,
      },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to fetch refund ${refundId} from Razorpay: HTTP ${res.status}`);
    }

    return res.json();
  }

  /**
   * Fetches all refunds associated with a captured payment.
   * GET /v1/payments/{payment_id}/refunds
   */
  async fetchPaymentRefunds(providerPaymentId: string): Promise<any[]> {
    const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`;
    const res = await fetch(
      `https://api.razorpay.com/v1/payments/${providerPaymentId}/refunds`,
      {
        method: "GET",
        headers: {
          Authorization: authHeader,
        },
      }
    );

    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(
        `Failed to fetch refunds for payment ${providerPaymentId} from Razorpay: HTTP ${res.status}`
      );
    }

    const data = await res.json();
    return data.items || [];
  }
}

/**
 * Factory resolving the active RefundProvider based on environment.
 * If REFUND_PROVIDER is 'RAZORPAY', fails closed if credentials missing.
 */
export function getRefundProvider(
  overrideProvider?: "MOCK_GATEWAY" | "RAZORPAY" | string
): RefundProvider {
  if (overrideProvider === "MOCK_GATEWAY") {
    return new MockRefundProvider();
  }
  if (overrideProvider === "RAZORPAY") {
    return new RazorpayRefundProvider();
  }

  const explicitRefund = (process.env.REFUND_PROVIDER || "").trim().toUpperCase();
  if (explicitRefund === "RAZORPAY") {
    return new RazorpayRefundProvider();
  }
  if (explicitRefund === "MOCK_GATEWAY" || explicitRefund === "MOCK") {
    return new MockRefundProvider();
  }

  const configuredPayment = (process.env.PAYMENT_PROVIDER || "").trim().toUpperCase();

  // If in automated test suite, default to MockRefundProvider unless explicitly set to RAZORPAY
  if (process.env.NODE_ENV === "test") {
    if (explicitRefund === "RAZORPAY") {
      return new RazorpayRefundProvider();
    }
    return new MockRefundProvider();
  }

  if (configuredPayment === "RAZORPAY") {
    return new RazorpayRefundProvider();
  }

  return new MockRefundProvider();
}

export const defaultRefundProvider: RefundProvider = new MockRefundProvider();
