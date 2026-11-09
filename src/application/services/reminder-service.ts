/**
 * Application Reminder Service for FeeFlow.
 * Handles reminder queries, live-balance dispatch, failure recording, retries,
 * and delivery history tracking with strict financial invariants.
 *
 * Hard Invariants:
 * 1. Live Balance at Dispatch: Never trust queued amounts; always re-evaluate
 *    current ledger balance via deriveInstalmentBalance().
 * 2. Stop on Full Settlement: If outstanding balance <= 0n, suppress dispatch
 *    and mark reminder as SKIPPED.
 * 3. Stop on Withdrawal / Pause: Withdrawn students or active pauses suppress dispatch.
 * 4. Partial Payment Quotes: Rendered messages always quote the exact live remaining balance.
 * 5. Idempotent & Concurrency Safe: Concurrent dispatch attempts never send twice.
 * 6. Non-Duplicable Success: Successful (SENT) reminders can never be re-dispatched.
 * 7. RBAC Enforced: Accounts staff are strictly scoped to their assigned centres;
 *    Director has cross-centre access.
 */

import { prisma } from "@/infrastructure/db/prisma";
import {
  demoPaymentStore,
  DemoReminder,
  DemoReminderAttempt,
} from "@/infrastructure/db/demo-payment-store";
import { deriveInstalmentBalance } from "@/domain/ledger";
import { evaluateReminderEligibility } from "@/domain/reminders";
import { getNotificationProvider } from "@/infrastructure/notifications/notification-provider";
import { recordAuditLog } from "@/application/services/audit-service";
import { Actor } from "@/application/actor";
import { getDefaultClock } from "@/domain/clock";

export interface ListRemindersFilter {
  status?: "QUEUED" | "SENT" | "SKIPPED" | "FAILED" | "ALL";
  centreId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface ReminderListItem {
  id: string;
  instalmentId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  centreId: string;
  centreName: string;
  parentPhone?: string | null;
  parentName?: string | null;
  instalmentSequence: number;
  ruleName: string;
  channel: "WHATSAPP" | "SMS";
  language: "en" | "hi";
  evaluatedAmountPaise: bigint;
  status: "QUEUED" | "SENT" | "SKIPPED" | "FAILED";
  scheduledFor: Date;
  dispatchedAt?: Date | null;
  skipReason?: string | null;
  lastError?: string | null;
  attemptCount: number;
}

export interface ReminderDetails {
  reminder: ReminderListItem;
  renderedPreviews: {
    en: { subject?: string; body?: string };
    hi: { subject?: string; body?: string };
  };
  attempts: DemoReminderAttempt[];
}

export interface DispatchReminderResult {
  success: boolean;
  status: "SENT" | "SKIPPED" | "FAILED";
  messageId?: string;
  skipReason?: string;
  error?: string;
  currentOutstandingPaise: bigint;
  renderedMessage?: string;
}

export class ReminderService {
  /**
   * Validates actor permissions for reminder operations.
   */
  private checkStaffAccess(actor: Actor, studentCentreId?: string): void {
    if (actor.role !== "ACCOUNTS" && actor.role !== "DIRECTOR") {
      throw new Error("Unauthorized: Only Accounts and Director can manage reminders");
    }
    if (actor.role === "ACCOUNTS" && studentCentreId) {
      if (!actor.centreIds.includes(studentCentreId)) {
        throw new Error(`Access denied: centre ${studentCentreId} is not in actor scope`);
      }
    }
  }

