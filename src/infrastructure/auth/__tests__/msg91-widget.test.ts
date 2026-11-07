/**
 * MSG91 OTP Widget Integration Tests.
 *
 * Verifies all 13 acceptance criteria from Milestone 1:
 * 1. Widget SDK configuration and initialization
 * 2. Script-load failures handling
 * 3. Successful OTP send and reqId registration
 * 4. Successful OTP verification
 * 5. Invalid access token (provider error)
 * 6. Provider HTTP 200 with an error response (type: "error")
 * 7. Phone identity mismatch
 * 8. Expired challenge (15-minute window)
 * 9. Replayed access token or consumed challenge
 * 10. Resend cooldown (60s) and request rate limits (max 3/10m)
 * 11. Unauthorized or incorrectly linked parent
 * 12. Missing provider credentials (fail closed)
 * 13. Mock provider regression
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Msg91WidgetAdapter } from "../sms/msg91-widget-adapter";
import { otpService } from "../otp-service";
import { POST as handleChallenge } from "@/app/api/auth/otp/challenge/route";
import { POST as handleRegisterReqId } from "@/app/api/auth/otp/register-reqid/route";
import { POST as handleVerifyWidget } from "@/app/api/auth/otp/verify-widget/route";

describe("Milestone 1: MSG91 OTP Widget Integration", () => {
  const TEST_PHONE = "+919829012345";
  const TEST_PHONE_BARE = "9829012345";
  const SEEDED_PARENT_PHONE = "+91 90000 12345"; // Sanjay Sharma
  const DUMMY_AUTHKEY = "dummy_msg91_authkey_for_unit_tests_12345";

  beforeEach(() => {
    otpService.resetState();
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Criterion 1: Widget SDK configuration and initialization
  // --------------------------------------------------------------------------
  describe("1. Widget SDK configuration and initialization", () => {
    it("reports configured when authKey is provided", () => {
      const adapter = new Msg91WidgetAdapter({ authKey: DUMMY_AUTHKEY });
      expect(adapter.isConfigured()).toBe(true);
    });

    it("reports unconfigured when authKey is missing or empty", () => {
      const adapter = new Msg91WidgetAdapter({ authKey: "" });
      expect(adapter.isConfigured()).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Criterion 2: Script-load failures handling
  // --------------------------------------------------------------------------
  describe("2. Script-load failures", () => {
    it("handles network failure gracefully when calling MSG91 verification API", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network connection lost"));
      const adapter = new Msg91WidgetAdapter({ authKey: DUMMY_AUTHKEY, fetchFn: mockFetch });

      const result = await adapter.verifyAccessToken("test_access_token_123");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Network connection lost");
    });

    it("handles malformed non-JSON responses from provider server", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });
      const adapter = new Msg91WidgetAdapter({ authKey: DUMMY_AUTHKEY, fetchFn: mockFetch });

      const result = await adapter.verifyAccessToken("test_access_token_123");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid JSON response");
    });
  });

  // --------------------------------------------------------------------------
  // Criterion 3: Successful OTP send and reqId registration
  // --------------------------------------------------------------------------
  describe("3. Successful OTP send and reqId registration", () => {
    it("creates a 15-minute challenge and formats phone for MSG91 widget (bare country code)", async () => {
      const res = await otpService.createWidgetChallenge(TEST_PHONE);

      expect(res.success).toBe(true);
      expect(res.challengeId).toBeDefined();
      expect(res.normalizedPhone).toBe("+919829012345");
      // Widget requires identifier with country code but without '+' (e.g. 919829012345)
      expect(res.widgetPhone).toBe("919829012345");
      expect(res.resendAfterSeconds).toBe(60);
      expect(res.expiresInSeconds).toBe(900); // 15 minutes = 900 seconds
    });

    it("registers provider reqId against the active challenge", async () => {
      const chal = await otpService.createWidgetChallenge(TEST_PHONE);
      const reg = await otpService.registerProviderRequestId(chal.challengeId!, "msg91_req_abc123");

      expect(reg.success).toBe(true);
      expect(reg.challengeId).toBe(chal.challengeId);
      expect(reg.reqId).toBe("msg91_req_abc123");
    });

    it("is idempotent when registering the identical reqId twice", async () => {
      const chal = await otpService.createWidgetChallenge(TEST_PHONE);
      await otpService.registerProviderRequestId(chal.challengeId!, "msg91_req_abc123");
      const reg2 = await otpService.registerProviderRequestId(chal.challengeId!, "msg91_req_abc123");

      expect(reg2.success).toBe(true);
      expect(reg2.reqId).toBe("msg91_req_abc123");
    });

    it("rejects registering a different reqId on an already bound challenge", async () => {
      const chal = await otpService.createWidgetChallenge(TEST_PHONE);
      await otpService.registerProviderRequestId(chal.challengeId!, "msg91_req_abc123");
      const conflict = await otpService.registerProviderRequestId(chal.challengeId!, "msg91_req_DIFFERENT");

      expect(conflict.success).toBe(false);
      expect(conflict.error).toContain("already bound to a different provider request ID");
    });
  });

  // --------------------------------------------------------------------------
  // Criterion 4: Successful OTP verification
  // --------------------------------------------------------------------------
  describe("4. Successful OTP verification", () => {
    it("verifies valid MSG91 access token and marks challenge consumed", async () => {
      const chal = await otpService.createWidgetChallenge(TEST_PHONE);
      await otpService.registerProviderRequestId(chal.challengeId!, "req_999");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          type: "success",
          message: "919829012345", // Verified phone from MSG91
        }),
      });

      const adapter = new Msg91WidgetAdapter({ authKey: DUMMY_AUTHKEY, fetchFn: mockFetch });

      const verifyRes = await otpService.verifyWidgetAccessToken({
        challengeId: chal.challengeId!,
        reqId: "req_999",
        accessToken: "valid_jwt_token_from_msg91",
        adapter,
      });

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.normalizedPhone).toBe("+919829012345");

      // Verify fetch payload sent hyphenated "access-token"
      expect(mockFetch).toHaveBeenCalledWith(
        "https://control.msg91.com/api/v5/widget/verifyAccessToken",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            authkey: DUMMY_AUTHKEY,
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ "access-token": "valid_jwt_token_from_msg91" }),
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // Criterion 5: Invalid access token
  // --------------------------------------------------------------------------
  describe("5. Invalid access token", () => {
    it("rejects invalid token and decrements remaining attempts", async () => {
      const chal = await otpService.createWidgetChallenge(TEST_PHONE);
      await otpService.registerProviderRequestId(chal.challengeId!, "req_555");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          type: "error",
          message: "Invalid or expired access token",
        }),
      });

      const adapter = new Msg91WidgetAdapter({ authKey: DUMMY_AUTHKEY, fetchFn: mockFetch });

      const res = await otpService.verifyWidgetAccessToken({
        challengeId: chal.challengeId!,
        reqId: "req_555",
        accessToken: "bad_token",
        adapter,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid or expired access token");
      expect(res.attemptsRemaining).toBe(2);
      expect(res.isLocked).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Criterion 6: Provider HTTP 200 with an error response
  // --------------------------------------------------------------------------
  describe("6. Provider HTTP 200 with an error response", () => {
    it("treats HTTP 200 with type 'error' as verification failure", async () => {
      const chal = await otpService.createWidgetChallenge(TEST_PHONE);
      await otpService.registerProviderRequestId(chal.challengeId!, "req_666");

      // Some MSG91 endpoints respond with HTTP 200 even on validation failure
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          type: "error",
          message: "Token has expired or was already consumed",
        }),
      });

      const adapter = new Msg91WidgetAdapter({ authKey: DUMMY_AUTHKEY, fetchFn: mockFetch });

      const res = await otpService.verifyWidgetAccessToken({
        challengeId: chal.challengeId!,
        reqId: "req_666",
        accessToken: "expired_token",
        adapter,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Token has expired or was already consumed");
    });
  });

  // --------------------------------------------------------------------------
  // Criterion 7: Phone identity mismatch
  // --------------------------------------------------------------------------
  describe("7. Phone identity mismatch", () => {
    it("rejects token when MSG91 verified mobile does not match challenge mobile", async () => {
      const chal = await otpService.createWidgetChallenge("+919829012345");
      await otpService.registerProviderRequestId(chal.challengeId!, "req_777");

      // Attacker managed to verify their own number (9999999999) and submitted token for victim's challenge
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          type: "success",
          message: "919999999999", // Different number!
        }),
      });

      const adapter = new Msg91WidgetAdapter({ authKey: DUMMY_AUTHKEY, fetchFn: mockFetch });

      const res = await otpService.verifyWidgetAccessToken({
        challengeId: chal.challengeId!,
        reqId: "req_777",
        accessToken: "valid_token_for_wrong_user",
        adapter,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Phone identity mismatch");
    });
  });

  // --------------------------------------------------------------------------
  // Criterion 8: Expired challenge
  // --------------------------------------------------------------------------
  describe("8. Expired challenge", () => {
    it("rejects verification when 15-minute challenge window has passed", async () => {
      const startTime = new Date(2026, 10, 8, 12, 0, 0);
      const chal = await otpService.createWidgetChallenge(TEST_PHONE, { now: startTime });
      await otpService.registerProviderRequestId(chal.challengeId!, "req_888");

      const adapter = new Msg91WidgetAdapter({ authKey: DUMMY_AUTHKEY });

      // 15 minutes and 1 second later
      const expiredTime = new Date(startTime.getTime() + 15 * 60 * 1000 + 1000);

      const res = await otpService.verifyWidgetAccessToken({
        challengeId: chal.challengeId!,
        reqId: "req_888",
        accessToken: "token_123",
        now: expiredTime,
        adapter,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Challenge has expired");
    });
  });

  // --------------------------------------------------------------------------
  // Criterion 9: Replayed access token or consumed challenge
  // --------------------------------------------------------------------------
  describe("9. Replayed access token or consumed challenge", () => {
    it("rejects second verification attempt on already consumed challenge", async () => {
      const chal = await otpService.createWidgetChallenge(TEST_PHONE);
      await otpService.registerProviderRequestId(chal.challengeId!, "req_replay");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          type: "success",
          message: "919829012345",
        }),
      });
      const adapter = new Msg91WidgetAdapter({ authKey: DUMMY_AUTHKEY, fetchFn: mockFetch });

      // First verification succeeds
      const first = await otpService.verifyWidgetAccessToken({
        challengeId: chal.challengeId!,
        reqId: "req_replay",
        accessToken: "unique_token_one",
        adapter,
      });
      expect(first.success).toBe(true);

      // Replay attempt on same challenge is blocked
      const replay = await otpService.verifyWidgetAccessToken({
        challengeId: chal.challengeId!,
        reqId: "req_replay",
        accessToken: "unique_token_one",
        adapter,
      });
      expect(replay.success).toBe(false);
      expect(replay.error).toContain("Challenge has already been consumed");
    });

    it("rejects consumed access token submitted against a new challenge (token replay)", async () => {
      const chal1 = await otpService.createWidgetChallenge(TEST_PHONE);
      await otpService.registerProviderRequestId(chal1.challengeId!, "req_chal1");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          type: "success",
          message: "919829012345",
        }),
      });
      const adapter = new Msg91WidgetAdapter({ authKey: DUMMY_AUTHKEY, fetchFn: mockFetch });

      // Consume token on challenge 1
      await otpService.verifyWidgetAccessToken({
        challengeId: chal1.challengeId!,
        reqId: "req_chal1",
        accessToken: "replayed_access_token_xyz",
        adapter,
      });

      // Advance clock past cooldown and create challenge 2
      const later = new Date(Date.now() + 70 * 1000);
      const chal2 = await otpService.createWidgetChallenge(TEST_PHONE, { now: later });
      await otpService.registerProviderRequestId(chal2.challengeId!, "req_chal2");

      // Attacker tries to submit the same accessToken to challenge 2
      const replay = await otpService.verifyWidgetAccessToken({
        challengeId: chal2.challengeId!,
        reqId: "req_chal2",
        accessToken: "replayed_access_token_xyz",
        now: later,
        adapter,
      });

      expect(replay.success).toBe(false);
      expect(replay.error).toContain("Access token has already been consumed");
    });
  });

  // --------------------------------------------------------------------------
  // Criterion 10: Resend cooldown and request rate limits
  // --------------------------------------------------------------------------
  describe("10. Resend cooldown and request rate limits", () => {
    it("enforces 60-second cooldown between challenge requests", async () => {
      const now = new Date(2026, 10, 8, 10, 0, 0);

      // 1st request
      const r1 = await otpService.createWidgetChallenge(TEST_PHONE, { now });
      expect(r1.success).toBe(true);

      // 2nd request 30 seconds later -> rejected by 60s cooldown
      const r2 = await otpService.createWidgetChallenge(TEST_PHONE, {
        now: new Date(now.getTime() + 30 * 1000),
      });
      expect(r2.success).toBe(false);
      expect(r2.error).toContain("Please wait");
      expect(r2.resendAfterSeconds).toBe(30);

      // 3rd request 65 seconds later -> allowed
      const r3 = await otpService.createWidgetChallenge(TEST_PHONE, {
        now: new Date(now.getTime() + 65 * 1000),
      });
      expect(r3.success).toBe(true);
    });

    it("enforces sliding-window rate limit (max 3 requests per 10 minutes)", async () => {
      const t0 = new Date(2026, 10, 8, 10, 0, 0);

      // 1st request at 0m
      expect((await otpService.createWidgetChallenge(TEST_PHONE, { now: t0 })).success).toBe(true);

      // 2nd request at 2m (cooldown elapsed)
      const t1 = new Date(t0.getTime() + 2 * 60 * 1000);
      expect((await otpService.createWidgetChallenge(TEST_PHONE, { now: t1 })).success).toBe(true);

      // 3rd request at 4m
      const t2 = new Date(t0.getTime() + 4 * 60 * 1000);
      expect((await otpService.createWidgetChallenge(TEST_PHONE, { now: t2 })).success).toBe(true);

      // 4th request at 6m (cooldown elapsed, but 3 requests already in 10-minute window)
      const t3 = new Date(t0.getTime() + 6 * 60 * 1000);
      const r4 = await otpService.createWidgetChallenge(TEST_PHONE, { now: t3 });
      expect(r4.success).toBe(false);
      expect(r4.error).toContain("Too many OTP requests");
    });
  });

  // --------------------------------------------------------------------------
  // Criterion 11: Unauthorized or incorrectly linked parent
  // --------------------------------------------------------------------------
  describe("11. Unauthorized or incorrectly linked parent", () => {
    it("/api/auth/otp/challenge returns 404 for unseeded/unregistered mobile number", async () => {
      const req = new Request("http://localhost:3000/api/auth/otp/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+91 99999 88888" }),
      });

      const res = await handleChallenge(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.notRegistered).toBe(true);
      expect(data.error).toContain("not registered with any student");
    });

    it("/api/auth/otp/challenge succeeds for registered parent Sanjay Sharma", async () => {
      const req = new Request("http://localhost:3000/api/auth/otp/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: SEEDED_PARENT_PHONE }),
      });

      const res = await handleChallenge(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.challengeId).toBeDefined();
      expect(data.widgetPhone).toBe("919000012345");
      expect(data.expiresInSeconds).toBe(900);
    });
  });

  // --------------------------------------------------------------------------
  // Criterion 12: Missing provider credentials
  // --------------------------------------------------------------------------
  describe("12. Missing provider credentials", () => {
    it("fails closed when MSG91_AUTHKEY is not configured", async () => {
      const adapter = new Msg91WidgetAdapter({ authKey: "" });
      const result = await adapter.verifyAccessToken("any_token");

      expect(result.success).toBe(false);
      expect(result.error).toContain("MSG91_AUTHKEY is not configured");
    });
  });

  // --------------------------------------------------------------------------
  // Criterion 13: Mock provider regression
  // --------------------------------------------------------------------------
  describe("13. Mock provider regression", () => {
    it("preserves standard mock OTP request and verification for automated testing", async () => {
      const reqRes = await otpService.requestOtp(TEST_PHONE);
      expect(reqRes.success).toBe(true);
      expect(reqRes.demoCode).toBeDefined();

      const verifyRes = await otpService.verifyOtp(TEST_PHONE, reqRes.demoCode!);
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.normalizedPhone).toBe("+919829012345");
    });
  });
});
