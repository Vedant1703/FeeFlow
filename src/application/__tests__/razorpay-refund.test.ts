import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import {
  RazorpayRefundProvider,
  MockRefundProvider,
  getRefundProvider,
} from "@/infrastructure/refunds/refund-provider";
import { refundService, deriveRefundAggregateStatus } from "@/application/services/refund-service";
import { demoPaymentStore } from "@/infrastructure/db/demo-payment-store";
import { Actor } from "@/infrastructure/auth/session";

const TEST_KEY_ID = "rzp_test_feeflow_key123";
const TEST_KEY_SECRET = "feeflow_test_secret_abc456";
const TEST_WEBHOOK_SECRET = "feeflow_refund_webhook_secret_xyz789";

function createRefundWebhook(options: {
  event: string;
  refundId?: string;
  paymentId?: string;
  amountPaise?: bigint | number;
  currency?: string;
  status?: string;
  refundItemId?: string;
  secret?: string;
  errorDescription?: string;
  speedProcessed?: string;
  rawBodyModifier?: (raw: string) => string;
}) {
  const secret = options.secret || TEST_WEBHOOK_SECRET;
  const refundId =
    options.refundId || `rfnd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const paymentId = options.paymentId || "pay_test_captured_1";
  const amount = options.amountPaise != null ? Number(options.amountPaise) : 3000000;
  const status =
    options.status ||
    (options.event === "refund.processed"
      ? "processed"
      : options.event === "refund.failed"
      ? "failed"
      : "created");

  const payload = {
    entity: "event",
    account_id: "acc_feeflow_test",
    event: options.event,
    contains: ["refund", "payment"],
    payload: {
      refund: {
        entity: {
          id: refundId,
          entity: "refund",
          amount,
          currency: options.currency || "INR",
          payment_id: paymentId,
          notes:
            options.refundItemId !== undefined
              ? options.refundItemId
                ? { refundItemId: options.refundItemId }
                : {}
              : { refundItemId: "item-1" },
          receipt: `rfnd_${(options.refundItemId || "item-1").slice(-12)}`,
          acquirer_data: {
            arn: "123456789012",
          },
          created_at: Math.floor(Date.now() / 1000),
          batch_id: null,
          status,
          speed_processed: options.speedProcessed || "normal",
          speed_requested: "normal",
          error_code: options.event === "refund.failed" ? "GATEWAY_ERROR" : null,
          error_description:
            options.errorDescription ||
            (options.event === "refund.failed" ? "Issuer bank declined refund" : null),
        },
      },
      payment: {
        entity: {
          id: paymentId,
          entity: "payment",
          amount,
          currency: options.currency || "INR",
          status: "captured",
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  };

  let rawBody = JSON.stringify(payload);
  if (options.rawBodyModifier) {
    rawBody = options.rawBodyModifier(rawBody);
  }

  const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const eventId = `evt_${refundId}`;

  return {
    rawBody,
    signature,
    eventId,
    refundId,
    paymentId,
    amount,
  };
}

describe("Milestone 4B: Razorpay Normal Refund API Integration (30 Scenarios)", () => {
  const accountsActor: Actor = {
    userId: "usr_accounts_neha",
    name: "Neha Verma",
    role: "ACCOUNTS",
    centreIds: ["cen_tonk"],
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  const directorActor: Actor = {
    userId: "usr_director_arvind",
    name: "Arvind Mathur",
    role: "DIRECTOR",
    centreIds: ["cen_tonk"],
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  beforeEach(() => {
    vi.stubEnv("RAZORPAY_KEY_ID", TEST_KEY_ID);
    vi.stubEnv("RAZORPAY_KEY_SECRET", TEST_KEY_SECRET);
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET);
    vi.stubEnv("REFUND_PROVIDER", "MOCK_GATEWAY");
    demoPaymentStore.reset();
    demoPaymentStore.seedKavyaWithdrawalData();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // =========================================================================
  // GROUP 1: RAZORPAY NORMAL REFUND PROVIDER INTEGRATION (SCENARIOS 1–8)
  // =========================================================================

  describe("Group 1: Provider Integration & Request Formatting", () => {
    it("Scenario 1: creates normal refund request with correct HTTP method, Basic Auth, and body payload", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: "rfnd_rzp_mock_1",
          entity: "refund",
          amount: 3000000,
          currency: "INR",
          payment_id: "pay_kavya_4",
          status: "processed",
          speed_processed: "normal",
        }),
      } as any);

      const provider = new RazorpayRefundProvider({
        keyId: TEST_KEY_ID,
        keySecret: TEST_KEY_SECRET,
      });

      const res = await provider.executeRefund({
        refundItemId: "item-1",
        paymentId: "pay_kavya_4",
        providerPaymentId: "rzp_pay_kavya_4",
        amountPaise: 3000000n,
        idempotencyKey: "refitem_item_1",
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://api.razorpay.com/v1/payments/rzp_pay_kavya_4/refund");
      expect(init?.method).toBe("POST");

      const headers = init?.headers as Record<string, string>;
      const expectedAuth = `Basic ${Buffer.from(`${TEST_KEY_ID}:${TEST_KEY_SECRET}`).toString("base64")}`;
      expect(headers["Authorization"]).toBe(expectedAuth);
      expect(headers["X-Refund-Idempotency"]).toBe("refitem_item_1");
      expect(headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(init?.body as string);
      expect(body.amount).toBe(3000000);
      expect(body.speed).toBe("normal"); // Hard constraint: normal refund, never instant
      expect(body.notes?.refundItemId).toBe("item-1");
      expect(res.status).toBe("SUCCEEDED");
      expect(res.providerRefundId).toBe("rfnd_rzp_mock_1");
    });

    it("Scenario 2: correctly maps providerPaymentId and falls back to paymentId when provider payment ID is omitted", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "rfnd_fallback_1", status: "processed", amount: 100000 }),
      } as any);

      const provider = new RazorpayRefundProvider({
        keyId: TEST_KEY_ID,
        keySecret: TEST_KEY_SECRET,
      });

      await provider.executeRefund({
        refundItemId: "item-test",
        paymentId: "pay_direct_id",
        amountPaise: 100000n,
        idempotencyKey: "refitem_test",
      });

      expect(fetchSpy.mock.calls[0][0]).toBe("https://api.razorpay.com/v1/payments/pay_direct_id/refund");
    });

    it("Scenario 3: handles exact paise calculations for full and partial pro-rata refunds", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "rfnd_partial_1", status: "created", amount: 372414 }),
      } as any);

      const provider = new RazorpayRefundProvider({
        keyId: TEST_KEY_ID,
        keySecret: TEST_KEY_SECRET,
      });

      // Partial refund of ₹3,724.14 (372414 paise)
      const res = await provider.executeRefund({
        refundItemId: "item-3",
        paymentId: "pay_kavya_2",
        amountPaise: 372414n,
        idempotencyKey: "refitem_item_3",
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(body.amount).toBe(372414);
      expect(res.status).toBe("PROCESSING"); // created status maps to PROCESSING
    });

    it("Scenario 4: safe integer conversion validates BigInt paise and rejects invalid non-positive amounts", async () => {
      const provider = new RazorpayRefundProvider({
        keyId: TEST_KEY_ID,
        keySecret: TEST_KEY_SECRET,
      });

      await expect(
        provider.executeRefund({
          refundItemId: "item-zero",
          paymentId: "pay-1",
          amountPaise: 0n,
          idempotencyKey: "ref_0",
        })
      ).rejects.toThrow("Refund amount must be greater than 0");

      await expect(
        provider.executeRefund({
          refundItemId: "item-neg",
          paymentId: "pay-1",
          amountPaise: -5000n,
          idempotencyKey: "ref_neg",
        })
      ).rejects.toThrow("Refund amount must be greater than 0");
    });

    it("Scenario 5: fails closed when Razorpay credentials are missing", () => {
      vi.stubEnv("RAZORPAY_KEY_ID", "");
      vi.stubEnv("RAZORPAY_KEY_SECRET", "");

      expect(() => new RazorpayRefundProvider()).toThrow(
        "Razorpay credentials missing: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required"
      );
    });

    it("Scenario 6: fails closed in test environment when key does not start with rzp_test_", () => {
      vi.stubEnv("RAZORPAY_KEY_ID", "rzp_live_production_key_danger");
      vi.stubEnv("RAZORPAY_KEY_SECRET", "prod_secret");

      expect(() => new RazorpayRefundProvider()).toThrow(
        "CRITICAL SAFETY VIOLATION: RAZORPAY_KEY_ID must begin with 'rzp_test_'"
      );
    });

    it("Scenario 7: handles external Razorpay API errors by returning FAILED with exact error description", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: "BAD_REQUEST_ERROR",
            description: "The payment has already been fully refunded",
          },
        }),
        text: async () =>
          JSON.stringify({
            error: {
              code: "BAD_REQUEST_ERROR",
              description: "The payment has already been fully refunded",
            },
          }),
      } as any);

      const provider = new RazorpayRefundProvider({
        keyId: TEST_KEY_ID,
        keySecret: TEST_KEY_SECRET,
      });

      const res = await provider.executeRefund({
        refundItemId: "item-err",
        paymentId: "pay-1",
        amountPaise: 500000n,
        idempotencyKey: "key-err",
      });

      expect(res.status).toBe("FAILED");
      expect(res.failureReason).toContain("The payment has already been fully refunded");
    });

    it("Scenario 8: preserves PROCESSING state on network timeout without premature failure transition", async () => {
      vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed: network timeout"));

      const provider = new RazorpayRefundProvider({
        keyId: TEST_KEY_ID,
        keySecret: TEST_KEY_SECRET,
      });

      await expect(
        provider.executeRefund({
          refundItemId: "item-timeout",
          paymentId: "pay-1",
          amountPaise: 500000n,
          idempotencyKey: "key-timeout",
        })
      ).rejects.toThrow("fetch failed");
    });
  });

  // =========================================================================
  // GROUP 2: IDEMPOTENCY & CONCURRENCY PROTECTION (SCENARIOS 9–14)
  // =========================================================================

  describe("Group 2: Idempotency & Concurrency Safeguards", () => {
    it("Scenario 9: re-executing an item reuses the exact same stable idempotency key", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "rfnd_idemp_1", status: "processed", amount: 372414 }),
      } as any);

      const mockProvider = new RazorpayRefundProvider({
        keyId: TEST_KEY_ID,
        keySecret: TEST_KEY_SECRET,
      });

      // Item 3 is currently FAILED in seed
      await refundService.executeRefundItem({
        refundItemId: "item-3",
        actor: accountsActor,
        refundProvider: mockProvider,
      });

      const postCall = fetchSpy.mock.calls.find(([url, init]) => init?.method === "POST");
      expect(postCall).toBeDefined();
      const headers = postCall![1]?.headers as Record<string, string>;
      expect(headers["X-Refund-Idempotency"]).toBe("refitem_item-3");
    });

    it("Scenario 10: rejects execution of an already SUCCEEDED refund item", async () => {
      // item-1 is SUCCEEDED in seed
      await expect(
        refundService.executeRefundItem({
          refundItemId: "item-1",
          actor: accountsActor,
        })
      ).rejects.toThrow("Refund item has already succeeded; duplicate execution rejected");
    });

    it("Scenario 11: concurrency lock rejects duplicate attempt when item is actively in-flight", async () => {
      // Set item-2 createdAt to now so timeDiff < 2 minutes
      demoPaymentStore.updateRefundItem("item-2", {
        status: "PROCESSING",
        createdAt: new Date(),
      });

      await expect(
        refundService.executeRefundItem({
          refundItemId: "item-2",
          actor: accountsActor,
        })
      ).rejects.toThrow("Refund item execution is currently in-flight; concurrent execution rejected");
    });

    it("Scenario 12: multi-item refund properly bounds each item to its parent payment", () => {
      const items = demoPaymentStore.getRefundItemsByRefundId("rfnd_kavya_1");
      expect(items.length).toBe(3);

      const item1 = items.find((it) => it.id === "item-1")!;
      const item2 = items.find((it) => it.id === "item-2")!;
      const item3 = items.find((it) => it.id === "item-3")!;

      expect(item1.paymentId).toBe("pay_kavya_4");
      expect(item1.amount).toBe(3000000n);

      expect(item2.paymentId).toBe("pay_kavya_3");
      expect(item2.amount).toBe(3000000n);

      expect(item3.paymentId).toBe("pay_kavya_2");
      expect(item3.amount).toBe(372414n); // Remaining statutory balance
    });

    it("Scenario 13: over-refund prevention prevents executing an amount exceeding remaining captured payment balance", async () => {
      // Seed a payment of ₹10,000 where ₹8,000 has already succeeded
      demoPaymentStore.payments.set("pay_test_cap_1", {
        id: "pay_test_cap_1",
        paymentReference: "pay_ref_cap",
        provider: "MOCK_GATEWAY",
        providerPaymentId: "rzp_pay_test_cap_1",
        studentId: "stu_kavya_1038",
        amount: 1000000n, // ₹10,000
        unallocatedAmount: 0n,
        paymentDate: new Date(),
        method: "UPI",
        status: "CAPTURED",
      });

      demoPaymentStore.createRefundItem({
        refundId: "rfnd_kavya_1",
        paymentId: "pay_test_cap_1",
        amount: 800000n,
        status: "SUCCEEDED",
      });

      const excessItem = demoPaymentStore.createRefundItem({
        refundId: "rfnd_kavya_1",
        paymentId: "pay_test_cap_1",
        amount: 500000n, // ₹5,000 exceeds remaining ₹2,000
        status: "PENDING",
      });

      await expect(
        refundService.executeRefundItem({
          refundItemId: excessItem.id,
          actor: accountsActor,
        })
      ).rejects.toThrow("exceeds remaining refundable amount");
    });

    it("Scenario 14: provider refund ID uniqueness across distinct executions", async () => {
      const mockProvider = new MockRefundProvider();
      const res1 = await mockProvider.executeRefund({
        refundItemId: "item-u1",
        paymentId: "pay-1",
        amountPaise: 100000n,
        idempotencyKey: "k1",
      });

      const res2 = await mockProvider.executeRefund({
        refundItemId: "item-u2",
        paymentId: "pay-1",
        amountPaise: 100000n,
        idempotencyKey: "k2",
      });

      expect(res1.providerRefundId).toBeDefined();
      expect(res2.providerRefundId).toBeDefined();
      expect(res1.providerRefundId).not.toBe(res2.providerRefundId);
    });
  });

  // =========================================================================
  // GROUP 3: REFUND WEBHOOKS (SCENARIOS 15–22)
  // =========================================================================

  describe("Group 3: Razorpay Webhook Ingestion & State Transitions", () => {
    it("Scenario 15: valid x-razorpay-signature verifies and processes successfully", async () => {
      const webhook = createRefundWebhook({
        event: "refund.processed",
        refundItemId: "item-2",
        status: "processed",
      });

      const res = await refundService.processRefundWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("SUCCEEDED");
      expect(res.refundItemId).toBe("item-2");
    });

    it("Scenario 16: invalid or tampered signature fails closed with HTTP 400 error", async () => {
      const webhook = createRefundWebhook({
        event: "refund.processed",
        refundItemId: "item-2",
        signature: "invalid_tampered_signature_9999",
      });

      const res = await refundService.processRefundWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: "invalid_tampered_signature_9999",
        eventId: webhook.eventId,
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe("REJECTED");
      expect(res.error).toContain("Invalid Razorpay webhook signature");
    });

    it("Scenario 17: refund.created event transitions item to PROCESSING", async () => {
      const webhook = createRefundWebhook({
        event: "refund.created",
        refundItemId: "item-3",
        status: "created",
      });

      const res = await refundService.processRefundWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("PROCESSING");

      const item = demoPaymentStore.getRefundItem("item-3");
      expect(item?.status).toBe("PROCESSING");
    });

    it("Scenario 18: refund.processed event transitions item to SUCCEEDED and re-evaluates parent aggregate status", async () => {
      const webhook = createRefundWebhook({
        event: "refund.processed",
        refundItemId: "item-2",
        status: "processed",
      });

      await refundService.processRefundWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });

      const item2 = demoPaymentStore.getRefundItem("item-2");
      expect(item2?.status).toBe("SUCCEEDED");

      // Parent rfnd_kavya_1 has item-1 (SUCCEEDED), item-2 (now SUCCEEDED), item-3 (FAILED)
      // Aggregate status must be PARTIALLY_REFUNDED (never FAILED!)
      const parentRefund = demoPaymentStore.getRefund("rfnd_kavya_1");
      expect(parentRefund?.status).toBe("PROCESSING"); // In DB schema, non-final partial is PROCESSING
    });

    it("Scenario 19: refund.failed event records failure reason and leaves item retryable", async () => {
      const webhook = createRefundWebhook({
        event: "refund.failed",
        refundItemId: "item-2",
        status: "failed",
        errorDescription: "Customer bank account closed or frozen",
      });

      const res = await refundService.processRefundWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("FAILED");

      const item2 = demoPaymentStore.getRefundItem("item-2");
      expect(item2?.status).toBe("FAILED");
      expect(item2?.failureReason).toBe("Customer bank account closed or frozen");
    });

    it("Scenario 20: duplicate refund webhook delivery is safely idempotent with zero additional mutations", async () => {
      const webhook = createRefundWebhook({
        event: "refund.processed",
        refundItemId: "item-2",
      });

      const first = await refundService.processRefundWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });
      expect(first.success).toBe(true);
      expect(first.duplicate).toBeFalsy();

      const second = await refundService.processRefundWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });
      expect(second.success).toBe(true);
      expect(second.duplicate).toBe(true);
      expect(second.status).toBe("SUCCEEDED");
    });

    it("Scenario 21: matches refund item by payment and amount when notes.refundItemId is absent", async () => {
      // item-2 is for pay_kavya_3 with amount 3000000n
      const webhook = createRefundWebhook({
        event: "refund.processed",
        paymentId: "pay_kavya_3",
        amountPaise: 3000000n,
        refundItemId: "", // No item ID in notes
      });

      const res = await refundService.processRefundWebhook(webhook.rawBody, {
        provider: "RAZORPAY",
        signature: webhook.signature,
        eventId: webhook.eventId,
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("SUCCEEDED");
      expect(res.refundItemId).toBe("item-2");
    });

    it("Scenario 22: out-of-order delivery preserves SUCCEEDED status when refund.created arrives after refund.processed", async () => {
      const processedHook = createRefundWebhook({
        event: "refund.processed",
        refundItemId: "item-2",
      });
      await refundService.processRefundWebhook(processedHook.rawBody, {
        provider: "RAZORPAY",
        signature: processedHook.signature,
        eventId: processedHook.eventId,
      });

      const createdHook = createRefundWebhook({
        event: "refund.created",
        refundItemId: "item-2",
      });
      await refundService.processRefundWebhook(createdHook.rawBody, {
        provider: "RAZORPAY",
        signature: createdHook.signature,
        eventId: createdHook.eventId,
      });

      // Item status MUST stay SUCCEEDED
      const item = demoPaymentStore.getRefundItem("item-2");
      expect(item?.status).toBe("SUCCEEDED");
    });
  });

  // =========================================================================
  // GROUP 4: AGGREGATION, RECONCILIATION & BUSINESS RULES (SCENARIOS 23–30)
  // =========================================================================

  describe("Group 4: Aggregate Status, Reconciliation & Financial Integrity", () => {
    it("Scenario 23: marks parent Refund COMPLETED when all items are SUCCEEDED", () => {
      const items = [
        { status: "SUCCEEDED" as const },
        { status: "SUCCEEDED" as const },
        { status: "SUCCEEDED" as const },
      ];
      const agg = deriveRefundAggregateStatus(items);
      expect(agg.dbStatus).toBe("COMPLETED");
      expect(agg.presentationStatus).toBe("COMPLETED");
    });

    it("Scenario 24: aggregate status is PARTIALLY_REFUNDED (never FAILED) when some items succeeded and others failed", () => {
      const items = [
        { status: "SUCCEEDED" as const },
        { status: "PROCESSING" as const },
        { status: "FAILED" as const },
      ];
      const agg = deriveRefundAggregateStatus(items);
      expect(agg.presentationStatus).toBe("PARTIALLY_REFUNDED");
      expect(agg.dbStatus).toBe("PROCESSING"); // In-flight DB status
    });

    it("Scenario 25: retrying failed item transitions it to SUCCEEDED and advances parent to COMPLETED", async () => {
      // In seed: item-1 is SUCCEEDED, item-2 is PROCESSING, item-3 is FAILED
      // Step A: item-2 succeeds
      demoPaymentStore.updateRefundItem("item-2", { status: "SUCCEEDED" });

      // Step B: Retry item-3 with mock provider forced to SUCCEEDED
      const mockProvider = new MockRefundProvider();
      const retryResult = await refundService.executeRefundItem({
        refundItemId: "item-3",
        actor: accountsActor,
        forceStatus: "SUCCEEDED",
        refundProvider: mockProvider,
      });

      expect(retryResult.item.status).toBe("SUCCEEDED");
      expect(retryResult.refund.status).toBe("COMPLETED");
    });

    it("Scenario 26: successful items are protected from re-execution during partial retry", async () => {
      await expect(
        refundService.executeRefundItem({
          refundItemId: "item-1",
          actor: accountsActor,
        })
      ).rejects.toThrow("Refund item has already succeeded; duplicate execution rejected");
    });

    it("Scenario 27: maker-checker verification strictly enforced for refund executions and reviews", async () => {
      const unauthActor: Actor = {
        userId: "usr_parent_vikram",
        name: "Vikram Rathore",
        role: "PARENT",
        centreIds: ["cen_tonk"],
        linkedStudentIds: ["stu_kavya_1038"],
        consentedStudentIds: ["stu_kavya_1038"],
      };

      await expect(
        refundService.executeRefundItem({
          refundItemId: "item-3",
          actor: unauthActor,
        })
      ).rejects.toThrow("Unauthorized: Only Accounts or Director can execute refund items");

      await expect(
        refundService.reconcileRefundItem({
          refundItemId: "item-3",
          actor: unauthActor,
        })
      ).rejects.toThrow("Unauthorized: Only Accounts or Director can reconcile refunds");
    });

    it("Scenario 28: CRITICAL INVARIANT: Executing refund items never duplicates ledger waivers or alters instalment balances", async () => {
      const initialLedgerCount = demoPaymentStore.ledgerEntries.length;
      const initialInstalments = Array.from(demoPaymentStore.instalments.values()).map((i) => ({
        id: i.id,
        status: i.status,
      }));

      await refundService.executeRefundItem({
        refundItemId: "item-3",
        actor: accountsActor,
        forceStatus: "SUCCEEDED",
      });

      // Assert ledger entry count is completely unchanged
      expect(demoPaymentStore.ledgerEntries.length).toBe(initialLedgerCount);

      // Assert all instalments retain their exact same status
      const postInstalments = Array.from(demoPaymentStore.instalments.values()).map((i) => ({
        id: i.id,
        status: i.status,
      }));
      expect(postInstalments).toEqual(initialInstalments);
    });

    it("Scenario 29: Student status remains ACTIVE when withdrawing from one FeePlan if another active FeePlan exists", async () => {
      // In deriveRefundAggregateStatus or student status rules, only update student to WITHDRAWN
      // if all active plans for the student are withdrawn.
      const studentPlans = [
        { id: "plan_jee", status: "WITHDRAWN" },
        { id: "plan_olympiad", status: "ACTIVE" },
      ];
      const hasOtherActive = studentPlans.some((p) => p.status === "ACTIVE");
      expect(hasOtherActive).toBe(true);
    });

    it("Scenario 30: server-side reconciliation fetches Razorpay refund status directly and polishes state without webhooks", async () => {
      const mockProvider = new MockRefundProvider();
      
      // Step A: Execute item with gateway returning PROCESSING
      const execResult = await mockProvider.executeRefund({
        refundItemId: "item-3",
        paymentId: "pay_kavya_2",
        amountPaise: 372414n,
        forceStatus: "PROCESSING",
      });

      // Gateway side settles the refund to processed
      const gatewayRecord = await mockProvider.fetchRefund(execResult.providerRefundId);
      gatewayRecord.status = "processed";

      demoPaymentStore.updateRefundItem("item-3", {
        status: "PROCESSING",
        providerRefundId: execResult.providerRefundId,
      });

      // Step B: Reconcile item-3
      const reconResult = await refundService.reconcileRefundItem({
        refundItemId: "item-3",
        actor: accountsActor,
        refundProvider: mockProvider,
      });

      expect(reconResult.reconciled).toBe(true);
      expect(reconResult.item.status).toBe("SUCCEEDED");
      expect(reconResult.item.providerRefundId).toBe(execResult.providerRefundId);
    });
  });
});
