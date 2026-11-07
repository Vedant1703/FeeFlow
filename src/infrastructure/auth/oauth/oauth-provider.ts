import crypto from "crypto";

export interface OAuthAuthorizationUrlResult {
  url: string;
  state: string;
  codeVerifier: string;
}

export interface OAuthProfile {
  provider: string;
  providerAccountId: string;
  email: string;
  name: string;
  emailVerified: boolean;
  picture?: string;
}

export interface OAuthProvider {
  name: string;
  getAuthorizationUrl(redirectUri: string): Promise<OAuthAuthorizationUrlResult>;
  exchangeCode(code: string, codeVerifier: string, redirectUri: string): Promise<OAuthProfile>;
}

/**
 * Generates a cryptographically secure random base64url PKCE code verifier (43-128 chars).
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Derives a PKCE code challenge from a code verifier using SHA-256.
 */
export function generateCodeChallenge(codeVerifier: string): string {
  return crypto.createHash("sha256").update(codeVerifier).digest("base64url");
}

/**
 * Generates a cryptographically random state parameter for CSRF mitigation.
 */
export function generateRandomState(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Google OAuth 2.0 PKCE Provider implementation.
 */
export class GoogleOAuthProvider implements OAuthProvider {
  public name = "GOOGLE";
  private clientId: string;
  private clientSecret: string;

  constructor(clientId?: string, clientSecret?: string) {
    this.clientId = clientId || process.env.GOOGLE_CLIENT_ID || "demo_google_client_id";
    this.clientSecret = clientSecret || process.env.GOOGLE_CLIENT_SECRET || "demo_google_client_secret";
  }

  async getAuthorizationUrl(redirectUri: string): Promise<OAuthAuthorizationUrlResult> {
    const state = generateRandomState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      access_type: "offline",
      prompt: "select_account",
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return {
      url,
      state,
      codeVerifier,
    };
  }

  async exchangeCode(
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<OAuthProfile> {
    const tokenEndpoint = "https://oauth2.googleapis.com/token";

    const bodyParams = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyParams.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Google token exchange failed: ${errText}`);
    }

    const tokenData = await tokenRes.json();
    const idToken = tokenData.id_token;

    // Decode ID Token claims without external library
    const [, payloadB64] = idToken.split(".");
    const claims = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));

    return {
      provider: this.name,
      providerAccountId: claims.sub,
      email: claims.email.toLowerCase(),
      name: claims.name || claims.email.split("@")[0],
      emailVerified: Boolean(claims.email_verified),
      picture: claims.picture,
    };
  }
}

/**
 * Mock OAuth Provider for local development, automated testing, and take-home demo evaluation.
 * Allows deterministic one-click authentication for any seeded persona.
 */
export class MockOAuthProvider implements OAuthProvider {
  public name = "MOCK_OAUTH";

  async getAuthorizationUrl(redirectUri: string): Promise<OAuthAuthorizationUrlResult> {
    const state = generateRandomState();
    const codeVerifier = generateCodeVerifier();

    const params = new URLSearchParams({
      redirect_uri: redirectUri,
      state,
      provider: "mock",
    });

    // Mock direct callback redirect url for local demo
    const url = `${redirectUri}?code=mock_code_arvind&state=${state}`;

    return {
      url,
      state,
      codeVerifier,
    };
  }

  async exchangeCode(
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<OAuthProfile> {
    // Determine profile from mock code suffix
    if (code.includes("neha")) {
      return {
        provider: this.name,
        providerAccountId: "mock_sub_neha_verma",
        email: "neha.verma@demo.companya.test",
        name: "Neha Verma (Accounts Executive)",
        emailVerified: true,
      };
    }

    if (code.includes("pooja")) {
      return {
        provider: this.name,
        providerAccountId: "mock_sub_pooja_rawat",
        email: "pooja.rawat@demo.companya.test",
        name: "Pooja Rawat (Student Counsellor)",
        emailVerified: true,
      };
    }

    if (code.includes("parent") || code.includes("rakesh")) {
      return {
        provider: this.name,
        providerAccountId: "mock_sub_rakesh_sharma",
        email: "rakesh.sharma@demo.parent.test",
        name: "Rakesh Sharma (Parent)",
        emailVerified: true,
      };
    }

    // Default to Founder-Director Arvind Mathur
    return {
      provider: this.name,
      providerAccountId: "mock_sub_arvind_mathur",
      email: "arvind.mathur@demo.companya.test",
      name: "Arvind Mathur (Founder-Director)",
      emailVerified: true,
    };
  }
}

export const mockOAuthProvider = new MockOAuthProvider();
export const googleOAuthProvider = new GoogleOAuthProvider();

/**
 * Factory function returning the OAuth Provider for a given provider name.
 */
export function getOAuthProvider(providerName: string = "GOOGLE"): OAuthProvider {
  const norm = providerName.toUpperCase();
  if (norm === "GOOGLE") {
    // If real Google Client ID is configured and not in DEMO_MODE, return Google provider
    if (process.env.GOOGLE_CLIENT_ID && process.env.DEMO_MODE !== "true") {
      return googleOAuthProvider;
    }
    return mockOAuthProvider;
  }
  return mockOAuthProvider;
}

