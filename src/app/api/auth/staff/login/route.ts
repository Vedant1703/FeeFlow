import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/infrastructure/auth/session";
import { Actor } from "@/application/actor";

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

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        userCentres: true,
      },
    });

    if (!user || user.passwordHash !== password) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const actor: Actor = {
      userId: user.id,
      role: user.role as any,
      name: user.name,
      email: user.email,
      centreIds: user.userCentres.map((uc) => uc.centreId),
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
