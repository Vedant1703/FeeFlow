import { describe, it, expect, beforeEach } from "vitest";
import { POST as registerParent } from "@/app/api/auth/parent/register/route";
import { POST as verifyOtp } from "@/app/api/auth/otp/verify/route";
import { POST as sendOtp } from "@/app/api/auth/otp/send/route";
import { GET as getLatestOtp } from "@/app/api/auth/otp/latest/route";
import { mockSmsProvider } from "@/infrastructure/auth/sms/sms-provider";
import { otpService } from "@/infrastructure/auth/otp-service";

describe("Parent User Registration & OTP Lifecycle End-to-End", () => {
  beforeEach(() => {
    mockSmsProvider.clear();
    otpService.resetState();
  });

  it("registers a new parent, dispatches real OTP via SMS, inspects inbox, and authenticates", async () => {
    const testPhone = "+91 98290 77665";
    const testName = "Devendra Rathore";

    // 1. Register new parent
    const regReq = new Request("http://localhost:3000/api/auth/parent/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: testName,
        phone: testPhone,
        studentCode: "STU-0587",
        relationship: "Father",
        preferredLanguage: "hi",
      }),
    });

    const regRes = await registerParent(regReq);
    const regData = await regRes.json();

    expect(regRes.status).toBe(200);
    expect(regData.success).toBe(true);
    expect(regData.parent.name).toBe(testName);
    expect(regData.parent.phone).toContain("9829077665");
    expect(regData.code).toBeTruthy();
    expect(regData.code).toMatch(/^\d{6}$/);

    const generatedOtp = regData.code;

    // 2. Verify that SMS Provider received the message
    const lastSms = mockSmsProvider.getLatestMessage(testPhone);
    expect(lastSms).toBeDefined();
    expect(lastSms?.otp).toBe(generatedOtp);

    // 3. Inspect latest OTP endpoint (/api/auth/otp/latest)
    const latestReq = new Request(`http://localhost:3000/api/auth/otp/latest?phone=${encodeURIComponent(testPhone)}`);
    const latestRes = await getLatestOtp(latestReq);
    const latestData = await latestRes.json();

    expect(latestRes.status).toBe(200);
    expect(latestData.otp).toBe(generatedOtp);
    expect(latestData.renderedBody).toContain(generatedOtp);

    // 4. Verify OTP and authenticate parent
    const verifyReq = new Request("http://localhost:3000/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: testPhone,
        code: generatedOtp,
      }),
    });

    const verifyRes = await verifyOtp(verifyReq);
    const verifyData = await verifyRes.json();

    expect(verifyRes.status).toBe(200);
    expect(verifyData.success).toBe(true);
    expect(verifyData.actor.role).toBe("PARENT");
    expect(verifyData.actor.name).toBe(testName);
    expect(verifyData.actor.phone).toContain("9829077665");

    // Verify session cookie header is returned
    const cookieHeader = verifyRes.headers.get("set-cookie");
    expect(cookieHeader).toContain("feeflow_session=");

    // 5. Single-use invariant: Reusing the same OTP must fail
    const replayReq = new Request("http://localhost:3000/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: testPhone,
        code: generatedOtp,
      }),
    });

    const replayRes = await verifyOtp(replayReq);
    expect(replayRes.status).toBe(401);
    const replayData = await replayRes.json();
    expect(replayData.error).toContain("No active OTP request found");
  });

  it("handles existing parent requesting new OTP, rejects wrong code, and locks after 3 attempts", async () => {
    const seededPhone = "+91 90000 12345"; // Sanjay Sharma

    // 1. Request new OTP
    const sendReq = new Request("http://localhost:3000/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: seededPhone }),
    });

    const sendRes = await sendOtp(sendReq);
    const sendData = await sendRes.json();

    expect(sendRes.status).toBe(200);
    expect(sendData.code).toBeTruthy();

    const validCode = sendData.code;

    // 2. Submit wrong code (Attempt 1)
    const failReq1 = new Request("http://localhost:3000/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: seededPhone, code: "000000" }),
    });
    const failRes1 = await verifyOtp(failReq1);
    expect(failRes1.status).toBe(401);
    const failData1 = await failRes1.json();
    expect(failData1.attemptsRemaining).toBe(2);

    // 3. Submit wrong code (Attempt 2)
    const failReq2 = new Request("http://localhost:3000/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: seededPhone, code: "111111" }),
    });
    const failRes2 = await verifyOtp(failReq2);
    expect(failRes2.status).toBe(401);
    const failData2 = await failRes2.json();
    expect(failData2.attemptsRemaining).toBe(1);

    // 4. Submit wrong code (Attempt 3 - Lockout)
    const failReq3 = new Request("http://localhost:3000/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: seededPhone, code: "222222" }),
    });
    const failRes3 = await verifyOtp(failReq3);
    expect(failRes3.status).toBe(401);
    const failData3 = await failRes3.json();
    expect(failData3.isLocked).toBe(true);
    expect(failData3.error).toContain("locked");

    // 5. Even submitting correct code now should fail because token is locked
    const lockedReq = new Request("http://localhost:3000/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: seededPhone, code: validCode }),
    });
    const lockedRes = await verifyOtp(lockedReq);
    expect(lockedRes.status).toBe(401);
    const lockedData = await lockedRes.json();
    expect(lockedData.error).toContain("locked");
  });
});
