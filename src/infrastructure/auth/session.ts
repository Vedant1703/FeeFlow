import crypto from "crypto";
import { cookies } from "next/headers";
import { Actor } from "@/application/actor";

const SESSION_COOKIE_NAME = "feeflow_session";
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "feeflow_demo_session_secret_at_least_32_characters_long_super_secure";

/**
 * Creates an HMAC-signed session token containing the actor payload.
 */
export function createSessionToken(actor: Actor): string {
  const payloadStr = JSON.stringify({
    ...actor,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  const b64Payload = Buffer.from(payloadStr).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(b64Payload)
    .digest("base64url");

  return `${b64Payload}.${signature}`;
}

/**
 * Verifies a signed session token and extracts the actor payload.
 */
export function verifySessionToken(token: string): Actor | null {
  if (!token || !token.includes(".")) return null;

  const [b64Payload, signature] = token.split(".");
  if (!b64Payload || !signature) return null;

  const expectedSignature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(b64Payload)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(b64Payload, "base64url").toString("utf-8"));
    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return null; // Expired
    }
    return {
      userId: payload.userId,
      role: payload.role,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      centreIds: payload.centreIds || [],
      linkedStudentIds: payload.linkedStudentIds || [],
      consentedStudentIds: payload.consentedStudentIds || [],
    };
  } catch {
    return null;
  }
}

/**
 * Retrieves the currently authenticated actor from Next.js request cookies.
 */
export async function getSessionActor(): Promise<Actor | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }
  return verifySessionToken(sessionCookie.value);
}

export { SESSION_COOKIE_NAME };
