/**
 * MSG91 OTP Widget Server-Side Verification Adapter for FeeFlow.
 *
 * Implements server-side access token verification according to the MSG91 OTP Widget Web SDK specifications.
 * Endpoint: POST https://control.msg91.com/api/v5/widget/verifyAccessToken
 *
 * Security:
 * - MSG91_AUTHKEY is kept strictly server-side and never exposed to the frontend.
 * - Raw access tokens are never logged or stored.
 * - Verified mobile identities are normalized to Indian E.164 (+91XXXXXXXXXX).
 */

import { normalizeIndianPhoneNumber } from "../otp-service";

export interface Msg91VerifyAccessTokenResponse {
  type: "success" | "error";
  message: string;
  [key: string]: any;
}

export interface Msg91VerifyResult {
  success: boolean;
  verifiedIdentifier?: string; // Normalized E.164 (+91XXXXXXXXXX)
  rawIdentifier?: string;
  error?: string;
  statusCode?: number;
}

export interface Msg91WidgetAdapterConfig {
  authKey?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export class Msg91WidgetAdapter {
  private authKey?: string;
  private baseUrl: string;
  private fetchFn: typeof fetch;

  constructor(config: Msg91WidgetAdapterConfig = {}) {
    this.authKey =
      config.authKey !== undefined
        ? config.authKey
        : process.env.MSG91_AUTHKEY || process.env.msg91authkey;
    this.baseUrl = config.baseUrl || "https://control.msg91.com";
    this.fetchFn = config.fetchFn || fetch;
  }

  /**
   * Returns true if MSG91_AUTHKEY is configured in the environment or adapter instance.
   */
  isConfigured(): boolean {
    return Boolean(this.authKey && this.authKey.trim().length > 0);
  }

  /**
   * Verifies an access token issued by the MSG91 Web SDK (verifyOtp).
   *
   * @param accessToken - The JWT access token received from window.verifyOtp()
   * @returns Msg91VerifyResult with normalized mobile on success
   */
  async verifyAccessToken(accessToken: string): Promise<Msg91VerifyResult> {
    if (!accessToken || typeof accessToken !== "string" || !accessToken.trim()) {
      return {
        success: false,
        error: "Access token is required for MSG91 verification",
      };
    }

    if (!this.authKey) {
      return {
        success: false,
        error: "MSG91_AUTHKEY is not configured on the server",
      };
    }

    const endpoint = `${this.baseUrl}/api/v5/widget/verifyAccessToken`;

    try {
      const response = await this.fetchFn(endpoint, {
        method: "POST",
        headers: {
          authkey: this.authKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          "access-token": accessToken.trim(),
        }),
      });

      let data: Msg91VerifyAccessTokenResponse;
      try {
        data = (await response.json()) as Msg91VerifyAccessTokenResponse;
      } catch {
        return {
          success: false,
          statusCode: response.status,
          error: "Invalid JSON response from MSG91 verification server",
        };
      }

      // MSG91 returns 200 even on some validation failures; check data.type strictly
      if (!response.ok || data.type !== "success") {
        const codeStr = data.code !== undefined ? String(data.code) : "";
        console.error(
          `[Msg91WidgetAdapter] Verification rejected by MSG91: status=${response.status}, code=${codeStr || "none"}, message=${data.message || "none"}`
        );

        let errorDetail = data.message || `MSG91 verification rejected token (type: ${data.type || "unknown"})`;
        if (codeStr === "418") {
          errorDetail = "MSG91 API Security Rejection (Code 418: Server IP not whitelisted). Please whitelist this server's public IP in MSG91 dashboard under Authkey API Security, or disable IP restriction.";
        } else if (codeStr === "201") {
          errorDetail = "MSG91 AuthenticationFailure (Code 201: Invalid Authkey). Please verify MSG91_AUTHKEY in your environment settings.";
        }

        return {
          success: false,
          statusCode: response.status,
          error: errorDetail,
        };
      }

      // Success: data.message contains the verified phone/identifier (e.g. "919829012345" or "9829012345")
      const rawIdentifier = data.message;
      if (!rawIdentifier || typeof rawIdentifier !== "string") {
        return {
          success: false,
          statusCode: response.status,
          error: "MSG91 response missing verified identifier in message field",
        };
      }

      // Normalize Indian mobile number
      const norm = normalizeIndianPhoneNumber(rawIdentifier);
      if (!norm.isValid) {
        return {
          success: false,
          statusCode: response.status,
          rawIdentifier,
          error: `Verified identifier from MSG91 could not be normalized: ${norm.error}`,
        };
      }

      return {
        success: true,
        statusCode: response.status,
        verifiedIdentifier: norm.normalized,
        rawIdentifier,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Network error verifying access token with MSG91: ${err.message || "Unknown error"}`,
      };
    }
  }
}

// Global singleton instance using environment variables
export const msg91WidgetAdapter = new Msg91WidgetAdapter();
