/**
 * Pure domain AI Dropout-Risk engine for FeeFlow.
 * Aligned with SRS v2.2 (§4.7) and Agentic Rules.
 *
 * Hard Invariants:
 * 1. Deterministic weighted heuristic: 0.40 fee + 0.30 attendance + 0.30 test trend.
 * 2. If < 2 academic signals have sufficient data, return INSUFFICIENT_DATA (never LOW).
 * 3. HIGH (score >= 60.0) triggers a COUNSELLOR_CALL task only.
 * 4. Zero access to ledger, payments, messaging, or fee modification.
 * 5. False positive review suppresses repeat tasks for 30 days unless score rises by >= 15 points.
 */

import { toCalendarMidnight } from "./clock";

export interface AttendanceSignalInput {
  records: { date: Date | string; present: boolean }[];
  asOfDate: Date | string;
}

export interface TestSignalInput {
  tests: { testDate: Date | string; score: number; maxScore: number }[];
  asOfDate: Date | string;
}

export interface RiskEvaluationInput {
  studentId: string;
  asOfDate: Date | string;
  feeOverdueDays: number;
  outstandingPaise: bigint;
  attendance?: AttendanceSignalInput;
  tests?: TestSignalInput;
  lastEvaluation?: {
    evaluatedAt: Date | string;
    overallScore: number;
    wasMarkedFalsePositive: boolean;
  } | null;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "INSUFFICIENT_DATA";

export interface FactorDetail {
  score: number;
  weight: number;
  dataPoints: number;
  sufficient: boolean;
  metric: string;
  detail: string;
}

export interface RiskEvaluationResult {
  studentId: string;
  evaluatedAt: Date;
  overallScore: number;
  riskLevel: RiskLevel;
  feeFactor: FactorDetail;
  attendanceFactor: FactorDetail;
  testFactor: FactorDetail;
  sufficientSignalsCount: number;
  isActionableTaskRequired: boolean;
  taskType: "COUNSELLOR_CALL" | null;
  taskSuppressedReason?: string | null;
  explainabilitySummary: string;
}

/**
 * Evaluates the fee component score (0-100).
 * Based on overdue days and outstanding amount.
 */
export function computeFeeScore(overdueDays: number, outstandingPaise: bigint): FactorDetail {
  if (outstandingPaise <= 0n || overdueDays <= 0) {
    return {
      score: 0,
      weight: 0.40,
      dataPoints: 1,
      sufficient: true,
      metric: "0 days overdue",
      detail: "All instalments current or fully paid",
    };
  }

  let score = 0;
  if (overdueDays <= 15) {
    score = 30;
  } else if (overdueDays <= 30) {
    score = 60;
  } else if (overdueDays <= 60) {
    score = 80;
  } else {
    score = 100;
  }

  return {
    score,
    weight: 0.40,
    dataPoints: 1,
    sufficient: true,
    metric: `${overdueDays} days overdue`,
    detail: `Instalment overdue by ${overdueDays} days with outstanding balance`,
  };
}

/**
 * Evaluates the attendance component score (0-100).
 * Compares recent 28-day attendance with prior 56-day baseline.
 * Requires at least 12 total sessions or at least 6 sessions in recent window.
 */
export function computeAttendanceScore(input?: AttendanceSignalInput): FactorDetail {
  if (!input || !input.records || input.records.length === 0) {
    return {
      score: 0,
      weight: 0.30,
      dataPoints: 0,
      sufficient: false,
      metric: "No attendance data",
      detail: "Insufficient data: 0 attendance sessions recorded",
    };
  }

  const asOfMs = toCalendarMidnight(input.asOfDate);
  const ms28Days = 28 * 24 * 60 * 60 * 1000;
  const ms56Days = 56 * 24 * 60 * 60 * 1000;

  const recentRecords: boolean[] = [];
  const baselineRecords: boolean[] = [];

  for (const r of input.records) {
    const rMs = toCalendarMidnight(r.date);
    const diff = asOfMs - rMs;
    if (diff >= 0 && diff <= ms28Days) {
      recentRecords.push(r.present);
    }
    if (diff >= 0 && diff <= ms56Days) {
      baselineRecords.push(r.present);
    }
  }

  // Minimum data guard: need at least 6 recent sessions or 12 baseline sessions
  if (baselineRecords.length < 12 && recentRecords.length < 6) {
    return {
      score: 0,
      weight: 0.30,
      dataPoints: baselineRecords.length,
      sufficient: false,
      metric: `${baselineRecords.length} sessions (min 12 required)`,
      detail: "Insufficient data: fewer than 12 recorded sessions in baseline window",
    };
  }

  const recentPresent = recentRecords.filter(Boolean).length;
  const recentPct =
    recentRecords.length > 0 ? (recentPresent / recentRecords.length) * 100 : 0;

  const baselinePresent = baselineRecords.filter(Boolean).length;
  const baselinePct =
    baselineRecords.length > 0
      ? (baselinePresent / baselineRecords.length) * 100
      : 100;

  // Drop in attendance
  const dropPct = Math.max(0, baselinePct - recentPct);

  // Score: 0 drop = 0, 10% drop = 25, 20% drop = 50, 40%+ drop = 100
  const score = Math.min(100, Math.round(dropPct * 2.5));

  return {
    score,
    weight: 0.30,
    dataPoints: baselineRecords.length,
    sufficient: true,
    metric: `${Math.round(recentPct)}% recent vs ${Math.round(baselinePct)}% baseline`,
    detail:
      dropPct > 5
        ? `Attendance dropped by ${Math.round(dropPct)}% in recent 4 weeks`
        : "Attendance stable or consistent with baseline",
  };
}

/**
 * Evaluates the test score trend (0-100).
 * Compares recent 3 tests with prior 3 tests within 120 days.
 * Requires at least 3 tests to evaluate.
 */
export function computeTestScore(input?: TestSignalInput): FactorDetail {
  if (!input || !input.tests || input.tests.length < 3) {
    const count = input?.tests?.length ?? 0;
    return {
      score: 0,
      weight: 0.30,
      dataPoints: count,
      sufficient: false,
      metric: `${count} tests (min 3 required)`,
      detail: "Insufficient data: fewer than 3 tests recorded in academic period",
    };
  }

  // Sort tests chronologically
  const sorted = [...input.tests].sort(
    (a, b) => toCalendarMidnight(a.testDate) - toCalendarMidnight(b.testDate)
  );

  const testPercentages = sorted.map((t) =>
    t.maxScore > 0 ? (t.score / t.maxScore) * 100 : 0
  );

  // Take up to recent 3 tests
  const recentCount = Math.min(3, Math.floor(testPercentages.length / 2) || 1);
  const recentTests = testPercentages.slice(-recentCount);
  const priorTests = testPercentages.slice(0, -recentCount);

  const recentAvg =
    recentTests.reduce((a, b) => a + b, 0) / recentTests.length;
  const priorAvg =
    priorTests.length > 0
      ? priorTests.reduce((a, b) => a + b, 0) / priorTests.length
      : recentAvg;

  const dropPct = Math.max(0, priorAvg - recentAvg);
  const score = Math.min(100, Math.round(dropPct * 2.5));

  return {
    score,
    weight: 0.30,
    dataPoints: sorted.length,
    sufficient: true,
    metric: `${Math.round(recentAvg)}% recent avg vs ${Math.round(priorAvg)}% prior avg`,
    detail:
      dropPct > 5
        ? `Test performance dropped by ${Math.round(dropPct)}%`
        : "Test performance consistent or improving",
  };
}

/**
 * Evaluates overall student dropout risk with safety guards and explainability.
 */
export function evaluateStudentRisk(input: RiskEvaluationInput): RiskEvaluationResult {
  const asOf = typeof input.asOfDate === "string" ? new Date(input.asOfDate) : input.asOfDate;

  const feeFactor = computeFeeScore(input.feeOverdueDays, input.outstandingPaise);
  const attendanceFactor = computeAttendanceScore(input.attendance);
  const testFactor = computeTestScore(input.tests);

  // Count sufficient academic signals
  const academicSignalsSufficient =
    (attendanceFactor.sufficient ? 1 : 0) + (testFactor.sufficient ? 1 : 0);

  // Hard Invariant: If < 2 academic signals are sufficient, return INSUFFICIENT_DATA
  if (academicSignalsSufficient < 2) {
    return {
      studentId: input.studentId,
      evaluatedAt: asOf,
      overallScore: 0,
      riskLevel: "INSUFFICIENT_DATA",
      feeFactor,
      attendanceFactor,
      testFactor,
      sufficientSignalsCount: academicSignalsSufficient,
      isActionableTaskRequired: false,
      taskType: null,
      taskSuppressedReason: "Insufficient academic signals (minimum 2 required)",
      explainabilitySummary:
        "Insufficient academic data: both attendance and test scores must have required minimum data points to evaluate risk accurately.",
    };
  }

  // Renormalise weights across available signals (here all 3 are available)
  const totalWeight = feeFactor.weight + attendanceFactor.weight + testFactor.weight;
  const rawScore =
    (feeFactor.score * feeFactor.weight +
      attendanceFactor.score * attendanceFactor.weight +
      testFactor.score * testFactor.weight) /
    totalWeight;

  const overallScore = Math.round(rawScore * 10) / 10;

  let riskLevel: RiskLevel = "LOW";
  if (overallScore >= 60.0) {
    riskLevel = "HIGH";
  } else if (overallScore >= 35.0) {
    riskLevel = "MEDIUM";
  } else {
    riskLevel = "LOW";
  }

  // Check 30-day false positive suppression
  let isActionableTaskRequired = riskLevel === "HIGH";
  let taskType: "COUNSELLOR_CALL" | null = riskLevel === "HIGH" ? "COUNSELLOR_CALL" : null;
  let taskSuppressedReason: string | null = null;

  if (isActionableTaskRequired && input.lastEvaluation?.wasMarkedFalsePositive) {
    const lastEvalMs = toCalendarMidnight(input.lastEvaluation.evaluatedAt);
    const currMs = toCalendarMidnight(asOf);
    const daysSince = Math.round((currMs - lastEvalMs) / (24 * 60 * 60 * 1000));

    // If within 30 days, suppress UNLESS score increased materially by >= 15 points
    if (daysSince <= 30) {
      const scoreDelta = overallScore - input.lastEvaluation.overallScore;
      if (scoreDelta < 15.0) {
        isActionableTaskRequired = false;
        taskType = null;
        taskSuppressedReason = `Suppressed: marked False Positive within last 30 days (${daysSince}d ago). Score increase (+${scoreDelta.toFixed(1)}) is below 15-point threshold.`;
      }
    }
  }

  // Explainability summary
  const summaryParts = [
    `Overall Risk Score: ${overallScore} (${riskLevel}).`,
    `Fee: ${feeFactor.metric} (score ${feeFactor.score}).`,
    `Attendance: ${attendanceFactor.metric} (score ${attendanceFactor.score}).`,
    `Tests: ${testFactor.metric} (score ${testFactor.score}).`,
  ];
  if (taskSuppressedReason) {
    summaryParts.push(taskSuppressedReason);
  }

  return {
    studentId: input.studentId,
    evaluatedAt: asOf,
    overallScore,
    riskLevel,
    feeFactor,
    attendanceFactor,
    testFactor,
    sufficientSignalsCount: academicSignalsSufficient,
    isActionableTaskRequired,
    taskType,
    taskSuppressedReason,
    explainabilitySummary: summaryParts.join(" "),
  };
}

