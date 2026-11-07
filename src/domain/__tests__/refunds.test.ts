import { describe, it, expect } from "vitest";
import {
  calculateProRataRefund,
  planRefundItems,
  generateWithdrawalWaivers,
  validateMakerChecker,
} from "../refunds";

describe("Domain: refunds.ts — MoE 2024 Pro-Rata Math", () => {
  // Service Period for F1–F4: 1 Apr 2026 to 31 Mar 2027 (T = 365 inclusive calendar days), N = ₹1,20,000 (12000000n paise)
  const serviceStartF = "2026-04-01";
  const serviceEndF = "2027-03-31";
  const netFeeF = 12000000n; // ₹1,20,000

  it("calculates Golden Fixture F1 accurately (c = 73, refund = ₹36,000.00)", () => {
    // F1: Paid = ₹60,000, W = 12 Jun 2026 -> c = 73 days
    // earned = roundHalfUp(12000000 * 73 / 365) = 2400000n (₹24,000.00)
    // potentialRefund = ₹60,000 - ₹24,000 = ₹36,000.00 (3600000n)
    const res = calculateProRataRefund({
      netFee: netFeeF,
      totalPaid: 6000000n, // ₹60,000
      serviceStartDate: serviceStartF,
      serviceEndDate: serviceEndF,
      effectiveWithdrawalDate: "2026-06-12",
    });

    expect(res.totalServiceDays).toBe(365);
    expect(res.consumedDays).toBe(73);
    expect(res.earnedFee).toBe(2400000n);
    expect(res.potentialRefund).toBe(3600000n);
    expect(res.indicativeShortfall).toBe(0n);
    expect(res.isShortfall).toBe(false);
  });

  it("calculates Golden Fixture F2 accurately (c = 201, shortfall = ₹6,082.19 informational only)", () => {
    // F2: Paid = ₹60,000, W = 18 Oct 2026 -> c = 201 days
    // earned = roundHalfUp(12000000 * 201 / 365) = 6608219n (₹66,082.19)
    // indicativeShortfall = ₹66,082.19 - ₹60,000 = ₹6,082.19 (608219n)
    // Hard invariant: potentialRefund = 0, shortfallIsInformationalOnly = true
    const res = calculateProRataRefund({
      netFee: netFeeF,
      totalPaid: 6000000n, // ₹60,000
      serviceStartDate: serviceStartF,
      serviceEndDate: serviceEndF,
      effectiveWithdrawalDate: "2026-10-18",
    });

    expect(res.totalServiceDays).toBe(365);
    expect(res.consumedDays).toBe(201);
    expect(res.earnedFee).toBe(6608219n); // ₹66,082.19
    expect(res.potentialRefund).toBe(0n);
    expect(res.indicativeShortfall).toBe(608219n); // ₹6,082.19
    expect(res.isShortfall).toBe(true);
    expect(res.shortfallIsInformationalOnly).toBe(true);
  });

  it("calculates Golden Fixture F3 accurately (withdrawal before course start, c = 0, full refund)", () => {
    // F3: Paid = ₹30,000, W = 20 Mar 2026 (before 1 Apr start) -> c = 0
    // earned = ₹0.00, potentialRefund = ₹30,000.00
    const res = calculateProRataRefund({
      netFee: netFeeF,
      totalPaid: 3000000n,
      serviceStartDate: serviceStartF,
      serviceEndDate: serviceEndF,
      effectiveWithdrawalDate: "2026-03-20",
    });

    expect(res.consumedDays).toBe(0);
    expect(res.earnedFee).toBe(0n);
    expect(res.potentialRefund).toBe(3000000n);
    expect(res.indicativeShortfall).toBe(0n);
  });

  it("calculates Golden Fixture F4 accurately (withdrawal after course end, c = 365 clamped, zero refund)", () => {
    // F4: Paid = ₹1,20,000, W = 1 May 2027 (after 31 Mar end) -> c = 365 clamped
    // earned = ₹1,20,000.00, potentialRefund = ₹0
    const res = calculateProRataRefund({
      netFee: netFeeF,
      totalPaid: 12000000n,
      serviceStartDate: serviceStartF,
      serviceEndDate: serviceEndF,
      effectiveWithdrawalDate: "2027-05-01",
    });

    expect(res.consumedDays).toBe(365);
    expect(res.earnedFee).toBe(12000000n);
    expect(res.potentialRefund).toBe(0n);
    expect(res.indicativeShortfall).toBe(0n);
  });

  // UI Fixtures: 15 Jun 2026 to 31 Mar 2027 (T = 290 inclusive days), N = ₹1,20,000
  const serviceStartUI = "2026-06-15";
  const serviceEndUI = "2027-03-31";
  const netFeeUI = 12000000n;

  it("calculates UI Fixture U1 accurately (STU-0587 Ishita Sharma: c = 144, shortfall = ₹14,586.21)", () => {
    // U1: Paid = ₹45,000, W = 5 Nov 2026 -> c = 144 days
    // earned = roundHalfUp(12000000 * 144 / 290) = 5958621n (₹59,586.21)
    // shortfall = ₹59,586.21 - ₹45,000 = ₹14,586.21 (1458621n)
    const res = calculateProRataRefund({
      netFee: netFeeUI,
      totalPaid: 4500000n, // ₹45,000 paid
      serviceStartDate: serviceStartUI,
      serviceEndDate: serviceEndUI,
      effectiveWithdrawalDate: "2026-11-05",
    });

    expect(res.totalServiceDays).toBe(290);
    expect(res.consumedDays).toBe(144);
    expect(res.earnedFee).toBe(5958621n);
    expect(res.potentialRefund).toBe(0n);
    expect(res.indicativeShortfall).toBe(1458621n);
    expect(res.shortfallIsInformationalOnly).toBe(true);
  });

  it("calculates UI Fixture U2 accurately (STU-1038 Kavya Rathore: c = 136, refund = ₹63,724.14)", () => {
    // U2: Paid = ₹1,20,000, W = 28 Oct 2026 -> c = 136 days
    // earned = roundHalfUp(12000000 * 136 / 290) = 5627586n (₹56,275.86)
    // potentialRefund = ₹1,20,000 - ₹56,275.86 = ₹63,724.14 (6372414n)
    const res = calculateProRataRefund({
      netFee: netFeeUI,
      totalPaid: 12000000n, // ₹1,20,000 paid
      serviceStartDate: serviceStartUI,
      serviceEndDate: serviceEndUI,
      effectiveWithdrawalDate: "2026-10-28",
    });

    expect(res.totalServiceDays).toBe(290);
    expect(res.consumedDays).toBe(136);
    expect(res.earnedFee).toBe(5627586n);
    expect(res.potentialRefund).toBe(6372414n);
    expect(res.indicativeShortfall).toBe(0n);
  });

  it("plans refund items across captured payments (U2: ₹30k + ₹30k + ₹3,724.14)", () => {
    // 4 captured payments of ₹30,000 each
    const payments = [
      { id: "p4", capturedAmount: 3000000n, alreadyRefundedAmount: 0n },
      { id: "p3", capturedAmount: 3000000n, alreadyRefundedAmount: 0n },
      { id: "p2", capturedAmount: 3000000n, alreadyRefundedAmount: 0n },
      { id: "p1", capturedAmount: 3000000n, alreadyRefundedAmount: 0n },
    ];

    const refundPlan = planRefundItems(6372414n, payments);
    expect(refundPlan).toHaveLength(4);
    expect(refundPlan[0].allocatedRefundPaise).toBe(3000000n); // Item 1: ₹30,000
    expect(refundPlan[1].allocatedRefundPaise).toBe(3000000n); // Item 2: ₹30,000
    expect(refundPlan[2].allocatedRefundPaise).toBe(372414n); // Item 3: ₹3,724.14
    expect(refundPlan[3].allocatedRefundPaise).toBe(0n); // Item 4: ₹0
  });

  it("generates waiver entries for unpaid instalments on withdrawal approval", () => {
    const instalments = [
      { id: "i1", sequence: 1, outstandingBalance: 0n },
      { id: "i2", sequence: 2, outstandingBalance: 1500000n }, // ₹15,000 part-paid remaining
      { id: "i3", sequence: 3, outstandingBalance: 3000000n }, // ₹30,000 unpaid
      { id: "i4", sequence: 4, outstandingBalance: 3000000n }, // ₹30,000 unpaid
    ];

    const waivers = generateWithdrawalWaivers("STU-0587", "w-123", instalments, "2026-11-05");
    expect(waivers).toHaveLength(3); // i2, i3, i4
    expect(waivers[0].amount).toBe(-1500000n);
    expect(waivers[1].amount).toBe(-3000000n);
    expect(waivers[2].amount).toBe(-3000000n);
    expect(waivers.every((w) => w.entryType === "WAIVER")).toBe(true);
  });

  it("strictly enforces maker-checker validation (requester !== approver)", () => {
    // Same user: rejected
    const invalidSelfApproval = validateMakerChecker("user-neha", "user-neha");
    expect(invalidSelfApproval.allowed).toBe(false);
    expect(invalidSelfApproval.error).toContain("Maker-checker violation");

    // Different users (Accounts Neha requested, Director Arvind approved): allowed
    const validApproval = validateMakerChecker("user-neha", "user-arvind");
    expect(validApproval.allowed).toBe(true);
  });
});

