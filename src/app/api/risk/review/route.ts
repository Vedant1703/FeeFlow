import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { getSessionActor } from "@/infrastructure/auth/session";
import { canActorReviewRisk } from "@/application/actor";

export async function POST(req: Request) {
  try {
    const actor = await getSessionActor();
    if (!actor || !canActorReviewRisk(actor)) {
      return NextResponse.json(
        { error: "Unauthorized: only Counsellor or Director can review risk tasks" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { taskId, status, notes } = body;

    if (!taskId || !status) {
      return NextResponse.json({ error: "taskId and status are required" }, { status: 400 });
    }

    const validStatuses = ["REVIEWED", "FOLLOW_UP_REQUIRED", "FALSE_POSITIVE"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const task = await prisma.riskTask.findUnique({
      where: { id: taskId },
      include: {
        student: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Risk task not found" }, { status: 404 });
    }

    // Centre scope check for Counsellor
    if (actor.role === "COUNSELLOR" && !actor.centreIds.includes(task.student.centreId)) {
      return NextResponse.json(
        { error: "Access denied: student is outside your assigned centre" },
        { status: 403 }
      );
    }

    // 30-day suppression if marked FALSE_POSITIVE
    let suppressedUntil: Date | null = null;
    if (status === "FALSE_POSITIVE") {
      suppressedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    const updatedTask = await prisma.riskTask.update({
      where: { id: task.id },
      data: {
        status: status as any,
        suppressedUntil,
        reviewedById: actor.userId,
        reviewedAt: new Date(),
        notes: notes || `Reviewed by ${actor.name} (${actor.role})`,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: actor.userId,
        actorEmail: actor.email || actor.name,
        actorRole: actor.role,
        action: "RISK_TASK_REVIEW",
        entityType: "RiskTask",
        entityId: task.id,
        centreId: task.student.centreId,
        reason: notes || `Status updated to ${status}`,
        afterJson: JSON.stringify({
          taskId: task.id,
          studentId: task.studentId,
          status,
          suppressedUntil,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Risk task marked as ${status}`,
      task: updatedTask,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to review risk task" },
      { status: 500 }
    );
  }
}

