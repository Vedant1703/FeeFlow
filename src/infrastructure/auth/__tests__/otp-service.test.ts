import { describe, it, expect, beforeEach } from "vitest";
import {
  OtpService,
  normalizeIndianPhoneNumber,
  hashOtp,
  generateNumericOtp,
} from "../otp-service";
import { mockSmsProvider } from "../sms/sms-provider";

describe("Infrastructure: Cryptographic OTP Authentication Service", () => {
  let service: OtpService;

  beforeEach(() => {
    service = new OtpService();
    service.resetState();
    mockSmsProvider.clear();
  });

  describe("Indian Phone Number Normalization", () => {
    it("normalizes bare 10-digit Indian mobile number to E.164", () => {
      const res = normalizeIndianPhoneNumber("9000012345");
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe("+919000012345");
    });

    it("normalizes number with country code +91 and spaces", () => {
      const res = normalizeIndianPhoneNumber("+91 98290 12345");
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe("+919829012345");
    });

    it("normalizes number with leading zero (STD/trunk prefix)", () => {
      const res = normalizeIndianPhoneNumber("09829012345");
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe("+919829012345");
    });

    it("rejects numbers not starting with 6, 7, 8, or 9", () => {
      const res = normalizeIndianPhoneNumber("5000012345");
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("must begin with 6, 7, 8, or 9");
    });

    it("rejects incomplete or oversized numbers", () => {
      expect(normalizeIndianPhoneNumber("98290").isValid).toBe(false);
      expect(normalizeIndianPhoneNumber("9829012345678").isValid).toBe(false);
      expect(normalizeIndianPhoneNumber("").isValid).toBe(false);
    });
  });

  describe("OTP Generation & Hashing", () => {
    it("generates a 6-digit numeric OTP", () => {
      const otp = generateNumericOtp();
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });

    it("computes deterministic HMAC-SHA256 hash bound to phone number", () => {
      const hash1 = hashOtp("+919000012345", "123456");
      const hash2 = hashOtp("+919000012345", "123456");
      const hashDiffPhone = hashOtp("+919829012345", "123456");

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hashDiffPhone);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });
  });

  describe("Request, Resend Cooldown & Expiry", () => {
    it("dispatches OTP and logs to SMS provider history", async () => {
      const res = await service.requestOtp("9000012345");

      expect(res.success).toBe(true);
      expect(res.normalizedPhone).toBe("+919000012345");
      expect(res.resendAfterSeconds).toBe(60);

      const dispatched = mockSmsProvider.getLastOtp("+919000012345");
      expect(dispatched).toBeDefined();
      expect(dispatched).toHaveLength(6);
    });

    it("enforces 60-second resend cooldown", async () => {
      const t0 = new Date("2026-11-02T10:00:00Z");
      await service.requestOtp("9000012345", { now: t0 });

      // Immediate second request within 60s
      const tImmediate = new Date("2026-11-02T10:00:15Z"); // +15s
      const res2 = await service.requestOtp("9000012345", { now: tImmediate });

      expect(res2.success).toBe(false);
      expect(res2.error).toContain("wait 45 seconds");

      // Request after 61s is permitted
      const tAfterCooldown = new Date("2026-11-02T10:01:05Z"); // +65s
      const res3 = await service.requestOtp("9000012345", { now: tAfterCooldown });
      expect(res3.success).toBe(true);
    });

    it("enforces sliding-window rate limit (max 3 requests per 10 minutes)", async () => {
      const t0 = 1000000;
      await service.requestOtp("9000012345", { now: new Date(t0) });
      await service.requestOtp("9000012345", { now: new Date(t0 + 70000) }); // +70s
      await service.requestOtp("9000012345", { now: new Date(t0 + 140000) }); // +140s

      // 4th request within 10 minutes should be blocked
      const res4 = await service.requestOtp("9000012345", { now: new Date(t0 + 210000) });
      expect(res4.success).toBe(false);
      expect(res4.error).toContain("Too many OTP requests");
    });

    it("rejects verification after 5-minute expiry window", async () => {
      const t0 = new Date("2026-11-02T10:00:00Z");
      await service.requestOtp("9000012345", { now: t0 });
      const code = mockSmsProvider.getLastOtp("+919000012345")!;

      // Verify at 6 minutes (after 5-minute expiry)
      const tExpired = new Date("2026-11-02T10:06:00Z");
      const verifyRes = await service.verifyOtp("9000012345", code, { now: tExpired });

      expect(verifyRes.success).toBe(false);
      expect(verifyRes.error).toContain("OTP has expired");
    });
  });

  describe("Verification & 3-Attempt Lockout", () => {
    it("verifies matching OTP successfully and marks single-use consumed", async () => {
      const t0 = new Date("2026-11-02T10:00:00Z");
      await service.requestOtp("9000012345", { now: t0 });
      const code = mockSmsProvider.getLastOtp("+919000012345")!;

      const res1 = await service.verifyOtp("9000012345", code, { now: t0 });
      expect(res1.success).toBe(true);
      expect(res1.normalizedPhone).toBe("+919000012345");

      // Second verification of same OTP must fail (single-use invariant)
      const res2 = await service.verifyOtp("9000012345", code, { now: t0 });
      expect(res2.success).toBe(false);
      expect(res2.error).toContain("No active OTP request found");
    });

    it("locks OTP after 3 consecutive failed attempts", async () => {
      const t0 = new Date("2026-11-02T10:00:00Z");
      await service.requestOtp("9000012345", { now: t0 });
      const correctCode = mockSmsProvider.getLastOtp("+919000012345")!;

      // Attempt 1: wrong code
      const v1 = await service.verifyOtp("9000012345", "000000", { now: t0 });
      expect(v1.success).toBe(false);
      expect(v1.attemptsRemaining).toBe(2);

      // Attempt 2: wrong code
      const v2 = await service.verifyOtp("9000012345", "111111", { now: t0 });
      expect(v2.success).toBe(false);
      expect(v2.attemptsRemaining).toBe(1);

      // Attempt 3: wrong code -> Locks!
      const v3 = await service.verifyOtp("9000012345", "222222", { now: t0 });
      expect(v3.success).toBe(false);
      expect(v3.isLocked).toBe(true);
      expect(v3.attemptsRemaining).toBe(0);
      expect(v3.error).toContain("locked");

      // Attempt 4: entering correct code now is rejected because it is locked
      const v4 = await service.verifyOtp("9000012345", correctCode, { now: t0 });
      expect(v4.success).toBe(false);
      expect(v4.isLocked).toBe(true);
    });

    it("accepts universal demo code 482913 in demo mode", async () => {
      const res = await service.verifyOtp("9000012345", "482913");
      expect(res.success).toBe(true);
      expect(res.normalizedPhone).toBe("+919000012345");
    });
  });
});
