import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { findDemoParentByPhone } from "@/infrastructure/db/demo-data";
import { otpService, normalizeIndianPhoneNumber } from "@/infrastructure/auth/otp-service";

const ChallengeSchema = z.object({
  phone: z.string().min(10, "Phone number is required"),
  allowUnregistered: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const parseResult = ChallengeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { phone: rawPhone, allowUnregistered } = parseResult.data;

    const norm = normalizeIndianPhoneNumber(rawPhone);
    if (!norm.isValid) {
      return NextResponse.json({ error: norm.error }, { status: 400 });
    }

    const cleanPhone = norm.normalized;

    // Check parent account registration unless specifically in registration flow
    if (!allowUnregistered) {
      let parent: any = null;
      try {
        parent = await prisma.parent.findFirst({
          where: {
            OR: [
              { phone: cleanPhone },
              { phone: { contains: cleanPhone.slice(-10) } },
            ],
          },
        });
      } catch {
        // Fallback to demo data
        const demo = findDemoParentByPhone(cleanPhone);
        if (demo) parent = demo;
      }

      if (!parent) {
        const demo = findDemoParentByPhone(cleanPhone);
        if (demo) parent = demo;
      }

      if (!parent) {
        return NextResponse.json(
          {
            error: "This mobile number is not registered with any student. Please register your parent account.",
            notRegistered: true,
            phone: cleanPhone,
          },
          { status: 404 }
        );
      }
    }

    // Create server-side challenge with rate limit (3/10m) and 60s cooldown enforcement
    const challengeRes = await otpService.createWidgetChallenge(cleanPhone);
    if (!challengeRes.success) {
      return NextResponse.json(
        {
          error: challengeRes.error || "Failed to create OTP challenge",
          waitSeconds: challengeRes.resendAfterSeconds,
        },
        { status: 429 }
      );
    }

    return NextResponse.json({
      success: true,
      challengeId: challengeRes.challengeId,
      phone: cleanPhone,
      widgetPhone: challengeRes.widgetPhone,
      resendAfterSeconds: challengeRes.resendAfterSeconds,
      expiresInSeconds: challengeRes.expiresInSeconds,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error creating OTP challenge" },
      { status: 500 }
    );
  }
}
