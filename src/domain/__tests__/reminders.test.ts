import { describe, it, expect } from "vitest";
import { evaluateReminderEligibility } from "../reminders";

describe("Domain: reminders.ts — Evaluate-at-Send Reminders", () => {
  const asOf = "2026-11-02";

  it("skips reminder when instalment is fully settled (outstanding <= 0n)", () => {
    // STU-0412 Aarav Meena: Instalment 2 settled (outstanding = 0)
    const res = evaluateReminderEligibility({
      studentId: "STU-0412",
      studentName: "Aarav Meena",
      studentCode: "STU-0412",
      studentStatus: "ACTIVE",
      instalmentSequence: 2,
      dueDate: "2026-10-10",
      currentOutstandingPaise: 0n, // fully paid
      originalAmountPaise: 3000000n,
      language: "en",
      asOfDate: asOf,
    });

    expect(res.isEligible).toBe(false);
    expect(res.skipReason).toBe("Instalment settled in full");
  });

  it("skips reminder when student has withdrawn from course", () => {
    // STU-1038 Kavya Rathore: Status WITHDRAWN
    const res = evaluateReminderEligibility({
      studentId: "STU-1038",
      studentName: "Kavya Rathore",
      studentCode: "STU-1038",
      studentStatus: "WITHDRAWN",
      instalmentSequence: 2,
      dueDate: "2026-10-10",
      currentOutstandingPaise: 3000000n,
      originalAmountPaise: 3000000n,
      language: "hi",
      asOfDate: asOf,
    });

    expect(res.isEligible).toBe(false);
    expect(res.skipReason).toBe("Student withdrawn from course");
  });

  it("skips reminder when an active pause exists", () => {
    const res = evaluateReminderEligibility({
      studentId: "STU-0587",
      studentName: "Ishita Sharma",
      studentCode: "STU-0587",
      studentStatus: "ACTIVE",
      instalmentSequence: 2,
      dueDate: "2026-10-10",
      currentOutstandingPaise: 1500000n,
      originalAmountPaise: 3000000n,
      language: "en",
      asOfDate: asOf,
      pausedUntil: "2026-11-10", // paused until 10 Nov
    });

    expect(res.isEligible).toBe(false);
    expect(res.skipReason).toContain("Reminder paused until");
  });

  it("quotes updated balance after partial payment, NEVER stale original amount (STU-0587 Ishita: ₹15,000 overdue by 23 days)", () => {
    // Original was ₹30,000, now ₹15,000 remaining
    const res = evaluateReminderEligibility({
      studentId: "STU-0587",
      studentName: "Ishita Sharma",
      studentCode: "STU-0587",
      studentStatus: "ACTIVE",
      instalmentSequence: 2,
      dueDate: "2026-10-10",
      currentOutstandingPaise: 1500000n, // ₹15,000
      originalAmountPaise: 3000000n, // original ₹30,000
      language: "en",
      asOfDate: asOf,
    });

    expect(res.isEligible).toBe(true);
    expect(res.daysOverdue).toBe(23);
    expect(res.renderedBody).toContain("₹15,000");
    // Hard Invariant: Must NOT quote stale original amount
    expect(res.renderedBody).not.toContain("₹30,000");
    expect(res.renderedBody).toContain("23 days overdue");
  });

  it("renders accurate Hindi template for upcoming instalment (STU-0219 Mohit: Due in 13 days)", () => {
    // Mohit Gurjar: Due 15 Nov 2026 (13 days from 2 Nov)
    const res = evaluateReminderEligibility({
      studentId: "STU-0219",
      studentName: "Mohit Gurjar",
      studentCode: "STU-0219",
      studentStatus: "ACTIVE",
      instalmentSequence: 2,
      dueDate: "2026-11-15",
      currentOutstandingPaise: 4000000n, // ₹40,000
      originalAmountPaise: 4000000n,
      language: "hi",
      asOfDate: asOf,
    });

    expect(res.isEligible).toBe(true);
    expect(res.daysOverdue).toBe(0);
    expect(res.daysUntilDue).toBe(13);
    expect(res.renderedSubject).toContain("आगामी फीस सूचना: Mohit Gurjar");
    expect(res.renderedBody).toContain("₹40,000");
    expect(res.renderedBody).toContain("13 दिन बाद");
  });
});

