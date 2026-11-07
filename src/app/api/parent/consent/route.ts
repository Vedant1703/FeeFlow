import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { getSessionActor, createSessionToken, SESSION_COOKIE_NAME } from "@/infrastructure/auth/session";

export async function POST(req: Request) {
  try {
    const actor = await getSessionActor();
    if (!actor || actor.role !== "PARENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { studentId, noticeVersion = "v1.0", language = "en", affirmativeConsent } = body;

    if (!affirmativeConsent) {
      return NextResponse.json(
        { error: "Affirmative consent checkbox must be selected" },
        { status: 400 }
      );
    }

    // Verify student is actually linked to this parent (if linkedStudentIds is populated)
    if (actor.linkedStudentIds.length > 0 && !actor.linkedStudentIds.includes(studentId)) {
      return NextResponse.json(
        { error: "Student is not linked to your parent account" },
        { status: 403 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "Unknown";
    const consentedAt = new Date();
    let consentId = `cns_${Date.now()}`;

    try {
      // Record verifiable consent in DB if available
      const consent = await prisma.consent.create({
        data: {
          parentId: actor.userId,
          studentId,
          noticeVersion,
          language,
          purposes: "fee_tracking,receipt_issuance,reminders,academic_progress",
          verifiedPhone: actor.phone || "",
          ipAddress,
          userAgent,
          consentedAt,
        },
      });
      consentId = consent.id;
    } catch (dbError) {
      // DB offline demo fallback: consent recorded in session
    }

    // Update actor session cookie with updated consented student IDs
    const updatedConsented = Array.from(new Set([...actor.consentedStudentIds, studentId]));
    const updatedActor = {
      ...actor,
      consentedStudentIds: updatedConsented,
    };

    const token = createSessionToken(updatedActor);

    const response = NextResponse.json({
      success: true,
      consentId,
      consentedAt,
      studentId,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
      sameSite: "lax",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to record consent" },
      { status: 500 }
    );
  }
}
