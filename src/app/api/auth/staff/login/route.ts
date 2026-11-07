import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/infrastructure/auth/session";
import { Actor } from "@/application/actor";
import { findDemoUserByEmail } from "@/infrastructure/db/demo-data";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user: any = null;

    try {
      user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
          userCentres: true,
        },
      });
    } catch (dbError) {
      // In demo mode or offline, fallback to in-memory demo staff accounts
      const demo = findDemoUserByEmail(normalizedEmail);
      if (demo) {
        user = {
          id: demo.id,
          name: demo.name,
          email: demo.email,
          role: demo.role,
          passwordHash: demo.passwordHash,
          userCentres: demo.centreIds.map((cid) => ({ centreId: cid })),
        };
      }
    }

    if (!user) {
      const demo = findDemoUserByEmail(normalizedEmail);
      if (demo) {
        user = {
          id: demo.id,
          name: demo.name,
          email: demo.email,
          role: demo.role,
          passwordHash: demo.passwordHash,
          userCentres: demo.centreIds.map((cid) => ({ centreId: cid })),
        };
      }
    }

    if (!user || user.passwordHash !== password) {
      return NextResponse.json(
        { error: "Invalid email or password. In demo mode, use DemoPassword123!" },
        { status: 401 }
      );
    }

    const actor: Actor = {
      userId: user.id,
      role: user.role as any,
      name: user.name,
      email: user.email,
      centreIds: user.userCentres.map((uc: any) => uc.centreId),
      linkedStudentIds: [],
      consentedStudentIds: [],
    };

    const token = createSessionToken(actor);

    const response = NextResponse.json({
      success: true,
      actor,
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
      { error: err.message || "Failed to authenticate staff" },
      { status: 500 }
    );
  }
}
