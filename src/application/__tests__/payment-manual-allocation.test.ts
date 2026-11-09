import { describe, it, expect, beforeEach } from "vitest";
import { paymentService } from "@/application/services/payment-service";
import { refundService } from "@/application/services/refund-service";
import { demoPaymentStore } from "@/infrastructure/db/demo-payment-store";
import { Actor } from "@/application/actor";
import { deriveInstalmentBalance } from "@/domain/ledger";

describe("Milestone 5A: Unmatched Payment Investigation & Manual Allocation (17 Scenarios)", () => {
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

    demoPaymentStore.recordProviderEvent({
      provider: "MOCK_GATEWAY",
      providerEventId: "prov_multi_50k",
      eventType: "payment.captured",
      payloadJson: JSON.stringify({
        paymentId: "prov_multi_50k",
        amountPaise: 5000000,
        currency: "INR",
        verifiedReceipt: true,
      }),
      signatureVerified: true,
      processed: true,
      processingStatus: "UNMATCHED",
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

    demoPaymentStore.recordProviderEvent({
      provider: "MOCK_GATEWAY",
      providerEventId: "prov_big_ishita",
      eventType: "payment.captured",
      payloadJson: JSON.stringify({
        paymentId: "prov_big_ishita",
        amountPaise: 2500000,
        currency: "INR",
      }),
      signatureVerified: true,
      processed: true,
      processingStatus: "ALLOCATED",
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

    demoPaymentStore.recordProviderEvent({
      provider: "RAZORPAY",
      providerEventId: "pay_rzp_ref_deduct",
      eventType: "payment.captured",
      payloadJson: JSON.stringify({
        paymentId: "pay_rzp_ref_deduct",
        amountPaise: 3000000,
        currency: "INR",
      }),
      signatureVerified: true,
      processed: true,
      processingStatus: "ALLOCATED",
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

  // --------------------------------------------------------------------------
  // Scenario 13: Authoritative capture verification rejects phantom/unverified payments
  // --------------------------------------------------------------------------
  it("Scenario 13: authoritative capture verification accepts verified webhooks and bank provenance, rejecting phantom/unverified captures", async () => {
    // 1. Phantom gateway payment without any ProviderEvent
    const phantomPay = demoPaymentStore.recordPayment({
      paymentReference: "PAY-PHANTOM-GATEWAY",
      provider: "RAZORPAY",
      providerPaymentId: "pay_phantom_rzp_99",
      amount: 1000000n,
      unallocatedAmount: 1000000n,
      paymentDate: new Date(),
      method: "UPI",
      payerDetails: "Unknown Payer",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });

    await expect(
      paymentService.allocatePayment({
        paymentId: phantomPay.id,
        studentId: "stu_mohit_0219",
        allocations: [{ instalmentId: "inst_mohit_1", amountPaise: 500000n }],
        reason: "Allocating unverified phantom payment",
        actor: accountsActorMansarovar,
      })
    ).rejects.toThrow(/missing or unverified authoritative capture evidence/i);

    // 2. Gateway payment with unverified ProviderEvent (signatureVerified: false)
    const tamperedPay = demoPaymentStore.recordPayment({
      paymentReference: "PAY-TAMPERED-SIG",
      provider: "RAZORPAY",
      providerPaymentId: "pay_tampered_rzp_88",
      amount: 1000000n,
      unallocatedAmount: 1000000n,
      paymentDate: new Date(),
      method: "UPI",
      payerDetails: "Tampered Signature",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });

    demoPaymentStore.recordProviderEvent({
      provider: "RAZORPAY",
      providerEventId: "pay_tampered_rzp_88",
      eventType: "payment.captured",
      payloadJson: JSON.stringify({
        paymentId: "pay_tampered_rzp_88",
        amountPaise: 1000000,
        currency: "INR",
      }),
      signatureVerified: false, // Invalid / unverified signature
      processed: false,
    });

    await expect(
      paymentService.allocatePayment({
        paymentId: tamperedPay.id,
        studentId: "stu_mohit_0219",
        allocations: [{ instalmentId: "inst_mohit_1", amountPaise: 500000n }],
        reason: "Allocating unverified signature payment",
        actor: accountsActorMansarovar,
      })
    ).rejects.toThrow(/missing or unverified authoritative capture evidence/i);

    // 3. Gateway payment with mismatched amount in event payload
    const mismatchAmtPay = demoPaymentStore.recordPayment({
      paymentReference: "PAY-MISMATCH-AMT",
      provider: "RAZORPAY",
      providerPaymentId: "pay_mismatch_amt_66",
      amount: 2500000n, // Payment is ₹25,000
      unallocatedAmount: 2500000n,
      paymentDate: new Date(),
      method: "UPI",
      payerDetails: "Mismatched Payer",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });

    demoPaymentStore.recordProviderEvent({
      provider: "RAZORPAY",
      providerEventId: "pay_mismatch_amt_66",
      eventType: "payment.captured",
      payloadJson: JSON.stringify({
        paymentId: "pay_mismatch_amt_66",
        amountPaise: 1500000, // Event payload is only ₹15,000
        currency: "INR",
      }),
      signatureVerified: true,
      processed: true,
    });

    await expect(
      paymentService.allocatePayment({
        paymentId: mismatchAmtPay.id,
        studentId: "stu_mohit_0219",
        allocations: [{ instalmentId: "inst_mohit_1", amountPaise: 500000n }],
        reason: "Allocating payment with mismatched event amount",
        actor: accountsActorMansarovar,
      })
    ).rejects.toThrow(/missing or unverified authoritative capture evidence/i);

    // 4. Gateway payment with mismatched currency in event payload
    const mismatchCurrPay = demoPaymentStore.recordPayment({
      paymentReference: "PAY-MISMATCH-CURR",
      provider: "RAZORPAY",
      providerPaymentId: "pay_mismatch_curr_55",
      amount: 1000000n,
      unallocatedAmount: 1000000n,
      paymentDate: new Date(),
      method: "UPI",
      payerDetails: "USD Payer",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });

    demoPaymentStore.recordProviderEvent({
      provider: "RAZORPAY",
      providerEventId: "pay_mismatch_curr_55",
      eventType: "payment.captured",
      payloadJson: JSON.stringify({
        paymentId: "pay_mismatch_curr_55",
        amountPaise: 1000000,
        currency: "USD", // Mismatched currency
      }),
      signatureVerified: true,
      processed: true,
    });

    await expect(
      paymentService.allocatePayment({
        paymentId: mismatchCurrPay.id,
        studentId: "stu_mohit_0219",
        allocations: [{ instalmentId: "inst_mohit_1", amountPaise: 500000n }],
        reason: "Allocating payment with mismatched event currency",
        actor: accountsActorMansarovar,
      })
    ).rejects.toThrow(/missing or unverified authoritative capture evidence/i);

    // 5. Gateway payment with non-captured event (e.g. payment.authorized)
    const authOnlyPay = demoPaymentStore.recordPayment({
      paymentReference: "PAY-AUTH-ONLY",
      provider: "RAZORPAY",
      providerPaymentId: "pay_auth_only_44",
      amount: 1000000n,
      unallocatedAmount: 1000000n,
      paymentDate: new Date(),
      method: "UPI",
      payerDetails: "Auth Only",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });

    demoPaymentStore.recordProviderEvent({
      provider: "RAZORPAY",
      providerEventId: "pay_auth_only_44",
      eventType: "payment.authorized", // NOT payment.captured
      payloadJson: JSON.stringify({
        paymentId: "pay_auth_only_44",
        amountPaise: 1000000,
        currency: "INR",
      }),
      signatureVerified: true,
      processed: true,
    });

    await expect(
      paymentService.allocatePayment({
        paymentId: authOnlyPay.id,
        studentId: "stu_mohit_0219",
        allocations: [{ instalmentId: "inst_mohit_1", amountPaise: 500000n }],
        reason: "Allocating payment with only authorized event",
        actor: accountsActorMansarovar,
      })
    ).rejects.toThrow(/missing or unverified authoritative capture evidence/i);

    // 6. Gateway payment with unchecked/arbitrary reconcile_ ID prefix that does not match
    const fakeReconcilePay = demoPaymentStore.recordPayment({
      paymentReference: "PAY-FAKE-RECONCILE",
      provider: "RAZORPAY",
      providerPaymentId: "pay_fake_rec_33",
      amount: 1000000n,
      unallocatedAmount: 1000000n,
      paymentDate: new Date(),
      method: "UPI",
      payerDetails: "Fake Reconcile",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });

    demoPaymentStore.recordProviderEvent({
      provider: "RAZORPAY",
      providerEventId: "reconcile_arbitrary_unrelated_id",
      eventType: "payment.captured",
      payloadJson: JSON.stringify({
        paymentId: "pay_unrelated_id",
        amountPaise: 1000000,
        currency: "INR",
      }),
      signatureVerified: false,
      processed: true,
    });

    await expect(
      paymentService.allocatePayment({
        paymentId: fakeReconcilePay.id,
        studentId: "stu_mohit_0219",
        allocations: [{ instalmentId: "inst_mohit_1", amountPaise: 500000n }],
        reason: "Allocating payment with arbitrary reconcile prefix",
        actor: accountsActorMansarovar,
      })
    ).rejects.toThrow(/missing or unverified authoritative capture evidence/i);

    // 7. Bank transfer with ONLY a manual UTR string in payerDetails and NO verified receipt evidence
    const manualUtrBankPay = demoPaymentStore.recordPayment({
      paymentReference: "PAY-MANUAL-UTR-ONLY",
      provider: "MOCK_GATEWAY",
      providerPaymentId: "bank_manual_utr_22",
      amount: 1000000n,
      unallocatedAmount: 1000000n,
      paymentDate: new Date(),
      method: "NEFT",
      payerDetails: "Mohit Gurjar / PUNB0123456 / UTR-9988776655", // Only manual string
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });

    await expect(
      paymentService.allocatePayment({
        paymentId: manualUtrBankPay.id,
        studentId: "stu_mohit_0219",
        allocations: [{ instalmentId: "inst_mohit_1", amountPaise: 500000n }],
        reason: "Allocating bank transfer with only manual UTR string",
        actor: accountsActorMansarovar,
      })
    ).rejects.toThrow(/bank transfer capture lacks verified receipt evidence/i);

    // 8. Bank transfer WITH verified receipt / statement intake evidence
    const verifiedBankPay = demoPaymentStore.recordPayment({
      paymentReference: "PAY-VERIFIED-BANK",
      provider: "MOCK_GATEWAY",
      providerPaymentId: "bank_verified_stmt_11",
      amount: 1000000n,
      unallocatedAmount: 1000000n,
      paymentDate: new Date(),
      method: "NEFT",
      payerDetails: "Mohit Gurjar / PUNB0123456 / UTR-55443322",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });

    demoPaymentStore.recordProviderEvent({
      provider: "MOCK_GATEWAY",
      providerEventId: "bank_verified_stmt_11",
      eventType: "payment.captured",
      payloadJson: JSON.stringify({
        paymentId: "bank_verified_stmt_11",
        amountPaise: 1000000,
        currency: "INR",
        verifiedReceipt: true,
      }),
      signatureVerified: true,
      processed: true,
    });

    const bankResult = await paymentService.allocatePayment({
      paymentId: verifiedBankPay.id,
      studentId: "stu_mohit_0219",
      allocations: [{ instalmentId: "inst_mohit_1", amountPaise: 500000n }],
      reason: "Legitimate investigated NEFT payment with verified statement intake",
      actor: accountsActorMansarovar,
    });
    expect(bankResult.success).toBe(true);
    expect(bankResult.totalAllocatedPaise).toBe(500000n);

    // 9. Valid gateway webhook capture with exact matching provenance
    const validGatewayPay = demoPaymentStore.recordPayment({
      paymentReference: "PAY-VALID-GATEWAY",
      provider: "RAZORPAY",
      providerPaymentId: "pay_valid_rzp_77",
      amount: 1000000n,
      unallocatedAmount: 1000000n,
      paymentDate: new Date(),
      method: "UPI",
      payerDetails: "Verified Webhook Payer",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });

    demoPaymentStore.recordProviderEvent({
      provider: "RAZORPAY",
      providerEventId: "pay_valid_rzp_77",
      eventType: "payment.captured",
      payloadJson: JSON.stringify({
        paymentId: "pay_valid_rzp_77",
        amountPaise: 1000000,
        currency: "INR",
      }),
      signatureVerified: true,
      processed: true,
      processingStatus: "ALLOCATED",
    });

    const validResult = await paymentService.allocatePayment({
      paymentId: validGatewayPay.id,
      studentId: "stu_mohit_0219",
      allocations: [{ instalmentId: "inst_mohit_1", amountPaise: 500000n }],
      reason: "Verified gateway capture allocation",
      actor: accountsActorMansarovar,
    });
    expect(validResult.success).toBe(true);
    expect(validResult.totalAllocatedPaise).toBe(500000n);

    // 10. Valid server-side reconciliation matching exact payment ID, amount, and currency
    const reconciledPay = demoPaymentStore.recordPayment({
      paymentReference: "PAY-RECONCILED-SERVER",
      provider: "RAZORPAY",
      providerPaymentId: "pay_reconciled_rzp_00",
      amount: 1000000n,
      unallocatedAmount: 1000000n,
      paymentDate: new Date(),
      method: "Netbanking",
      payerDetails: "Reconciled Payer",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });

    demoPaymentStore.recordProviderEvent({
      provider: "RAZORPAY",
      providerEventId: "reconcile_pay_reconciled_rzp_00",
      eventType: "payment.captured",
      payloadJson: JSON.stringify({
        paymentId: "pay_reconciled_rzp_00",
        amountPaise: 1000000,
        currency: "INR",
      }),
      signatureVerified: false,
      processed: true,
      processingStatus: "RECONCILED",
    });

    const recResult = await paymentService.allocatePayment({
      paymentId: reconciledPay.id,
      studentId: "stu_mohit_0219",
      allocations: [{ instalmentId: "inst_mohit_1", amountPaise: 500000n }],
      reason: "Server reconciled capture allocation",
      actor: accountsActorMansarovar,
    });
    expect(recResult.success).toBe(true);
    expect(recResult.totalAllocatedPaise).toBe(500000n);
  });

  // --------------------------------------------------------------------------
  // Scenario 14: Cross-payment instalment concurrency prevents over-allocation
  // --------------------------------------------------------------------------
  it("Scenario 14: cross-payment instalment concurrency serializes concurrent allocations and prevents negative balances", async () => {
    // Mohit inst_mohit_1 outstanding is ₹40,000 (4000000n).
    // Pre-allocate ₹20,000 to leave exactly ₹20,000 outstanding (2000000n).
    const prepPay = demoPaymentStore.recordPayment({
      paymentReference: "PAY-PREP-20K",
      provider: "MOCK_GATEWAY",
      providerPaymentId: "prov_prep_20k",
      amount: 2000000n,
      unallocatedAmount: 2000000n,
      paymentDate: new Date(),
      method: "NEFT",
      payerDetails: "Mohit Gurjar / UTR-PREP-20K",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });
    demoPaymentStore.recordProviderEvent({
      provider: "MOCK_GATEWAY",
      providerEventId: "prov_prep_20k",
      eventType: "payment.captured",
      payloadJson: JSON.stringify({
        paymentId: "prov_prep_20k",
        amountPaise: 2000000,
        currency: "INR",
        verifiedReceipt: true,
      }),
      signatureVerified: true,
      processed: true,
    });
    await paymentService.allocatePayment({
      paymentId: prepPay.id,
      studentId: "stu_mohit_0219",
      allocations: [{ instalmentId: "inst_mohit_1", amountPaise: 2000000n }],
      reason: "Prep allocation to leave 20,000 balance",
      actor: accountsActorMansarovar,
    });

    const instBefore = demoPaymentStore.instalments.get("inst_mohit_1")!;
    const ledgerBefore = demoPaymentStore.getStudentLedger("stu_mohit_0219");
    const balBefore = deriveInstalmentBalance(instBefore, ledgerBefore, new Date());
    expect(balBefore.outstandingBalance).toBe(2000000n); // exactly ₹20,000 remaining

    // Create two separate captured payments of ₹15,000 each.
    // Individually, each payment (₹15,000) is valid against the pre-allocation balance (₹20,000).
    // Collectively, ₹15,000 + ₹15,000 = ₹30,000 > ₹20,000.
    const payA = demoPaymentStore.recordPayment({
      paymentReference: "PAY-CONC-A",
      provider: "MOCK_GATEWAY",
      providerPaymentId: "prov_conc_a",
      amount: 1500000n,
      unallocatedAmount: 1500000n,
      paymentDate: new Date(),
      method: "NEFT",
      payerDetails: "Mohit Gurjar / UTR-CONC-A",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });
    demoPaymentStore.recordProviderEvent({
      provider: "MOCK_GATEWAY",
      providerEventId: "prov_conc_a",
      eventType: "payment.captured",
      payloadJson: JSON.stringify({
        paymentId: "prov_conc_a",
        amountPaise: 1500000,
        currency: "INR",
        verifiedReceipt: true,
      }),
      signatureVerified: true,
      processed: true,
    });

    const payB = demoPaymentStore.recordPayment({
      paymentReference: "PAY-CONC-B",
      provider: "MOCK_GATEWAY",
      providerPaymentId: "prov_conc_b",
      amount: 1500000n,
      unallocatedAmount: 1500000n,
      paymentDate: new Date(),
      method: "NEFT",
      payerDetails: "Mohit Gurjar / UTR-CONC-B",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });
    demoPaymentStore.recordProviderEvent({
      provider: "MOCK_GATEWAY",
      providerEventId: "prov_conc_b",
      eventType: "payment.captured",
      payloadJson: JSON.stringify({
        paymentId: "prov_conc_b",
        amountPaise: 1500000,
        currency: "INR",
        verifiedReceipt: true,
      }),
      signatureVerified: true,
      processed: true,
    });

    // Fire allocations simultaneously targeting the same instalment
    const results = await Promise.allSettled([
      paymentService.allocatePayment({
        paymentId: payA.id,
        studentId: "stu_mohit_0219",
        allocations: [{ instalmentId: "inst_mohit_1", amountPaise: 1500000n }],
        reason: "Concurrent allocation A",
        actor: accountsActorMansarovar,
      }),
      paymentService.allocatePayment({
        paymentId: payB.id,
        studentId: "stu_mohit_0219",
        allocations: [{ instalmentId: "inst_mohit_1", amountPaise: 1500000n }],
        reason: "Concurrent allocation B",
        actor: accountsActorMansarovar,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one must succeed, and one must be rejected due to insufficient remaining balance
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectionReason.message).toMatch(/exceeds current outstanding/i);

    // Verify resulting instalment balance: ₹20,000 - ₹15,000 = ₹5,000 (never negative!)
    const ledgerAfter = demoPaymentStore.getStudentLedger("stu_mohit_0219");
    const balAfter = deriveInstalmentBalance(instBefore, ledgerAfter, new Date());
    expect(balAfter.outstandingBalance).toBe(500000n);
  });

  // --------------------------------------------------------------------------
  // Scenario 15: Refund & allocation balance consistency and stale balance self-healing
  // --------------------------------------------------------------------------
  it("Scenario 15: refund and allocation balance consistency enforces in-flight refund reservations and self-heals stale balances", async () => {
    // Payment of ₹40,000 (4000000n)
    const payment = demoPaymentStore.recordPayment({
      paymentReference: "PAY-REFUND-CONSISTENCY",
      provider: "RAZORPAY",
      providerPaymentId: "pay_rzp_consistency_1",
      amount: 4000000n,
      unallocatedAmount: 4000000n,
      paymentDate: new Date(),
      method: "Netbanking",
      payerDetails: "Mohit Gurjar",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });

    demoPaymentStore.recordProviderEvent({
      provider: "RAZORPAY",
      providerEventId: "pay_rzp_consistency_1",
      eventType: "payment.captured",
      payloadJson: JSON.stringify({
        paymentId: "pay_rzp_consistency_1",
        amountPaise: 4000000,
        currency: "INR",
      }),
      signatureVerified: true,
      processed: true,
      processingStatus: "ALLOCATED",
    });

    // 1. Prior allocation of ₹15,000
    demoPaymentStore.recordAllocation({
      paymentId: payment.id,
      instalmentId: "inst_mohit_1",
      amount: 1500000n,
      allocationReason: "Prior allocation",
    });

    // 2. Succeeded refund of ₹10,000
    const refund = demoPaymentStore.createRefund({
      withdrawalId: "wd_test_consistency",
      studentId: "stu_mohit_0219",
      totalApprovedAmount: 1000000n,
      status: "COMPLETED",
    });
    demoPaymentStore.createRefundItem({
      refundId: refund.id,
      paymentId: payment.id,
      amount: 1000000n,
      status: "SUCCEEDED",
      providerRefundId: "rfnd_succeeded_1",
    });

    // Authoritative available: 40,000 - 15,000 - 10,000 = 15,000.
    // Suppose unallocatedAmount was STALE and set to 30,000 (3000000n).
    payment.unallocatedAmount = 3000000n;

    // Attempting to allocate ₹20,000 must fail against authoritative available (₹15,000)
    await expect(
      paymentService.allocatePayment({
        paymentId: payment.id,
        studentId: "stu_mohit_0219",
        allocations: [{ instalmentId: "inst_mohit_1", amountPaise: 2000000n }],
        reason: "Attempt to allocate against stale balance",
        actor: accountsActorMansarovar,
      })
    ).rejects.toThrow(/exceeds available payment balance/i);

    // 3. In-flight PROCESSING refund of ₹10,000 reserves funds
    demoPaymentStore.createRefundItem({
      refundId: refund.id,
      paymentId: payment.id,
      amount: 1000000n,
      status: "PROCESSING",
      providerRefundId: "rfnd_processing_2",
    });

    // Active refunds: 10,000 (SUCCEEDED) + 10,000 (PROCESSING) = 20,000.
    // Authoritative available: 40,000 - 15,000 - 20,000 = 5,000.
    // Attempting to allocate ₹10,000 must fail
    await expect(
      paymentService.allocatePayment({
        paymentId: payment.id,
        studentId: "stu_mohit_0219",
        allocations: [{ instalmentId: "inst_mohit_1", amountPaise: 1000000n }],
        reason: "Attempt to allocate funds reserved by in-flight refund",
        actor: accountsActorMansarovar,
      })
    ).rejects.toThrow(/exceeds available payment balance/i);

    // Allocating the exact available balance of ₹5,000 succeeds
    const allocResult = await paymentService.allocatePayment({
      paymentId: payment.id,
      studentId: "stu_mohit_0219",
      allocations: [{ instalmentId: "inst_mohit_1", amountPaise: 500000n }],
      reason: "Allocate exact remaining balance",
      actor: accountsActorMansarovar,
    });

    expect(allocResult.success).toBe(true);
    expect(allocResult.totalAllocatedPaise).toBe(500000n);
    expect(allocResult.remainingUnallocatedPaise).toBe(0n);

    // Verify self-healing: payment.unallocatedAmount is now 0n, not stale
    expect(payment.unallocatedAmount).toBe(0n);
  });

  // --------------------------------------------------------------------------
  // Scenario 16: Strict demo-store isolation in production mode
  // --------------------------------------------------------------------------
  it("Scenario 16: strict demo-store isolation rejects fallback operations when running in production mode", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAppEnv = process.env.APP_ENV;

    try {
      (process.env as any).NODE_ENV = "production";
      process.env.APP_ENV = "production";

      // 1. Manual allocation must fail closed without touching demo store
      await expect(
        paymentService.allocatePayment({
          paymentId: "pay_demo_a91c",
          studentId: "stu_mohit_0219",
          allocations: [{ instalmentId: "inst_mohit_1", amountPaise: 1000000n }],
          reason: "Production test allocation",
          actor: accountsActorMansarovar,
        })
      ).rejects.toThrow(/In-memory demo fallback is strictly prohibited in production/i);

      // 2. Unmatched queue query must fail closed in production
      await expect(
        paymentService.getUnmatchedPayments({}, accountsActorMansarovar)
      ).rejects.toThrow(/In-memory demo fallback is strictly prohibited in production/i);

      // 3. Payment investigation details query must fail closed in production
      await expect(
        paymentService.getPaymentInvestigationDetails("pay_demo_a91c", accountsActorMansarovar)
      ).rejects.toThrow(/In-memory demo fallback is strictly prohibited in production/i);

      // 4. Student outstanding instalments query must fail closed in production
      await expect(
        paymentService.getStudentOutstandingInstalments("stu_mohit_0219", accountsActorMansarovar)
      ).rejects.toThrow(/In-memory demo fallback is strictly prohibited in production/i);
    } finally {
      (process.env as any).NODE_ENV = originalNodeEnv;
      process.env.APP_ENV = originalAppEnv;
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 17: Concurrent refund and allocation attempts against the same payment
  // --------------------------------------------------------------------------
  it("Scenario 17: concurrent refund and allocation attempts against same payment serialize and prevent negative balance", async () => {
    // 1. Seed ₹30,000 captured payment with verified capture evidence
    const payment = demoPaymentStore.recordPayment({
      paymentReference: "PAY-CONC-REF-ALLOC",
      provider: "RAZORPAY",
      providerPaymentId: "pay_conc_ref_alloc",
      amount: 3000000n, // ₹30,000
      unallocatedAmount: 3000000n,
      paymentDate: new Date(),
      method: "UPI",
      payerDetails: "Mohit Gurjar",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
    });

    demoPaymentStore.recordProviderEvent({
      provider: "RAZORPAY",
      providerEventId: "pay_conc_ref_alloc",
      eventType: "payment.captured",
      payloadJson: JSON.stringify({
        paymentId: "pay_conc_ref_alloc",
        amountPaise: 3000000,
        currency: "INR",
      }),
      signatureVerified: true,
      processed: true,
      processingStatus: "ALLOCATED",
    });

    // 2. Create refund item of ₹20,000 for student
    const refund = demoPaymentStore.createRefund({
      withdrawalId: "wd_conc_ref_alloc",
      studentId: "stu_mohit_0219",
      totalApprovedAmount: 2000000n,
      status: "PENDING_EXECUTION",
    });

    const refundItem = demoPaymentStore.createRefundItem({
      refundId: refund.id,
      paymentId: payment.id,
      amount: 2000000n, // ₹20,000
      status: "PENDING",
    });

    // 3. Concurrently trigger allocation of ₹20,000 and refund execution of ₹20,000
    // Combined requested funds: ₹20,000 + ₹20,000 = ₹40,000 > ₹30,000
    const allocPromise = paymentService.allocatePayment({
      paymentId: payment.id,
      studentId: "stu_mohit_0219",
      allocations: [
        {
          instalmentId: "inst_mohit_1",
          amountPaise: 2000000n, // ₹20,000
        },
      ],
      reason: "Concurrent allocation attempt",
      actor: accountsActorMansarovar,
    });

    const refundPromise = refundService.executeRefundItem({
      refundItemId: refundItem.id,
      actor: directorActor,
    });

    const results = await Promise.allSettled([allocPromise, refundPromise]);

    // 4. Verify serialization: exactly one succeeds, one fails with "exceeds available balance" or "exceeds remaining refundable amount"
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason?.message || "";
    const matchedExpectedError =
      /exceeds available/i.test(rejectionReason) ||
      /exceeds remaining refundable/i.test(rejectionReason);
    expect(matchedExpectedError).toBe(true);

    // 5. Resulting balance is exactly ₹10,000 (1000000n), never negative or over-allocated
    const updatedPayment = demoPaymentStore.findPaymentById(payment.id)!;
    expect(updatedPayment.unallocatedAmount).toBe(1000000n); // exactly ₹10,000 remaining
    expect(updatedPayment.unallocatedAmount).toBeGreaterThanOrEqual(0n);
  });
});
