/**
 * Cryptographic OTP Authentication Service for FeeFlow.
 * Handles Indian E.164 normalization, secure 6-digit generation, HMAC-SHA256 hashing,
 * sliding-window rate limiting, and brute-force attempt lockout.
 */

import crypto from "crypto";
import { prisma } from "@/infrastructure/db/prisma";
import { getSmsProvider } from "./sms/sms-provider";
import { msg91WidgetAdapter, Msg91WidgetAdapter } from "./sms/msg91-widget-adapter";

export const OTP_HMAC_SECRET =
  process.env.OTP_HMAC_SECRET ||
  process.env.SESSION_SECRET ||
  "feeflow_otp_hmac_secret_key_at_least_32_characters_long";

export const OTP_EXPIRY_MINUTES = 5;
export const OTP_EXPIRY_MS = OTP_EXPIRY_MINUTES * 60 * 1000;
export const WIDGET_CHALLENGE_EXPIRY_MINUTES = 15;
export const WIDGET_CHALLENGE_EXPIRY_MS = WIDGET_CHALLENGE_EXPIRY_MINUTES * 60 * 1000; // 15-minute widget expiry
export const RESEND_COOLDOWN_SECONDS = 60;
export const RESEND_COOLDOWN_MS = RESEND_COOLDOWN_SECONDS * 1000;
export const MAX_ATTEMPTS = 3;
export const MAX_REQUESTS_PER_PHONE_WINDOW = 3;
export const PHONE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Normalizes an Indian phone number to strict E.164 format (+91XXXXXXXXXX).
 * Rejects numbers that do not have 10 digits starting with 6, 7, 8, or 9.
 */
export function normalizeIndianPhoneNumber(rawPhone: string): {
  isValid: boolean;
  normalized: string;
  error?: string;
} {
  if (!rawPhone || typeof rawPhone !== "string") {
    return { isValid: false, normalized: "", error: "Phone number is required" };
  }

  // Strip all whitespace, dashes, parentheses
  const cleaned = rawPhone.replace(/[^\d+]/g, "");

  let tenDigit = "";
  if (cleaned.startsWith("+91")) {
    tenDigit = cleaned.slice(3);
  } else if (cleaned.startsWith("91") && cleaned.length === 12) {
    tenDigit = cleaned.slice(2);
  } else if (cleaned.startsWith("0") && cleaned.length === 11) {
    tenDigit = cleaned.slice(1);
  } else if (cleaned.length === 10) {
    tenDigit = cleaned;
  } else {
    return {
      isValid: false,
      normalized: "",
      error: "Invalid Indian phone format. Please provide a 10-digit mobile number.",
    };
  }

  // Indian mobile numbers must be 10 digits and begin with 6, 7, 8, or 9
  if (!/^[6-9]\d{9}$/.test(tenDigit)) {
    return {
      isValid: false,
      normalized: "",
      error: "Invalid Indian mobile number. Mobile numbers must begin with 6, 7, 8, or 9.",
    };
  }

  return {
    isValid: true,
    normalized: `+91${tenDigit}`,
  };
}

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 */
export function generateNumericOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Computes an HMAC-SHA256 hex digest of the OTP bound to the normalized phone number.
 */
export function hashOtp(phone: string, otp: string, secret: string = OTP_HMAC_SECRET): string {
  return crypto.createHmac("sha256", secret).update(`${phone}:${otp}`).digest("hex");
}

export interface InMemoryOtpRecord {
  id?: string;
  phone: string;
  tokenHash: string;
  provider?: string; // "INTERNAL" | "MSG91_WIDGET"
  providerRequestId?: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  consumed: boolean;
  createdAt: Date;
}

export interface RequestRateRecord {
  timestamps: number[];
}

export class OtpService {
  private inMemoryTokens: Map<string, InMemoryOtpRecord[]> = new Map();
  private phoneRateLimits: Map<string, RequestRateRecord> = new Map();

  /**
   * Resets in-memory state (useful for test isolation).
   */
  resetState(): void {
    this.inMemoryTokens.clear();
    this.phoneRateLimits.clear();
  }

