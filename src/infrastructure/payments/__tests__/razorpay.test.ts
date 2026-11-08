import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import {
  RazorpayPaymentProvider,
  MockPaymentProvider,
  verifyRazorpaySignature,
  getPaymentProvider,
} from "../payment-provider";

describe("Milestone 2: Razorpay Payment Provider & Signature Verification", () => {
  const TEST_KEY_ID = "rzp_test_mock123456789012";
  const TEST_KEY_SECRET = "mockSecretKeyForTesting987654321";

  beforeEach(() => {
    vi.stubEnv("RAZORPAY_KEY_ID", TEST_KEY_ID);
    vi.stubEnv("RAZORPAY_KEY_SECRET", TEST_KEY_SECRET);
    vi.stubEnv("PAYMENT_PROVIDER", "RAZORPAY");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Razorpay order creation with valid payload
  // --------------------------------------------------------------------------
  it("Scenario 1: creates Razorpay order with valid payload, correct basic auth, and integer paise", async () => {
    const mockOrderResponse = {
      id: "order_rzp_mock_001",
      entity: "order",
      amount: 1500000,
      amount_paid: 0,
      amount_due: 1500000,
      currency: "INR",
      receipt: "rcpt_ishita_1",
      status: "created",
      attempts: 0,
      notes: { studentId: "stu_ishita_0587", environment: "test" },
      created_at: Math.floor(Date.now() / 1000),
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockOrderResponse,
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new RazorpayPaymentProvider(TEST_KEY_ID, TEST_KEY_SECRET);
    const result = await provider.createOrder({
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      amountPaise: 1500000n,
    });

    expect(result.orderId).toBe("order_rzp_mock_001");
    expect(result.amountPaise).toBe(1500000n);
    expect(result.currency).toBe("INR");
    expect(result.provider).toBe("RAZORPAY");
    expect(result.keyId).toBe(TEST_KEY_ID);

    // Verify fetch call details
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect(options.method).toBe("POST");

    const expectedAuth = `Basic ${Buffer.from(`${TEST_KEY_ID}:${TEST_KEY_SECRET}`).toString("base64")}`;
    expect(options.headers.Authorization).toBe(expectedAuth);

    const sentBody = JSON.parse(options.body);
    expect(sentBody.amount).toBe(1500000);
    expect(sentBody.currency).toBe("INR");
    expect(sentBody.notes.studentId).toBe("stu_ishita_0587");
    expect(sentBody.notes.environment).toBe("test");
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Order creation with non-safe integer amount rejection
  // --------------------------------------------------------------------------
  it("Scenario 2: rejects amounts that exceed JavaScript Number.MAX_SAFE_INTEGER", async () => {
    const provider = new RazorpayPaymentProvider(TEST_KEY_ID, TEST_KEY_SECRET);
    const unsafeAmount = BigInt(Number.MAX_SAFE_INTEGER) + 1000n;

    await expect(
      provider.createOrder({
        studentId: "stu_ishita_0587",
        amountPaise: unsafeAmount,
      })
    ).rejects.toThrow("exceeds JavaScript safe integer limit");
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Missing or invalid Razorpay credentials fail closed
  // --------------------------------------------------------------------------
  it("Scenario 3: fails closed when RAZORPAY_KEY_ID is missing", () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    expect(() => new RazorpayPaymentProvider(undefined, TEST_KEY_SECRET)).toThrow(
      "Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET"
    );
  });

  it("Scenario 3b: fails closed when RAZORPAY_KEY_SECRET is missing", () => {
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");
    expect(() => new RazorpayPaymentProvider(TEST_KEY_ID, undefined)).toThrow(
      "Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET"
    );
  });

  it("Scenario 3c: fails closed when Key ID does not belong to Test Mode (rzp_test_)", () => {
    const liveKey = "rzp_live_realProductionKey1234";
    expect(() => new RazorpayPaymentProvider(liveKey, TEST_KEY_SECRET)).toThrow(
      "Only Test Mode credentials ('rzp_test_') are permitted"
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Checkout response signature verification success
  // --------------------------------------------------------------------------
  it("Scenario 4: verifies authentic Razorpay payment signature in constant-time", () => {
    const orderId = "order_rzp_test_987";
    const paymentId = "pay_rzp_test_123";
    const expectedSignature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const provider = new RazorpayPaymentProvider(TEST_KEY_ID, TEST_KEY_SECRET);
    const isValid = provider.verifyCheckoutSignature({
      orderId,
      paymentId,
      signature: expectedSignature,
    });

    expect(isValid).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Checkout response signature verification failure (tampered)
  // --------------------------------------------------------------------------
  it("Scenario 5: rejects tampered or forged checkout payment signatures", () => {
    const orderId = "order_rzp_test_987";
    const paymentId = "pay_rzp_test_123";
    const forgedSignature = "0000000000000000000000000000000000000000000000000000000000000000";

    const provider = new RazorpayPaymentProvider(TEST_KEY_ID, TEST_KEY_SECRET);
    const isValid = provider.verifyCheckoutSignature({
      orderId,
      paymentId,
      signature: forgedSignature,
    });

    expect(isValid).toBe(false);
  });

  it("Scenario 5b: handles empty or malformed signature strings safely", () => {
    expect(verifyRazorpaySignature("", "pay_1", "sig", TEST_KEY_SECRET)).toBe(false);
    expect(verifyRazorpaySignature("order_1", "", "sig", TEST_KEY_SECRET)).toBe(false);
    expect(verifyRazorpaySignature("order_1", "pay_1", "", TEST_KEY_SECRET)).toBe(false);
    expect(verifyRazorpaySignature("order_1", "pay_1", "short", TEST_KEY_SECRET)).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Provider factory behavior
  // --------------------------------------------------------------------------
  it("Scenario 6: getPaymentProvider respects overrides and environment configuration", () => {
    const mockProvider = getPaymentProvider("MOCK_GATEWAY");
    expect(mockProvider.providerName).toBe("MOCK_GATEWAY");

    const rzpProvider = getPaymentProvider("RAZORPAY");
    expect(rzpProvider.providerName).toBe("RAZORPAY");
  });

  it("Scenario 6b: MockPaymentProvider creates deterministic simulated orders", async () => {
    const mock = new MockPaymentProvider();
    const order = await mock.createOrder({
      studentId: "stu_001",
      amountPaise: 500000n,
    });
    expect(order.orderId).toMatch(/^order_/);
    expect(order.provider).toBe("MOCK_GATEWAY");
    expect(order.amountPaise).toBe(500000n);
  });
});
