import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { paymentService } from "../services/payment-service";
import { demoPaymentStore } from "@/infrastructure/db/demo-payment-store";
import { Actor } from "@/application/actor";
import { deriveInstalmentBalance } from "@/domain/ledger";

describe("Milestone 2: Payment Intent, Order Creation & Checkout Verification Matrix", () => {
  const TEST_KEY_ID = "rzp_test_matrix123456789";
  const TEST_KEY_SECRET = "matrixSecretKey987654321";

  const authorizedActor: Actor = {
    userId: "par_rakesh_sharma",
    role: "PARENT",
    name: "Rakesh Sharma",
    phone: "+919000012345",
    centreIds: ["cen_vn"],
    linkedStudentIds: ["stu_ishita_0587"],
    consentedStudentIds: ["stu_ishita_0587"],
  };

  const unauthorizedActor: Actor = {
    userId: "par_stranger",
    role: "PARENT",
    name: "Stranger Parent",
    phone: "+919000099999",
    centreIds: [],
    linkedStudentIds: ["stu_other_9999"],
    consentedStudentIds: ["stu_other_9999"],
  };

  const nonConsentedActor: Actor = {
    userId: "par_rakesh_sharma",
    role: "PARENT",
    name: "Rakesh Sharma",
    phone: "+919000012345",
    centreIds: ["cen_vn"],
    linkedStudentIds: ["stu_ishita_0587"],
    consentedStudentIds: [], // DPDP consent missing
  };

  beforeEach(() => {
    vi.stubEnv("RAZORPAY_KEY_ID", TEST_KEY_ID);
    vi.stubEnv("RAZORPAY_KEY_SECRET", TEST_KEY_SECRET);
    vi.stubEnv("PAYMENT_PROVIDER", "MOCK_GATEWAY"); // default mock
    demoPaymentStore.reset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Razorpay order creation with valid payload
  // --------------------------------------------------------------------------
  it("Scenario 1: creates payment intent and Razorpay order with valid payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "order_rzp_intent_001",
        amount: 1500000,
        currency: "INR",
        status: "created",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const intent = await paymentService.createIntent({
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      amountPaise: 1500000n,
      actor: authorizedActor,
      provider: "RAZORPAY",
    });

    expect(intent.orderId).toBe("order_rzp_intent_001");
    expect(intent.amount).toBe(1500000n);
    expect(intent.provider).toBe("RAZORPAY");
    expect(intent.status).toBe("CREATED");
    expect((intent as any).keyId).toBe(TEST_KEY_ID);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Order creation with non-safe integer amount rejection
  // --------------------------------------------------------------------------
  it("Scenario 2: rejects amounts that exceed safe integer limits or are negative", async () => {
    // Negative amount
    await expect(
      paymentService.createIntent({
        studentId: "stu_ishita_0587",
        instalmentId: "inst_ishita_2",
        amountPaise: -5000n,
        actor: authorizedActor,
      })
    ).rejects.toThrow("greater than zero");

    // Unsafe integer
    const unsafe = BigInt(Number.MAX_SAFE_INTEGER) + 5000n;
    await expect(
      paymentService.createIntent({
        studentId: "stu_ishita_0587",
        instalmentId: "inst_ishita_2",
        amountPaise: unsafe,
        actor: authorizedActor,
      })
    ).rejects.toThrow("safe integer limit");
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Unauthorized parent rejection
  // --------------------------------------------------------------------------
  it("Scenario 3: rejects parent actors who are not linked to the student", async () => {
    await expect(
      paymentService.createIntent({
        studentId: "stu_ishita_0587",
        instalmentId: "inst_ishita_2",
        amountPaise: 1500000n,
        actor: unauthorizedActor,
      })
    ).rejects.toThrow("Access denied: student not linked");
  });

  it("Scenario 3b: rejects parent actors who do not have active DPDP consent", async () => {
    await expect(
      paymentService.createIntent({
        studentId: "stu_ishita_0587",
        instalmentId: "inst_ishita_2",
        amountPaise: 1500000n,
        actor: nonConsentedActor,
      })
    ).rejects.toThrow("Access denied: DPDP consent required");
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Settled instalment rejection
  // --------------------------------------------------------------------------
  it("Scenario 4: rejects payment intent creation for an already settled instalment", async () => {
    // Instalment 1 is already paid in full (status: PAID)
    await expect(
      paymentService.createIntent({
        studentId: "stu_ishita_0587",
        instalmentId: "inst_ishita_1",
        amountPaise: 3000000n,
        actor: authorizedActor,
      })
    ).rejects.toThrow("Instalment is already settled");
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Partial payment below minimum rejection
  // --------------------------------------------------------------------------
  it("Scenario 5: rejects partial payment below ₹1,000 when balance exceeds ₹1,000", async () => {
    // Outstanding is ₹15,000 (> ₹1,000). Trying to pay ₹500 (50000n paise)
    await expect(
      paymentService.createIntent({
        studentId: "stu_ishita_0587",
        instalmentId: "inst_ishita_2",
        amountPaise: 50000n,
        actor: authorizedActor,
      })
    ).rejects.toThrow("Minimum payment amount is ₹1,000");
  });

  it("Scenario 5b: requires exact remaining balance when balance is less than ₹1,000", async () => {
    // Artificially update Ishita's instalment 2 to have only ₹500 remaining
    demoPaymentStore.appendLedgerEntry({
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      entryType: "ALLOCATION",
      amount: -1450000n, // Leaves ₹500 (50000n paise) remaining
      referenceType: "PAYMENT",
    });

    // Trying to pay ₹300 instead of exact ₹500
    await expect(
      paymentService.createIntent({
        studentId: "stu_ishita_0587",
        instalmentId: "inst_ishita_2",
        amountPaise: 30000n,
        actor: authorizedActor,
      })
    ).rejects.toThrow("exact remaining balance must be paid");

    // Exact ₹500 succeeds
    const intent = await paymentService.createIntent({
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      amountPaise: 50000n,
      actor: authorizedActor,
    });
    expect(intent.amount).toBe(50000n);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Over-payment rejection
  // --------------------------------------------------------------------------
  it("Scenario 6: rejects payment amount exceeding current outstanding balance", async () => {
    // Outstanding on Inst 2 is ₹15,000. Trying to pay ₹20,000 (2000000n paise)
    await expect(
      paymentService.createIntent({
        studentId: "stu_ishita_0587",
        instalmentId: "inst_ishita_2",
        amountPaise: 2000000n,
        actor: authorizedActor,
      })
    ).rejects.toThrow("Payment amount exceeds current outstanding balance");
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Reusing active pending intent within 30 minutes
  // --------------------------------------------------------------------------
  it("Scenario 7: reuses active pending intent within 30 minutes without creating duplicate order", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "order_rzp_first_order",
        amount: 1500000,
        currency: "INR",
        status: "created",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    // First call creates the order
    const intent1 = await paymentService.createIntent({
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      amountPaise: 1500000n,
      actor: authorizedActor,
      provider: "RAZORPAY",
    });

    expect(intent1.orderId).toBe("order_rzp_first_order");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call 5 minutes later with identical student, instalment, amount, and provider
    const intent2 = await paymentService.createIntent({
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      amountPaise: 1500000n,
      actor: authorizedActor,
      provider: "RAZORPAY",
    });

    // Reuses intent1 without calling Razorpay API again!
    expect(intent2.orderId).toBe("order_rzp_first_order");
    expect((intent2 as any).isReused).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1); // STILL 1!
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Creating new order after 30-minute expiry
  // --------------------------------------------------------------------------
  it("Scenario 8: creates new order when previous intent is older than 30 minutes", async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: `order_rzp_order_${callCount}`,
          amount: 1500000,
          currency: "INR",
          status: "created",
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    // First intent
    const intent1 = await paymentService.createIntent({
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      amountPaise: 1500000n,
      actor: authorizedActor,
      provider: "RAZORPAY",
    });
    expect(intent1.orderId).toBe("order_rzp_order_1");

    // Manually age intent1 in store to 35 minutes ago
    const stored = demoPaymentStore.findPaymentIntent("order_rzp_order_1");
    if (stored) {
      stored.createdAt = new Date(Date.now() - 35 * 60 * 1000);
    }

    // Second call after expiry
    const intent2 = await paymentService.createIntent({
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      amountPaise: 1500000n,
      actor: authorizedActor,
      provider: "RAZORPAY",
    });

    // Created brand new order
    expect(intent2.orderId).toBe("order_rzp_order_2");
    expect((intent2 as any).isReused).toBeFalsy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Checkout signature verification success
  // --------------------------------------------------------------------------
  it("Scenario 9: checkout signature verification succeeds and transitions status to PROCESSING", async () => {
    // Seed an intent in store
    const orderId = "order_rzp_verify_test_1";
    demoPaymentStore.createPaymentIntent({
      orderId,
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      amount: 1500000n,
      currency: "INR",
      provider: "RAZORPAY",
    });

    const paymentId = "pay_rzp_capture_12345";
    const signature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const result = await paymentService.verifyCheckoutSignature({
      orderId,
      paymentId,
      signature,
      actor: authorizedActor,
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe("pending");
    expect(result.orderId).toBe(orderId);

    // Verify stored intent status is now PROCESSING
    const intent = demoPaymentStore.findPaymentIntent(orderId);
    expect(intent?.status).toBe("PROCESSING");
    expect(intent?.providerPaymentId).toBe(paymentId);
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Checkout signature verification failure (tampered signature)
  // --------------------------------------------------------------------------
  it("Scenario 10: checkout signature verification fails with tampered signature and leaves intent CREATED", async () => {
    const orderId = "order_rzp_verify_test_2";
    demoPaymentStore.createPaymentIntent({
      orderId,
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      amount: 1500000n,
      currency: "INR",
      provider: "RAZORPAY",
    });

    const paymentId = "pay_rzp_capture_99999";
    const tamperedSignature = "bad_signature_0000000000000000000000000000000000000000000000000000";

    const result = await paymentService.verifyCheckoutSignature({
      orderId,
      paymentId,
      signature: tamperedSignature,
      actor: authorizedActor,
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe("REJECTED");
    expect(result.error).toContain("Invalid payment signature");

    // Status remains CREATED
    const intent = demoPaymentStore.findPaymentIntent(orderId);
    expect(intent?.status).toBe("CREATED");
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Zero ledger mutation during Milestone 2 checkout completion
  // --------------------------------------------------------------------------
  it("Scenario 11: CRITICAL INVARIANT: Zero ledger mutation, payments, receipts, or reminders modified during checkout verification", async () => {
    const orderId = "order_rzp_verify_invariant_check";
    demoPaymentStore.createPaymentIntent({
      orderId,
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      amount: 1500000n,
      currency: "INR",
      provider: "RAZORPAY",
    });

    const ledgerCountBefore = demoPaymentStore.ledgerEntries.length;
    const paymentCountBefore = demoPaymentStore.payments.size;
    const allocationCountBefore = demoPaymentStore.allocations.length;
    const receiptCountBefore = demoPaymentStore.receipts.size;
    const remindersBefore = JSON.stringify(demoPaymentStore.reminders);

    const paymentId = "pay_rzp_invariant_1";
    const signature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const result = await paymentService.verifyCheckoutSignature({
      orderId,
      paymentId,
      signature,
      actor: authorizedActor,
    });

    expect(result.success).toBe(true);

    // STRICT INVARIANTS:
    expect(demoPaymentStore.ledgerEntries.length).toBe(ledgerCountBefore);
    expect(demoPaymentStore.payments.size).toBe(paymentCountBefore);
    expect(demoPaymentStore.allocations.length).toBe(allocationCountBefore);
    expect(demoPaymentStore.receipts.size).toBe(receiptCountBefore);
    expect(JSON.stringify(demoPaymentStore.reminders)).toBe(remindersBefore);

    // Ledger balance of Ishita remains unchanged at ₹15,000
    const inst2 = demoPaymentStore.instalments.get("inst_ishita_2")!;
    const bal = deriveInstalmentBalance(
      inst2,
      demoPaymentStore.getStudentLedger("stu_ishita_0587"),
      new Date("2026-11-02")
    );
    expect(bal.outstandingBalance).toBe(1500000n);
    expect(inst2.status).toBe("PARTIAL");
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Missing Razorpay credentials fail-closed behavior
  // --------------------------------------------------------------------------
  it("Scenario 12: fails closed if Razorpay credentials are missing when provider is RAZORPAY", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");

    await expect(
      paymentService.createIntent({
        studentId: "stu_ishita_0587",
        instalmentId: "inst_ishita_2",
        amountPaise: 1500000n,
        actor: authorizedActor,
        provider: "RAZORPAY",
      })
    ).rejects.toThrow("Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET");
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Preserving MockPaymentProvider for test suite
  // --------------------------------------------------------------------------
  it("Scenario 13: preserves MockPaymentProvider when MOCK_GATEWAY is specified", async () => {
    const intent = await paymentService.createIntent({
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      amountPaise: 1500000n,
      actor: authorizedActor,
      provider: "MOCK_GATEWAY",
    });

    expect(intent.provider).toBe("MOCK_GATEWAY");
    expect(intent.orderId).toMatch(/^order_/);
  });
});
