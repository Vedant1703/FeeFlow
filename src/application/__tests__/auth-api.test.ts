import { describe, it, expect } from "vitest";
import { POST as sendOtp } from "@/app/api/auth/otp/send/route";
import { POST as verifyOtp } from "@/app/api/auth/otp/verify/route";
import { POST as staffLogin } from "@/app/api/auth/staff/login/route";

describe("Authentication & Session API Integration Tests", () => {
  describe("Parent OTP Send (/api/auth/otp/send)", () => {
    it("returns 200 and demoCode 482913 for seeded parent Rakesh Sharma (+91 90000 12345)", async () => {
      const req = new Request("http://localhost:3000/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+91 90000 12345" }),
      });

      const res = await sendOtp(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.demoCode).toBe("482913");
      expect(data.phone).toContain("9000012345");
    });

    it("returns 404 for unseeded phone number", async () => {
      const req = new Request("http://localhost:3000/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+91 99999 99999" }),
      });

      const res = await sendOtp(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toContain("not registered");
    });

    it("returns 400 when phone number is missing", async () => {
      const req = new Request("http://localhost:3000/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const res = await sendOtp(req);
      expect(res.status).toBe(400);
    });
  });

  describe("Parent OTP Verify (/api/auth/otp/verify)", () => {
    it("authenticates parent with valid demo OTP code 482913 and returns linked students", async () => {
      const req = new Request("http://localhost:3000/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+91 90000 12345", code: "482913" }),
      });

      const res = await verifyOtp(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.actor.role).toBe("PARENT");
      expect(data.actor.name).toBe("Rakesh Sharma");
      expect(data.students.length).toBeGreaterThanOrEqual(1);

      // Check session cookie is set
      const setCookieHeader = res.headers.get("set-cookie");
      expect(setCookieHeader).toBeTruthy();
      expect(setCookieHeader).toContain("feeflow_session=");
    });

    it("rejects invalid OTP code with 401", async () => {
      const req = new Request("http://localhost:3000/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+91 90000 12345", code: "123456" }),
      });

      const res = await verifyOtp(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toContain("Wrong code");
    });
  });

  describe("Staff Login (/api/auth/staff/login)", () => {
    it("authenticates Accounts Executive (Neha Verma) with scoped centres", async () => {
      const req = new Request("http://localhost:3000/api/auth/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "neha.verma@demo.companya.test",
          password: "DemoPassword123!",
        }),
      });

      const res = await staffLogin(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.actor.role).toBe("ACCOUNTS");
      expect(data.actor.name).toContain("Neha Verma");
      expect(data.actor.centreIds.length).toBeGreaterThanOrEqual(1);

      const setCookieHeader = res.headers.get("set-cookie");
      expect(setCookieHeader).toContain("feeflow_session=");
    });

    it("authenticates Founder-Director (Arvind Mathur) across all 4 centres", async () => {
      const req = new Request("http://localhost:3000/api/auth/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "arvind.mathur@demo.companya.test",
          password: "DemoPassword123!",
        }),
      });

      const res = await staffLogin(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.actor.role).toBe("DIRECTOR");
    });

    it("authenticates Counsellor (Pooja Rawat)", async () => {
      const req = new Request("http://localhost:3000/api/auth/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "pooja.rawat@demo.companya.test",
          password: "DemoPassword123!",
        }),
      });

      const res = await staffLogin(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.actor.role).toBe("COUNSELLOR");
    });

    it("rejects incorrect password with 401", async () => {
      const req = new Request("http://localhost:3000/api/auth/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "neha.verma@demo.companya.test",
          password: "WrongPassword999",
        }),
      });

      const res = await staffLogin(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toContain("Invalid email or password");
    });
  });
});

