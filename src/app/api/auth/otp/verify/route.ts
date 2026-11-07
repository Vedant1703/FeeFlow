import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/infrastructure/auth/session";
import { Actor } from "@/application/actor";
import { findDemoParentByPhone } from "@/infrastructure/db/demo-data";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, code } = body;

    if (!phone || !code) {
      return NextResponse.json(
        { error: "Phone number and 6-digit OTP code are required" },
        { status: 400 }
      );
    }

    // Verify code: In demo mode, accept 482913
    if (code !== "482913") {
      return NextResponse.json(
        { error: "Wrong code. In demo mode, enter 482913." },
        { status: 401 }
      );
    }

    const cleanPhone = phone.replace(/[^\d+]/g, "");

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
    } catch (dbError) {
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
        { error: "Parent profile not found" },
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
      { error: err.message || "Failed to verify OTP" },
      { status: 500 }
    );
  }
}
