/**
 * Pure domain reminder evaluation and rendering engine for FeeFlow.
 * Aligned with SRS v2.2 (§4.4) and Wireframe S4.
 *
 * Hard Invariants:
 * 1. Evaluate-at-send live balance: Always reads current ledger balance.
 *    A stale original amount is NEVER sent.
 * 2. Stop on payment: If instalment is fully settled (outstanding <= 0n), skip immediately.
 * 3. Stop on withdrawal or pause: If student is withdrawn or reminder is paused, skip.
 * 4. Partial payment update: Quotes the exact remaining outstanding balance.
 * 5. Bilingual parity: Full English and Hindi templates with Indian number formatting.
 */

import { formatINR } from "./money";
import { formatDate, calculateDaysOverdue } from "./clock";

export interface ReminderEligibilityInput {
  studentId: string;
  studentName: string;
  studentCode: string;
  studentStatus: "ACTIVE" | "WITHDRAWN" | "COMPLETED";
  instalmentSequence: number;
  dueDate: Date | string;
  currentOutstandingPaise: bigint; // live evaluated from ledger
  originalAmountPaise: bigint;
  language: "en" | "hi";
  asOfDate: Date | string;
  pausedUntil?: Date | string | null;
  lastReminderSentDate?: Date | string | null;
  instituteName?: string;
}

export interface ReminderEligibilityResult {
  isEligible: boolean;
  skipReason?: string | null;
  daysOverdue: number;
  daysUntilDue: number;
  currentOutstandingPaise: bigint;
  renderedSubject?: string;
  renderedBody?: string;
  channel: "WHATSAPP" | "SMS";
}

/**
 * Checks whether an instalment reminder is eligible to be dispatched,
 * and renders the exact personalized bilingual message with live balance.
 */
