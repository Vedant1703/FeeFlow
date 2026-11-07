import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { getSessionActor } from "@/infrastructure/auth/session";
import { evaluateReminderEligibility } from "@/domain/reminders";
import { deriveInstalmentBalance } from "@/domain/ledger";
import { getDefaultClock } from "@/domain/clock";

export async function POST() {
  try {
    const actor = await getSessionActor();
    if (!actor || (actor.role !== "ACCOUNTS" && actor.role !== "DIRECTOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const clock = getDefaultClock();
    const asOfDate = clock.businessDate();

    // Fetch active students and their instalments
    const students = await prisma.student.findMany({
      where: {
        status: { not: "WITHDRAWN" },
      },
      include: {
        centre: true,
        parents: {
          include: { parent: true },
        },
        feePlans: {
          where: { status: "ACTIVE" },
          include: {
            instalments: {
              where: {
                status: { not: "PAID" },
              },
            },
          },
        },
        ledgerEntries: true,
        reminderPauses: {
          where: {
            pausedUntil: { gte: new Date(`${asOfDate}T00:00:00Z`) },
          },
        },
      },
    });

    let dispatchedCount = 0;
    let skippedCount = 0;
    const details: any[] = [];

    for (const student of students) {
      // Centre scope check for Accounts
      if (actor.role === "ACCOUNTS" && !actor.centreIds.includes(student.centreId)) {
        continue;
      }

      const activePlan = student.feePlans[0];
      if (!activePlan) continue;

      const primaryParent = student.parents[0]?.parent;
      if (!primaryParent) continue;

      const activePause = student.reminderPauses[0];

      for (const instalment of activePlan.instalments) {
        // Evaluate live ledger balance
        const balance = deriveInstalmentBalance(
          {
            id: instalment.id,
            feePlanId: activePlan.id,
            sequence: instalment.sequence,
            dueDate: instalment.dueDate,
            amount: instalment.amount,
          },
          student.ledgerEntries.map((e) => ({ ...e, amount: e.amount })),
          asOfDate
        );

        // Evaluate reminder eligibility
        const eligibility = evaluateReminderEligibility({
          studentId: student.id,
          studentName: student.name,
          studentCode: student.studentCode,
          studentStatus: student.status as any,
          instalmentSequence: instalment.sequence,
          dueDate: instalment.dueDate,
          currentOutstandingPaise: balance.outstandingBalance,
          originalAmountPaise: instalment.amount,
          language: (primaryParent.preferredLanguage as any) || "en",
          asOfDate,
          pausedUntil: activePause ? activePause.pausedUntil : null,
          instituteName: `Company A, ${student.centre.name}`,
        });

        if (eligibility.isEligible) {
          // Record dispatch
          await prisma.reminderDispatch.create({
            data: {
              instalmentId: instalment.id,
              studentId: student.id,
              parentId: primaryParent.id,
              channel: eligibility.channel,
              language: primaryParent.preferredLanguage || "en",
              scheduledFor: new Date(),
              evaluatedAmount: eligibility.currentOutstandingPaise,
              status: "SENT",
              renderedMessage: eligibility.renderedBody,
              dispatchedAt: new Date(),
            },
          });
          dispatchedCount++;
          details.push({
            student: student.name,
            code: student.studentCode,
            status: "DISPATCHED",
            amount: eligibility.currentOutstandingPaise.toString(),
            message: eligibility.renderedBody,
          });
        } else {
          skippedCount++;
          details.push({
            student: student.name,
            code: student.studentCode,
            status: "SKIPPED",
            reason: eligibility.skipReason,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      asOfDate,
      dispatchedCount,
      skippedCount,
      details,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to run reminder scheduler" },
      { status: 500 }
    );
  }
}
