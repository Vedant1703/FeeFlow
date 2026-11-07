import { describe, it, expect, beforeEach } from "vitest";
import { MockSmsProvider, getSmsProvider } from "../sms-provider";

describe("Infrastructure: SMS Provider Port & Mock Adapter", () => {
  let provider: MockSmsProvider;

  beforeEach(() => {
    provider = new MockSmsProvider();
  });

  it("dispatches OTP successfully and records sent message with messageId", async () => {
    const res = await provider.sendOtp({
      phone: "+919000012345",
      otp: "582914",
      expiresInMinutes: 5,
    });

    expect(res.success).toBe(true);
    expect(res.messageId).toMatch(/^sms_\d+_/);
    expect(res.provider).toBe("MOCK_SMS");

    expect(provider.history.length).toBe(1);
    expect(provider.getLastOtp("+91 90000 12345")).toBe("582914");
  });

  it("fails gracefully if phone or otp is missing", async () => {
    const res = await provider.sendOtp({
      phone: "",
      otp: "123456",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("required");
  });

  it("retrieves the most recent OTP for a phone number", async () => {
    await provider.sendOtp({ phone: "+919000012345", otp: "111111" });
    await provider.sendOtp({ phone: "+919000012345", otp: "222222" });

    expect(provider.getLastOtp("+919000012345")).toBe("222222");
  });

  it("factory returns default SmsProvider instance", () => {
    const defaultProvider = getSmsProvider();
    expect(defaultProvider).toBeDefined();
    expect(defaultProvider.name).toBe("MOCK_SMS");
  });
});
