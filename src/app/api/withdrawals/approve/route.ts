import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionActor } from "@/infrastructure/auth/session";
import { refundService } from "@/application/services/refund-service";

const WithdrawalApproveSchema = z.object({
  withdrawalId: z.string().optional(),
  quoteId: z.string().optional(),
  decision: z.enum(["APPROVED", "REJECTED"]).default("APPROVED"),
  notes: z.string().optional(),
}).refine((data) => data.withdrawalId || data.quoteId, {
  message: "Either withdrawalId or quoteId is required",
});

export async function POST(req: Request) {
  try {
    const actor = await getSessionActor();
    if (!actor || actor.role !== "DIRECTOR") {
      return NextResponse.json(
        { error: "Unauthorized: only Founder-Director can approve withdrawals and refunds" },
        { status: 403 }
      );
    }

    let rawBody: any;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const parseResult = WithdrawalApproveSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid approval request" },
        { status: 400 }
      );
    }

    const { withdrawalId, quoteId, decision, notes } = parseResult.data;
    const targetId = (withdrawalId || quoteId) as string;

    const result = await refundService.reviewWithdrawal({
      withdrawalId: targetId,
      decision,
      notes,
      actor,
    });

    return NextResponse.json({
      success: true,
      message:
        decision === "APPROVED"
          ? "Withdrawal and statutory refund approved by Director"
          : "Withdrawal quote rejected by Director",
      result: {
        withdrawalId: result.withdrawal.id,
        status: result.status,
        refundId: result.refund?.id,
        approverName: actor.name,
        makerCheckerVerified: true,
      },
    });
  } catch (err: any) {
    const isForbidden =
      err.message?.includes("Maker-checker") ||
      err.message?.includes("Unauthorized") ||
      err.message?.includes("Permission denied");
    const status = isForbidden ? 403 : 400;

    return NextResponse.json(
      { error: err.message || "Failed to process withdrawal review" },
      { status }
    );
  }
}
