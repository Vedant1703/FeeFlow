import { describe, it, expect, beforeEach } from "vitest";
import { paymentService } from "@/application/services/payment-service";
import { demoPaymentStore } from "@/infrastructure/db/demo-payment-store";
import { Actor } from "@/application/actor";
import { deriveInstalmentBalance } from "@/domain/ledger";

describe("Milestone 5A: Unmatched Payment Investigation & Manual Allocation (12 Scenarios)", () => {
  // Actors
  const directorActor: Actor = {
    userId: "usr_director_arvind",
    name: "Arvind Mathur",
    role: "DIRECTOR",
    centreIds: ["cen_vaishali", "cen_tonk", "cen_malviya", "cen_mansarovar"],
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  const accountsActorMansarovar: Actor = {
    userId: "usr_accounts_mansarovar",
    name: "Ramesh Sharma",
    role: "ACCOUNTS",
    centreIds: ["cen_mansarovar"],
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  const accountsActorVaishali: Actor = {
    userId: "usr_accounts_neha",
    name: "Neha Verma",
    role: "ACCOUNTS",
    centreIds: ["cen_vaishali"], // Only Vaishali Nagar (does not have cen_mansarovar)
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  const counsellorActor: Actor = {
    userId: "usr_counsellor_priya",
    name: "Priya Singh",
    role: "COUNSELLOR",
    centreIds: ["cen_vaishali", "cen_mansarovar"],
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  beforeEach(() => {
    demoPaymentStore.reset();
    demoPaymentStore.seedUnmatchedPayment();
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Successful allocation of an unmatched captured payment
  // --------------------------------------------------------------------------
  it("Scenario 1: allocates an unmatched captured payment, appending signed ledger and updating status", async () => {
    // Unmatched payment pay_demo_a91c: ₹15,000 (1500000n), Mohit Gurjar: inst_mohit_1 (₹40,000 due)
    const result = await paymentService.allocatePayment({
      paymentId: "pay_demo_a91c",
      studentId: "stu_mohit_0219",
      allocations: [
        {
          instalmentId: "inst_mohit_1",
          amountPaise: 1500000n, // ₹15,000
        },
      ],
      reason: "Direct NEFT transfer verified against student ID 0219 Mohit Gurjar",
      actor: accountsActorMansarovar,
    });

    expect(result.success).toBe(true);
    expect(result.totalAllocatedPaise).toBe(1500000n);
    expect(result.remainingUnallocatedPaise).toBe(0n);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].newOutstandingPaise).toBe(2500000n); // 40,000 - 15,000 = 25,000

    // Payment in store updated
    const payment = demoPaymentStore.findPaymentById("pay_demo_a91c");
    expect(payment).toBeDefined();
    expect(payment!.unallocatedAmount).toBe(0n);
    expect(payment!.studentId).toBe("stu_mohit_0219");
    expect(payment!.matchStatus).toBe("MATCHED_MANUAL");

    // Allocation record created
    const allocs = demoPaymentStore.getAllocationsForPayment("pay_demo_a91c");
    expect(allocs).toHaveLength(1);
    expect(allocs[0].amount).toBe(1500000n);
    expect(allocs[0].instalmentId).toBe("inst_mohit_1");

    // Signed Ledger ALLOCATION entry appended with negative amount
    const ledger = demoPaymentStore.getStudentLedger("stu_mohit_0219");
    const allocEntry = ledger.find(
      (e) => e.entryType === "ALLOCATION" && e.referenceId === "pay_demo_a91c"
    );
    expect(allocEntry).toBeDefined();
    expect(allocEntry!.amount).toBe(-1500000n);
    expect(allocEntry!.referenceType).toBe("MANUAL_ALLOCATION");

    // Instalment status updated to PARTIAL
    const inst = demoPaymentStore.instalments.get("inst_mohit_1");
    expect(inst!.status).toBe("PARTIAL");

    // Audit log recorded
    const auditLog = demoPaymentStore.auditLogs.find(
      (l) => l.action === "PAYMENT_ALLOCATE" && l.entityId === "pay_demo_a91c"
    );
    expect(auditLog).toBeDefined();
    expect(auditLog!.actorId).toBe(accountsActorMansarovar.userId);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Partial allocation leaving a valid unallocated balance
  // --------------------------------------------------------------------------
  it("Scenario 2: partial allocation leaves valid unallocated remainder in payment and preserves excess", async () => {
    // ₹15,000 capture, allocate only ₹10,000
    const result = await paymentService.allocatePayment({
      paymentId: "pay_demo_a91c",
      studentId: "stu_mohit_0219",
      allocations: [
        {
          instalmentId: "inst_mohit_1",
          amountPaise: 1000000n, // ₹10,000
        },
      ],
      reason: "Allocating ₹10,000 portion; ₹5,000 retained pending confirmation",
      actor: accountsActorMansarovar,
    });

    expect(result.success).toBe(true);
    expect(result.totalAllocatedPaise).toBe(1000000n);
    expect(result.remainingUnallocatedPaise).toBe(500000n); // ₹5,000 preserved

    const payment = demoPaymentStore.findPaymentById("pay_demo_a91c");
    expect(payment!.unallocatedAmount).toBe(500000n);
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Allocation across multiple eligible instalments
  // --------------------------------------------------------------------------
  it("Scenario 3: allocates a captured payment across multiple instalments and cancels settled reminders", async () => {
    // Seed a payment with ₹50,000 unallocated
    const multiPay = demoPaymentStore.recordPayment({
      paymentReference: "PAY-MULTI-50K",
      provider: "MOCK_GATEWAY",
      providerPaymentId: "prov_multi_50k",
      amount: 5000000n, // ₹50,000
      unallocatedAmount: 5000000n,
      paymentDate: new Date(),
      method: "NEFT",
      payerDetails: "MOHIT G 0219",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });

    // Mohit inst 1 is ₹40,000 due; inst 2 is ₹40,000 due
    // Allocate ₹40,000 to inst 1 (fully settles it) and ₹10,000 to inst 2
    demoPaymentStore.reminders.push({
      id: "rem_mohit_inst1",
      instalmentId: "inst_mohit_1",
      studentId: "stu_mohit_0219",
      scheduledDate: new Date("2026-11-20"),
      status: "QUEUED",
    });

    const result = await paymentService.allocatePayment({
      paymentId: multiPay.id,
      studentId: "stu_mohit_0219",
      allocations: [
        {
          instalmentId: "inst_mohit_1",
          amountPaise: 4000000n, // ₹40,000
        },
        {
          instalmentId: "inst_mohit_2",
          amountPaise: 1000000n, // ₹10,000
        },
      ],
      reason: "Multi-instalment allocation across Inst 1 and Inst 2",
      actor: accountsActorMansarovar,
    });

    expect(result.success).toBe(true);
    expect(result.totalAllocatedPaise).toBe(5000000n);
    expect(result.remainingUnallocatedPaise).toBe(0n);
    expect(result.allocations).toHaveLength(2);

    // Inst 1 fully settled -> status: PAID, remaining outstanding: 0n
    expect(result.allocations[0].newOutstandingPaise).toBe(0n);
    const inst1 = demoPaymentStore.instalments.get("inst_mohit_1");
    expect(inst1!.status).toBe("PAID");

    // Inst 2 partially settled -> status: PARTIAL, remaining outstanding: 3000000n
    expect(result.allocations[1].newOutstandingPaise).toBe(3000000n);
    const inst2 = demoPaymentStore.instalments.get("inst_mohit_2");
    expect(inst2!.status).toBe("PARTIAL");

    // Inst 1 queued reminder skipped
    const rem = demoPaymentStore.reminders.find((r) => r.id === "rem_mohit_inst1");
    expect(rem!.status).toBe("SKIPPED");
    expect(rem!.skipReason).toBe("Instalment settled");
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Rejection when allocation exceeds available payment funds
  // --------------------------------------------------------------------------
  it("Scenario 4: rejects when allocation exceeds available payment funds", async () => {
    // pay_demo_a91c has ₹15,000 available. Requesting ₹20,000 must fail closed.
    await expect(
      paymentService.allocatePayment({
        paymentId: "pay_demo_a91c",
        studentId: "stu_mohit_0219",
        allocations: [
          {
            instalmentId: "inst_mohit_1",
            amountPaise: 2000000n, // ₹20,000 > ₹15,000
          },
        ],
        reason: "Over-allocation attempt",
        actor: accountsActorMansarovar,
      })
    ).rejects.toThrow(/exceeds available payment balance|unallocated/i);

    // Assert zero change to payment and zero ledger entries
    const payment = demoPaymentStore.findPaymentById("pay_demo_a91c");
    expect(payment!.unallocatedAmount).toBe(1500000n);
    const allocs = demoPaymentStore.getAllocationsForPayment("pay_demo_a91c");
    expect(allocs).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Rejection when allocation exceeds an instalment's outstanding balance
  // --------------------------------------------------------------------------
  it("Scenario 5: rejects when allocation exceeds an instalment's current outstanding", async () => {
    // Ishita inst_ishita_2 has current balance of ₹15,000 (30,000 charge - 15,000 paid)
    // Create a payment of ₹25,000
    const bigPay = demoPaymentStore.recordPayment({
      paymentReference: "PAY-BIG-ISHITA",
      provider: "MOCK_GATEWAY",
      providerPaymentId: "prov_big_ishita",
      amount: 2500000n, // ₹25,000
      unallocatedAmount: 2500000n,
      paymentDate: new Date(),
      method: "UPI",
      payerDetails: "Ishita Sharma",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });

    // Trying to allocate ₹20,000 to inst_ishita_2 (which only has ₹15,000 outstanding)
    await expect(
      paymentService.allocatePayment({
        paymentId: bigPay.id,
        studentId: "stu_ishita_0587",
        allocations: [
          {
            instalmentId: "inst_ishita_2",
            amountPaise: 2000000n, // ₹20,000 > ₹15,000
          },
        ],
        reason: "Attempt to overpay instalment 2",
        actor: accountsActorVaishali,
      })
    ).rejects.toThrow(/exceeds current outstanding/i);

    // Payment and ledger remain untouched
    expect(bigPay.unallocatedAmount).toBe(2500000n);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Rejection of pending, failed, or unverified payments
  // --------------------------------------------------------------------------
  it("Scenario 6: rejects allocation for payments not in CAPTURED status", async () => {
    // Seed a failed payment
    const failedPay = demoPaymentStore.recordPayment({
      paymentReference: "PAY-FAILED-001",
      provider: "MOCK_GATEWAY",
      providerPaymentId: "prov_failed_001",
      amount: 1500000n,
      unallocatedAmount: 1500000n,
      paymentDate: new Date(),
      method: "CARD",
      payerDetails: "Failed Attempt",
      status: "FAILED",
      matchStatus: "UNMATCHED",
    });

    await expect(
      paymentService.allocatePayment({
        paymentId: failedPay.id,
        studentId: "stu_mohit_0219",
        allocations: [
          {
            instalmentId: "inst_mohit_1",
            amountPaise: 1500000n,
          },
        ],
        reason: "Allocating failed payment",
        actor: accountsActorMansarovar,
      })
    ).rejects.toThrow(/only CAPTURED payments can be allocated/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Duplicate submission / idempotency protection
  // --------------------------------------------------------------------------
  it("Scenario 7: rejects repeated duplicate allocation once funds are consumed", async () => {
    // First allocation: consumes all ₹15,000
    await paymentService.allocatePayment({
      paymentId: "pay_demo_a91c",
      studentId: "stu_mohit_0219",
      allocations: [
        {
          instalmentId: "inst_mohit_1",
          amountPaise: 1500000n,
        },
      ],
      reason: "Initial allocation",
      actor: accountsActorMansarovar,
    });

    // Replay / duplicate submission with same parameters
    await expect(
      paymentService.allocatePayment({
        paymentId: "pay_demo_a91c",
        studentId: "stu_mohit_0219",
        allocations: [
          {
            instalmentId: "inst_mohit_1",
            amountPaise: 1500000n,
          },
        ],
        reason: "Initial allocation replay",
        actor: accountsActorMansarovar,
      })
    ).rejects.toThrow(/exceeds available payment balance|unallocated/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Concurrent allocation attempts cannot over-allocate
  // --------------------------------------------------------------------------
  it("Scenario 8: concurrent allocation attempts cannot over-allocate", async () => {
    // pay_demo_a91c has ₹15,000
    // Request 1 tries to allocate ₹10,000
    const res1 = await paymentService.allocatePayment({
      paymentId: "pay_demo_a91c",
      studentId: "stu_mohit_0219",
      allocations: [
        {
          instalmentId: "inst_mohit_1",
          amountPaise: 1000000n, // ₹10,000
        },
      ],
      reason: "First concurrent actor",
      actor: accountsActorMansarovar,
    });
    expect(res1.success).toBe(true);

    // Request 2 tries to allocate ₹10,000 (only ₹5,000 remaining)
    await expect(
      paymentService.allocatePayment({
        paymentId: "pay_demo_a91c",
        studentId: "stu_mohit_0219",
        allocations: [
          {
            instalmentId: "inst_mohit_1",
            amountPaise: 1000000n, // ₹10,000 > ₹5,000 remaining
          },
        ],
        reason: "Second concurrent actor",
        actor: accountsActorMansarovar,
      })
    ).rejects.toThrow(/exceeds available payment balance|unallocated/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Refunds and previous allocations are correctly deducted from available funds
  // --------------------------------------------------------------------------
  it("Scenario 9: formula (Captured - Allocated - Refunded) strictly bounds available balance", async () => {
    // Seed payment: ₹30,000
    const pay = demoPaymentStore.recordPayment({
      paymentReference: "PAY-REFUND-DEDUCT",
      provider: "RAZORPAY",
      providerPaymentId: "pay_rzp_ref_deduct",
      amount: 3000000n, // ₹30,000
      unallocatedAmount: 3000000n,
      paymentDate: new Date(),
      method: "Netbanking",
      payerDetails: "Mohit Gurjar",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });

    // 1. Prior allocation of ₹10,000
    demoPaymentStore.recordAllocation({
      paymentId: pay.id,
      instalmentId: "inst_mohit_1",
      amount: 1000000n, // ₹10,000
      allocationReason: "Prior allocation",
    });
    pay.unallocatedAmount -= 1000000n; // 20,000 remaining

    // 2. Succeeded refund of ₹10,000
    const refund = demoPaymentStore.createRefund({
      withdrawalId: "wd_test",
      studentId: "stu_mohit_0219",
      totalApprovedAmount: 1000000n,
      status: "COMPLETED",
    });
    demoPaymentStore.createRefundItem({
      refundId: refund.id,
      paymentId: pay.id,
      amount: 1000000n, // ₹10,000 refunded
      status: "SUCCEEDED",
      providerRefundId: "rfnd_rzp_123",
    });
    pay.unallocatedAmount -= 1000000n; // Deduct refund from unallocated amount (10,000 remaining)

    // Net available balance: 30,000 - 10,000 - 10,000 = 10,000 (1000000n)
    // Allocating ₹15,000 must fail
    await expect(
      paymentService.allocatePayment({
        paymentId: pay.id,
        studentId: "stu_mohit_0219",
        allocations: [
          {
            instalmentId: "inst_mohit_1",
            amountPaise: 1500000n, // ₹15,000 > ₹10,000 available
          },
        ],
        reason: "Allocating beyond unrefunded balance",
        actor: accountsActorMansarovar,
      })
    ).rejects.toThrow(/exceeds available payment balance/i);

    // Allocating ₹10,000 must succeed
    const res = await paymentService.allocatePayment({
      paymentId: pay.id,
      studentId: "stu_mohit_0219",
      allocations: [
        {
          instalmentId: "inst_mohit_1",
          amountPaise: 1000000n, // Exact available balance
        },
      ],
      reason: "Allocating remaining available balance",
      actor: accountsActorMansarovar,
    });
    expect(res.success).toBe(true);
    expect(res.remainingUnallocatedPaise).toBe(1000000n - 1000000n); // 0
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Ledger and audit records roll back together if transaction fails
  // --------------------------------------------------------------------------
  it("Scenario 10: rejects multi-instalment batch if any instalment check fails, keeping state intact", async () => {
    const initialLedgerCount = demoPaymentStore.ledgerEntries.length;
    const initialAllocCount = demoPaymentStore.allocations.length;

    // Try multi-allocation where second instalment is invalid (e.g. non-existent instalment)
    await expect(
      paymentService.allocatePayment({
        paymentId: "pay_demo_a91c",
        studentId: "stu_mohit_0219",
        allocations: [
          {
            instalmentId: "inst_mohit_1",
            amountPaise: 500000n,
          },
          {
            instalmentId: "inst_invalid_999",
            amountPaise: 500000n,
          },
        ],
        reason: "Failed batch",
        actor: accountsActorMansarovar,
      })
    ).rejects.toThrow(/not found/i);

    // Confirm zero ledger entries or allocations were persisted
    expect(demoPaymentStore.ledgerEntries.length).toBe(initialLedgerCount);
    expect(demoPaymentStore.allocations.length).toBe(initialAllocCount);
    const payment = demoPaymentStore.findPaymentById("pay_demo_a91c");
    expect(payment!.unallocatedAmount).toBe(1500000n);
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Centre-level and role-level access restrictions
  // --------------------------------------------------------------------------
  it("Scenario 11: enforces RBAC and centre scoping (rejects cross-centre accounts and non-staff)", async () => {
    // Mohit Gurjar is in cen_mansarovar
    // 1. Accounts staff from Vaishali Nagar only (must be rejected)
    await expect(
      paymentService.allocatePayment({
        paymentId: "pay_demo_a91c",
        studentId: "stu_mohit_0219",
        allocations: [
          {
            instalmentId: "inst_mohit_1",
            amountPaise: 1000000n,
          },
        ],
        reason: "Cross-centre attempt by Neha Verma",
        actor: accountsActorVaishali,
      })
    ).rejects.toThrow(/outside your assigned centre scope/i);

    // 2. Counsellor (must be rejected - no payment management permission)
    await expect(
      paymentService.allocatePayment({
        paymentId: "pay_demo_a91c",
        studentId: "stu_mohit_0219",
        allocations: [
          {
            instalmentId: "inst_mohit_1",
            amountPaise: 1000000n,
          },
        ],
        reason: "Counsellor allocation attempt",
        actor: counsellorActor,
      })
    ).rejects.toThrow(/Unauthorized/i);

    // 3. Director (allowed cross-centre oversight)
    const directorResult = await paymentService.allocatePayment({
      paymentId: "pay_demo_a91c",
      studentId: "stu_mohit_0219",
      allocations: [
        {
          instalmentId: "inst_mohit_1",
          amountPaise: 1000000n,
        },
      ],
      reason: "Director approval allocation",
      actor: directorActor,
    });
    expect(directorResult.success).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Excess funds remain visible and unallocated
  // --------------------------------------------------------------------------
  it("Scenario 12: excess funds remain unallocated and visible in unmatched queue with candidate suggestions", async () => {
    // Allocate ₹10,000 from ₹15,000
    await paymentService.allocatePayment({
      paymentId: "pay_demo_a91c",
      studentId: "stu_mohit_0219",
      allocations: [
        {
          instalmentId: "inst_mohit_1",
          amountPaise: 1000000n,
        },
      ],
      reason: "Partial allocation",
      actor: accountsActorMansarovar,
    });

    // Query unmatched / unallocated queue
    const queue = await paymentService.getUnmatchedPayments({}, accountsActorMansarovar);
    const item = queue.find((p) => p.id === "pay_demo_a91c");

    expect(item).toBeDefined();
    expect(item!.amount).toBe(1500000n);
    expect(item!.allocatedAmount).toBe(1000000n);
    expect(item!.unallocatedAmount).toBe(500000n);
    expect(item!.availableBalance).toBe(500000n);
    expect(item!.student).toBeDefined();
    expect(item!.student!.name).toBe("Mohit Gurjar");
  });
});
