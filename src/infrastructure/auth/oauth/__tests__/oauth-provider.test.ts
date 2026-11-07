import { describe, it, expect } from "vitest";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateRandomState,
  MockOAuthProvider,
  GoogleOAuthProvider,
  getOAuthProvider,
} from "../oauth-provider";

describe("Infrastructure: OAuth 2.0 PKCE Provider Port & Adapters", () => {
  it("generates valid high-entropy PKCE code verifier and SHA-256 challenge", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toBeDefined();
    expect(verifier.length).toBeGreaterThanOrEqual(43);

    const challenge = generateCodeChallenge(verifier);
    expect(challenge).toBeDefined();
    expect(challenge.length).toBeGreaterThanOrEqual(43);

    // Verify determinism: same verifier yields identical challenge
    const challenge2 = generateCodeChallenge(verifier);
    expect(challenge).toBe(challenge2);
  });

  it("generates cryptographically random state parameter for CSRF mitigation", () => {
    const state1 = generateRandomState();
    const state2 = generateRandomState();

    expect(state1).not.toBe(state2);
    expect(state1.length).toBeGreaterThanOrEqual(30);
  });

  it("GoogleOAuthProvider constructs valid authorization URL with PKCE parameters", async () => {
    const google = new GoogleOAuthProvider("test_client_id", "test_client_secret");
    const res = await google.getAuthorizationUrl("http://localhost:3000/api/auth/oauth/google/callback");

    expect(res.url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(res.url).toContain("client_id=test_client_id");
    expect(res.url).toContain("code_challenge_method=S256");
    expect(res.url).toContain(`state=${res.state}`);
    expect(res.codeVerifier).toBeDefined();
  });

  it("MockOAuthProvider resolves deterministic demo personas based on code", async () => {
    const mock = new MockOAuthProvider();

    // 1. Director Arvind Mathur
    const dirProfile = await mock.exchangeCode("mock_code_arvind", "verifier", "http://localhost");
    expect(dirProfile.email).toBe("arvind.mathur@demo.companya.test");
    expect(dirProfile.name).toContain("Arvind Mathur");

    // 2. Accounts Executive Neha Verma
    const accProfile = await mock.exchangeCode("mock_code_neha", "verifier", "http://localhost");
    expect(accProfile.email).toBe("neha.verma@demo.companya.test");
    expect(accProfile.name).toContain("Neha Verma");

    // 3. Counsellor Pooja Rawat
    const couProfile = await mock.exchangeCode("mock_code_pooja", "verifier", "http://localhost");
    expect(couProfile.email).toBe("pooja.rawat@demo.companya.test");
    expect(couProfile.name).toContain("Pooja Rawat");

    // 4. Parent Rakesh Sharma
    const parProfile = await mock.exchangeCode("mock_code_rakesh", "verifier", "http://localhost");
    expect(parProfile.email).toBe("rakesh.sharma@demo.parent.test");
    expect(parProfile.name).toContain("Rakesh Sharma");
  });

  it("factory returns default configured provider", () => {
    const provider = getOAuthProvider("GOOGLE");
    expect(provider).toBeDefined();
    expect(provider.name).toBe("MOCK_OAUTH"); // In demo mode
  });
});