  /**
   * Checks sliding window rate limit for phone number.
   */
  checkRateLimit(phone: string, now: number = Date.now()): { allowed: boolean; waitSeconds?: number } {
    const rateRec = this.phoneRateLimits.get(phone) || { timestamps: [] };

    // Filter timestamps within sliding window
    const recent = rateRec.timestamps.filter((ts) => now - ts < PHONE_WINDOW_MS);
    this.phoneRateLimits.set(phone, { timestamps: recent });

    if (recent.length >= MAX_REQUESTS_PER_PHONE_WINDOW) {
      const oldestInWindow = recent[0];
      const waitSeconds = Math.ceil((PHONE_WINDOW_MS - (now - oldestInWindow)) / 1000);
      return { allowed: false, waitSeconds: Math.max(1, waitSeconds) };
    }

    return { allowed: true };
  }

  /**
   * Checks resend cooldown (60 seconds).
   */
  checkCooldown(phone: string, now: number = Date.now()): { allowed: boolean; waitSeconds?: number } {
    const tokens = this.inMemoryTokens.get(phone) || [];
    if (tokens.length === 0) return { allowed: true };

    const lastToken = tokens[tokens.length - 1];
    const elapsed = now - lastToken.createdAt.getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return { allowed: false, waitSeconds };
    }

