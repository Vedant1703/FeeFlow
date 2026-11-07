import { describe, it, expect } from "vitest";
import {
  deriveInstalmentBalance,
  deriveStudentLedgerSummary,
  validateLedgerIntegrity,
  DomainInstalment,
  DomainLedgerEntry,
} from "../ledger";

describe("Domain: ledger.ts", () => {
  const sampleInstalment: DomainInstalment = {
    id: "inst-1",
    feePlanId: "plan-1",
    sequence: 1,
    dueDate: "2026-10-10",
    amount: 3000000n, // ₹30,000
  };

  it("calculates fully paid instalment balance correctly", () => {
    const entries: DomainLedgerEntry[] = [
      {
        id: "e1",
        studentId: "stu-1",
        instalmentId: "inst-1",
        entryType: "CHARGE",
        amount: 3000000n,
        entryDate: "2026-10-10",
      },
      {
        id: "e2",
        studentId: "stu-1",
        instalmentId: "inst-1",
        entryType: "ALLOCATION",
        amount: -3000000n,
        entryDate: "2026-10-10",
      },
    ];

    const balance = deriveInstalmentBalance(sampleInstalment, entries, "2026-11-02");
    expect(balance.outstandingBalance).toBe(0n);
    expect(balance.allocatedAmount).toBe(3000000n);
    expect(balance.status).toBe("PAID");
    expect(balance.daysOverdue).toBe(0);
    expect(balance.railSegment.state).toBe("paid");
    expect(balance.railSegment.paidPct).toBe(100);
  });

  it("calculates part-paid overdue instalment balance (STU-0587 Ishita Sharma: 23 days overdue)", () => {
    const entries: DomainLedgerEntry[] = [
      {
        id: "e1",
        studentId: "STU-0587",
        instalmentId: "inst-1",
        entryType: "CHARGE",
        amount: 3000000n,
        entryDate: "2026-10-10",
      },
      {
        id: "e2",
        studentId: "STU-0587",
        instalmentId: "inst-1",
        entryType: "ALLOCATION",
        amount: -1500000n, // ₹15,000 paid
        entryDate: "2026-10-15",
      },
    ];

    const balance = deriveInstalmentBalance(sampleInstalment, entries, "2026-11-02");
    expect(balance.outstandingBalance).toBe(1500000n); // ₹15,000 remaining
    expect(balance.allocatedAmount).toBe(1500000n);
    expect(balance.daysOverdue).toBe(23); // 10 Oct to 2 Nov is 23 days
    expect(balance.status).toBe("OVERDUE");
    expect(balance.railSegment.state).toBe("part");
    expect(balance.railSegment.paidPct).toBe(50);
    expect(balance.railSegment.overdue).toBe(true);
  });

  it("calculates unpaid future instalment balance (STU-0219 Mohit Gurjar: 0 days overdue)", () => {
    const futureInstalment: DomainInstalment = {
      id: "inst-mohit-2",
      feePlanId: "plan-mohit",
      sequence: 2,
      dueDate: "2026-11-15",
      amount: 4000000n,
    };

    const entries: DomainLedgerEntry[] = [
      {
        id: "e-m2",
        studentId: "STU-0219",
        instalmentId: "inst-mohit-2",
        entryType: "CHARGE",
        amount: 4000000n,
        entryDate: "2026-11-15",
      },
    ];

    const balance = deriveInstalmentBalance(futureInstalment, entries, "2026-11-02");
    expect(balance.outstandingBalance).toBe(4000000n);
    expect(balance.allocatedAmount).toBe(0n);
    expect(balance.daysOverdue).toBe(0);
    expect(balance.status).toBe("UNPAID");
    expect(balance.railSegment.state).toBe("upcoming");
    expect(balance.railSegment.overdue).toBe(false);
  });

  it("derives complete student summary across 4 instalments", () => {
    const instalments: DomainInstalment[] = [
      { id: "i1", feePlanId: "p1", sequence: 1, dueDate: "2026-07-10", amount: 3000000n },
      { id: "i2", feePlanId: "p1", sequence: 2, dueDate: "2026-10-10", amount: 3000000n },
      { id: "i3", feePlanId: "p1", sequence: 3, dueDate: "2027-01-10", amount: 3000000n },
      { id: "i4", feePlanId: "p1", sequence: 4, dueDate: "2027-03-10", amount: 3000000n },
    ];

    const entries: DomainLedgerEntry[] = [
      { id: "c1", studentId: "s1", instalmentId: "i1", entryType: "CHARGE", amount: 3000000n, entryDate: "2026-07-10" },
      { id: "a1", studentId: "s1", instalmentId: "i1", entryType: "ALLOCATION", amount: -3000000n, entryDate: "2026-07-10" },
      { id: "c2", studentId: "s1", instalmentId: "i2", entryType: "CHARGE", amount: 3000000n, entryDate: "2026-10-10" },
      { id: "a2", studentId: "s1", instalmentId: "i2", entryType: "ALLOCATION", amount: -1500000n, entryDate: "2026-10-15" },
      { id: "c3", studentId: "s1", instalmentId: "i3", entryType: "CHARGE", amount: 3000000n, entryDate: "2027-01-10" },
      { id: "c4", studentId: "s1", instalmentId: "i4", entryType: "CHARGE", amount: 3000000n, entryDate: "2027-03-10" },
    ];

    const summary = deriveStudentLedgerSummary("s1", instalments, entries, "2026-11-02");
    expect(summary.totalBilled).toBe(12000000n); // ₹1,20,000
    expect(summary.totalPaid).toBe(4500000n); // ₹45,000
    expect(summary.totalOutstanding).toBe(7500000n); // ₹75,000
    expect(summary.maxDaysOverdue).toBe(23);
    expect(summary.overallStatus).toBe("OVERDUE");
  });

  it("handles approved discount and waivers correctly", () => {
    const entries: DomainLedgerEntry[] = [
      { id: "c1", studentId: "s2", instalmentId: "inst-1", entryType: "CHARGE", amount: 3000000n, entryDate: "2026-10-10" },
      { id: "d1", studentId: "s2", instalmentId: "inst-1", entryType: "DISCOUNT", amount: -500000n, entryDate: "2026-10-10" }, // ₹5,000 discount
      { id: "w1", studentId: "s2", instalmentId: "inst-1", entryType: "WAIVER", amount: -2500000n, entryDate: "2026-10-15" }, // ₹25,000 waiver
    ];

    const balance = deriveInstalmentBalance(sampleInstalment, entries, "2026-11-02");
    expect(balance.discountAmount).toBe(500000n);
    expect(balance.waivedAmount).toBe(2500000n);
    expect(balance.outstandingBalance).toBe(0n);
    expect(balance.status).toBe("WAIVED");
  });

  it("prevents over-allocation in ledger integrity validator", () => {
    const overAllocatedEntries: DomainLedgerEntry[] = [
      { id: "c1", studentId: "s3", instalmentId: "inst-1", entryType: "CHARGE", amount: 3000000n, entryDate: "2026-10-10" },
      { id: "a1", studentId: "s3", instalmentId: "inst-1", entryType: "ALLOCATION", amount: -3500000n, entryDate: "2026-10-10" },
    ];

    const validation = validateLedgerIntegrity(sampleInstalment, overAllocatedEntries);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("over-credited");
  });
});
