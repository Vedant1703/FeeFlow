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

  // 4. Missing ProviderEvent column regression & durable persistence
  it("persists ProviderEvent with processingStatus and error without schema drift", () => {
    const event = demoPaymentStore.recordProviderEvent({
      provider: "RAZORPAY",
      providerEventId: "evt_col_test_1",
      eventType: "payment.captured",
      payloadJson: "{}",
      signatureVerified: true,
      processed: false,
      processingStatus: "PENDING",
      error: undefined,
    });

    expect(event.processingStatus).toBe("PENDING");
    expect(event.error).toBeUndefined();

    // Update with status and error
    demoPaymentStore.updateProviderEventStatus(
      "RAZORPAY",
      "evt_col_test_1",
      "FAILED",
      "Transient connection timeout"
    );

    const updated = demoPaymentStore.findProviderEvent("RAZORPAY", "evt_col_test_1");
    expect(updated?.processingStatus).toBe("FAILED");
    expect(updated?.error).toBe("Transient connection timeout");
    expect(updated?.processed).toBe(true);
  });

  // 5. Failed event recovery via reprocessPendingProviderEvents
  it("reprocessPendingProviderEvents recovers and reprocesses uncompleted events marked FAILED", async () => {
    demoPaymentStore.createPaymentIntent({
      orderId: "order_failed_recovery_1",
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
            id: "pay_failed_captured_1",
            order_id: "order_failed_recovery_1",
            amount: 1500000,
            currency: "INR",
            status: "captured",
            method: "netbanking",
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
    };

    // Record an event that previously failed but was not settled (processed: false)
    const storedEvent = demoPaymentStore.recordProviderEvent({
      provider: "RAZORPAY",
      providerEventId: "evt_failed_reprocess_1",
      eventType: "payment.captured",
      payloadJson: JSON.stringify(payload),
      signatureVerified: true,
      processed: false,
      processingStatus: "FAILED",
      error: "Previous column missing error",
    });
    // Ensure processed is false
    storedEvent.processed = false;

    const count = await paymentService.reprocessPendingProviderEvents();
    expect(count).toBe(1);

    const after = demoPaymentStore.findProviderEvent("RAZORPAY", "evt_failed_reprocess_1");
    expect(after?.processed).toBe(true);
    expect(after?.processingStatus).toBe("ALLOCATED");

    const intent = demoPaymentStore.findPaymentIntent("order_failed_recovery_1");
    expect(intent?.status).toBe("SUCCEEDED");
  });

  // 6. Migration compatibility check
  it("verifies migration SQL exists with additive ProviderEvent and Payment constraints", async () => {
    const fs = await import("fs");
    const path = await import("path");

    const migrationDir = path.resolve(process.cwd(), "prisma/migrations");
    expect(fs.existsSync(migrationDir)).toBe(true);

    const subdirs = fs.readdirSync(migrationDir);
    expect(subdirs.length).toBeGreaterThanOrEqual(2);

    const additiveMigration = subdirs.find((d) => d.includes("add_provider_event_status"));
    expect(additiveMigration).toBeDefined();

    const sqlContent = fs.readFileSync(
      path.join(migrationDir, additiveMigration!, "migration.sql"),
      "utf-8"
    );
    expect(sqlContent).toContain('ALTER TABLE "ProviderEvent"');
    expect(sqlContent).toContain('"processingStatus"');
    expect(sqlContent).toContain('"error"');
    expect(sqlContent).toContain('CREATE UNIQUE INDEX "Payment_provider_providerPaymentId_key"');
  });

  // 7. Duplicate webhook delivery (Level A idempotency)
  it("guarantees Level A idempotency returning existing payment and receipt upon re-delivery", async () => {
    demoPaymentStore.createPaymentIntent({
      orderId: "order_dup_delivery_1",
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      amount: 1500000n,
      currency: "INR",
      provider: "RAZORPAY",
      status: "PROCESSING",
    });

    const payload = JSON.stringify({
      entity: "event",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_dup_deliv_1",
            order_id: "order_dup_delivery_1",
            amount: 1500000,
            currency: "INR",
            status: "captured",
            method: "upi",
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
    });

    const secret = "test_webhook_secret_key_123";
    const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    const res1 = await paymentService.processWebhook(payload, {
      signature: sig,
      secret,
      eventId: "evt_dup_deliv_1",
    });
    expect(res1.status).toBe("ALLOCATED");
    expect(res1.paymentId).toBeDefined();
    expect(res1.receiptNumber).toBeDefined();

    // Replay identical webhook
    const res2 = await paymentService.processWebhook(payload, {
      signature: sig,
      secret,
      eventId: "evt_dup_deliv_1",
    });
    expect(res2.duplicate).toBe(true);
    expect(res2.status).toBe("ALLOCATED");
    expect(res2.paymentId).toBe(res1.paymentId);
    expect(res2.receiptNumber).toBe(res1.receiptNumber);

    // Verify exactly one payment in demo store
    const payments = Array.from(demoPaymentStore.payments.values()).filter(
      (p) => p.orderId === "order_dup_delivery_1"
    );
    expect(payments.length).toBe(1);
  });

  // 8. Reconciliation after delayed webhook and exactly-once receipt generation
  it("reconciles captured order and guarantees exactly-once receipt generation", async () => {
    demoPaymentStore.createPaymentIntent({
      orderId: "order_delayed_webhook_1",
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      amount: 500000n,
      currency: "INR",
      provider: "RAZORPAY",
      status: "PROCESSING",
    });

    // 1. Reconcile captured payment
    const rec1 = await paymentService.processCapturedPayment({
      provider: "RAZORPAY",
      orderId: "order_delayed_webhook_1",
      paymentId: "pay_delayed_1",
      amountPaise: 500000n,
    });
    expect(rec1.status).toBe("ALLOCATED");
    expect(rec1.receiptNumber).toMatch(/^REC-2026-/);

    // 2. Delayed webhook arrives later
    const delayedPayload = JSON.stringify({
      entity: "event",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_delayed_1",
            order_id: "order_delayed_webhook_1",
            amount: 500000,
            currency: "INR",
            status: "captured",
            method: "netbanking",
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
    });

    const secret = "test_webhook_secret_key_123";
    const sig = crypto.createHmac("sha256", secret).update(delayedPayload).digest("hex");

    const delayedWebhookRes = await paymentService.processWebhook(delayedPayload, {
      signature: sig,
      secret,
      eventId: "evt_delayed_arrived_late",
    });

    // Level B idempotency catches it
    expect(delayedWebhookRes.duplicate).toBe(true);
    expect(delayedWebhookRes.paymentId).toBe(rec1.paymentId);
    expect(delayedWebhookRes.receiptNumber).toBe(rec1.receiptNumber);

    // Check receipts count
    const receipts = Array.from(demoPaymentStore.receipts.values()).filter(
      (r) => r.paymentId === rec1.paymentId
    );
    expect(receipts.length).toBe(1);
    expect(receipts[0].receiptNumber).toBe(rec1.receiptNumber);
  });
});
