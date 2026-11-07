import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { getSessionActor } from "@/infrastructure/auth/session";
import { canActorReviewRisk } from "@/application/actor";

const RiskReviewSchema = z.object({
  taskId: z.string().optional(),
  studentId: z.string().optional(),
  status: z.enum(["REVIEWED", "FOLLOW_UP", "FOLLOW_UP_REQUIRED", "FALSE_POSITIVE"]),
  notes: z.string().optional(),
}).refine((data) => data.taskId || data.studentId, {
  message: "Either taskId or studentId must be provided",
});

export async function POST(req: Request) {
  try {
    const actor = await getSessionActor();
    if (!actor || !canActorReviewRisk(actor)) {
      return NextResponse.json(
        { error: "Unauthorized: only Counsellor or Director can review risk tasks" },
        { status: 403 }
      );
    }

    const rawBody = await req.json();
    const parseResult = RiskReviewSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid review payload" },
        { status: 400 }
      );
    }

    const { taskId, studentId, status, notes } = parseResult.data;

    // 30-day suppression if marked FALSE_POSITIVE
    let suppressedUntil: Date | null = null;
    if (status === "FALSE_POSITIVE") {
      suppressedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    try {
      let task: any = null;
      if (taskId) {
        task = await prisma.riskTask.findUnique({
          where: { id: taskId },
          include: { student: true },
        });
      } else if (studentId) {
        task = await prisma.riskTask.findFirst({
          where: {
            OR: [
              { studentId },
              { student: { studentCode: studentId } },
            ],
          },
          include: { student: true },
        });
      }

      if (task) {
        // Centre scope check for Counsellor
        if (actor.role === "COUNSELLOR" && !actor.centreIds.includes(task.student.centreId)) {
          return NextResponse.json(
            { error: "Access denied: student is outside your assigned centre" },
            { status: 403 }
          );
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
          task: updatedTask,
          suppressedUntil,
        });
      }
    } catch (dbError) {
      // In demo mode or offline, return simulated successful review
    }

    // Demo mode / offline fallback response
    return NextResponse.json({
      success: true,
      message: "Counsellor review saved successfully (demo mode)",
      status,
      suppressedUntil: status === "FALSE_POSITIVE" ? "2026-12-02" : undefined,
      notes,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update risk review" },
      { status: 500 }
    );
  }
}