export function evaluateReminderEligibility(
  input: ReminderEligibilityInput
): ReminderEligibilityResult {
  const {
    studentName,
    studentCode,
    studentStatus,
    instalmentSequence,
    dueDate,
    currentOutstandingPaise,
    language,
    asOfDate,
    pausedUntil,
    lastReminderSentDate,
    instituteName = "Company A Institute, Jaipur",
  } = input;

  // 1. Withdrawn student guard
  if (studentStatus === "WITHDRAWN") {
    return {
      isEligible: false,
      skipReason: "Student withdrawn from course",
      daysOverdue: 0,
      daysUntilDue: 0,
      currentOutstandingPaise,
      channel: "WHATSAPP",
    };
  }

  // 2. Fully settled instalment guard
  if (currentOutstandingPaise <= 0n) {
    return {
      isEligible: false,
      skipReason: "Instalment settled in full",
      daysOverdue: 0,
      daysUntilDue: 0,
      currentOutstandingPaise,
      channel: "WHATSAPP",
    };
  }

  // 3. Active pause guard
  if (pausedUntil) {
    const pauseMs = typeof pausedUntil === "string" ? new Date(pausedUntil).getTime() : pausedUntil.getTime();
    const asOfMs = typeof asOfDate === "string" ? new Date(asOfDate).getTime() : asOfDate.getTime();
    if (asOfMs <= pauseMs) {
      return {
        isEligible: false,
        skipReason: `Reminder paused until ${formatDate(pausedUntil)}`,
        daysOverdue: 0,
        daysUntilDue: 0,
        currentOutstandingPaise,
        channel: "WHATSAPP",
      };
    }
  }

  // 4. Rate limit: Maximum 1 reminder per student per day
  if (lastReminderSentDate) {
    const lastMs = typeof lastReminderSentDate === "string" ? new Date(lastReminderSentDate).getTime() : lastReminderSentDate.getTime();
    const asOfMs = typeof asOfDate === "string" ? new Date(asOfDate).getTime() : asOfDate.getTime();
    const diffHours = (asOfMs - lastMs) / (1000 * 60 * 60);
    if (diffHours < 20) {
      return {
        isEligible: false,
        skipReason: "Rate limited: reminder already dispatched within last 24 hours",
        daysOverdue: 0,
        daysUntilDue: 0,
        currentOutstandingPaise,
        channel: "WHATSAPP",
      };
    }
  }

  // Calculate days overdue or days until due
  const overdueDays = calculateDaysOverdue(asOfDate, dueDate);
  let daysUntilDue = 0;
  if (overdueDays === 0) {
    const dMs = typeof dueDate === "string" ? new Date(dueDate).getTime() : dueDate.getTime();
    const aMs = typeof asOfDate === "string" ? new Date(asOfDate).getTime() : asOfDate.getTime();
    daysUntilDue = Math.max(0, Math.round((dMs - aMs) / (24 * 60 * 60 * 1000)));
  }

  const formattedAmount = formatINR(currentOutstandingPaise);
  const formattedDueDate = formatDate(dueDate);

  // Render bilingual message template
  let renderedSubject = "";
  let renderedBody = "";

  if (language === "hi") {
    if (overdueDays > 0) {
      renderedSubject = `फीस बकाया सूचना: ${studentName} (${studentCode})`;
      renderedBody = `प्रिय अभिभावक, ${instituteName} में ${studentName} की किस्त ${instalmentSequence} की देय राशि ${formattedAmount} है, जो ${overdueDays} दिन से बकाया है (देय तिथि: ${formattedDueDate})। कृपया तुरंत भुगतान के लिए अपने पैरेंट पोर्टल पर जाएं या सहायता हेतु केंद्र से संपर्क करें।`;
    } else if (daysUntilDue === 0) {
      renderedSubject = `फीस देय तिथि आज: ${studentName} (${studentCode})`;
      renderedBody = `प्रिय अभिभावक, ${instituteName} में ${studentName} की किस्त ${instalmentSequence} की राशि ${formattedAmount} आज देय है (${formattedDueDate})। असुविधा से बचने के लिए कृपया आज ही ऑनलाइन भुगतान करें।`;
    } else {
      renderedSubject = `आगामी फीस सूचना: ${studentName} (${studentCode})`;
      renderedBody = `प्रिय अभिभावक, ${instituteName} में ${studentName} की किस्त ${instalmentSequence} की देय राशि ${formattedAmount} है, जिसकी देय तिथि ${formattedDueDate} (${daysUntilDue} दिन बाद) है। आप अपने पैरेंट पोर्टल पर विवरण देख सकते हैं।`;
    }
  } else {
    // English template
    if (overdueDays > 0) {
      renderedSubject = `Fee Overdue Notice: ${studentName} (${studentCode})`;
      renderedBody = `Dear Parent, Instalment ${instalmentSequence} for ${studentName} at ${instituteName} has an outstanding balance of ${formattedAmount}, which is ${overdueDays} days overdue (due date: ${formattedDueDate}). Please log in to your Parent Portal to complete payment: https://feeflow.companya.test/parent`;
    } else if (daysUntilDue === 0) {
      renderedSubject = `Fee Due Today: ${studentName} (${studentCode})`;
      renderedBody = `Dear Parent, Instalment ${instalmentSequence} for ${studentName} of ${formattedAmount} is due today (${formattedDueDate}). Please complete payment via your Parent Portal to keep records current.`;
    } else {
      renderedSubject = `Upcoming Fee Reminder: ${studentName} (${studentCode})`;
      renderedBody = `Dear Parent, an upcoming fee instalment (${instalmentSequence}) of ${formattedAmount} for ${studentName} is due in ${daysUntilDue} days on ${formattedDueDate}. You can review dues on your portal.`;
    }
  }

  return {
    isEligible: true,
    daysOverdue: overdueDays,
    daysUntilDue,
    currentOutstandingPaise,
    renderedSubject,
    renderedBody,
    channel: "WHATSAPP",
  };
}
