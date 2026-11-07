import { describe, it, expect } from "vitest";
import {
  computeWebhookSignature,
  verifyWebhookSignature,
  createMockWebhookEvent,
} from "@/infrastructure/adapters/mock-payment-gateway";

describe("Application: Mock Payment Gateway & Webhook Security", () => {
  const secret = "test_secret_key_12345";

  it("computes and verifies HMAC SHA-256 signatures correctly", () => {
    const rawBody = JSON.stringify({ event: "payment.captured", amountPaise: "3000000" });
    const signature = computeWebhookSignature(rawBody, secret);

    expect(signature).toHaveLength(64); // 32 bytes hex
    const isValid = verifyWebhookSignature(rawBody, signature, secret);
    expect(isValid).toBe(true);
  });

  it("rejects forged or tampered webhook bodies", () => {
    const originalBody = JSON.stringify({ orderId: "order_123", amountPaise: "3000000" });
    const signature = computeWebhookSignature(originalBody, secret);

    // Tampered body: attacker changes amount
    const tamperedBody = JSON.stringify({ orderId: "order_123", amountPaise: "100" });
    const isTamperedValid = verifyWebhookSignature(tamperedBody, signature, secret);
    expect(isTamperedValid).toBe(false);
  });

  it("rejects invalid signature headers", () => {
    const body = JSON.stringify({ test: true });
    expect(verifyWebhookSignature(body, "bad_signature", secret)).toBe(false);
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyWebhookSignature(body, undefined, secret)).toBe(false);
  });

  it("generates deterministic test webhook events", () => {
    const event = createMockWebhookEvent("order_demo_1", 3000000n, { secret });
    expect(event.payload.amountPaise).toBe("3000000");
    expect(event.payload.eventType).toBe("payment.captured");
    expect(verifyWebhookSignature(event.rawBody, event.signature, secret)).toBe(true);
  });
});
