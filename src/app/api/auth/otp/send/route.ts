import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { findDemoParentByPhone } from "@/infrastructure/db/demo-data";
import { otpService, normalizeIndianPhoneNumber } from "@/infrastructure/auth/otp-service";

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }
    const { phone } = body || {};

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const norm = normalizeIndianPhoneNumber(phone);
    if (!norm.isValid) {
      return NextResponse.json({ error: norm.error }, { status: 400 });
    }

    const cleanPhone = norm.normalized;
    let parent: any = null;

    try {
      // Attempt database query if PostgreSQL is active
      parent = await prisma.parent.findFirst({
        where: {
          OR: [
            { phone: cleanPhone },
            { phone: { contains: cleanPhone.slice(-10) } },
          ],
        },
        include: {
          students: {
            include: { student: true },
          },
        },
      });
    } catch {
      // In demo mode or offline, fallback to in-memory demo data
      const demo = findDemoParentByPhone(cleanPhone);
      if (demo) {
        parent = {
          id: demo.id,
          phone: demo.phone,
          name: demo.name,
        };
      }
    }

    // If still not found via DB, check demo store fallback
    if (!parent) {
      const demo = findDemoParentByPhone(cleanPhone);
      if (demo) {
        parent = {
          id: demo.id,
          phone: demo.phone,
          name: demo.name,
        };
      }
    }

    if (!parent) {
      return NextResponse.json(
        {
          error: "This mobile number is not registered with any student. In demo mode, use +91 90000 12345.",
        },
        { status: 404 }
      );
    }

    // Request cryptographically secure OTP with rate limiting & cooldown
    const otpRes = await otpService.requestOtp(cleanPhone);
    if (!otpRes.success) {
      return NextResponse.json(
        {
          error: otpRes.error || "Failed to generate OTP",
          waitSeconds: otpRes.resendAfterSeconds,
        },
        { status: 429 }
      );
    }

    return NextResponse.json({
      success: true,
      phone: parent.phone,
      resendAfterSeconds: otpRes.resendAfterSeconds,
      demoCode: "482913",
      generatedCode: otpRes.demoCode,
      message: "6-digit OTP code sent. In demo mode, enter code 482913.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to send OTP" },
      { status: 500 }
    );
  }
}
