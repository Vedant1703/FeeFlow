import { describe, it, expect, beforeEach } from "vitest";
import { RefundService } from "@/application/services/refund-service";
import { MockRefundProvider } from "@/infrastructure/refunds/refund-provider";
import { Actor } from "@/application/actor";
import { demoPaymentStore } from "@/infrastructure/db/demo-payment-store";
import {
  calculateProRataRefund,
  planRefundItems,
  generateWithdrawalWaivers,
  validateMakerChecker,
} from "@/domain/refunds";
import { deriveInstalmentBalance } from "@/domain/ledger";

describe("Milestone 4A: Withdrawal & Refund Business Workflow (16 Scenarios)", () => {
  let refundService: RefundService;
  let mockProvider: MockRefundProvider;

  // Actors
  const directorActor: Actor = {
    userId: "usr_director_arvind",
    name: "Arvind Mathur",
    role: "DIRECTOR",
    centreIds: ["cen_vaishali", "cen_tonk", "cen_malviya", "cen_mansarovar"],
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  const accountsActorVaishali: Actor = {
    userId: "usr_accounts_neha",
    name: "Neha Verma",
    role: "ACCOUNTS",
    centreIds: ["cen_vaishali", "cen_malviya"],
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  const accountsActorOtherCentre: Actor = {
    userId: "usr_accounts_other",
    name: "Ramesh Sharma",
    role: "ACCOUNTS",
    centreIds: ["cen_mansarovar"], // Only Mansarovar
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  beforeEach(() => {
    demoPaymentStore.reset();
    demoPaymentStore.seedKavyaWithdrawalData();
    mockProvider = new MockRefundProvider();
    refundService = new RefundService(mockProvider);
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Full-payment statutory refund calculation & attribution
  // --------------------------------------------------------------------------
  it("Scenario 1: Full-payment statutory refund -> calculates pro-rata refund & plans multi-item attribution", () => {
    // S: 15 Jun 2026, E: 31 Mar 2027 (T = 290 days)
    // W: 28 Oct 2026 (c = 136 days)
    // N = ₹1,20,000 (12000000n), P = ₹1,20,000 (12000000n)
    // earned = roundHalfUp(12000000 * 136 / 290) = 5627586n (₹56,275.86)
    // potentialRefund = 12000000 - 5627586 = 6372414n (₹63,724.14)
    const calc = calculateProRataRefund({
      netFee: 12000000n,
      totalPaid: 12000000n,
      serviceStartDate: "2026-06-15",
      serviceEndDate: "2027-03-31",
      effectiveWithdrawalDate: "2026-10-28",
    });

    expect(calc.totalServiceDays).toBe(290);
    expect(calc.consumedDays).toBe(136);
    expect(calc.earnedFee).toBe(5627586n);
    expect(calc.potentialRefund).toBe(6372414n);
    expect(calc.indicativeShortfall).toBe(0n);

    // Plan attribution across 4 payments of ₹30,000 each (reverse-chronological)
    const payments = [
      { id: "pay_4", capturedAmount: 3000000n, alreadyRefundedAmount: 0n },
      { id: "pay_3", capturedAmount: 3000000n, alreadyRefundedAmount: 0n },
      { id: "pay_2", capturedAmount: 3000000n, alreadyRefundedAmount: 0n },
      { id: "pay_1", capturedAmount: 3000000n, alreadyRefundedAmount: 0n },
    ];

    const planned = planRefundItems(calc.potentialRefund, payments);
    expect(planned.length).toBe(4);
    expect(planned[0].allocatedRefundPaise).toBe(3000000n); // pay_4: ₹30,000.00
    expect(planned[1].allocatedRefundPaise).toBe(3000000n); // pay_3: ₹30,000.00
    expect(planned[2].allocatedRefundPaise).toBe(372414n); // pay_2: ₹3,724.14
    expect(planned[3].allocatedRefundPaise).toBe(0n); // pay_1: ₹0.00
    expect(
      planned.reduce((acc, p) => acc + p.allocatedRefundPaise, 0n)
    ).toBe(6372414n);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Partial-payment refund (part-paid extension)
  // --------------------------------------------------------------------------
  it("Scenario 2: Partial-payment refund -> calculates potential refund when P > earned", () => {
    // S: 15 Jun 2026, E: 31 Mar 2027 (T = 290)
    // W: 15 Jul 2026 -> c = 31 days
    // N = ₹1,20,000, P = ₹45,000 (4500000n)
    // earned = roundHalfUp(12000000 * 31 / 290) = 1282759n (₹12,827.59)
    // potentialRefund = 4500000 - 1282759 = 3217241n (₹32,172.41)
    const calc = calculateProRataRefund({
      netFee: 12000000n,
      totalPaid: 4500000n,
      serviceStartDate: "2026-06-15",
      serviceEndDate: "2027-03-31",
      effectiveWithdrawalDate: "2026-07-15",
    });

    expect(calc.consumedDays).toBe(31);
    expect(calc.earnedFee).toBe(1282759n);
    expect(calc.potentialRefund).toBe(3217241n);
    expect(calc.indicativeShortfall).toBe(0n);
    expect(calc.isShortfall).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Part-paid shortfall (informational only)
  // --------------------------------------------------------------------------
  it("Scenario 3: Part-paid shortfall -> strictly informational only, zero receivable debt", () => {
    // Ishita U1: N = 120,000, P = 45,000, W = 5 Nov 2026 (c = 144, T = 290)
    // earned = ₹59,586.21 (5958621n)
    // shortfall = 5958621 - 4500000 = 1458621n (₹14,586.21)
    const calc = calculateProRataRefund({
      netFee: 12000000n,
      totalPaid: 4500000n,
      serviceStartDate: "2026-06-15",
      serviceEndDate: "2027-03-31",
      effectiveWithdrawalDate: "2026-11-05",
    });

    expect(calc.consumedDays).toBe(144);
    expect(calc.earnedFee).toBe(5958621n);
    expect(calc.potentialRefund).toBe(0n);
    expect(calc.indicativeShortfall).toBe(1458621n);
    expect(calc.isShortfall).toBe(true);
    expect(calc.shortfallIsInformationalOnly).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Inclusive calendar service days
  // --------------------------------------------------------------------------
  it("Scenario 4: Inclusive calendar days -> T = days(E) - days(S) + 1", () => {
    // 1 Apr 2026 to 31 Mar 2027 -> 365 days
    const calcFullYear = calculateProRataRefund({
      netFee: 10000000n,
      totalPaid: 10000000n,
      serviceStartDate: "2026-04-01",
      serviceEndDate: "2027-03-31",
      effectiveWithdrawalDate: "2026-04-01",
    });
    expect(calcFullYear.totalServiceDays).toBe(365);
    expect(calcFullYear.consumedDays).toBe(1); // Day 1 inclusive

    // 15 Jun 2026 to 31 Mar 2027 -> 290 days
    const calcCoachingYear = calculateProRataRefund({
      netFee: 10000000n,
      totalPaid: 10000000n,
      serviceStartDate: "2026-06-15",
      serviceEndDate: "2027-03-31",
      effectiveWithdrawalDate: "2026-06-15",
    });
    expect(calcCoachingYear.totalServiceDays).toBe(290);
    expect(calcCoachingYear.consumedDays).toBe(1);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Commercial round-half-up calculations
  // --------------------------------------------------------------------------
  it("Scenario 5: Commercial round-half-up -> rounds half upwards in paise", () => {
    // 12000000 * 201 / 365 = 6608219.178... -> 6608219n paise
    const calc = calculateProRataRefund({
      netFee: 12000000n,
      totalPaid: 6000000n,
      serviceStartDate: "2026-04-01",
      serviceEndDate: "2027-03-31",
      effectiveWithdrawalDate: "2026-10-18",
    });
    expect(calc.consumedDays).toBe(201);
    expect(calc.earnedFee).toBe(6608219n);
    expect(calc.indicativeShortfall).toBe(608219n);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Boundary dates and clamping
  // --------------------------------------------------------------------------
  it("Scenario 6: Boundary dates -> c = 0 before start, c = T after end", () => {
    // Withdrawal before course start
    const beforeStart = calculateProRataRefund({
      netFee: 12000000n,
      totalPaid: 3000000n,
      serviceStartDate: "2026-06-15",
      serviceEndDate: "2027-03-31",
      effectiveWithdrawalDate: "2026-05-10",
    });
    expect(beforeStart.consumedDays).toBe(0);
    expect(beforeStart.earnedFee).toBe(0n);
    expect(beforeStart.potentialRefund).toBe(3000000n);

    // Withdrawal after course end
    const afterEnd = calculateProRataRefund({
      netFee: 12000000n,
      totalPaid: 12000000n,
      serviceStartDate: "2026-06-15",
      serviceEndDate: "2027-03-31",
      effectiveWithdrawalDate: "2027-05-01",
    });
    expect(afterEnd.consumedDays).toBe(290);
    expect(afterEnd.earnedFee).toBe(12000000n);
    expect(afterEnd.potentialRefund).toBe(0n);
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Refund policy version immutability and provenance tracking
  // --------------------------------------------------------------------------
  it("Scenario 7: Refund policy provenance -> v1.0, MoE 2024 compliance, deduction ₹0", async () => {
    const policy = await refundService.getRefundPolicy();
    expect(policy.version).toBe("v1.0");
    expect(policy.isActive).toBe(true);
    expect(policy.policyHash).toBe("7c3a88bf0a012d9e6e01a5b82098d41e739ad005fbcba72513a890989ad65e91");

    const json = JSON.parse(policy.policyJson);
    expect(json.rules).toContain("Inclusive calendar-day");
    expect(json.fixedDeductionPaise).toBe("0");
    expect(json.slaDays).toBe(10);
    expect(json.shortfallTreatment).toBe("INFORMATIONAL_ONLY");
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Maker-checker violation rejection
  // --------------------------------------------------------------------------
  it("Scenario 8: Maker-checker violation -> requester cannot approve own request (403)", async () => {
    // Attempting self-approval where approver === requester
    const check = validateMakerChecker("usr_director_arvind", "usr_director_arvind");
    expect(check.allowed).toBe(false);
    expect(check.error).toContain("Maker-checker violation");

    // In service review
    const withdrawal = demoPaymentStore.createWithdrawal({
      studentId: "stu_ishita_0587",
      requestDate: new Date(),
      effectiveWithdrawalDate: new Date("2026-11-05"),
      consumedDays: 144,
      totalServiceDays: 290,
      netFee: 12000000n,
      totalPaid: 4500000n,
      earnedFee: 5958621n,
      deductionAmount: 0n,
      potentialRefund: 0n,
      indicativeShortfall: 1458621n,
      slaTargetDate: new Date(),
      status: "REQUESTED",
      requesterId: directorActor.userId, // Director created request
      approvalNotes: "Self request",
    });

    await expect(
      refundService.reviewWithdrawal({
        withdrawalId: withdrawal.id,
        decision: "APPROVED",
        actor: directorActor, // Director tries to approve own request
      })
    ).rejects.toThrow(/Maker-checker violation/);
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Unauthorized non-director approval rejection
  // --------------------------------------------------------------------------
  it("Scenario 9: Unauthorized role -> ACCOUNTS role cannot approve or reject withdrawals", async () => {
    await expect(
      refundService.reviewWithdrawal({
        withdrawalId: "wd-001",
        decision: "APPROVED",
        actor: accountsActorVaishali, // Accounts role tries to approve
      })
    ).rejects.toThrow(/Unauthorized: Only Founder-Director can approve/);
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Duplicate approval prevention
  // --------------------------------------------------------------------------
  it("Scenario 10: Duplicate approval prevention -> cannot re-approve already APPROVED withdrawal", async () => {
    // wd-002 is already APPROVED in seed
    await expect(
      refundService.reviewWithdrawal({
        withdrawalId: "wd-002",
        decision: "APPROVED",
        actor: directorActor,
      })
    ).rejects.toThrow(/Withdrawal has already been approved/);
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Withdrawal rebase: ordinary remaining instalments waived to ₹0
  // --------------------------------------------------------------------------
  it("Scenario 11: Withdrawal rebase -> generates negative WAIVER entries and cancels instalments", async () => {
    // Create new withdrawal request for Ishita (requester = accounts)
    const withdrawal = demoPaymentStore.createWithdrawal({
      studentId: "stu_ishita_0587",
      requestDate: new Date("2026-11-02"),
      effectiveWithdrawalDate: new Date("2026-11-05"),
      consumedDays: 144,
      totalServiceDays: 290,
      netFee: 12000000n,
      totalPaid: 4500000n,
      earnedFee: 5958621n,
      deductionAmount: 0n,
      potentialRefund: 0n,
      indicativeShortfall: 1458621n,
      slaTargetDate: new Date(),
      status: "REQUESTED",
      requesterId: accountsActorVaishali.userId,
    });

    // Check outstanding before approval
    const inst2 = demoPaymentStore.instalments.get("inst_ishita_2")!;
    const bal2Before = deriveInstalmentBalance(
      inst2,
      demoPaymentStore.getStudentLedger("stu_ishita_0587"),
      new Date("2026-11-02")
    );
    expect(bal2Before.outstandingBalance).toBe(1500000n); // ₹15,000 outstanding

    // Director approves
    const reviewResult = await refundService.reviewWithdrawal({
      withdrawalId: withdrawal.id,
      decision: "APPROVED",
      actor: directorActor,
    });

    expect(reviewResult.status).toBe("APPROVED");

    // Verify WAIVER ledger entries in demo store
    const ledgersAfter = demoPaymentStore.getStudentLedger("stu_ishita_0587");
    const waivers = ledgersAfter.filter((l) => l.entryType === "WAIVER");
    expect(waivers.length).toBeGreaterThan(0);

    // Verify all waived instalments are now CANCELLED
    const inst2After = demoPaymentStore.instalments.get("inst_ishita_2")!;
    expect(inst2After.status).toBe("CANCELLED");

    // Balance after rebase must be ₹0
    const bal2After = deriveInstalmentBalance(inst2After, ledgersAfter, new Date());
    expect(bal2After.outstandingBalance).toBe(0n);
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Reminder suppression: queued reminders marked SKIPPED
  // --------------------------------------------------------------------------
  it("Scenario 12: Reminder suppression -> queued reminders marked SKIPPED on withdrawal", async () => {
    // Ishita has rem_ishita_inst2 in QUEUED status
    const rem = demoPaymentStore.reminders.find((r) => r.id === "rem_ishita_inst2");
    expect(rem).toBeDefined();

    const withdrawal = demoPaymentStore.createWithdrawal({
      studentId: "stu_ishita_0587",
      requestDate: new Date("2026-11-02"),
      effectiveWithdrawalDate: new Date("2026-11-05"),
      consumedDays: 144,
      totalServiceDays: 290,
      netFee: 12000000n,
      totalPaid: 4500000n,
      earnedFee: 5958621n,
      deductionAmount: 0n,
      potentialRefund: 0n,
      indicativeShortfall: 1458621n,
      slaTargetDate: new Date(),
      status: "REQUESTED",
      requesterId: accountsActorVaishali.userId,
    });

    await refundService.reviewWithdrawal({
      withdrawalId: withdrawal.id,
      decision: "APPROVED",
      actor: directorActor,
    });

    // Check reminder status
    const updatedRem = demoPaymentStore.reminders.find((r) => r.id === "rem_ishita_inst2");
    expect(updatedRem?.status).toBe("SKIPPED");
    expect(updatedRem?.skipReason).toContain("ordinary dues waived to ₹0");
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Over-refund prevention: items capped by unrefunded amount
  // --------------------------------------------------------------------------
  it("Scenario 13: Over-refund prevention -> fails if refund exceeds available unrefunded payments", () => {
    const payments = [
      { id: "pay_1", capturedAmount: 1000000n, alreadyRefundedAmount: 800000n }, // available 200,000 paise
    ];

    // Attempting to refund 300,000 paise when only 200,000 is available
    expect(() => planRefundItems(300000n, payments)).toThrow(
      /Insufficient captured payments to refund/
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 14: Duplicate refund execution rejection
  // --------------------------------------------------------------------------
  it("Scenario 14: Duplicate execution rejection -> cannot execute already SUCCEEDED refund item", async () => {
    // item-1 is SUCCEEDED in seed
    await expect(
      refundService.executeRefundItem({
        refundItemId: "item-1",
        actor: accountsActorVaishali,
      })
    ).rejects.toThrow(/Refund item has already succeeded/);
  });

  // --------------------------------------------------------------------------
  // Scenario 15: Refund item failure and retry execution
  // --------------------------------------------------------------------------
  it("Scenario 15: Failure and retry -> failed item can be retried and completes refund", async () => {
    // item-3 is FAILED in seed
    const item3 = demoPaymentStore.getRefundItem("item-3");
    expect(item3?.status).toBe("FAILED");

    // Retry item-3 with mock provider
    const retryResult = await refundService.executeRefundItem({
      refundItemId: "item-3",
      actor: accountsActorVaishali,
      forceStatus: "SUCCEEDED",
    });

    expect(retryResult.item.status).toBe("SUCCEEDED");
    expect(retryResult.item.providerRefundId).toMatch(/^rfnd_mock_/);

    // Also execute item-2 (which was PROCESSING) to confirm parent Refund transitions to COMPLETED
    await refundService.executeRefundItem({
      refundItemId: "item-2",
      actor: accountsActorVaishali,
      forceStatus: "SUCCEEDED",
    });

    const parentRefund = demoPaymentStore.getRefund("rfnd_kavya_1");
    expect(parentRefund?.status).toBe("COMPLETED");
  });

  // --------------------------------------------------------------------------
  // Scenario 16: Centre-level scoping enforcement
  // --------------------------------------------------------------------------
  it("Scenario 16: Centre scoping -> accounts cannot access or create requests for outside centres", async () => {
    // Ramesh Sharma has only Mansarovar (cen_mansarovar)
    // Ishita Sharma is at Vaishali Nagar (cen_vaishali)
    await expect(
      refundService.createWithdrawalRequest({
        studentId: "stu_ishita_0587",
        effectiveWithdrawalDate: "2026-11-05",
        actor: accountsActorOtherCentre, // Forbidden centre
      })
    ).rejects.toThrow(/Permission denied: Student is outside your assigned centre scope/);

    // Preview calculation also enforces centre scoping
    await expect(
      refundService.previewWithdrawalCalculation({
        studentId: "stu_ishita_0587",
        effectiveWithdrawalDate: "2026-11-05",
        actor: accountsActorOtherCentre,
      })
    ).rejects.toThrow(/Permission denied: Student is outside your assigned centre scope/);
  });
});

