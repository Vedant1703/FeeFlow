/**
 * Pure domain refund calculations for FeeFlow.
 * Aligned with Ministry of Education (MoE) January 2024 Guidelines,
 * Refund Policy v1.0, and SRS v2.2 (§4.5).
 *
 * Hard Invariants:
 * 1. Inclusive calendar days: T = days(E) - days(S) + 1, c = clamp(days(W) - days(S) + 1, 0, T).
 * 2. All money in integer paise (bigint); zero floating-point arithmetic.
 * 3. Fixed deduction = 0, percentage deduction = 0 bps.
 * 4. Part-paid shortfall (earned > paid) is INFORMATIONAL ONLY (styled in neutral slate #505A66).
 *    It is never an ordinary collectible receivable, never added to dues/ageing/reminders.
 * 5. Approved withdrawal waives unpaid ordinary instalments to ₹0.
 * 6. Maker-checker enforcement: approverId !== requesterId.
 */

import { inclusiveCalendarDays, toCalendarMidnight } from "./clock";
import { roundHalfUp } from "./money";
import { DomainInstalment, DomainLedgerEntry } from "./ledger";

export interface RefundCalculationInput {
  netFee: bigint; // N: net fee after approved discounts (integer paise)
  totalPaid: bigint; // P: verified payments allocated to service component (integer paise)
  serviceStartDate: Date | string; // S
  serviceEndDate: Date | string; // E
  effectiveWithdrawalDate: Date | string; // W
  deductionPaise?: bigint; // Default 0n
  deductionBasisPoints?: number; // Default 0 (e.g. 100 bp = 1%)
}

export interface RefundCalculationResult {
  totalServiceDays: number; // T
  consumedDays: number; // c
  netFee: bigint; // N
  totalPaid: bigint; // P
  earnedFee: bigint; // roundHalfUp(N * c / T)
  deductionAmount: bigint; // 0n
  indicativeObligation: bigint; // min(N, earned + deduction)
  potentialRefund: bigint; // max(0n, P - indicativeObligation)
  indicativeShortfall: bigint; // max(0n, indicativeObligation - P)
  isShortfall: boolean;
  shortfallIsInformationalOnly: boolean; // Always true
  slaTargetDays: number; // 10 days
  policyVersion: string;
}

export interface RefundItemPlan {
  paymentId: string;
  maxRefundablePaise: bigint;
  allocatedRefundPaise: bigint;
}

/**
 * Deterministic pro-rata refund calculation according to Refund Policy v1.0.
 */
export function calculateProRataRefund(
  input: RefundCalculationInput
): RefundCalculationResult {
  const {
    netFee,
    totalPaid,
    serviceStartDate,
    serviceEndDate,
    effectiveWithdrawalDate,
    deductionPaise = 0n,
    deductionBasisPoints = 0,
  } = input;

  if (netFee < 0n || totalPaid < 0n) {
    throw new Error("Financial inputs cannot be negative in refund calculation");
  }

  // T = days(E) - days(S) + 1
  const totalServiceDays = inclusiveCalendarDays(
    serviceStartDate,
    serviceEndDate
  );
  if (totalServiceDays <= 0) {
    throw new Error("Invalid service period: end date must be on or after start date");
  }

  // Raw consumed days from start to effective withdrawal date
  const startMs = toCalendarMidnight(serviceStartDate);
  const wMs = toCalendarMidnight(effectiveWithdrawalDate);

  let rawConsumed = 0;
  if (wMs >= startMs) {
    rawConsumed = inclusiveCalendarDays(serviceStartDate, effectiveWithdrawalDate);
  } else {
    // Withdrawal effective before course start
    rawConsumed = 0;
  }

  // c = clamp(rawConsumed, 0, T)
  const consumedDays = Math.max(0, Math.min(rawConsumed, totalServiceDays));

  // earned = roundHalfUp(N * c / T)
  const earnedFee = roundHalfUp(
    netFee * BigInt(consumedDays),
    BigInt(totalServiceDays)
  );

  // deduction = deductionPaise + roundHalfUp(N * basisPoints / 10000)
  const bpDeduction =
    deductionBasisPoints > 0
      ? roundHalfUp(netFee * BigInt(deductionBasisPoints), 10000n)
      : 0n;
  const deductionAmount = deductionPaise + bpDeduction;

  // indicativeObligation = min(N, earned + deduction)
  const calculatedObligation = earnedFee + deductionAmount;
  const indicativeObligation =
    calculatedObligation > netFee ? netFee : calculatedObligation;

  // potentialRefund = max(0, P - indicativeObligation)
  const potentialRefund =
    totalPaid > indicativeObligation ? totalPaid - indicativeObligation : 0n;

  // indicativeShortfall = max(0, indicativeObligation - P)
  const indicativeShortfall =
    indicativeObligation > totalPaid ? indicativeObligation - totalPaid : 0n;

  return {
    totalServiceDays,
    consumedDays,
    netFee,
    totalPaid,
    earnedFee,
    deductionAmount,
    indicativeObligation,
    potentialRefund,
    indicativeShortfall,
    isShortfall: indicativeShortfall > 0n,
    shortfallIsInformationalOnly: true,
    slaTargetDays: 10,
    policyVersion: "v1.0",
  };
}

