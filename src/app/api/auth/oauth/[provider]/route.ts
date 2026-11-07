import { NextRequest, NextResponse } from "next/server";
import { getOAuthProvider } from "@/infrastructure/auth/oauth/oauth-provider";

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const providerName = params.provider.toLowerCase();
    const oauthProvider = getOAuthProvider(providerName);

    // Compute redirect URI
    const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = `${origin}/api/auth/oauth/${providerName}/callback`;

    const { url, state, codeVerifier } = await oauthProvider.getAuthorizationUrl(redirectUri);

    const returnTo = req.nextUrl.searchParams.get("returnTo") || "/staff";

    const response = NextResponse.redirect(url);

    // Store state, verifier, and return destination in secure HttpOnly cookies (10-minute expiry)
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60, // 10 minutes
      sameSite: "lax" as const,
    };

    response.cookies.set("feeflow_oauth_state", state, cookieOptions);
    response.cookies.set("feeflow_oauth_verifier", codeVerifier, cookieOptions);
    response.cookies.set("feeflow_oauth_return_to", returnTo, cookieOptions);

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }
}

