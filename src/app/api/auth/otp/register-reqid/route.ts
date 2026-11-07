import { NextResponse } from "next/server";
import { z } from "zod";
import { otpService } from "@/infrastructure/auth/otp-service";

const RegisterReqIdSchema = z.object({
  challengeId: z.string().min(1, "Challenge ID is required"),
  reqId: z.string().min(1, "Provider request ID is required"),
});

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const parseResult = RegisterReqIdSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { challengeId, reqId } = parseResult.data;

    const result = await otpService.registerProviderRequestId(challengeId, reqId);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to register provider request ID" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      challengeId: result.challengeId,
      reqId: result.reqId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error registering provider request ID" },
      { status: 500 }
    );
  }
}