/**
 * Splits a potential refund amount across captured payments in reverse chronological order
 * (newest payment refunded first, or matching instalment order), capped by each payment's unrefunded amount.
 */
export function planRefundItems(
  totalRefundToIssue: bigint,
  payments: { id: string; capturedAmount: bigint; alreadyRefundedAmount: bigint }[]
): RefundItemPlan[] {
  let remainingToRefund = totalRefundToIssue;
  const plans: RefundItemPlan[] = [];

  for (const pay of payments) {
    if (remainingToRefund <= 0n) {
      plans.push({
        paymentId: pay.id,
        maxRefundablePaise: pay.capturedAmount - pay.alreadyRefundedAmount,
        allocatedRefundPaise: 0n,
      });
      continue;
    }

    const available = pay.capturedAmount - pay.alreadyRefundedAmount;
    if (available <= 0n) {
      plans.push({
        paymentId: pay.id,
        maxRefundablePaise: 0n,
        allocatedRefundPaise: 0n,
      });
      continue;
    }

    const allocation = remainingToRefund >= available ? available : remainingToRefund;
    plans.push({
      paymentId: pay.id,
      maxRefundablePaise: available,
      allocatedRefundPaise: allocation,
    });

    remainingToRefund -= allocation;
  }

  if (remainingToRefund > 0n) {
    throw new Error(
      `Insufficient captured payments to refund: remaining ${remainingToRefund} paise cannot be attributed to any payment`
    );
  }

  return plans;
}

/**
 * Generates WAIVER ledger entries for unpaid or partly-paid ordinary instalments
 * when a student's withdrawal is approved.
 * This guarantees the student's ordinary ledger balance drops to ₹0 on withdrawal.
 */
export function generateWithdrawalWaivers(
  studentId: string,
  withdrawalId: string,
  instalments: { id: string; sequence: number; outstandingBalance: bigint }[],
  effectiveDate: Date | string
): Omit<DomainLedgerEntry, "id">[] {
  const waivers: Omit<DomainLedgerEntry, "id">[] = [];

  for (const inst of instalments) {
    if (inst.outstandingBalance > 0n) {
      waivers.push({
        studentId,
        instalmentId: inst.id,
        entryType: "WAIVER",
        amount: -inst.outstandingBalance, // negative reduces debt
        entryDate: effectiveDate,
        referenceType: "WITHDRAWAL_APPROVAL",
        referenceId: withdrawalId,
        notes: `Ordinary unpaid balance waived on withdrawal approval for instalment ${inst.sequence}`,
      });
    }
  }

  return waivers;
}

/**
 * Maker-checker authorization guard:
 * The person approving a withdrawal or refund MUST NOT be the person who requested it.
 */
export function validateMakerChecker(
  requesterId: string,
  approverId: string
): { allowed: boolean; error?: string } {
  if (!requesterId || !approverId) {
    return {
      allowed: false,
      error: "Both requester and approver IDs must be provided for maker-checker validation",
    };
  }

  if (requesterId === approverId) {
    return {
      allowed: false,
      error: "Maker-checker violation: requester cannot approve their own withdrawal or refund request",
    };
  }

  return { allowed: true };
}
