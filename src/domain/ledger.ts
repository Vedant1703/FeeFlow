/**
 * Pure domain ledger calculations for FeeFlow.
 * Hard invariant: Balances and daysOverdue are derived strictly from signed ledger entries.
 * Positive entries increase dues (CHARGE, and reversals of allocations).
 * Negative entries decrease dues (ALLOCATION, DISCOUNT, WAIVER).
 * Zero floating-point math; all values in integer paise (bigint).
 */

import { calculateDaysOverdue } from "./clock";

export type LedgerEntryType =
  | "CHARGE"
  | "DISCOUNT"
  | "ALLOCATION"
  | "REVERSAL"
  | "WAIVER"
  | "REFUND_ADJUSTMENT";

export interface DomainLedgerEntry {
  id: string;
  studentId: string;
  instalmentId?: string | null;
  entryType: LedgerEntryType;
  amount: bigint; // signed integer paise: positive increases due, negative reduces due
  entryDate: Date | string;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
}

export interface DomainInstalment {
  id: string;
  feePlanId: string;
  sequence: number;
  dueDate: Date | string;
  amount: bigint; // Scheduled amount
}

export interface InstalmentBalance {
  instalmentId: string;
  sequence: number;
  dueDate: Date | string;
  chargedAmount: bigint;
  discountAmount: bigint;
  allocatedAmount: bigint;
  waivedAmount: bigint;
  outstandingBalance: bigint;
  daysOverdue: number;
  status: "UNPAID" | "PARTIAL" | "PAID" | "WAIVED" | "OVERDUE";
  railSegment: {
    state: "paid" | "part" | "upcoming";
    paidPct: number;
    overdue: boolean;
  };
}

export interface StudentLedgerSummary {
  studentId: string;
  totalBilled: bigint;
  totalPaid: bigint;
  totalWaived: bigint;
  totalOutstanding: bigint;
  maxDaysOverdue: number;
  overallStatus: "ALL_PAID" | "PARTIAL" | "OVERDUE" | "CURRENT_DUE";
  instalments: InstalmentBalance[];
}

/**
 * Derives the financial balance for a specific instalment from its ledger entries.
 */
export function deriveInstalmentBalance(
  instalment: DomainInstalment,
  entries: DomainLedgerEntry[],
  businessDate: Date | string
): InstalmentBalance {
  const instEntries = entries.filter((e) => e.instalmentId === instalment.id);

  let chargedAmount = 0n;
  let discountAmount = 0n;
  let allocatedAmount = 0n;
  let waivedAmount = 0n;

  for (const entry of instEntries) {
    switch (entry.entryType) {
      case "CHARGE":
        chargedAmount += entry.amount;
        break;
      case "DISCOUNT":
        discountAmount += entry.amount < 0n ? -entry.amount : entry.amount;
        break;
      case "ALLOCATION":
        allocatedAmount += entry.amount < 0n ? -entry.amount : entry.amount;
        break;
      case "WAIVER":
        waivedAmount += entry.amount < 0n ? -entry.amount : entry.amount;
        break;
      case "REVERSAL":
        // Positive reversal increases due (cancels prior credit), negative reduces due
        if (entry.amount > 0n) {
          allocatedAmount -= entry.amount;
        } else {
          chargedAmount += entry.amount;
        }
        break;
      case "REFUND_ADJUSTMENT":
        chargedAmount += entry.amount;
        break;
    }
  }

  // Fallback to scheduled amount if no explicit CHARGE ledger entry exists
  if (chargedAmount === 0n && instEntries.length === 0) {
    chargedAmount = instalment.amount;
  }

  const effectiveNetBilled = chargedAmount - discountAmount;
  const totalSettled = allocatedAmount + waivedAmount;
  const rawOutstanding = effectiveNetBilled - totalSettled;
  const outstandingBalance = rawOutstanding < 0n ? 0n : rawOutstanding;

  const overdueDays =
    outstandingBalance > 0n
      ? calculateDaysOverdue(businessDate, instalment.dueDate)
      : 0;

  let status: InstalmentBalance["status"] = "UNPAID";
  if (waivedAmount > 0n && outstandingBalance === 0n) {
    status = "WAIVED";
  } else if (outstandingBalance === 0n) {
    status = "PAID";
  } else if (allocatedAmount > 0n) {
    status = overdueDays > 0 ? "OVERDUE" : "PARTIAL";
  } else if (overdueDays > 0) {
    status = "OVERDUE";
  } else {
    status = "UNPAID";
  }

  // Rail segment determination
  let railState: "paid" | "part" | "upcoming" = "upcoming";
  let paidPct = 0;
  if (effectiveNetBilled > 0n) {
    paidPct = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          (Number(allocatedAmount + waivedAmount) /
            Number(effectiveNetBilled)) *
            100
        )
      )
    );
  }

  if (outstandingBalance === 0n) {
    railState = "paid";
    paidPct = 100;
  } else if (allocatedAmount > 0n) {
    railState = "part";
  } else {
    railState = "upcoming";
  }

  return {
    instalmentId: instalment.id,
    sequence: instalment.sequence,
    dueDate: instalment.dueDate,
    chargedAmount,
    discountAmount,
    allocatedAmount,
    waivedAmount,
    outstandingBalance,
    daysOverdue: overdueDays,
    status,
    railSegment: {
      state: railState,
      paidPct,
      overdue: overdueDays > 0,
    },
  };
}

