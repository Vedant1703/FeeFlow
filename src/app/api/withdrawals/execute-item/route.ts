import { NextResponse } from "next/server";
import { getSessionActor } from "@/infrastructure/auth/session";
import { refundService } from "@/application/services/refund-service";

export async function POST(req: Request) {
  try {
    const actor = await getSessionActor();
    if (!actor || (actor.role !== "ACCOUNTS" && actor.role !== "DIRECTOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const { refundItemId, forceStatus } = body || {};

    if (!refundItemId) {
      return NextResponse.json(
        { error: "refundItemId is required" },
        { status: 400 }
      );
    }

    const result = await refundService.executeRefundItem({
      refundItemId,
      actor,
      forceStatus,
    });

    return NextResponse.json({
      success: true,
      message:
        result.item.status === "SUCCEEDED"
          ? "Refund item executed successfully"
          : "Refund item execution failed",
      item: {
        id: result.item.id,
        status: result.item.status,
        providerRefundId: result.item.providerRefundId,
        failureReason: result.item.failureReason,
      },
      refundStatus: result.refund.status,
    });
  } catch (err: any) {
    const isForbidden = err.message?.includes("Unauthorized") || err.message?.includes("Permission denied");
    const status = isForbidden ? 403 : 400;

    return NextResponse.json(
      { error: err.message || "Failed to execute refund item" },
      { status }
    );
  }
}

