/**
 * Refund Provider Interface and Mock Implementation for FeeFlow.
 * Aligned with Milestone 4A: In Milestone 4A, MockRefundProvider is used.
 * Razorpay Refund API is strictly reserved for Milestone 4B.
 */

export interface ExecuteRefundInput {
  refundItemId: string;
  paymentId: string;
  providerPaymentId?: string;
  amountPaise: bigint;
  reason?: string;
  notes?: Record<string, string>;
  forceStatus?: "SUCCEEDED" | "FAILED";
}

export interface RefundExecutionResult {
  providerRefundId: string;
  status: "SUCCEEDED" | "FAILED";
  failureReason?: string;
}

export interface RefundProvider {
  readonly providerName: "MOCK_REFUND" | "RAZORPAY";
  executeRefund(input: ExecuteRefundInput): Promise<RefundExecutionResult>;
}

/**
 * Mock Refund Provider for Milestone 4A, testing, and offline execution.
 */
export class MockRefundProvider implements RefundProvider {
  readonly providerName = "MOCK_REFUND" as const;

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

    const timestamp = Date.now().toString(36);
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    return {
      providerRefundId: `rfnd_mock_${timestamp}_${randomSuffix}`,
      status: "SUCCEEDED",
    };
  }
}

export const defaultRefundProvider: RefundProvider = new MockRefundProvider();
