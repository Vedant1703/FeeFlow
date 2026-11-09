import { NextResponse } from "next/server";
import { getSessionActor } from "@/infrastructure/auth/session";
import { reminderService } from "@/application/services/reminder-service";

export async function GET(
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

    const details = await reminderService.getReminderDetails(params.id, actor);

    const serialized = {
      ...details,
      reminder: {
        ...details.reminder,
        evaluatedAmountPaise: details.reminder.evaluatedAmountPaise.toString(),
        scheduledFor:
          details.reminder.scheduledFor instanceof Date
            ? details.reminder.scheduledFor.toISOString()
            : details.reminder.scheduledFor,
        dispatchedAt: details.reminder.dispatchedAt
          ? details.reminder.dispatchedAt instanceof Date
            ? details.reminder.dispatchedAt.toISOString()
            : details.reminder.dispatchedAt
          : null,
      },
      attempts: details.attempts.map((a) => ({
        ...a,
        evaluatedAmountPaise: a.evaluatedAmountPaise.toString(),
        attemptedAt:
          a.attemptedAt instanceof Date ? a.attemptedAt.toISOString() : a.attemptedAt,
      })),
    };

    return NextResponse.json({
      success: true,
      details: serialized,
    });
  } catch (err: any) {
    const status = err.message?.includes("Access denied")
      ? 403
      : err.message?.includes("not found")
      ? 404
      : 500;
    return NextResponse.json({ error: err.message || "Failed to load reminder" }, { status });
  }
}