    return { allowed: true };
  }

  /**
   * Requests a new OTP for a phone number.
   */
  async requestOtp(
    rawPhone: string,
    options: { now?: Date; ipAddress?: string } = {}
  ): Promise<{
    success: boolean;
    normalizedPhone?: string;
    resendAfterSeconds: number;
    demoCode?: string;
    error?: string;
  }> {
    const norm = normalizeIndianPhoneNumber(rawPhone);
    if (!norm.isValid) {
      return {
        success: false,
        resendAfterSeconds: 0,
        error: norm.error,
      };
    }

    const phone = norm.normalized;
    const now = options.now ? options.now.getTime() : Date.now();

    // 1. Check Rate Limit (max 3 per 10 mins)
    const rateCheck = this.checkRateLimit(phone, now);
    if (!rateCheck.allowed) {
      return {
        success: false,
        resendAfterSeconds: rateCheck.waitSeconds || 60,
        error: `Too many OTP requests. Please wait ${rateCheck.waitSeconds} seconds before trying again.`,
      };
    }

    // 2. Check 60s Resend Cooldown
    const cooldownCheck = this.checkCooldown(phone, now);
    if (!cooldownCheck.allowed) {
      return {
        success: false,
        resendAfterSeconds: cooldownCheck.waitSeconds || 60,
        error: `Please wait ${cooldownCheck.waitSeconds} seconds before requesting a new OTP.`,
      };
    }

    // 3. Generate secure OTP
    const rawOtp = generateNumericOtp();
    const tokenHash = hashOtp(phone, rawOtp);
    const expiresAt = new Date(now + OTP_EXPIRY_MS);
    const createdAt = new Date(now);

    const tokenRecord: InMemoryOtpRecord = {
      phone,
      tokenHash,
      expiresAt,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      consumed: false,
      createdAt,
    };

    // Record in memory store
    const existing = this.inMemoryTokens.get(phone) || [];
    existing.push(tokenRecord);
    this.inMemoryTokens.set(phone, existing);

    // Record timestamp in rate limiter
    const rateRec = this.phoneRateLimits.get(phone) || { timestamps: [] };
    rateRec.timestamps.push(now);
    this.phoneRateLimits.set(phone, rateRec);

    // Try persisting to Prisma if database is connected
    try {
      await prisma.otpToken.create({
        data: {
          phone,
          tokenHash,
          expiresAt,
          attempts: 0,
          maxAttempts: MAX_ATTEMPTS,
          consumed: false,
        },
      });
    } catch {
      // In-memory fallback handles offline testing & demo mode gracefully
    }

    // 4. Dispatch via SMS Provider
    const smsProvider = getSmsProvider();
    await smsProvider.sendOtp({
      phone,
      otp: rawOtp,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });

    return {
      success: true,
      normalizedPhone: phone,
      resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
      // In demo mode, expose the generated code for instant testing
      demoCode: process.env.DEMO_MODE !== "false" ? rawOtp : undefined,
    };
  }

  /**
   * Verifies an OTP code against stored records with brute-force attempt lockout.
   */
  async verifyOtp(
    rawPhone: string,
    candidateCode: string,
    options: { now?: Date } = {}
  ): Promise<{
    success: boolean;
    normalizedPhone?: string;
    error?: string;
    attemptsRemaining?: number;
    isLocked?: boolean;
  }> {
    const norm = normalizeIndianPhoneNumber(rawPhone);
    if (!norm.isValid) {
      return { success: false, error: norm.error };
    }

    if (!candidateCode || !/^\d{6}$/.test(candidateCode.trim())) {
      return { success: false, error: "Please enter a valid 6-digit OTP code." };
    }

    const phone = norm.normalized;
    const now = options.now ? options.now.getTime() : Date.now();
    const cleanCode = candidateCode.trim();

    // Universal demo code override in demo mode
    if (process.env.DEMO_MODE !== "false" && cleanCode === "482913") {
      return {
        success: true,
        normalizedPhone: phone,
      };
    }

    // 1. Try finding active token in database if available
    let dbToken: any = null;
    try {
      dbToken = await prisma.otpToken.findFirst({
        where: {
          phone,
          consumed: false,
        },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      // In-memory fallback handles offline testing & demo mode gracefully
    }

    // 2. Retrieve in-memory token
    const tokens = this.inMemoryTokens.get(phone) || [];
    let memToken: InMemoryOtpRecord | undefined;
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (!tokens[i].consumed) {
        memToken = tokens[i];
        break;
      }
    }

    const activeToken = dbToken || memToken;

    if (!activeToken) {
      return {
        success: false,
        error: "No active OTP request found for this phone number. Please request a new OTP.",
      };
    }

    const expiresAtMs =
      activeToken.expiresAt instanceof Date
        ? activeToken.expiresAt.getTime()
        : new Date(activeToken.expiresAt).getTime();

    // Check expiry
    if (now > expiresAtMs) {
      return {
        success: false,
        error: "OTP has expired. Please request a new OTP.",
      };
    }

    // Check attempt lockout
    if (activeToken.attempts >= activeToken.maxAttempts) {
      return {
        success: false,
        isLocked: true,
        attemptsRemaining: 0,
        error: "Maximum verification attempts exceeded. For your security, this OTP is locked. Please request a new OTP.",
      };
    }

    // Constant-time hash comparison
    const candidateHash = hashOtp(phone, cleanCode);
    const isValid = crypto.timingSafeEqual(
      Buffer.from(candidateHash),
      Buffer.from(activeToken.tokenHash)
    );

    if (!isValid) {
      activeToken.attempts += 1;
      if (memToken && memToken !== activeToken) {
        memToken.attempts += 1;
      }

      if (dbToken) {
        try {
          await prisma.otpToken.update({
            where: { id: dbToken.id },
            data: { attempts: { increment: 1 } },
          });
        } catch {}
      }

      const attemptsRemaining = activeToken.maxAttempts - activeToken.attempts;

      if (attemptsRemaining <= 0) {
        return {
          success: false,
          isLocked: true,
          attemptsRemaining: 0,
          error: "Maximum verification attempts exceeded. For your security, this OTP is locked. Please request a new OTP.",
        };
      }

      return {
        success: false,
        attemptsRemaining,
        error: `Wrong code. You have ${attemptsRemaining} ${
          attemptsRemaining === 1 ? "attempt" : "attempts"
        } remaining. In demo mode, use 482913.`,
      };
    }

    // Success: Mark consumed immediately (single-use invariant)
    if (memToken) {
      memToken.consumed = true;
    }
    if (dbToken) {
      try {
        await prisma.otpToken.update({
          where: { id: dbToken.id },
          data: { consumed: true },
        });
      } catch {}
    }

    return {
      success: true,
      normalizedPhone: phone,
    };
  }

  /**
   * Helper to find challenge record across in-memory tokens.
   */
  private findInMemoryChallenge(challengeId: string): InMemoryOtpRecord | undefined {
    for (const tokens of this.inMemoryTokens.values()) {
      const match = tokens.find((t) => t.id === challengeId);
      if (match) return match;
    }
    return undefined;
  }

  /**
   * Creates a short-lived (15-minute) MSG91 Widget challenge bound to the phone number.
   * Enforces 60-second cooldown and max 3 requests per 10-minute sliding window.
   */
  async createWidgetChallenge(
    rawPhone: string,
    options: { now?: Date; ipAddress?: string } = {}
  ): Promise<{
    success: boolean;
    challengeId?: string;
    normalizedPhone?: string;
    widgetPhone?: string;
    resendAfterSeconds: number;
    expiresInSeconds?: number;
    error?: string;
  }> {
    const norm = normalizeIndianPhoneNumber(rawPhone);
    if (!norm.isValid) {
      return {
        success: false,
        resendAfterSeconds: 0,
        error: norm.error,
      };
    }

    const phone = norm.normalized;
    const now = options.now ? options.now.getTime() : Date.now();

    // 1. Sliding window rate limit (max 3 per 10 min)
    const rateCheck = this.checkRateLimit(phone, now);
    if (!rateCheck.allowed) {
      return {
        success: false,
        resendAfterSeconds: rateCheck.waitSeconds || 60,
        error: `Too many OTP requests. Please wait ${rateCheck.waitSeconds} seconds before trying again.`,
      };
    }

    // 2. 60-second resend cooldown
    const cooldownCheck = this.checkCooldown(phone, now);
    if (!cooldownCheck.allowed) {
      return {
        success: false,
        resendAfterSeconds: cooldownCheck.waitSeconds || 60,
        error: `Please wait ${cooldownCheck.waitSeconds} seconds before requesting a new OTP.`,
      };
    }

    const challengeId = `ch_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
    const initialTokenHash = crypto
      .createHash("sha256")
      .update(`${challengeId}:${phone}:${now}`)
      .digest("hex");
    const expiresAt = new Date(now + WIDGET_CHALLENGE_EXPIRY_MS);
    const createdAt = new Date(now);

    const record: InMemoryOtpRecord = {
      id: challengeId,
      phone,
      tokenHash: initialTokenHash,
      provider: "MSG91_WIDGET",
      expiresAt,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      consumed: false,
      createdAt,
    };

    // Store in-memory
    const existing = this.inMemoryTokens.get(phone) || [];
    existing.push(record);
    this.inMemoryTokens.set(phone, existing);

    // Record rate limit timestamp
    const rateRec = this.phoneRateLimits.get(phone) || { timestamps: [] };
    rateRec.timestamps.push(now);
    this.phoneRateLimits.set(phone, rateRec);

    // Persist to Prisma
    try {
      await prisma.otpToken.create({
        data: {
          id: challengeId,
          phone,
          tokenHash: initialTokenHash,
          provider: "MSG91_WIDGET",
          expiresAt,
          attempts: 0,
          maxAttempts: MAX_ATTEMPTS,
          consumed: false,
        },
      });
    } catch {
      // In-memory fallback handles offline testing & demo mode gracefully
    }

    // MSG91 widget identifier requires country code without leading '+' (e.g. 919829012345)
    const widgetPhone = phone.replace(/^\+/, "");

    return {
      success: true,
      challengeId,
      normalizedPhone: phone,
      widgetPhone,
      resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
      expiresInSeconds: WIDGET_CHALLENGE_EXPIRY_MINUTES * 60,
    };
  }

  /**
   * Binds the MSG91 provider reqId (received from window.sendOtp) to the existing FeeFlow challenge.
   */
  async registerProviderRequestId(
    challengeId: string,
    reqId: string,
    options: { now?: Date } = {}
  ): Promise<{
    success: boolean;
    challengeId?: string;
    reqId?: string;
    error?: string;
  }> {
    if (!challengeId || typeof challengeId !== "string" || !challengeId.trim()) {
      return { success: false, error: "Challenge ID is required" };
    }
    if (!reqId || typeof reqId !== "string" || !reqId.trim()) {
      return { success: false, error: "Provider request ID (reqId) is required" };
    }

    const cleanChallengeId = challengeId.trim();
    const cleanReqId = reqId.trim();
    const now = options.now ? options.now.getTime() : Date.now();

    // 1. Check database first
    let dbToken: any = null;
    try {
      dbToken = await prisma.otpToken.findUnique({
        where: { id: cleanChallengeId },
      });
    } catch {}

    const memToken = this.findInMemoryChallenge(cleanChallengeId);
    const active = dbToken || memToken;

    if (!active) {
      return { success: false, error: "Challenge not found. Please request a new OTP." };
    }

    if (active.consumed) {
      return { success: false, error: "Challenge has already been consumed. Replay detected." };
    }

    const expiresAtMs =
      active.expiresAt instanceof Date
        ? active.expiresAt.getTime()
        : new Date(active.expiresAt).getTime();

    if (now > expiresAtMs) {
      return { success: false, error: "Challenge has expired. Please request a new OTP." };
    }

    // Idempotent check
    if (active.providerRequestId && active.providerRequestId === cleanReqId) {
      return { success: true, challengeId: cleanChallengeId, reqId: cleanReqId };
    }

    if (active.providerRequestId && active.providerRequestId !== cleanReqId) {
      return { success: false, error: "Challenge is already bound to a different provider request ID." };
    }

    // Ensure reqId is unique across active challenges (prevent duplicate/replayed reqId)
    if (memToken) {
      for (const list of this.inMemoryTokens.values()) {
        const conflict = list.find((t) => t.id !== cleanChallengeId && t.providerRequestId === cleanReqId);
        if (conflict) {
          return { success: false, error: "Provider request ID has already been registered with another challenge." };
        }
      }
      memToken.providerRequestId = cleanReqId;
    }

    if (dbToken) {
      try {
        const existingReq = await prisma.otpToken.findFirst({
          where: {
            providerRequestId: cleanReqId,
            NOT: { id: cleanChallengeId },
          },
        });
        if (existingReq) {
          return { success: false, error: "Provider request ID has already been registered with another challenge." };
        }

        await prisma.otpToken.update({
          where: { id: cleanChallengeId },
          data: { providerRequestId: cleanReqId },
        });
      } catch (err: any) {
        if (err?.code === "P2002") {
          return { success: false, error: "Provider request ID has already been registered." };
        }
      }
    }

    return {
      success: true,
      challengeId: cleanChallengeId,
      reqId: cleanReqId,
    };
  }

  /**
   * Verifies an access token issued by the MSG91 Web SDK against the challenge and provider.
   */
  async verifyWidgetAccessToken(params: {
    challengeId: string;
    reqId: string;
    accessToken: string;
    now?: Date;
    adapter?: Msg91WidgetAdapter;
  }): Promise<{
    success: boolean;
    normalizedPhone?: string;
    challengeId?: string;
    error?: string;
    attemptsRemaining?: number;
    isLocked?: boolean;
  }> {
    const { challengeId, reqId, accessToken, now: optNow, adapter = msg91WidgetAdapter } = params;

    if (!challengeId || typeof challengeId !== "string" || !challengeId.trim()) {
      return { success: false, error: "Challenge ID is required." };
    }
    if (!reqId || typeof reqId !== "string" || !reqId.trim()) {
      return { success: false, error: "Provider request ID (reqId) is required." };
    }
    if (!accessToken || typeof accessToken !== "string" || !accessToken.trim()) {
      return { success: false, error: "MSG91 access token is required." };
    }

    const cleanChallengeId = challengeId.trim();
    const cleanReqId = reqId.trim();
    const cleanAccessToken = accessToken.trim();
    const now = optNow ? optNow.getTime() : Date.now();

    // 1. Fetch challenge
    let dbToken: any = null;
    try {
      dbToken = await prisma.otpToken.findUnique({
        where: { id: cleanChallengeId },
      });
    } catch {}

    const memToken = this.findInMemoryChallenge(cleanChallengeId);
    const active = dbToken || memToken;

    if (!active) {
      return { success: false, error: "Challenge not found. Please request a new OTP." };
    }

    // 2. Check consumption (replay prevention)
    if (active.consumed) {
      return { success: false, error: "Challenge has already been consumed. Replay detected." };
    }

    // 3. Check expiry
    const expiresAtMs =
      active.expiresAt instanceof Date
        ? active.expiresAt.getTime()
        : new Date(active.expiresAt).getTime();

    if (now > expiresAtMs) {
      return { success: false, error: "Challenge has expired. Please request a new OTP." };
    }

    // 4. Check attempt lockout
    if (active.attempts >= active.maxAttempts) {
      return {
        success: false,
        isLocked: true,
        attemptsRemaining: 0,
        error: "Maximum verification attempts exceeded. Challenge locked.",
      };
    }

    // Helper for recording a failed verification attempt
    const recordFailedAttempt = async (errorMessage: string) => {
      active.attempts += 1;
      if (memToken && memToken !== active) {
        memToken.attempts += 1;
      }
      if (dbToken) {
        try {
          await prisma.otpToken.update({
            where: { id: cleanChallengeId },
            data: { attempts: { increment: 1 } },
          });
        } catch {}
      }
      const attemptsRemaining = Math.max(0, active.maxAttempts - active.attempts);
      const isLocked = attemptsRemaining === 0;
      return {
        success: false,
        isLocked,
        attemptsRemaining,
        error: isLocked
          ? "Maximum verification attempts exceeded. Challenge locked."
          : errorMessage,
      };
    };

    // 5. Verify provider reqId matches registered reqId
    if (!active.providerRequestId || active.providerRequestId !== cleanReqId) {
      return recordFailedAttempt("Provider request ID mismatch with challenge.");
    }

    // 6. Check access token replay (using token hash)
    const tokenHash = crypto.createHash("sha256").update(cleanAccessToken).digest("hex");

    // Check if tokenHash was already consumed in memory
    for (const tokens of this.inMemoryTokens.values()) {
      if (tokens.some((t) => t.tokenHash === tokenHash && t.consumed)) {
        return { success: false, error: "Access token has already been consumed. Replay detected." };
      }
    }

    // Check if tokenHash was already consumed in DB
    if (dbToken) {
      try {
        const replayed = await prisma.otpToken.findFirst({
          where: { tokenHash, consumed: true },
        });
        if (replayed) {
          return { success: false, error: "Access token has already been consumed. Replay detected." };
        }
      } catch {}
    }

    // 7. Verify access token with MSG91 API
    const verifyResult = await adapter.verifyAccessToken(cleanAccessToken);
    if (!verifyResult.success || !verifyResult.verifiedIdentifier) {
      return recordFailedAttempt(
        verifyResult.error || "MSG91 server rejected access token"
      );
    }

    // 8. Identity match check: verified mobile MUST match the challenge phone
    if (verifyResult.verifiedIdentifier !== active.phone) {
      return recordFailedAttempt(
        `Phone identity mismatch. Verified mobile ${verifyResult.verifiedIdentifier} does not match expected ${active.phone}.`
      );
    }

    // 9. Success: Atomically mark challenge consumed and store accessToken digest
    if (memToken) {
      memToken.consumed = true;
      memToken.tokenHash = tokenHash;
    }

    if (dbToken) {
      try {
        await prisma.otpToken.update({
          where: { id: cleanChallengeId },
          data: {
            consumed: true,
            tokenHash,
          },
        });
      } catch {}
    }

    return {
      success: true,
      normalizedPhone: active.phone,
      challengeId: cleanChallengeId,
    };
  }
}

export const otpService = new OtpService();
