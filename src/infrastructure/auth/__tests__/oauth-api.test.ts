import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as initiateOAuth } from "@/app/api/auth/oauth/[provider]/route";
import { GET as handleOAuthCallback } from "@/app/api/auth/oauth/[provider]/callback/route";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/infrastructure/auth/session";

describe("Infrastructure: OAuth 2.0 PKCE API Integration", () => {
  it("initiates OAuth flow with PKCE verifier, state cookie, and redirect to auth URL", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/oauth/google?returnTo=/staff/reconciliation");
    const res = await initiateOAuth(req, { params: { provider: "google" } });

    expect(res.status).toBe(307); // NextResponse.redirect default
    const location = res.headers.get("location");
    expect(location).toBeDefined();

    // Verify cookies set on response
    const setCookieHeaders = res.headers.getSetCookie();
    expect(setCookieHeaders.some((c) => c.includes("feeflow_oauth_state="))).toBe(true);
    expect(setCookieHeaders.some((c) => c.includes("feeflow_oauth_verifier="))).toBe(true);
    expect(setCookieHeaders.some((c) => c.includes("feeflow_oauth_return_to="))).toBe(true);
  });

  it("callback rejects invalid or missing CSRF state parameter", async () => {
    // Request with state=evil_state and cookie state=real_state
    const req = new NextRequest("http://localhost:3000/api/auth/oauth/google/callback?code=mock_code&state=evil_state", {
      headers: {
        Cookie: "feeflow_oauth_state=real_state; feeflow_oauth_verifier=test_verifier",
      },
    });

    const res = await handleOAuthCallback(req, { params: { provider: "google" } });
    const location = res.headers.get("location");

    expect(location).toContain("/staff/login?error=Invalid+OAuth+state+parameter");
  });

  it("callback resolves Founder-Director Arvind Mathur and issues DIRECTOR session", async () => {
    const validState = "test_valid_state_123";
    const req = new NextRequest(
      `http://localhost:3000/api/auth/oauth/google/callback?code=mock_code_arvind&state=${validState}`,
      {
        headers: {
          Cookie: `feeflow_oauth_state=${validState}; feeflow_oauth_verifier=test_verifier; feeflow_oauth_return_to=/staff`,
        },
      }
    );

    const res = await handleOAuthCallback(req, { params: { provider: "google" } });
    const location = res.headers.get("location");
    expect(location).toContain("/staff");

    // Extract session cookie
    const setCookies = res.headers.getSetCookie();
    const sessionCookie = setCookies.find((c) => c.includes(`${SESSION_COOKIE_NAME}=`));
    expect(sessionCookie).toBeDefined();

    const tokenMatch = sessionCookie!.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    expect(tokenMatch).toBeTruthy();
    const token = tokenMatch![1];

    const actor = verifySessionToken(token);
    expect(actor).toBeDefined();
    expect(actor?.role).toBe("DIRECTOR");
    expect(actor?.name).toContain("Arvind Mathur");
    expect(actor?.email).toBe("arvind.mathur@demo.companya.test");
    expect(actor?.centreIds.length).toBe(4); // All 4 centres
  });

  it("callback resolves Accounts Executive Neha Verma and enforces centre scoping", async () => {
    const validState = "test_valid_state_456";
    const req = new NextRequest(
      `http://localhost:3000/api/auth/oauth/google/callback?code=mock_code_neha&state=${validState}`,
      {
        headers: {
          Cookie: `feeflow_oauth_state=${validState}; feeflow_oauth_verifier=test_verifier; feeflow_oauth_return_to=/staff`,
        },
      }
    );

    const res = await handleOAuthCallback(req, { params: { provider: "google" } });
    const location = res.headers.get("location");
    expect(location).toContain("/staff");

    const setCookies = res.headers.getSetCookie();
    const sessionCookie = setCookies.find((c) => c.includes(`${SESSION_COOKIE_NAME}=`));
    const token = sessionCookie!.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))![1];

    const actor = verifySessionToken(token);
    expect(actor?.role).toBe("ACCOUNTS");
    expect(actor?.name).toContain("Neha Verma");
    expect(actor?.centreIds).toContain("cen_vn"); // Vaishali Nagar
  });

  it("callback resolves Parent Rakesh Sharma and redirects to /parent", async () => {
    const validState = "test_valid_state_789";
    const req = new NextRequest(
      `http://localhost:3000/api/auth/oauth/google/callback?code=mock_code_rakesh&state=${validState}`,
      {
        headers: {
          Cookie: `feeflow_oauth_state=${validState}; feeflow_oauth_verifier=test_verifier`,
        },
      }
    );

    const res = await handleOAuthCallback(req, { params: { provider: "google" } });
    const location = res.headers.get("location");
    expect(location).toContain("/parent");

    const setCookies = res.headers.getSetCookie();
    const sessionCookie = setCookies.find((c) => c.includes(`${SESSION_COOKIE_NAME}=`));
    const token = sessionCookie!.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))![1];

    const actor = verifySessionToken(token);
    expect(actor?.role).toBe("PARENT");
    expect(actor?.name).toBe("Rakesh Sharma");
    expect(actor?.linkedStudentIds.length).toBeGreaterThanOrEqual(1);
  });
});
