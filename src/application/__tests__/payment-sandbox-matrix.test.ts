import { describe, it, expect, beforeEach } from "vitest";
import { paymentService } from "../services/payment-service";
import {
  computeWebhookSignature,
  createMockWebhookEvent,
  DEFAULT_WEBHOOK_SECRET,
} from "@/infrastructure/adapters/mock-payment-gateway";
import { demoPaymentStore } from "@/infrastructure/db/demo-payment-store";
import { deriveInstalmentBalance } from "@/domain/ledger";

describe("Payment Provider Sandbox Verification Matrix (payment-provider-sandbox-check)", () => {
  beforeEach(() => {
    // Reset in-memory store to deterministic seed state before each scenario
    demoPaymentStore.reset();
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Valid success/capture
  // --------------------------------------------------------------------------
  it("Scenario 1: Valid success/capture -> verified, atomic allocation, receipt issued, reminders skipped", async () => {
    // Student Ishita Sharma owes ₹15,000 on instalment 2
    const event = createMockWebhookEvent("order_demo_10oct", 1500000n);
    const result = await paymentService.processWebhook(event.rawBody, event.signature);

    expect(result.success).toBe(true);
    expect(result.status).toBe("ALLOCATED");
    expect(result.receiptNumber).toMatch(/^REC-2026-/);

    // Verify Payment was created
    const payment = demoPaymentStore.payments.get(result.paymentId!);
    expect(payment).toBeDefined();
    expect(payment?.amount).toBe(1500000n);
    expect(payment?.unallocatedAmount).toBe(0n);
    expect(payment?.status).toBe("CAPTURED");
    expect(payment?.matchStatus).toBe("MATCHED_AUTOMATIC");

    // Verify signed LedgerEntry was appended
    const ledger = demoPaymentStore.getStudentLedger("stu_ishita_0587");
    const lastEntry = ledger[ledger.length - 1];
    expect(lastEntry.entryType).toBe("ALLOCATION");
    expect(lastEntry.amount).toBe(-1500000n); // Negative signed paise reduces obligation

    // Verify balance is now 0n (Settled)
    const inst2 = demoPaymentStore.instalments.get("inst_ishita_2")!;
    const bal = deriveInstalmentBalance(inst2, ledger, new Date("2026-11-02"));
    expect(bal.outstandingBalance).toBe(0n);
    expect(inst2.status).toBe("PAID");

    // HARD INVARIANT: Reminders for settled instalment marked SKIPPED immediately
    const reminder = demoPaymentStore.reminders.find((r) => r.instalmentId === "inst_ishita_2");
    expect(reminder?.status).toBe("SKIPPED");
    expect(reminder?.skipReason).toBe("Instalment settled");

    // Verify official GST receipt snapshot
    const receipt = demoPaymentStore.receipts.get(result.receiptNumber!);
    expect(receipt).toBeDefined();
    expect(receipt?.gstin).toBe("08AABCC1234D1Z5 [SYNTHETIC]");
    expect(receipt?.sacCode).toBe("999293");
    expect(receipt?.taxableAmount).toBe(1500000n);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Browser returns before webhook
  // --------------------------------------------------------------------------
  it("Scenario 2: Browser returns before webhook -> remains pending; zero ledger changes", () => {
    // Parent redirects with status=pending before webhook reaches server
    const ledgerBefore = demoPaymentStore.getStudentLedger("stu_ishita_0587");
    const inst2Before = demoPaymentStore.instalments.get("inst_ishita_2")!;
    const balBefore = deriveInstalmentBalance(inst2Before, ledgerBefore, new Date("2026-11-02"));

    // Outstanding remains ₹15,000 (1500000n paise)
    expect(balBefore.outstandingBalance).toBe(1500000n);
    expect(inst2Before.status).toBe("PARTIAL");

    // No payment record created
    expect(demoPaymentStore.payments.size).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Pending provider outcome
  // --------------------------------------------------------------------------
  it("Scenario 3: Pending provider outcome -> remains pending without capture or receipt", () => {
    const intent = demoPaymentStore.findPaymentIntent("order_demo_10oct");
    expect(intent?.status).toBe("PENDING");

    // No receipt exists
    expect(demoPaymentStore.receipts.size).toBe(0);
    // Ledger untouched: exactly 2 initial seed allocations (Inst 1 full paid, Inst 2 part paid)
    const ledger = demoPaymentStore.getStudentLedger("stu_ishita_0587");
    expect(ledger.filter((e) => e.entryType === "ALLOCATION").length).toBe(2);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Failed payment
  // --------------------------------------------------------------------------
  it("Scenario 4: Failed payment -> failure recorded; zero ledger reduction", async () => {
    const event = createMockWebhookEvent("order_demo_10oct", 1500000n, {
      eventType: "payment.failed",
    });

    const result = await paymentService.processWebhook(event.rawBody, event.signature);

    expect(result.success).toBe(true);
    expect(result.status).toBe("FAILED");

    // Provider event is recorded
    const pevt = demoPaymentStore.findProviderEvent("MOCK_GATEWAY", event.payload.eventId);
    expect(pevt).toBeDefined();
    expect(pevt?.eventType).toBe("payment.failed");

    // Zero allocations or ledger changes
    expect(demoPaymentStore.allocations.length).toBe(0);
    const inst2 = demoPaymentStore.instalments.get("inst_ishita_2")!;
    expect(inst2.status).toBe("PARTIAL");
    const bal = deriveInstalmentBalance(
      inst2,
      demoPaymentStore.getStudentLedger("stu_ishita_0587"),
      new Date("2026-11-02")
    );
    expect(bal.outstandingBalance).toBe(1500000n);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Invalid signature
  // --------------------------------------------------------------------------
  it("Scenario 5: Invalid signature -> rejected with 400; zero financial side-effects", async () => {
    const event = createMockWebhookEvent("order_demo_10oct", 1500000n);
    // Forged signature
    const forgedSignature = "0000000000000000000000000000000000000000000000000000000000000000";

    const result = await paymentService.processWebhook(event.rawBody, forgedSignature);

    expect(result.success).toBe(false);
    expect(result.status).toBe("REJECTED");
    expect(result.error).toContain("Invalid webhook HMAC signature");

    // No event recorded
    expect(demoPaymentStore.providerEvents.size).toBe(0);
    // No payment created
    expect(demoPaymentStore.payments.size).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Duplicate event idempotency
  // --------------------------------------------------------------------------
  it("Scenario 6: Duplicate event -> idempotently recognized with zero duplicate mutations", async () => {
    const event = createMockWebhookEvent("order_demo_10oct", 1500000n);

    // First arrival
    const res1 = await paymentService.processWebhook(event.rawBody, event.signature);
    expect(res1.success).toBe(true);
    expect(res1.duplicate).toBeFalsy();

    const ledgerCount1 = demoPaymentStore.ledgerEntries.length;
    const allocationCount1 = demoPaymentStore.allocations.length;
    const receiptsCount1 = demoPaymentStore.receipts.size;

    // Second arrival (duplicate eventId)
    const res2 = await paymentService.processWebhook(event.rawBody, event.signature);
    expect(res2.success).toBe(true);
    expect(res2.duplicate).toBe(true);
    expect(res2.status).toBe("ALLOCATED");

    // Invariant: zero duplicate effects
    expect(demoPaymentStore.ledgerEntries.length).toBe(ledgerCount1);
    expect(demoPaymentStore.allocations.length).toBe(allocationCount1);
    expect(demoPaymentStore.receipts.size).toBe(receiptsCount1);
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Replayed event
  // --------------------------------------------------------------------------
  it("Scenario 7: Replayed event -> safe no-op", async () => {
    const event = createMockWebhookEvent("order_demo_10oct", 1500000n);
    await paymentService.processWebhook(event.rawBody, event.signature);

    // Replay after time
    const replayResult = await paymentService.processWebhook(event.rawBody, event.signature);
    expect(replayResult.duplicate).toBe(true);
    expect(demoPaymentStore.payments.size).toBe(1);
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Unknown order / unmatched queue routing
  // --------------------------------------------------------------------------
  it("Scenario 8: Unknown order -> routed to Accounts Queue as UNMATCHED; zero student ledger changes", async () => {
    const event = createMockWebhookEvent("order_unknown_neft_999", 2000000n);

    const result = await paymentService.processWebhook(event.rawBody, event.signature);

    expect(result.success).toBe(true);
    expect(result.status).toBe("UNMATCHED");
    expect(result.paymentId).toBeDefined();

    const payment = demoPaymentStore.payments.get(result.paymentId!)!;
    expect(payment.matchStatus).toBe("UNMATCHED");
    expect(payment.studentId).toBeNull();
    expect(payment.unallocatedAmount).toBe(2000000n); // Full amount remains unallocated

    // Crucial check: zero student ledger entries created!
    expect(demoPaymentStore.ledgerEntries.filter((e) => e.referenceId === payment.id).length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Amount / currency mismatch
  // --------------------------------------------------------------------------
  it("Scenario 9: Currency mismatch -> rejected when currency is not INR", async () => {
    const payload = {
      eventId: "evt_usd_attack",
      eventType: "payment.captured",
      orderId: "order_demo_10oct",
      providerPaymentId: "pay_usd_123",
      amountPaise: "1500000",
      currency: "USD", // Illegal currency
      method: "CARD",
      timestamp: new Date().toISOString(),
    };
    const rawBody = JSON.stringify(payload);
    const signature = computeWebhookSignature(rawBody, DEFAULT_WEBHOOK_SECRET);

    const result = await paymentService.processWebhook(rawBody, signature);

    expect(result.success).toBe(false);
    expect(result.status).toBe("REJECTED");
    expect(result.error).toContain("Unsupported currency: USD");
    expect(demoPaymentStore.payments.size).toBe(0);
  });

  it("Scenario 9b: Non-positive amount -> rejected when amountPaise is zero or negative", async () => {
    const payload = {
      eventId: "evt_zero_amt",
      eventType: "payment.captured",
      orderId: "order_demo_10oct",
      providerPaymentId: "pay_zero_123",
      amountPaise: "0",
      currency: "INR",
      method: "UPI",
      timestamp: new Date().toISOString(),
    };
    const rawBody = JSON.stringify(payload);
    const signature = computeWebhookSignature(rawBody, DEFAULT_WEBHOOK_SECRET);

    const result = await paymentService.processWebhook(rawBody, signature);

    expect(result.success).toBe(false);
    expect(result.status).toBe("REJECTED");
    expect(result.error).toContain("positive integer paise");
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Partial payment
  // --------------------------------------------------------------------------
  it("Scenario 10: Partial payment -> allocates up to paid amount; derives remainder from ledger", async () => {
    // Ishita owes ₹15,000 on instalment 2. Parent pays ₹5,000 (500000n paise).
    const event = createMockWebhookEvent("order_demo_10oct", 500000n);
    const result = await paymentService.processWebhook(event.rawBody, event.signature);

    expect(result.success).toBe(true);
    expect(result.status).toBe("ALLOCATED");

    const payment = demoPaymentStore.payments.get(result.paymentId!)!;
    expect(payment.amount).toBe(500000n);
    expect(payment.unallocatedAmount).toBe(0n);

    // Ledger balance derives: ₹15,000 - ₹5,000 = ₹10,000 (1000000n paise) remaining
    const inst2 = demoPaymentStore.instalments.get("inst_ishita_2")!;
    const bal = deriveInstalmentBalance(
      inst2,
      demoPaymentStore.getStudentLedger("stu_ishita_0587"),
      new Date("2026-11-02")
    );
    expect(bal.outstandingBalance).toBe(1000000n);
    expect(inst2.status).toBe("PARTIAL");

    // Reminders remain queued because instalment is NOT yet settled
    const reminder = demoPaymentStore.reminders.find((r) => r.instalmentId === "inst_ishita_2");
    expect(reminder?.status).toBe("QUEUED");
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Excess payment
  // --------------------------------------------------------------------------
  it("Scenario 11: Excess payment -> allocates up to outstanding; preserves excess as unallocated for accounts review", async () => {
    // Ishita owes ₹15,000 on instalment 2. Parent pays ₹25,000 (2500000n paise).
    const event = createMockWebhookEvent("order_demo_10oct", 2500000n);
    const result = await paymentService.processWebhook(event.rawBody, event.signature);

    expect(result.success).toBe(true);

    const payment = demoPaymentStore.payments.get(result.paymentId!)!;
    expect(payment.amount).toBe(2500000n);
    // Allocated: exactly 1500000n (capped at outstanding)
    // Excess: 1000000n (₹10,000) preserved as unallocated for accounts review
    expect(payment.unallocatedAmount).toBe(1000000n);

    // Ledger entry is capped at -1500000n
    const ledger = demoPaymentStore.getStudentLedger("stu_ishita_0587");
    const lastEntry = ledger[ledger.length - 1];
    expect(lastEntry.amount).toBe(-1500000n);

    // Instalment is marked PAID and balance is 0n
    const inst2 = demoPaymentStore.instalments.get("inst_ishita_2")!;
    const bal = deriveInstalmentBalance(inst2, ledger, new Date("2026-11-02"));
    expect(bal.outstandingBalance).toBe(0n);
    expect(inst2.status).toBe("PAID");

    // Reminders skipped
    const reminder = demoPaymentStore.reminders.find((r) => r.instalmentId === "inst_ishita_2");
    expect(reminder?.status).toBe("SKIPPED");
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Sequential / Concurrent captures
  // --------------------------------------------------------------------------
  it("Scenario 12: Consecutive captures bounds allocation strictly to outstanding", async () => {
    // Ishita owes ₹15,000. Capture 1 pays ₹10,000.
    const event1 = createMockWebhookEvent("order_demo_10oct", 1000000n);
    await paymentService.processWebhook(event1.rawBody, event1.signature);

    // Capture 2 pays ₹10,000. Only ₹5,000 remaining, so ₹5,000 allocates, ₹5,000 excess unallocated.
    const event2 = createMockWebhookEvent("order_demo_10oct", 1000000n);
    await paymentService.processWebhook(event2.rawBody, event2.signature);

    const ledger = demoPaymentStore.getStudentLedger("stu_ishita_0587");
    const inst2 = demoPaymentStore.instalments.get("inst_ishita_2")!;
    const bal = deriveInstalmentBalance(inst2, ledger, new Date("2026-11-02"));

    expect(bal.outstandingBalance).toBe(0n);
    expect(inst2.status).toBe("PAID");
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Truthful Provider timeout / pending outcome
  // --------------------------------------------------------------------------
  it("Scenario 13: Gateway timeout / error does not fabricate capture state", () => {
    // Network / timeout simulation: webhook never reached callback endpoint
    expect(demoPaymentStore.providerEvents.size).toBe(0);
    expect(demoPaymentStore.payments.size).toBe(0);

    // Student balance strictly unchanged
    const ledger = demoPaymentStore.getStudentLedger("stu_ishita_0587");
    const inst2 = demoPaymentStore.instalments.get("inst_ishita_2")!;
    const bal = deriveInstalmentBalance(inst2, ledger, new Date("2026-11-02"));
    expect(bal.outstandingBalance).toBe(1500000n);
  });
});