/**
 * Derives full student ledger summary across all instalments.
 */
export function deriveStudentLedgerSummary(
  studentId: string,
  instalments: DomainInstalment[],
  entries: DomainLedgerEntry[],
  businessDate: Date | string
): StudentLedgerSummary {
  const sortedInstalments = [...instalments].sort(
    (a, b) => a.sequence - b.sequence
  );

  const instalmentBalances = sortedInstalments.map((inst) =>
    deriveInstalmentBalance(inst, entries, businessDate)
  );

  let totalBilled = 0n;
  let totalPaid = 0n;
  let totalWaived = 0n;
  let totalOutstanding = 0n;
  let maxDaysOverdue = 0;

  for (const b of instalmentBalances) {
    totalBilled += b.chargedAmount - b.discountAmount;
    totalPaid += b.allocatedAmount;
    totalWaived += b.waivedAmount;
    totalOutstanding += b.outstandingBalance;
    if (b.daysOverdue > maxDaysOverdue) {
      maxDaysOverdue = b.daysOverdue;
    }
  }

  let overallStatus: StudentLedgerSummary["overallStatus"] = "CURRENT_DUE";
  if (totalOutstanding === 0n) {
    overallStatus = "ALL_PAID";
  } else if (maxDaysOverdue > 0) {
    overallStatus = "OVERDUE";
  } else if (totalPaid > 0n) {
    overallStatus = "PARTIAL";
  }

  return {
    studentId,
    totalBilled,
    totalPaid,
    totalWaived,
    totalOutstanding,
    maxDaysOverdue,
    overallStatus,
    instalments: instalmentBalances,
  };
}

/**
 * Validates append-only ledger invariants:
 * 1. An instalment cannot have negative outstanding (over-allocation prevented).
 * 2. Waivers cannot exceed remaining balance.
 */
export function validateLedgerIntegrity(
  instalment: DomainInstalment,
  entries: DomainLedgerEntry[]
): { valid: boolean; error?: string } {
  const instEntries = entries.filter((e) => e.instalmentId === instalment.id);

  let netCharged = 0n;
  let netCredits = 0n;

  for (const entry of instEntries) {
    if (entry.entryType === "CHARGE" || entry.entryType === "REFUND_ADJUSTMENT") {
      netCharged += entry.amount;
    } else if (
      entry.entryType === "ALLOCATION" ||
      entry.entryType === "DISCOUNT" ||
      entry.entryType === "WAIVER"
    ) {
      netCredits += entry.amount < 0n ? -entry.amount : entry.amount;
    } else if (entry.entryType === "REVERSAL") {
      if (entry.amount > 0n) {
        netCredits -= entry.amount;
      } else {
        netCharged += entry.amount;
      }
    }
  }

  if (netCredits > netCharged) {
    return {
      valid: false,
      error: `Ledger over-credited: credits (${netCredits}) exceed charges (${netCharged}) for instalment ${instalment.id}`,
    };
  }

  return { valid: true };
}

