/**
 * Cryptographic OTP Authentication Service for FeeFlow.
 * Handles Indian E.164 normalization, secure 6-digit generation, HMAC-SHA256 hashing,
 * sliding-window rate limiting, and brute-force attempt lockout.
 */

import crypto from "crypto";
import { prisma } from "@/infrastructure/db/prisma";
import { getSmsProvider } from "./sms/sms-provider";

export const OTP_HMAC_SECRET =
  process.env.OTP_HMAC_SECRET ||
  process.env.SESSION_SECRET ||
  "feeflow_otp_hmac_secret_key_at_least_32_characters_long";

export const OTP_EXPIRY_MINUTES = 5;
export const OTP_EXPIRY_MS = OTP_EXPIRY_MINUTES * 60 * 1000;
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
  phone: string;
  tokenHash: string;
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
}

export const otpService = new OtpService();