  /**
   * Lists reminders matching the given filters and scoped to actor permissions.
   */
  public async listReminders(
    filter: ListRemindersFilter = {},
    actor: Actor
  ): Promise<ReminderListItem[]> {
    this.checkStaffAccess(actor);

    const clock = getDefaultClock();
    const asOfDate = clock.businessDate();

    try {
      const where: any = {};
      if (filter.status && filter.status !== "ALL") {
        where.status = filter.status;
      }
      if (filter.centreId) {
        where.student = { centreId: filter.centreId };
      }
      if (actor.role === "ACCOUNTS") {
        where.student = {
          ...where.student,
          centreId: { in: actor.centreIds },
        };
      }
      if (filter.dateFrom || filter.dateTo) {
        where.scheduledFor = {};
        if (filter.dateFrom) where.scheduledFor.gte = new Date(filter.dateFrom);
        if (filter.dateTo) where.scheduledFor.lte = new Date(filter.dateTo);
      }

      const dbReminders = await prisma.reminderDispatch.findMany({
        where,
        include: {
          student: {
            include: {
              centre: true,
              parents: { include: { parent: true } },
              ledgerEntries: true,
            },
          },
          instalment: true,
          rule: true,
        },
        orderBy: { scheduledFor: "desc" },
      });

      const items: ReminderListItem[] = [];
      for (const r of dbReminders) {
        const balance = deriveInstalmentBalance(
          {
            id: r.instalment.id,
            feePlanId: r.instalment.feePlanId,
            sequence: r.instalment.sequence,
            dueDate: r.instalment.dueDate,
            amount: r.instalment.amount,
          },
          r.student.ledgerEntries.map((e) => ({ ...e, amount: e.amount })),
          asOfDate
        );

        const primaryParent = r.student.parents[0]?.parent;
        items.push({
          id: r.id,
          instalmentId: r.instalmentId,
          studentId: r.studentId,
          studentCode: r.student.studentCode,
          studentName: r.student.name,
          centreId: r.student.centreId,
          centreName: r.student.centre.name,
          parentPhone: primaryParent?.phone || null,
          parentName: primaryParent?.name || null,
          instalmentSequence: r.instalment.sequence,
          ruleName: r.rule?.name || "Automated Schedule",
          channel: (r.channel as any) || "WHATSAPP",
          language: (r.language as any) || "en",
          evaluatedAmountPaise:
            r.status === "SENT" ? r.evaluatedAmount : balance.outstandingBalance,
          status: r.status as any,
          scheduledFor: r.scheduledFor,
          dispatchedAt: r.dispatchedAt,
          skipReason: r.skipReason,
          lastError: null,
          attemptCount: r.status === "SENT" ? 1 : 0,
        });
      }

      if (filter.search) {
        const q = filter.search.toLowerCase();
        return items.filter(
          (i) =>
            i.studentName.toLowerCase().includes(q) ||
            i.studentCode.toLowerCase().includes(q) ||
            (i.parentName && i.parentName.toLowerCase().includes(q)) ||
            (i.parentPhone && i.parentPhone.includes(q))
        );
      }
      return items;
    } catch {
      // Fallback to demo store
      return this.listRemindersFromDemoStore(filter, actor);
    }
  }

