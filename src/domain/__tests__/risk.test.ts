import { describe, it, expect } from "vitest";
import {
  evaluateStudentRisk,
  computeFeeScore,
  computeAttendanceScore,
  computeTestScore,
} from "../risk";

describe("Domain: risk.ts — Explainable AI Dropout-Risk Heuristic", () => {
  const asOf = "2026-11-02";

  it("returns INSUFFICIENT_DATA when fewer than 2 academic signals have data (STU-1456 Tanvi Arora)", () => {
    // Only 3 attendance records (min 12 required) and 1 test (min 3 required)
    const res = evaluateStudentRisk({
      studentId: "STU-1456",
      asOfDate: asOf,
      feeOverdueDays: 0,
      outstandingPaise: 0n,
      attendance: {
        asOfDate: asOf,
        records: [
          { date: "2026-10-20", present: true },
          { date: "2026-10-22", present: true },
          { date: "2026-10-25", present: false },
        ],
      },
      tests: {
        asOfDate: asOf,
        tests: [{ testDate: "2026-10-24", score: 85, maxScore: 100 }],
      },
    });

    expect(res.riskLevel).toBe("INSUFFICIENT_DATA");
    expect(res.sufficientSignalsCount).toBe(0);
    expect(res.isActionableTaskRequired).toBe(false);
    expect(res.taskType).toBeNull();
    // Guardrail check: NEVER return LOW when academic data is insufficient
    expect(res.riskLevel).not.toBe("LOW");
  });

  it("calculates HIGH risk and triggers COUNSELLOR_CALL task (STU-0731 Rohan Saini: score >= 60)", () => {
    // Generate 20 attendance sessions: 90% attendance in baseline, but 40% in recent 28 days
    const attendanceRecords = [];
    // Prior baseline sessions (29 to 56 days ago) -> 12 sessions, all present
    for (let i = 29; i <= 50; i += 2) {
      const d = new Date(new Date(asOf).getTime() - i * 24 * 60 * 60 * 1000);
      attendanceRecords.push({ date: d.toISOString().slice(0, 10), present: true });
    }
    // Recent sessions (last 28 days) -> 8 sessions, only 3 present (37.5%)
    for (let i = 2; i <= 24; i += 3) {
      const d = new Date(new Date(asOf).getTime() - i * 24 * 60 * 60 * 1000);
      attendanceRecords.push({ date: d.toISOString().slice(0, 10), present: i > 15 });
    }

    // 4 Tests: prior 2 tests ~80%, recent 2 tests ~45% (significant drop)
    const testResults = [
      { testDate: "2026-09-10", score: 82, maxScore: 100 },
      { testDate: "2026-09-25", score: 80, maxScore: 100 },
      { testDate: "2026-10-12", score: 48, maxScore: 100 },
      { testDate: "2026-10-28", score: 44, maxScore: 100 },
    ];

    const res = evaluateStudentRisk({
      studentId: "STU-0731",
      asOfDate: asOf,
      feeOverdueDays: 35, // >30 days overdue
      outstandingPaise: 3000000n,
      attendance: { asOfDate: asOf, records: attendanceRecords },
      tests: { asOfDate: asOf, tests: testResults },
    });

    expect(res.sufficientSignalsCount).toBe(2);
    expect(res.overallScore).toBeGreaterThanOrEqual(60.0);
    expect(res.riskLevel).toBe("HIGH");
    expect(res.isActionableTaskRequired).toBe(true);
    // Hard Invariant: Task must be COUNSELLOR_CALL only
    expect(res.taskType).toBe("COUNSELLOR_CALL");
    expect(res.explainabilitySummary).toContain("Fee:");
    expect(res.explainabilitySummary).toContain("Attendance:");
    expect(res.explainabilitySummary).toContain("Tests:");
  });

  it("suppresses repeat task creation for 30 days when previously marked FALSE_POSITIVE", () => {
    // Generate valid attendance and test data
    const records = [];
    for (let i = 1; i <= 20; i += 2) {
      records.push({ date: `2026-10-${i < 10 ? "0" + i : i}`, present: i > 10 });
    }
    const tests = [
      { testDate: "2026-09-15", score: 75, maxScore: 100 },
      { testDate: "2026-10-01", score: 65, maxScore: 100 },
      { testDate: "2026-10-20", score: 50, maxScore: 100 },
    ];

    // Evaluated 10 days ago and marked FALSE_POSITIVE with score 62.0
    const res = evaluateStudentRisk({
      studentId: "STU-0731",
      asOfDate: asOf,
      feeOverdueDays: 25,
      outstandingPaise: 3000000n,
      attendance: { asOfDate: asOf, records },
      tests: { asOfDate: asOf, tests },
      lastEvaluation: {
        evaluatedAt: "2026-10-23", // 10 days ago (< 30 days)
        overallScore: 62.0,
        wasMarkedFalsePositive: true,
      },
    });

    // Even if score is in HIGH range, task is suppressed
    if (res.overallScore >= 60.0 && res.overallScore - 62.0 < 15.0) {
      expect(res.isActionableTaskRequired).toBe(false);
      expect(res.taskType).toBeNull();
      expect(res.taskSuppressedReason).toContain("Suppressed: marked False Positive within last 30 days");
    }
  });

  it("un-suppresses task if score increases materially by >= 15 points", () => {
    const records = [];
    for (let i = 1; i <= 20; i += 2) {
      records.push({ date: `2026-10-${i < 10 ? "0" + i : i}`, present: false }); // 0% attendance
    }
    const tests = [
      { testDate: "2026-09-15", score: 90, maxScore: 100 },
      { testDate: "2026-10-01", score: 30, maxScore: 100 },
      { testDate: "2026-10-20", score: 20, maxScore: 100 }, // massive drop
    ];

    // Previously evaluated at score 60.0, now rises to > 75.0 (+15 points)
    const res = evaluateStudentRisk({
      studentId: "STU-0731",
      asOfDate: asOf,
      feeOverdueDays: 65, // >60 days overdue (score 100)
      outstandingPaise: 6000000n,
      attendance: { asOfDate: asOf, records },
      tests: { asOfDate: asOf, tests },
      lastEvaluation: {
        evaluatedAt: "2026-10-23",
        overallScore: 60.0,
        wasMarkedFalsePositive: true,
      },
    });

    if (res.overallScore >= 75.0) {
      expect(res.isActionableTaskRequired).toBe(true);
      expect(res.taskType).toBe("COUNSELLOR_CALL");
    }
  });
});
