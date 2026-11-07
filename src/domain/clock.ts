/**
 * Injected Clock abstraction for FeeFlow.
 * In demo mode, business date defaults to 2026-11-02 (Asia/Kolkata).
 * This ensures deterministic reproduction of brief sample records:
 * - STU-0412 Aarav Meena: Paid (due 10 Oct 2026)
 * - STU-0587 Ishita Sharma: Part paid, 23 days overdue (due 10 Oct 2026, paid 15k/30k)
 * - STU-0219 Mohit Gurjar: Due in 13 days (due 15 Nov 2026)
 */

export interface Clock {
  now(): Date;
  businessDate(): string; // YYYY-MM-DD in Asia/Kolkata
  businessDateTime(): Date;
}

export const DEMO_BUSINESS_DATE = "2026-11-02";

export class DemoClock implements Clock {
  private readonly fixedDate: string;

  constructor(fixedDate: string = DEMO_BUSINESS_DATE) {
    this.fixedDate = fixedDate;
  }

  now(): Date {
    return new Date(`${this.fixedDate}T12:00:00+05:30`);
  }

  businessDate(): string {
    return this.fixedDate;
  }

  businessDateTime(): Date {
    return new Date(`${this.fixedDate}T00:00:00+05:30`);
  }
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  businessDate(): string {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  }

  businessDateTime(): Date {
    const todayStr = this.businessDate();
    return new Date(`${todayStr}T00:00:00+05:30`);
  }
}

/**
 * Returns the default clock instance based on environment.
 */
export function getDefaultClock(): Clock {
  const isDemo =
    process.env.DEMO_MODE !== "false" &&
    process.env.NODE_ENV !== "production";
  const customDemoDate = process.env.DEMO_BUSINESS_DATE;

  if (isDemo || customDemoDate) {
    return new DemoClock(customDemoDate || DEMO_BUSINESS_DATE);
  }
  return new SystemClock();
}

/**
 * Parses YYYY-MM-DD or Date into UTC midnight timestamp for exact calendar math.
 */
export function toCalendarMidnight(dateOrStr: Date | string): number {
  if (typeof dateOrStr === "string") {
    const parts = dateOrStr.slice(0, 10).split("-").map(Number);
    return Date.UTC(parts[0], parts[1] - 1, parts[2]);
  }
  return Date.UTC(
    dateOrStr.getUTCFullYear(),
    dateOrStr.getUTCMonth(),
    dateOrStr.getUTCDate()
  );
}

/**
 * Inclusive calendar days between two dates: days(end) - days(start) + 1.
 * Used for refund calculations: T = inclusive calendar days.
 */
export function inclusiveCalendarDays(
  startDate: Date | string,
  endDate: Date | string
): number {
  const startMs = toCalendarMidnight(startDate);
  const endMs = toCalendarMidnight(endDate);
  const diffDays = Math.round((endMs - startMs) / (24 * 60 * 60 * 1000));
  return diffDays + 1;
}

/**
 * Calculate days overdue: max(0, businessDate - dueDate)
 */
export function calculateDaysOverdue(
  businessDate: Date | string,
  dueDate: Date | string
): number {
  const bMs = toCalendarMidnight(businessDate);
  const dMs = toCalendarMidnight(dueDate);
  const diffDays = Math.round((bMs - dMs) / (24 * 60 * 60 * 1000));
  return Math.max(0, diffDays);
}

/**
 * Format a date nicely for UI display: "10 Oct 2026"
 */
export function formatDate(dateOrStr: Date | string): string {
  const d = typeof dateOrStr === "string" ? new Date(dateOrStr) : dateOrStr;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

