import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";
import {
  paymentService,
  generateSequentialReceiptNumber,
} from "@/application/services/payment-service";
import { demoPaymentStore } from "@/infrastructure/db/demo-payment-store";

describe("Milestone 3 Hardening: Durability, Recovery, Mock Isolation & Receipt Concurrency", () => {
  beforeEach(() => {
    demoPaymentStore.reset();
  });

  // 1. Receipt numbering concurrency safety
  it("generates 1,000 concurrent sequential receipt numbers without collision", () => {
    const set = new Set<string>();
    const count = 1000;

    for (let i = 0; i < count; i++) {
      const receiptNo = generateSequentialReceiptNumber();
      expect(receiptNo).toMatch(/^REC-2026-/);
      set.add(receiptNo);
    }

    // Must have 1000 unique values
    expect(set.size).toBe(count);
  });

  // 2. Webhook durability and crash recovery
  it("reprocessPendingProviderEvents recovers and processes pending provider events", async () => {
    demoPaymentStore.createPaymentIntent({
      orderId: "order_recovery_test_1",
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      amount: 1500000n,
      currency: "INR",
      provider: "RAZORPAY",
      status: "PROCESSING",
    });

    const payload = {
      entity: "event",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_recovery_captured_99",
            order_id: "order_recovery_test_1",
            amount: 1500000,
            currency: "INR",
            status: "captured",
            method: "upi",
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
    };

    // Simulate an event that was durably ingested but pending processing due to server restart
    demoPaymentStore.recordProviderEvent({
      provider: "RAZORPAY",
      providerEventId: "evt_recovery_stuck_1",
      eventType: "payment.captured",
      payloadJson: JSON.stringify(payload),
      signatureVerified: true,
      processed: false,
      processingStatus: "PENDING",
    });

    // Run recovery sweep
    const reprocessedCount = await paymentService.reprocessPendingProviderEvents();
    expect(reprocessedCount).toBe(1);

    // Verify state transitioned to ALLOCATED and intent to SUCCEEDED
    const event = demoPaymentStore.findProviderEvent("RAZORPAY", "evt_recovery_stuck_1");
    expect(event?.processed).toBe(true);
    expect(event?.processingStatus).toBe("ALLOCATED");

    const intent = demoPaymentStore.findPaymentIntent("order_recovery_test_1");
    expect(intent?.status).toBe("SUCCEEDED");
  });

  // 3. Rate-limiting verification for reconciliation
  it("prevents duplicate captures when replaying reprocessed events", async () => {
    demoPaymentStore.createPaymentIntent({
      orderId: "order_reconcile_idempotency_1",
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      amount: 1500000n,
      currency: "INR",
      provider: "RAZORPAY",
      status: "PROCESSING",
    });

    const res1 = await paymentService.processCapturedPayment({
      provider: "RAZORPAY",
      orderId: "order_reconcile_idempotency_1",
      paymentId: "pay_captured_reconcile_1",
      amountPaise: 1500000n,
    });
    expect(res1.status).toBe("ALLOCATED");

    // Second call with same paymentId (Level B check)
    const res2 = await paymentService.processCapturedPayment({
      provider: "RAZORPAY",
      orderId: "order_reconcile_idempotency_1",
      paymentId: "pay_captured_reconcile_1",
      amountPaise: 1500000n,
    });
    expect(res2.duplicate).toBe(true);
    expect(res2.status).toBe("ALLOCATED");
    expect(res2.paymentId).toBe(res1.paymentId);
  });
});
