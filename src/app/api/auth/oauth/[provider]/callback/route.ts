import { NextRequest, NextResponse } from "next/server";
import { getOAuthProvider } from "@/infrastructure/auth/oauth/oauth-provider";
import { prisma } from "@/infrastructure/db/prisma";
import { findDemoUserByEmail, DEMO_PARENTS } from "@/infrastructure/db/demo-data";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/infrastructure/auth/session";
import { Actor } from "@/application/actor";

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const providerName = params.provider.toLowerCase();
    const searchParams = req.nextUrl.searchParams;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      return NextResponse.redirect(
        new URL(`/staff/login?error=${encodeURIComponent(`OAuth Error: ${errorParam}`)}`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/staff/login?error=Missing+OAuth+code+or+state", req.url)
      );
    }

    // 1. Verify CSRF State
    const storedState = req.cookies.get("feeflow_oauth_state")?.value;
    const codeVerifier = req.cookies.get("feeflow_oauth_verifier")?.value || "";
    const returnTo = req.cookies.get("feeflow_oauth_return_to")?.value || "/staff";

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        new URL("/staff/login?error=Invalid+OAuth+state+parameter", req.url)
      );
    }

    // 2. Exchange code for profile
    const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = `${origin}/api/auth/oauth/${providerName}/callback`;

    const oauthProvider = getOAuthProvider(providerName);
    const profile = await oauthProvider.exchangeCode(code, codeVerifier, redirectUri);

    const email = profile.email.toLowerCase().trim();

    // 3. User Resolution: Check Staff first
    let staffUser: any = null;
    try {
      staffUser = await prisma.user.findUnique({
        where: { email },
        include: { userCentres: true },
      });
    } catch {
      // In demo mode or offline, fallback to in-memory demo data
      staffUser = findDemoUserByEmail(email);
    }

    if (!staffUser) {
      staffUser = findDemoUserByEmail(email);
    }

    if (staffUser) {
      const centreIds = staffUser.userCentres
        ? staffUser.userCentres.map((uc: any) => uc.centreId)
        : staffUser.centreIds || [];

      const actor: Actor = {
        userId: staffUser.id,
        role: staffUser.role,
        name: staffUser.name,
        email: staffUser.email,
        centreIds,
        linkedStudentIds: [],
        consentedStudentIds: [],
      };

      const token = createSessionToken(actor);
      const destinationUrl = new URL(returnTo.startsWith("/staff") ? returnTo : "/staff", req.url);
      const response = NextResponse.redirect(destinationUrl);

      // Set session cookie
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
        sameSite: "lax",
      });

      // Clear OAuth temporary cookies
      response.cookies.delete("feeflow_oauth_state");
      response.cookies.delete("feeflow_oauth_verifier");
      response.cookies.delete("feeflow_oauth_return_to");

      return response;
    }

    // 4. User Resolution: Check Parent
    let parentUser: any = null;
    let linkedStudentIds: string[] = [];
    let consentedStudentIds: string[] = [];

    try {
      parentUser = await prisma.parent.findFirst({
        where: { email },
        include: {
          students: true,
          consents: { where: { withdrawnAt: null } },
        },
      });

      if (parentUser) {
        linkedStudentIds = parentUser.students.map((s: any) => s.studentId);
        consentedStudentIds = parentUser.consents.map((c: any) => c.studentId);
      }
    } catch {
      // Demo fallback
      parentUser = DEMO_PARENTS.find(
        (p) => (p as any).email === email || email.includes("parent") || email.includes("rakesh")
      );
      if (parentUser) {
        linkedStudentIds = parentUser.students.map((s: any) => s.studentId);
        consentedStudentIds = parentUser.students.filter((s: any) => s.hasConsent).map((s: any) => s.studentId);
      }
    }

    if (!parentUser) {
      parentUser = DEMO_PARENTS.find(
        (p) => (p as any).email === email || email.includes("parent") || email.includes("rakesh")
      );
      if (parentUser) {
        linkedStudentIds = parentUser.students.map((s: any) => s.studentId);
        consentedStudentIds = parentUser.students.filter((s: any) => s.hasConsent).map((s: any) => s.studentId);
      }
    }

    if (parentUser) {
      const actor: Actor = {
        userId: parentUser.id,
        role: "PARENT",
        name: parentUser.name,
        email,
        phone: parentUser.phone,
        centreIds: [],
        linkedStudentIds,
        consentedStudentIds,
      };

      const token = createSessionToken(actor);
      const destinationUrl = new URL("/parent", req.url);
      const response = NextResponse.redirect(destinationUrl);

      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
        sameSite: "lax",
      });

      response.cookies.delete("feeflow_oauth_state");
      response.cookies.delete("feeflow_oauth_verifier");
      response.cookies.delete("feeflow_oauth_return_to");

      return response;
    }

    // 5. Unrecognized Email
    return NextResponse.redirect(
      new URL(
        `/staff/login?error=${encodeURIComponent(
          `Email ${email} is not authorized for staff or parent access at Company A, Jaipur.`
        )}`,
        req.url
      )
    );
  } catch (err: any) {
    return NextResponse.redirect(
      new URL(`/staff/login?error=${encodeURIComponent(err.message || "OAuth authentication failed")}`, req.url)
    );
  }
}
