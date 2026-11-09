import { NextResponse } from "next/server";
import { getSessionActor } from "@/infrastructure/auth/session";
import { reminderService } from "@/application/services/reminder-service";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    let actor = await getSessionActor();
    if (!actor && process.env.NODE_ENV !== "production") {
      actor = {
        userId: "usr_accounts_neha",
        role: "ACCOUNTS",
        name: "Neha Verma",
        centreIds: ["cen_vaishali", "cen_mansarovar", "cen_malviya", "cen_tonk"],
        linkedStudentIds: [],
        consentedStudentIds: [],
      };
    }

    if (!actor || (actor.role !== "ACCOUNTS" && actor.role !== "DIRECTOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    let idempotencyKey: string | undefined;
    try {
      const body = await req.json();
      idempotencyKey = body.idempotencyKey;
    } catch {
      // Body is optional
    }

    const result = await reminderService.retryReminder(params.id, actor, idempotencyKey);

    return NextResponse.json({
      success: result.success,
      status: result.status,
      messageId: result.messageId,
      skipReason: result.skipReason,
      error: result.error,
      currentOutstandingPaise: result.currentOutstandingPaise.toString(),
      renderedMessage: result.renderedMessage,
    });
  } catch (err: any) {
    const status = err.message?.includes("Access denied")
      ? 403
      : err.message?.includes("Concurrent dispatch")
      ? 409
      : err.message?.includes("already dispatched")
      ? 400
      : 500;
    return NextResponse.json({ error: err.message || "Failed to retry reminder" }, { status });
  }
}
