import { NextResponse } from "next/server";
import { getSessionActor } from "@/infrastructure/auth/session";
import { reminderService, ListRemindersFilter } from "@/application/services/reminder-service";

export async function GET(req: Request) {
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
      return NextResponse.json({ error: "Unauthorized: only Accounts and Director staff can view reminders" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filter: ListRemindersFilter = {
      status: (searchParams.get("status") as any) || undefined,
      centreId: searchParams.get("centreId") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      search: searchParams.get("search") || undefined,
    };

    const reminders = await reminderService.listReminders(filter, actor);

    const serialized = reminders.map((r) => ({
      ...r,
      evaluatedAmountPaise: r.evaluatedAmountPaise.toString(),
      scheduledFor: r.scheduledFor instanceof Date ? r.scheduledFor.toISOString() : r.scheduledFor,
      dispatchedAt: r.dispatchedAt ? (r.dispatchedAt instanceof Date ? r.dispatchedAt.toISOString() : r.dispatchedAt) : null,
    }));

    return NextResponse.json({
      success: true,
      reminders: serialized,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to list reminders" },
      { status: 500 }
    );
  }
}