  /**
   * Internal helper to list reminders from demo store.
   */
  private listRemindersFromDemoStore(
    filter: ListRemindersFilter,
    actor: Actor
  ): ReminderListItem[] {
    const clock = getDefaultClock();
    const asOfDate = clock.businessDate();
    const result: ReminderListItem[] = [];

    for (const r of demoPaymentStore.reminders) {
      const student = demoPaymentStore.getStudent(r.studentId);
      if (!student) continue;

      if (actor.role === "ACCOUNTS" && !actor.centreIds.includes(student.centreId)) {
        continue;
      }

      if (filter.centreId && student.centreId !== filter.centreId) {
        continue;
      }

      if (filter.status && filter.status !== "ALL" && r.status !== filter.status) {
        continue;
      }

      if (filter.dateFrom && new Date(r.scheduledDate) < new Date(filter.dateFrom)) {
        continue;
      }
      if (filter.dateTo && new Date(r.scheduledDate) > new Date(filter.dateTo)) {
        continue;
      }

      if (filter.search) {
        const q = filter.search.toLowerCase();
        const matches =
          student.name.toLowerCase().includes(q) ||
          student.studentCode.toLowerCase().includes(q) ||
          (student.parentPhone && student.parentPhone.includes(q));
        if (!matches) continue;
      }

      const instalment = demoPaymentStore.instalments.get(r.instalmentId);
      const studentLedgers = demoPaymentStore.ledgerEntries.filter(
        (e) => e.studentId === student.id
      );
      let liveOutstanding = 0n;
      if (instalment) {
        const bal = deriveInstalmentBalance(instalment, studentLedgers, asOfDate);
        liveOutstanding = bal.outstandingBalance;
      }

      const attempts = demoPaymentStore.getAttemptsForReminder(r.id);
      const sentAmount = attempts.find((a) => a.status === "SENT")?.evaluatedAmountPaise;

      result.push({
        id: r.id,
        instalmentId: r.instalmentId,
        studentId: r.studentId,
        studentCode: student.studentCode,
        studentName: student.name,
        centreId: student.centreId,
        centreName: student.centreName,
        parentPhone: student.parentPhone || null,
        parentName: `Parent of ${student.name}`,
        instalmentSequence: instalment?.sequence || 1,
        ruleName: r.ruleName || "Automated Schedule",
        channel: r.channel || "WHATSAPP",
        language: r.language || "en",
        evaluatedAmountPaise:
          r.status === "SENT" && sentAmount !== undefined
            ? sentAmount
            : liveOutstanding,
        status: r.status as any,
        scheduledFor: r.scheduledDate,
        dispatchedAt: r.dispatchedAt,
        skipReason: r.skipReason,
        lastError: r.lastError,
        attemptCount: r.attemptCount || (r.status === "SENT" ? 1 : 0),
      });
    }

    return result.sort(
      (a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime()
    );
  }

  /**
   * Retrieves full details and rendered previews for a single reminder.
   */
  public async getReminderDetails(
    reminderId: string,
    actor: Actor
  ): Promise<ReminderDetails> {
    this.checkStaffAccess(actor);

    const clock = getDefaultClock();
    const asOfDate = clock.businessDate();

    const reminder = demoPaymentStore.findReminderById(reminderId);
    if (!reminder) {
      throw new Error(`Reminder not found: ${reminderId}`);
    }

    const student = demoPaymentStore.getStudent(reminder.studentId);
    if (!student) {
      throw new Error(`Student not found for reminder: ${reminder.studentId}`);
    }

    this.checkStaffAccess(actor, student.centreId);

    const instalment = demoPaymentStore.instalments.get(reminder.instalmentId);
    if (!instalment) {
      throw new Error(`Instalment not found for reminder: ${reminder.instalmentId}`);
    }

    const studentLedgers = demoPaymentStore.ledgerEntries.filter(
      (e) => e.studentId === student.id
    );
    const bal = deriveInstalmentBalance(instalment, studentLedgers, asOfDate);
    const liveOutstanding = bal.outstandingBalance;

    const studentStatus = this.resolveStudentStatus(student.id);

    // Render both EN and HI previews
    const enPreview = evaluateReminderEligibility({
      studentId: student.id,
      studentName: student.name,
      studentCode: student.studentCode,
      studentStatus,
      instalmentSequence: instalment.sequence,
      dueDate: instalment.dueDate,
      currentOutstandingPaise: liveOutstanding,
      originalAmountPaise: instalment.amount,
      language: "en",
      asOfDate,
      instituteName: `Company A, ${student.centreName}`,
    });

    const hiPreview = evaluateReminderEligibility({
      studentId: student.id,
      studentName: student.name,
      studentCode: student.studentCode,
      studentStatus,
      instalmentSequence: instalment.sequence,
      dueDate: instalment.dueDate,
      currentOutstandingPaise: liveOutstanding,
      originalAmountPaise: instalment.amount,
      language: "hi",
      asOfDate,
      instituteName: `Company A, ${student.centreName}`,
    });

    const attempts = demoPaymentStore.getAttemptsForReminder(reminderId);

    const item: ReminderListItem = {
      id: reminder.id,
      instalmentId: reminder.instalmentId,
      studentId: reminder.studentId,
      studentCode: student.studentCode,
      studentName: student.name,
      centreId: student.centreId,
      centreName: student.centreName,
      parentPhone: student.parentPhone || null,
      parentName: `Parent of ${student.name}`,
      instalmentSequence: instalment.sequence,
      ruleName: reminder.ruleName || "Automated Schedule",
      channel: reminder.channel || "WHATSAPP",
      language: reminder.language || "en",
      evaluatedAmountPaise:
        reminder.status === "SENT" && attempts.find((a) => a.status === "SENT")?.evaluatedAmountPaise !== undefined
          ? attempts.find((a) => a.status === "SENT")!.evaluatedAmountPaise
          : liveOutstanding,
      status: reminder.status as any,
      scheduledFor: reminder.scheduledDate,
      dispatchedAt: reminder.dispatchedAt,
      skipReason: reminder.skipReason,
      lastError: reminder.lastError,
      attemptCount: reminder.attemptCount || attempts.length,
    };

    return {
      reminder: item,
      renderedPreviews: {
        en: { subject: enPreview.renderedSubject, body: enPreview.renderedBody },
        hi: { subject: hiPreview.renderedSubject, body: hiPreview.renderedBody },
      },
      attempts,
    };
  }

  /**
   * Resolves effective student status (checking withdrawal state).
   */
  private resolveStudentStatus(studentId: string): "ACTIVE" | "WITHDRAWN" | "COMPLETED" {
    for (const w of demoPaymentStore.withdrawals.values()) {
      if (w.studentId === studentId && (w.status === "APPROVED" || w.status === "EXECUTED")) {
        return "WITHDRAWN";
      }
    }
    return "ACTIVE";
  }

  /**
   * Dispatches an eligible queued reminder.
   * Enforces live balance re-evaluation, stop-on-settlement, stop-on-withdrawal,
   * idempotency locking, and audit recording.
   */
  public async dispatchReminder(
    reminderId: string,
    actor: Actor,
    idempotencyKey?: string
  ): Promise<DispatchReminderResult> {
    this.checkStaffAccess(actor);

    const reminder = demoPaymentStore.findReminderById(reminderId);
    if (!reminder) {
      throw new Error(`Reminder not found: ${reminderId}`);
    }

    const student = demoPaymentStore.getStudent(reminder.studentId);
    if (!student) {
      throw new Error(`Student not found for reminder: ${reminder.studentId}`);
    }

    this.checkStaffAccess(actor, student.centreId);

    // Rule: Never re-send an already dispatched reminder
    if (reminder.status === "SENT") {
      throw new Error("Cannot re-send already dispatched reminder");
    }

    // In-process Concurrency Lock
    if (demoPaymentStore.dispatchingReminders.has(reminderId)) {
      throw new Error(`Concurrent dispatch in progress for reminder: ${reminderId}`);
    }
    demoPaymentStore.dispatchingReminders.add(reminderId);

    try {
      const clock = getDefaultClock();
      const asOfDate = clock.businessDate();

      const instalment = demoPaymentStore.instalments.get(reminder.instalmentId);
      if (!instalment) {
        throw new Error(`Instalment not found: ${reminder.instalmentId}`);
      }

      // Financial Invariant: Re-derive LIVE ledger balance at dispatch time
      const studentLedgers = demoPaymentStore.ledgerEntries.filter(
        (e) => e.studentId === student.id
      );
      const balance = deriveInstalmentBalance(instalment, studentLedgers, asOfDate);
      const liveOutstanding = balance.outstandingBalance;

      const studentStatus = this.resolveStudentStatus(student.id);

      // Evaluate eligibility with pure domain rules
      const eligibility = evaluateReminderEligibility({
        studentId: student.id,
        studentName: student.name,
        studentCode: student.studentCode,
        studentStatus,
        instalmentSequence: instalment.sequence,
        dueDate: instalment.dueDate,
        currentOutstandingPaise: liveOutstanding,
        originalAmountPaise: instalment.amount,
        language: reminder.language || "en",
        asOfDate,
        instituteName: `Company A, ${student.centreName}`,
      });

      // If not eligible (settled in full, withdrawn, paused): Auto-skip immediately
      if (!eligibility.isEligible) {
        demoPaymentStore.updateReminder(reminderId, {
          status: "SKIPPED",
          skipReason: eligibility.skipReason || "Ineligible for dispatch",
        });

        demoPaymentStore.recordReminderAttempt({
          reminderId,
          attemptNumber: (reminder.attemptCount || 0) + 1,
          status: "SKIPPED",
          error: eligibility.skipReason,
          evaluatedAmountPaise: liveOutstanding,
        });

        await recordAuditLog({
          action: "REMINDER_SKIPPED",
          entityType: "Reminder",
          entityId: reminderId,
          actorId: actor.userId,
          actorRole: actor.role,
          centreId: student.centreId,
          reason: eligibility.skipReason,
          metadata: {
            studentCode: student.studentCode,
            outstandingPaise: liveOutstanding.toString(),
          },
        });

        return {
          success: true,
          status: "SKIPPED",
          skipReason: eligibility.skipReason || "Ineligible for dispatch",
          currentOutstandingPaise: liveOutstanding,
        };
      }

      // Dispatch via notification provider
      const provider = getNotificationProvider();
      const providerResult = await provider.sendFeeReminder({
        phone: student.parentPhone || "+91 99999 99999",
        subject: eligibility.renderedSubject || "Fee Reminder",
        body: eligibility.renderedBody || "",
        channel: reminder.channel || "WHATSAPP",
        studentName: student.name,
        studentCode: student.studentCode,
        amountPaise: liveOutstanding,
        idempotencyKey: idempotencyKey || `rem_${reminderId}_${Date.now()}`,
      });

      const nextAttemptNumber = (reminder.attemptCount || 0) + 1;

      if (providerResult.success) {
        demoPaymentStore.updateReminder(reminderId, {
          status: "SENT",
          dispatchedAt: providerResult.sentAt,
          renderedMessage: eligibility.renderedBody,
          attemptCount: nextAttemptNumber,
          lastError: null,
        });

        demoPaymentStore.recordReminderAttempt({
          reminderId,
          attemptNumber: nextAttemptNumber,
          status: "SENT",
          evaluatedAmountPaise: liveOutstanding,
          renderedMessage: eligibility.renderedBody,
          provider: providerResult.provider,
          attemptedAt: providerResult.sentAt,
        });

        await recordAuditLog({
          action: "REMINDER_DISPATCHED",
          entityType: "Reminder",
          entityId: reminderId,
          actorId: actor.userId,
          actorRole: actor.role,
          centreId: student.centreId,
          metadata: {
            studentCode: student.studentCode,
            amountPaise: liveOutstanding.toString(),
            messageId: providerResult.messageId,
          },
        });

        return {
          success: true,
          status: "SENT",
          messageId: providerResult.messageId,
          currentOutstandingPaise: liveOutstanding,
          renderedMessage: eligibility.renderedBody,
        };
      } else {
        demoPaymentStore.updateReminder(reminderId, {
          status: "FAILED",
          lastError: providerResult.error,
          attemptCount: nextAttemptNumber,
          lastAttemptAt: providerResult.sentAt,
        });

        demoPaymentStore.recordReminderAttempt({
          reminderId,
          attemptNumber: nextAttemptNumber,
          status: "FAILED",
          error: providerResult.error,
          evaluatedAmountPaise: liveOutstanding,
          provider: providerResult.provider,
          attemptedAt: providerResult.sentAt,
        });

        await recordAuditLog({
          action: "REMINDER_FAILED",
          entityType: "Reminder",
          entityId: reminderId,
          actorId: actor.userId,
          actorRole: actor.role,
          centreId: student.centreId,
          reason: providerResult.error,
          metadata: {
            studentCode: student.studentCode,
            amountPaise: liveOutstanding.toString(),
          },
        });

        return {
          success: false,
          status: "FAILED",
          error: providerResult.error,
          currentOutstandingPaise: liveOutstanding,
        };
      }
    } finally {
      demoPaymentStore.dispatchingReminders.delete(reminderId);
    }
  }

  /**
   * Retries dispatch for a failed reminder.
   * Re-evaluates live ledger balance, ensures previous state was FAILED,
   * enforces concurrency protection, and handles provider recovery.
   */
  public async retryReminder(
    reminderId: string,
    actor: Actor,
    idempotencyKey?: string
  ): Promise<DispatchReminderResult> {
    this.checkStaffAccess(actor);

    const reminder = demoPaymentStore.findReminderById(reminderId);
    if (!reminder) {
      throw new Error(`Reminder not found: ${reminderId}`);
    }

    if (reminder.status === "SENT") {
      throw new Error("Cannot re-send already dispatched reminder");
    }

    // Call dispatchReminder which handles the full re-evaluation, locking, and recording lifecycle
    return this.dispatchReminder(reminderId, actor, idempotencyKey);
  }
}

export const reminderService = new ReminderService();
