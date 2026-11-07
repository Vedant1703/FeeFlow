import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/infrastructure/auth/session";
import { Actor } from "@/application/actor";
import { findDemoParentByPhone } from "@/infrastructure/db/demo-data";
import { otpService } from "@/infrastructure/auth/otp-service";

const VerifyWidgetSchema = z.object({
  challengeId: z.string().min(1, "Challenge ID is required"),
  reqId: z.string().min(1, "Provider request ID (reqId) is required"),
  accessToken: z.string().min(1, "MSG91 access token is required"),
});

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const parseResult = VerifyWidgetSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { challengeId, reqId, accessToken } = parseResult.data;

    // Verify access token with MSG91 API, challenge association, expiry, and single-use replay check
    const verifyRes = await otpService.verifyWidgetAccessToken({
      challengeId,
      reqId,
      accessToken,
    });

    if (!verifyRes.success) {
      const status = verifyRes.isLocked ? 429 : 401;
      return NextResponse.json(
        {
          error: verifyRes.error || "Failed to verify MSG91 access token",
          isLocked: verifyRes.isLocked,
          attemptsRemaining: verifyRes.attemptsRemaining,
        },
        { status }
      );
    }

    const cleanPhone = verifyRes.normalizedPhone!;

    // Validate corresponding parent account and active student relationships
    let parent: any = null;
    let linkedStudentIds: string[] = [];
    let consentedStudentIds: string[] = [];
    let studentList: any[] = [];

    try {
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
          consents: {
            where: { withdrawnAt: null },
          },
        },
      });

      if (parent) {
        linkedStudentIds = parent.students.map((s: any) => s.studentId);
        consentedStudentIds = parent.consents.map((c: any) => c.studentId);
        studentList = parent.students.map((ps: any) => ({
          id: ps.student.id,
          studentCode: ps.student.studentCode,
          name: ps.student.name,
          hasConsent: consentedStudentIds.includes(ps.student.id),
        }));
      }
    } catch {
      // In demo mode or offline, fallback to in-memory demo data
      const demo = findDemoParentByPhone(cleanPhone);
      if (demo) {
        parent = {
          id: demo.id,
          name: demo.name,
          phone: demo.phone,
        };
        linkedStudentIds = demo.students.map((s) => s.studentId);
        consentedStudentIds = demo.students.filter((s) => s.hasConsent).map((s) => s.studentId);
        studentList = demo.students.map((s) => ({
          id: s.studentId,
          studentCode: s.studentCode,
          name: s.name,
          hasConsent: s.hasConsent,
        }));
      }
    }

    if (!parent) {
      const demo = findDemoParentByPhone(cleanPhone);
      if (demo) {
        parent = {
          id: demo.id,
          name: demo.name,
          phone: demo.phone,
        };
        linkedStudentIds = demo.students.map((s) => s.studentId);
        consentedStudentIds = demo.students.filter((s) => s.hasConsent).map((s) => s.studentId);
        studentList = demo.students.map((s) => ({
          id: s.studentId,
          studentCode: s.studentCode,
          name: s.name,
          hasConsent: s.hasConsent,
        }));
      }
    }

    if (!parent) {
      return NextResponse.json(
        { error: "Parent profile not found for the verified mobile identity" },
        { status: 404 }
      );
    }

    const actor: Actor = {
      userId: parent.id,
      role: "PARENT",
      name: parent.name,
      phone: parent.phone,
      centreIds: [],
      linkedStudentIds,
      consentedStudentIds,
    };

    const token = createSessionToken(actor);

    const response = NextResponse.json({
      success: true,
      actor,
      requiresConsent: consentedStudentIds.length === 0,
      students: studentList,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      sameSite: "lax",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error verifying MSG91 OTP widget" },
      { status: 500 }
    );
  }
}
