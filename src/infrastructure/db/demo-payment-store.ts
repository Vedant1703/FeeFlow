/**
 * Deterministic In-Memory Payment and Ledger Store for FeeFlow.
 * Used for demo execution and tests when local PostgreSQL is offline.
 * Maintains full financial fidelity: BigInt paise, atomic ledger updates,
 * idempotency tracking, and GST receipt snapshots.
 */

import { DomainLedgerEntry, DomainInstalment, deriveInstalmentBalance } from "@/domain/ledger";

export interface DemoPaymentIntent {
  id: string;
  orderId: string;
  studentId: string;
  instalmentId?: string;
  amount: bigint;
  currency: string;
  provider?: string;
  providerPaymentId?: string;
  status: "CREATED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "EXPIRED" | "PENDING";
  idempotencyKey?: string;
  createdAt: Date;
}

export interface DemoProviderEvent {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  payloadJson: string;
  signatureVerified: boolean;
  processed: boolean;
  processedAt?: Date;
  processingStatus?: string;
  error?: string;
}

export interface DemoPayment {
  id: string;
  paymentReference: string;
  provider: string;
  providerPaymentId: string;
  orderId?: string | null;
  studentId?: string | null;
  amount: bigint;
  unallocatedAmount: bigint;
  paymentDate: Date;
  method: string;
  payerDetails: string;
  status: "PENDING" | "CAPTURED" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  matchStatus: "MATCHED_AUTOMATIC" | "MATCHED_MANUAL" | "UNMATCHED" | "SUSPICIOUS";
  notes?: string;
}

export interface DemoAllocation {
  id: string;
  paymentId: string;
  instalmentId: string;
  amount: bigint;
  allocatedAt: Date;
  allocationReason: string;
}

export interface DemoReceipt {
  id: string;
  receiptNumber: string;
  paymentId: string;
  studentId: string;
  amount: bigint;
  issuedAt: Date;
  gstin: string;
  sacCode: string;
  taxableAmount: bigint;
}

export interface DemoReminder {
  id: string;
  instalmentId: string;
  studentId: string;
  scheduledDate: Date;
  status: "QUEUED" | "SENT" | "SKIPPED" | "CANCELLED" | "FAILED";
  skipReason?: string;
  ruleName?: string;
  channel?: "WHATSAPP" | "SMS";
  language?: "en" | "hi";
  attemptCount?: number;
  lastError?: string | null;
  lastAttemptAt?: Date | null;
  dispatchedAt?: Date | null;
  renderedMessage?: string | null;
}

export interface DemoReminderAttempt {
  id: string;
  reminderId: string;
  attemptNumber: number;
  status: "SENT" | "FAILED" | "SKIPPED";
  error?: string | null;
  evaluatedAmountPaise: bigint;
  renderedMessage?: string | null;
  provider?: string;
  attemptedAt: Date;
}

export interface DemoWithdrawal {
  id: string;
  studentId: string;
  requestDate: Date;
  effectiveWithdrawalDate: Date;
  consumedDays: number;
  totalServiceDays: number;
  netFee: bigint;
  totalPaid: bigint;
  earnedFee: bigint;
  deductionAmount: bigint;
  potentialRefund: bigint;
  indicativeShortfall: bigint;
  slaTargetDate: Date;
  status: "DRAFT" | "REQUESTED" | "APPROVED" | "REJECTED" | "EXECUTED";
  requesterId: string;
  approverId?: string | null;
  approvedAt?: Date | null;
  approvalNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DemoRefund {
  id: string;
  withdrawalId: string;
  studentId: string;
  totalApprovedAmount: bigint;
  status: "PENDING_EXECUTION" | "PROCESSING" | "PARTIALLY_REFUNDED" | "COMPLETED" | "FAILED";
  createdAt: Date;
  completedAt?: Date | null;
}

export interface DemoRefundItem {
  id: string;
  refundId: string;
  paymentId: string;
  amount: bigint;
  status: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";
  failureReason?: string | null;
  providerRefundId?: string | null;
  createdAt: Date;
  attemptCount?: number;
  lastAttemptKey?: string;
  lastReceipt?: string;
}

export interface DemoStudent {
  id: string;
  studentCode: string;
  name: string;
  centreId: string;
  centreName: string;
  parentPhone?: string | null;
}

export interface DemoAuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  centreId?: string | null;
  reason?: string | null;
  beforeJson?: string | null;
  afterJson?: string | null;
  createdAt: Date;
}

class DemoPaymentStore {
  public intents: Map<string, DemoPaymentIntent> = new Map();
  public providerEvents: Map<string, DemoProviderEvent> = new Map();
  public payments: Map<string, DemoPayment> = new Map();
  public allocations: DemoAllocation[] = [];
  public ledgerEntries: DomainLedgerEntry[] = [];
  public instalments: Map<string, DomainInstalment & { status: string; studentId: string }> = new Map();
  public receipts: Map<string, DemoReceipt> = new Map();
  public reminders: DemoReminder[] = [];
  public reminderAttempts: DemoReminderAttempt[] = [];
  public dispatchingReminders: Set<string> = new Set();
  public withdrawals: Map<string, DemoWithdrawal> = new Map();
  public refunds: Map<string, DemoRefund> = new Map();
  public refundItems: Map<string, DemoRefundItem> = new Map();
  public students: Map<string, DemoStudent> = new Map();
  public auditLogs: DemoAuditLog[] = [];

  constructor() {
    this.reset();
  }

  public reset() {
    this.intents.clear();
    this.providerEvents.clear();
    this.payments.clear();
    this.allocations = [];
    this.ledgerEntries = [];
    this.instalments.clear();
    this.receipts.clear();
    this.reminders = [];
    this.reminderAttempts = [];
    this.dispatchingReminders.clear();
    this.withdrawals.clear();
    this.refunds.clear();
    this.refundItems.clear();
    this.students.clear();
    this.auditLogs = [];

    this.seedDefaultData();
  }

  private seedDefaultData() {
    // 1. Ishita Sharma (STU-0587): JEE 2027 Evening, Vaishali Nagar
    // 4 x ₹30,000 instalments.
    // Inst 1: Paid ₹30,000.
    // Inst 2: Due 2026-10-10, Paid ₹15,000 -> Part paid, ₹15,000 remaining.
    const ishitaId = "stu_ishita_0587";
    const inst1Id = "inst_ishita_1";
    const inst2Id = "inst_ishita_2";
    const inst3Id = "inst_ishita_3";
    const inst4Id = "inst_ishita_4";

    this.students.set(ishitaId, {
      id: ishitaId,
      studentCode: "STU-0587",
      name: "Ishita Sharma",
      centreId: "cen_vaishali",
      centreName: "Vaishali Nagar, Jaipur",
      parentPhone: "+91 90000 12341",
    });

    this.instalments.set(inst1Id, {
      id: inst1Id,
      studentId: ishitaId,
      feePlanId: "plan_ishita_jee",
      sequence: 1,
      dueDate: new Date("2026-07-10"),
      amount: 3000000n,
      status: "PAID",
    });

    this.instalments.set(inst2Id, {
      id: inst2Id,
      studentId: ishitaId,
      feePlanId: "plan_ishita_jee",
      sequence: 2,
      dueDate: new Date("2026-10-10"),
      amount: 3000000n,
      status: "PARTIAL",
    });

    this.instalments.set(inst3Id, {
      id: inst3Id,
      studentId: ishitaId,
      feePlanId: "plan_ishita_jee",
      sequence: 3,
      dueDate: new Date("2027-01-10"),
      amount: 3000000n,
      status: "UPCOMING",
    });

    this.instalments.set(inst4Id, {
      id: inst4Id,
      studentId: ishitaId,
      feePlanId: "plan_ishita_jee",
      sequence: 4,
      dueDate: new Date("2027-03-10"),
      amount: 3000000n,
      status: "UPCOMING",
    });

    // Ledger for Ishita
    this.ledgerEntries.push(
      {
        id: "led_ishita_chg_1",
        studentId: ishitaId,
        instalmentId: inst1Id,
        entryType: "CHARGE",
        amount: 3000000n,
        entryDate: new Date("2026-06-15"),
      },
      {
        id: "led_ishita_alloc_1",
        studentId: ishitaId,
        instalmentId: inst1Id,
        entryType: "ALLOCATION",
        amount: -3000000n,
        entryDate: new Date("2026-07-09"),
      },
      {
        id: "led_ishita_chg_2",
        studentId: ishitaId,
        instalmentId: inst2Id,
        entryType: "CHARGE",
        amount: 3000000n,
        entryDate: new Date("2026-06-15"),
      },
      {
        id: "led_ishita_alloc_2",
        studentId: ishitaId,
        instalmentId: inst2Id,
        entryType: "ALLOCATION",
        amount: -1500000n,
        entryDate: new Date("2026-10-09"),
      },
      {
        id: "led_ishita_chg_3",
        studentId: ishitaId,
        instalmentId: inst3Id,
        entryType: "CHARGE",
        amount: 3000000n,
        entryDate: new Date("2026-06-15"),
      },
      {
        id: "led_ishita_chg_4",
        studentId: ishitaId,
        instalmentId: inst4Id,
        entryType: "CHARGE",
        amount: 3000000n,
        entryDate: new Date("2026-06-15"),
      }
    );

    // Queued Reminder for Ishita's instalment 2
    this.reminders.push({
      id: "rem_ishita_inst2",
      instalmentId: inst2Id,
      studentId: ishitaId,
      scheduledDate: new Date("2026-10-15"),
      status: "QUEUED",
      ruleName: "+21d Firm Overdue",
      channel: "SMS",
      language: "hi",
      attemptCount: 0,
    });

    // Default seeded intent for Ishita
    this.intents.set("order_demo_10oct", {
      id: "intent_ishita_demo",
      orderId: "order_demo_10oct",
      studentId: ishitaId,
      instalmentId: inst2Id,
      amount: 1500000n,
      currency: "INR",
      provider: "MOCK_GATEWAY",
      status: "PENDING",
      createdAt: new Date(),
    });

    // Seeded withdrawal case U1 for Ishita Sharma (status: REQUESTED, requester: Neha Verma)
    const wdIshita: DemoWithdrawal = {
      id: "wd-001",
      studentId: ishitaId,
      requestDate: new Date("2026-11-02T10:00:00Z"),
      effectiveWithdrawalDate: new Date("2026-11-05T00:00:00Z"),
      consumedDays: 144,
      totalServiceDays: 290,
      netFee: 12000000n,
      totalPaid: 4500000n,
      earnedFee: 5958621n,
      deductionAmount: 0n,
      potentialRefund: 0n,
      indicativeShortfall: 1458621n,
      slaTargetDate: new Date("2026-11-12T00:00:00Z"),
      status: "REQUESTED",
      requesterId: "usr_accounts_neha",
      createdAt: new Date("2026-11-02T10:00:00Z"),
      updatedAt: new Date("2026-11-02T10:00:00Z"),
    };
    this.withdrawals.set("wd-001", wdIshita);

    // 2. Mohit Gurjar (STU-0219): NEET 2027 Morning, Mansarovar
    // 3 x ₹40,000 instalments.
    // Inst 1: Due 2026-11-15, Paid ₹0.
    const mohitId = "stu_mohit_0219";
    const instMohit1Id = "inst_mohit_1";
    const instMohit2Id = "inst_mohit_2";
    const instMohit3Id = "inst_mohit_3";

    this.students.set(mohitId, {
      id: mohitId,
      studentCode: "STU-0219",
      name: "Mohit Gurjar",
      centreId: "cen_mansarovar",
      centreName: "Mansarovar, Jaipur",
      parentPhone: "+91 90000 12342",
    });

    this.instalments.set(instMohit1Id, {
      id: instMohit1Id,
      studentId: mohitId,
      feePlanId: "plan_mohit_neet",
      sequence: 1,
      dueDate: new Date("2026-11-15"),
      amount: 4000000n,
      status: "DUE",
    });

    this.instalments.set(instMohit2Id, {
      id: instMohit2Id,
      studentId: mohitId,
      feePlanId: "plan_mohit_neet",
      sequence: 2,
      dueDate: new Date("2026-12-15"),
      amount: 4000000n,
      status: "UPCOMING",
    });

    this.instalments.set(instMohit3Id, {
      id: instMohit3Id,
      studentId: mohitId,
      feePlanId: "plan_mohit_neet",
      sequence: 3,
      dueDate: new Date("2027-02-15"),
      amount: 4000000n,
      status: "UPCOMING",
    });

    this.ledgerEntries.push(
      {
        id: "led_mohit_chg_1",
        studentId: mohitId,
        instalmentId: instMohit1Id,
        entryType: "CHARGE",
        amount: 4000000n,
        entryDate: new Date("2026-06-15"),
      },
      {
        id: "led_mohit_chg_2",
        studentId: mohitId,
        instalmentId: instMohit2Id,
        entryType: "CHARGE",
        amount: 4000000n,
        entryDate: new Date("2026-06-15"),
      },
      {
        id: "led_mohit_chg_3",
        studentId: mohitId,
        instalmentId: instMohit3Id,
        entryType: "CHARGE",
        amount: 4000000n,
        entryDate: new Date("2026-06-15"),
      }
    );

    this.intents.set("order_demo_mohit", {
      id: "intent_mohit_demo",
      orderId: "order_demo_mohit",
      studentId: mohitId,
      instalmentId: instMohit1Id,
      amount: 4000000n,
      currency: "INR",
      provider: "MOCK_GATEWAY",
      status: "PENDING",
      createdAt: new Date(),
    });

    this.reminders.push({
      id: "rem_mohit_inst1",
      instalmentId: instMohit1Id,
      studentId: mohitId,
      scheduledDate: new Date("2026-11-02T10:00:00Z"),
      status: "QUEUED",
      ruleName: "T-14d Advance Courtesy",
      channel: "WHATSAPP",
      language: "en",
      attemptCount: 0,
    });

    // 3. Dev Sharma (STU-0622): JEE 2027 Morning, Mansarovar
    // Inst 1: Due 2026-11-02, amount ₹30,000, FAILED delivery (3 attempts)
    const devId = "stu_dev_0622";
    const instDev1Id = "inst_dev_1";
    this.students.set(devId, {
      id: devId,
      studentCode: "STU-0622",
      name: "Dev Sharma",
      centreId: "cen_mansarovar",
      centreName: "Mansarovar, Jaipur",
      parentPhone: "+91 98290 77889",
    });
    this.instalments.set(instDev1Id, {
      id: instDev1Id,
      studentId: devId,
      feePlanId: "plan_dev_jee",
      sequence: 1,
      dueDate: new Date("2026-11-02"),
      amount: 3000000n,
      status: "DUE",
    });
    this.ledgerEntries.push({
      id: "led_dev_chg_1",
      studentId: devId,
      instalmentId: instDev1Id,
      entryType: "CHARGE",
      amount: 3000000n,
      entryDate: new Date("2026-06-15"),
    });
    this.reminders.push({
      id: "rem_dev_failed",
      instalmentId: instDev1Id,
      studentId: devId,
      scheduledDate: new Date("2026-11-02T08:30:00Z"),
      status: "FAILED",
      ruleName: "Due Date Final Alert",
      channel: "SMS",
      language: "en",
      attemptCount: 3,
      lastError: "Provider delivery timeout (DLR error 30008)",
      lastAttemptAt: new Date("2026-11-02T08:31:00Z"),
    });
    this.reminderAttempts.push(
      {
        id: "att_dev_1",
        reminderId: "rem_dev_failed",
        attemptNumber: 1,
        status: "FAILED",
        error: "Provider delivery timeout (DLR error 30008)",
        evaluatedAmountPaise: 3000000n,
        provider: "MOCK_SMS",
        attemptedAt: new Date("2026-11-02T08:30:00Z"),
      },
      {
        id: "att_dev_2",
        reminderId: "rem_dev_failed",
        attemptNumber: 2,
        status: "FAILED",
        error: "Provider delivery timeout (DLR error 30008)",
        evaluatedAmountPaise: 3000000n,
        provider: "MOCK_SMS",
        attemptedAt: new Date("2026-11-02T08:30:30Z"),
      },
      {
        id: "att_dev_3",
        reminderId: "rem_dev_failed",
        attemptNumber: 3,
        status: "FAILED",
        error: "Provider delivery timeout (DLR error 30008)",
        evaluatedAmountPaise: 3000000n,
        provider: "MOCK_SMS",
        attemptedAt: new Date("2026-11-02T08:31:00Z"),
      }
    );

    // 4. Aman Joshi (STU-0891): JEE 2027 Evening, Malviya Nagar
    // Inst 2: Due 2026-10-25, amount ₹30,000, SENT
    const amanId = "stu_aman_0891";
    const instAman2Id = "inst_aman_2";
    this.students.set(amanId, {
      id: amanId,
      studentCode: "STU-0891",
      name: "Aman Joshi",
      centreId: "cen_malviya",
      centreName: "Malviya Nagar, Jaipur",
      parentPhone: "+91 98290 99887",
    });
    this.instalments.set(instAman2Id, {
      id: instAman2Id,
      studentId: amanId,
      feePlanId: "plan_aman_jee",
      sequence: 2,
      dueDate: new Date("2026-10-25"),
      amount: 3000000n,
      status: "OVERDUE",
    });
    this.ledgerEntries.push({
      id: "led_aman_chg_2",
      studentId: amanId,
      instalmentId: instAman2Id,
      entryType: "CHARGE",
      amount: 3000000n,
      entryDate: new Date("2026-06-15"),
    });
    this.reminders.push({
      id: "rem_aman_sent",
      instalmentId: instAman2Id,
      studentId: amanId,
      scheduledDate: new Date("2026-11-02T09:00:00Z"),
      status: "SENT",
      ruleName: "+7d Standard Overdue",
      channel: "SMS",
      language: "en",
      dispatchedAt: new Date("2026-11-02T09:02:00Z"),
      attemptCount: 1,
      renderedMessage:
        "Dear Parent, Instalment 2 for Aman Joshi at Company A, Malviya Nagar has an outstanding balance of ₹30,000, which is 8 days overdue.",
    });
    this.reminderAttempts.push({
      id: "att_aman_1",
      reminderId: "rem_aman_sent",
      attemptNumber: 1,
      status: "SENT",
      evaluatedAmountPaise: 3000000n,
      renderedMessage:
        "Dear Parent, Instalment 2 for Aman Joshi at Company A, Malviya Nagar has an outstanding balance of ₹30,000, which is 8 days overdue.",
      provider: "MOCK_SMS",
      attemptedAt: new Date("2026-11-02T09:02:00Z"),
    });

    // 5. Aarav Meena (STU-0412): NEET 2027 Morning, Malviya Nagar
    // Inst 1: Paid in full (₹30,000 charge - ₹30,000 alloc = 0), SKIPPED
    const aaravId = "stu_aarav_0412";
    const instAarav1Id = "inst_aarav_1";
    this.students.set(aaravId, {
      id: aaravId,
      studentCode: "STU-0412",
      name: "Aarav Meena",
      centreId: "cen_malviya",
      centreName: "Malviya Nagar, Jaipur",
      parentPhone: "+91 98290 11223",
    });
    this.instalments.set(instAarav1Id, {
      id: instAarav1Id,
      studentId: aaravId,
      feePlanId: "plan_aarav_jee",
      sequence: 1,
      dueDate: new Date("2026-10-30"),
      amount: 3000000n,
      status: "PAID",
    });
    this.ledgerEntries.push(
      {
        id: "led_aarav_chg_1",
        studentId: aaravId,
        instalmentId: instAarav1Id,
        entryType: "CHARGE",
        amount: 3000000n,
        entryDate: new Date("2026-06-15"),
      },
      {
        id: "led_aarav_alloc_1",
        studentId: aaravId,
        instalmentId: instAarav1Id,
        entryType: "ALLOCATION",
        amount: -3000000n,
        entryDate: new Date("2026-10-28"),
      }
    );
    this.reminders.push({
      id: "rem_aarav_skipped",
      instalmentId: instAarav1Id,
      studentId: aaravId,
      scheduledDate: new Date("2026-11-02T09:15:00Z"),
      status: "SKIPPED",
      ruleName: "+3d Gentle Reminder",
      channel: "WHATSAPP",
      language: "hi",
      skipReason: "Instalment settled in full",
      attemptCount: 1,
    });
    this.reminderAttempts.push({
      id: "att_aarav_1",
      reminderId: "rem_aarav_skipped",
      attemptNumber: 1,
      status: "SKIPPED",
      error: "Instalment settled in full",
      evaluatedAmountPaise: 0n,
      attemptedAt: new Date("2026-11-02T09:15:00Z"),
    });

  }

  public seedUnmatchedPayment() {
    // UNMATCHED PAYMENT: pay_demo_a91c (₹15,000, "MOHIT G 0219")
    this.payments.set("pay_demo_a91c", {
      id: "pay_demo_a91c",
      paymentReference: "pay_demo_a91c",
      provider: "MOCK_GATEWAY",
      providerPaymentId: "prov_unmatched_a91c",
      orderId: null,
      studentId: null,
      amount: 1500000n,
      unallocatedAmount: 1500000n,
      paymentDate: new Date("2026-11-01T16:45:00Z"),
      method: "NEFT",
      payerDetails: "MOHIT G 0219 / PUNB0123456",
      status: "CAPTURED",
      matchStatus: "UNMATCHED",
      notes: "Direct bank transfer; potential candidate STU-0219 Mohit Gurjar (score 0.88)",
    });

    this.recordProviderEvent({
      provider: "MOCK_GATEWAY",
      providerEventId: "evt_1101_unmatched",
      eventType: "payment.captured",
      payloadJson: JSON.stringify({
        paymentId: "prov_unmatched_a91c",
        amount: 1500000,
        payerDetails: "MOHIT G 0219 / PUNB0123456",
      }),
      signatureVerified: true,
      processed: true,
      processingStatus: "UNMATCHED",
    });
  }

  public seedKavyaWithdrawalData() {
    // 3. Kavya Rathore (STU-1038): NEET 2027 Morning, Tonk Road
    // 4 x ₹30,000 instalments. All 4 paid = ₹120,000.
    const kavyaId = "stu_kavya_1038";
    this.students.set(kavyaId, {
      id: kavyaId,
      studentCode: "STU-1038",
      name: "Kavya Rathore",
      centreId: "cen_tonk",
      centreName: "Tonk Road, Jaipur",
      parentPhone: "+91 98290 12345",
    });
    const kInst1 = "inst_kavya_1";
    const kInst2 = "inst_kavya_2";
    const kInst3 = "inst_kavya_3";
    const kInst4 = "inst_kavya_4";

    const insts = [
      { id: kInst1, seq: 1, due: "2026-07-10", payId: "pay_kavya_1", pRef: "pay_k1", date: "2026-07-09" },
      { id: kInst2, seq: 2, due: "2026-08-10", payId: "pay_kavya_2", pRef: "pay_k2", date: "2026-08-09" },
      { id: kInst3, seq: 3, due: "2026-09-10", payId: "pay_kavya_3", pRef: "pay_k3", date: "2026-09-09" },
      { id: kInst4, seq: 4, due: "2026-10-10", payId: "pay_kavya_4", pRef: "pay_k4", date: "2026-10-09" },
    ];

    for (const it of insts) {
      this.instalments.set(it.id, {
        id: it.id,
        studentId: kavyaId,
        feePlanId: "plan_kavya_neet",
        sequence: it.seq,
        dueDate: new Date(it.due),
        amount: 3000000n,
        status: "PAID",
      });

      this.ledgerEntries.push({
        id: `led_kavya_chg_${it.seq}`,
        studentId: kavyaId,
        instalmentId: it.id,
        entryType: "CHARGE",
        amount: 3000000n,
        entryDate: new Date("2026-06-15"),
      });

      this.ledgerEntries.push({
        id: `led_kavya_alloc_${it.seq}`,
        studentId: kavyaId,
        instalmentId: it.id,
        entryType: "ALLOCATION",
        amount: -3000000n,
        entryDate: new Date(it.date),
      });

      this.payments.set(it.payId, {
        id: it.payId,
        paymentReference: it.pRef,
        provider: "MOCK_GATEWAY",
        providerPaymentId: `rzp_${it.payId}`,
        studentId: kavyaId,
        amount: 3000000n,
        unallocatedAmount: 0n,
        paymentDate: new Date(it.date),
        method: "Gateway (UPI)",
        payerDetails: "Vikram Rathore (+91 98290 12345)",
        status: "CAPTURED",
        matchStatus: "MATCHED_AUTOMATIC",
      });
    }

    // Kavya Rathore (Approved, Executing refund)
    const wdKavya: DemoWithdrawal = {
      id: "wd-002",
      studentId: kavyaId,
      requestDate: new Date("2026-10-25T09:00:00Z"),
      effectiveWithdrawalDate: new Date("2026-10-28T00:00:00Z"),
      consumedDays: 136,
      totalServiceDays: 290,
      netFee: 12000000n,
      totalPaid: 12000000n,
      earnedFee: 5627586n,
      deductionAmount: 0n,
      potentialRefund: 6372414n,
      indicativeShortfall: 0n,
      slaTargetDate: new Date("2026-11-04T00:00:00Z"),
      status: "APPROVED",
      requesterId: "usr_accounts_neha",
      approverId: "usr_director_arvind",
      approvedAt: new Date("2026-10-29T14:00:00Z"),
      approvalNotes: "Approved under MoE 2024 pro-rata refund policy",
      createdAt: new Date("2026-10-25T09:00:00Z"),
      updatedAt: new Date("2026-10-29T14:00:00Z"),
    };
    this.withdrawals.set("wd-002", wdKavya);

    const refKavya: DemoRefund = {
      id: "rfnd_kavya_1",
      withdrawalId: "wd-002",
      studentId: kavyaId,
      totalApprovedAmount: 6372414n,
      status: "PROCESSING",
      createdAt: new Date("2026-10-29T14:05:00Z"),
    };
    this.refunds.set("rfnd_kavya_1", refKavya);

    const kItems: DemoRefundItem[] = [
      {
        id: "item-1",
        refundId: "rfnd_kavya_1",
        paymentId: "pay_kavya_4",
        amount: 3000000n,
        status: "SUCCEEDED",
        providerRefundId: "rf_91a",
        createdAt: new Date("2026-10-29T14:10:00Z"),
      },
      {
        id: "item-2",
        refundId: "rfnd_kavya_1",
        paymentId: "pay_kavya_3",
        amount: 3000000n,
        status: "PROCESSING",
        providerRefundId: "rf_91b",
        createdAt: new Date("2026-10-29T14:10:00Z"),
      },
      {
        id: "item-3",
        refundId: "rfnd_kavya_1",
        paymentId: "pay_kavya_2",
        amount: 372414n,
        status: "FAILED",
        failureReason: "ERR_PROVIDER_TIMEOUT",
        providerRefundId: null,
        createdAt: new Date("2026-10-29T14:10:00Z"),
      },
    ];
    for (const kit of kItems) {
      this.refundItems.set(kit.id, kit);
    }
  }

  // --- Store Operations ---

  createPaymentIntent(data: {
    orderId: string;
    studentId: string;
    instalmentId?: string;
    amount: bigint;
    currency: string;
    provider?: string;
    status?: "CREATED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "EXPIRED" | "PENDING";
    idempotencyKey?: string;
    createdAt?: Date;
  }): DemoPaymentIntent {
    const id = `intent_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const intent: DemoPaymentIntent = {
      id,
      orderId: data.orderId,
      studentId: data.studentId,
      instalmentId: data.instalmentId,
      amount: data.amount,
      currency: data.currency,
      provider: data.provider || "MOCK_GATEWAY",
      status: data.status || "CREATED",
      idempotencyKey: data.idempotencyKey,
      createdAt: data.createdAt || new Date(),
    };
    this.intents.set(data.orderId, intent);
    return intent;
  }

  findReusableIntent(params: {
    studentId: string;
    instalmentId?: string;
    amount: bigint;
    provider: string;
    maxAgeMs?: number;
  }): DemoPaymentIntent | null {
    const maxAge = params.maxAgeMs ?? 30 * 60 * 1000;
    const now = Date.now();
    for (const intent of this.intents.values()) {
      const matchInstalment =
        (intent.instalmentId || undefined) === (params.instalmentId || undefined);
      if (
        intent.studentId === params.studentId &&
        matchInstalment &&
        intent.amount === params.amount &&
        (intent.provider || "MOCK_GATEWAY") === params.provider &&
        (intent.status === "CREATED" || intent.status === "PENDING") &&
        now - intent.createdAt.getTime() <= maxAge
      ) {
        return intent;
      }
    }
    return null;
  }

  findPaymentIntent(orderId: string): DemoPaymentIntent | null {
    return this.intents.get(orderId) || null;
  }

  findProviderEvent(provider: string, providerEventId: string): DemoProviderEvent | null {
    const key = `${provider}:${providerEventId}`;
    return this.providerEvents.get(key) || null;
  }

  recordProviderEvent(data: {
    provider: string;
    providerEventId: string;
    eventType: string;
    payloadJson: string;
    signatureVerified: boolean;
    processed: boolean;
    processingStatus?: string;
    error?: string;
  }): DemoProviderEvent {
    const key = `${data.provider}:${data.providerEventId}`;
    const event: DemoProviderEvent = {
      id: `pevt_${Date.now()}`,
      ...data,
      processedAt: new Date(),
    };
    this.providerEvents.set(key, event);
    return event;
  }

  updateProviderEventStatus(
    provider: string,
    providerEventId: string,
    status: string,
    error?: string
  ): void {
    const key = `${provider}:${providerEventId}`;
    const event = this.providerEvents.get(key);
    if (event) {
      event.processingStatus = status;
      event.processed =
        status === "ALLOCATED" || status === "UNMATCHED" || status === "FAILED";
      event.processedAt = new Date();
      if (error) event.error = error;
    }
  }

  getStudentLedger(studentId: string): DomainLedgerEntry[] {
    return this.ledgerEntries.filter((e) => e.studentId === studentId);
  }

  getStudentInstalments(studentId: string): (DomainInstalment & { status: string; studentId: string })[] {
    return Array.from(this.instalments.values())
      .filter((i) => i.studentId === studentId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  findPaymentByProviderPaymentId(provider: string, providerPaymentId: string): DemoPayment | null {
    for (const p of this.payments.values()) {
      if (p.provider === provider && p.providerPaymentId === providerPaymentId) {
        return p;
      }
    }
    return null;
  }

  recordPayment(data: {
    paymentReference: string;
    provider: string;
    providerPaymentId: string;
    orderId?: string | null;
    studentId?: string | null;
    amount: bigint;
    unallocatedAmount: bigint;
    paymentDate: Date;
    method: string;
    payerDetails: string;
    status: "CAPTURED" | "FAILED";
    matchStatus: "MATCHED_AUTOMATIC" | "UNMATCHED";
    notes?: string;
  }): DemoPayment {
    const existing = this.findPaymentByProviderPaymentId(data.provider, data.providerPaymentId);
    if (existing) {
      throw new Error(`Payment with providerPaymentId ${data.providerPaymentId} already exists`);
    }
    const id = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const payment: DemoPayment = {
      id,
      ...data,
    };
    this.payments.set(id, payment);
    return payment;
  }

  recordAllocation(data: {
    paymentId: string;
    instalmentId: string;
    amount: bigint;
    allocationReason: string;
  }): DemoAllocation {
    const id = `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const allocation: DemoAllocation = {
      id,
      ...data,
      allocatedAt: new Date(),
    };
    this.allocations.push(allocation);
    return allocation;
  }

  appendLedgerEntry(entry: {
    studentId: string;
    instalmentId?: string | null;
    entryType: "ALLOCATION" | "CHARGE" | "DISCOUNT" | "WAIVER";
    amount: bigint;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
  }): DomainLedgerEntry {
    const newEntry: DomainLedgerEntry = {
      id: `led_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      studentId: entry.studentId,
      instalmentId: entry.instalmentId,
      entryType: entry.entryType,
      amount: entry.amount,
      entryDate: new Date(),
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      notes: entry.notes,
    };
    this.ledgerEntries.push(newEntry);
    return newEntry;
  }

  updateInstalmentStatus(instalmentId: string, status: string) {
    const inst = this.instalments.get(instalmentId);
    if (inst) {
      inst.status = status;
    }
  }

  skipQueuedReminders(instalmentId: string, reason: string): number {
    let count = 0;
    for (const rem of this.reminders) {
      if (rem.instalmentId === instalmentId && rem.status === "QUEUED") {
        rem.status = "SKIPPED";
        rem.skipReason = reason;
        count++;
      }
    }
    return count;
  }

  createReceipt(data: {
    receiptNumber: string;
    paymentId: string;
    studentId: string;
    amount: bigint;
    gstin: string;
    sacCode: string;
    taxableAmount: bigint;
  }): DemoReceipt {
    for (const r of this.receipts.values()) {
      if (r.paymentId === data.paymentId) {
        throw new Error(`Unique constraint failed: Receipt already issued for paymentId ${data.paymentId}`);
      }
    }
    const id = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const receipt: DemoReceipt = {
      id,
      ...data,
      issuedAt: new Date(),
    };
    this.receipts.set(receipt.receiptNumber, receipt);
    return receipt;
  }

  updatePaymentIntentStatus(
    orderId: string,
    status: "CREATED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "EXPIRED" | "PENDING",
    providerPaymentId?: string
  ) {
    const intent = this.intents.get(orderId);
    if (intent) {
      intent.status = status;
      if (providerPaymentId) {
        intent.providerPaymentId = providerPaymentId;
      }
    }
  }

  // --- Withdrawal & Refund Operations ---

  createWithdrawal(data: Omit<DemoWithdrawal, "id" | "createdAt" | "updatedAt">): DemoWithdrawal {
    const id = `wd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const withdrawal: DemoWithdrawal = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.withdrawals.set(id, withdrawal);
    return withdrawal;
  }

  getWithdrawal(id: string): DemoWithdrawal | null {
    return this.withdrawals.get(id) || null;
  }

  listWithdrawals(): DemoWithdrawal[] {
    return Array.from(this.withdrawals.values()).sort(
      (a, b) => b.requestDate.getTime() - a.requestDate.getTime()
    );
  }

  updateWithdrawal(
    id: string,
    data: Partial<Omit<DemoWithdrawal, "id" | "createdAt">>
  ): DemoWithdrawal {
    const existing = this.withdrawals.get(id);
    if (!existing) {
      throw new Error(`Withdrawal ${id} not found in store`);
    }
    const updated: DemoWithdrawal = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.withdrawals.set(id, updated);
    return updated;
  }

  createRefund(data: Omit<DemoRefund, "id" | "createdAt">): DemoRefund {
    const id = `rfnd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const refund: DemoRefund = {
      id,
      ...data,
      createdAt: new Date(),
    };
    this.refunds.set(id, refund);
    return refund;
  }

  getRefund(id: string): DemoRefund | null {
    return this.refunds.get(id) || null;
  }

  getRefundByWithdrawalId(withdrawalId: string): DemoRefund | null {
    for (const r of this.refunds.values()) {
      if (r.withdrawalId === withdrawalId) return r;
    }
    return null;
  }

  updateRefund(id: string, data: Partial<Omit<DemoRefund, "id" | "createdAt">>): DemoRefund {
    const existing = this.refunds.get(id);
    if (!existing) {
      throw new Error(`Refund ${id} not found in store`);
    }
    const updated: DemoRefund = {
      ...existing,
      ...data,
    };
    this.refunds.set(id, updated);
    return updated;
  }

  createRefundItem(data: Omit<DemoRefundItem, "id" | "createdAt">): DemoRefundItem {
    const id = `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const item: DemoRefundItem = {
      id,
      ...data,
      createdAt: new Date(),
    };
    this.refundItems.set(id, item);
    return item;
  }

  getRefundItem(id: string): DemoRefundItem | null {
    return this.refundItems.get(id) || null;
  }

  findRefundItemByProviderRefundId(providerRefundId: string): DemoRefundItem | null {
    for (const item of this.refundItems.values()) {
      if (item.providerRefundId === providerRefundId) {
        return item;
      }
    }
    return null;
  }

  findRefundItemsByPaymentId(paymentId: string): DemoRefundItem[] {
    return Array.from(this.refundItems.values()).filter((it) => it.paymentId === paymentId);
  }

  getRefundItemsByRefundId(refundId: string): DemoRefundItem[] {
    return Array.from(this.refundItems.values()).filter((it) => it.refundId === refundId);
  }

  updateRefundItem(id: string, data: Partial<Omit<DemoRefundItem, "id" | "createdAt">>): DemoRefundItem {
    const existing = this.refundItems.get(id);
    if (!existing) {
      throw new Error(`RefundItem ${id} not found in store`);
    }
    const updated: DemoRefundItem = {
      ...existing,
      ...data,
    };
    this.refundItems.set(id, updated);
    return updated;
  }

  getRefundItemAttempt(id: string): { attemptCount: number; key: string; receipt: string } {
    const existing = this.refundItems.get(id);
    const count = existing?.attemptCount || 1;
    const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, "");
    return {
      attemptCount: count,
      key: count > 1 ? `refitem_${cleanId}_att${count}` : `refitem_${cleanId}`,
      receipt: count > 1 ? `rfnd_${cleanId.slice(-8)}_a${count}`.slice(0, 40) : `rfnd_${cleanId.slice(-8)}`.slice(0, 40),
    };
  }

  incrementRefundItemAttempt(id: string): { attemptCount: number; key: string; receipt: string } {
    const existing = this.refundItems.get(id);
    const newCount = (existing?.attemptCount || 1) + 1;
    const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, "");
    const key = `refitem_${cleanId}_att${newCount}`;
    const receipt = `rfnd_${cleanId.slice(-8)}_a${newCount}`.slice(0, 40);
    if (existing) {
      existing.attemptCount = newCount;
      existing.lastAttemptKey = key;
      existing.lastReceipt = receipt;
    }
    return { attemptCount: newCount, key, receipt };
  }

  getStudent(id: string): DemoStudent | null {
    return this.students.get(id) || null;
  }

  listStudents(): DemoStudent[] {
    return Array.from(this.students.values());
  }

  findPaymentById(id: string): DemoPayment | null {
    return this.payments.get(id) || null;
  }

  getAllocationsForPayment(paymentId: string): DemoAllocation[] {
    return this.allocations.filter((a) => a.paymentId === paymentId);
  }

  getRefundItemsForPayment(paymentId: string): DemoRefundItem[] {
    return Array.from(this.refundItems.values()).filter((r) => r.paymentId === paymentId);
  }

  getProviderEventsForPayment(provider: string, providerPaymentId?: string, orderId?: string | null): DemoProviderEvent[] {
    return Array.from(this.providerEvents.values()).filter((evt) => {
      if (evt.provider !== provider) return false;
      if (providerPaymentId && (evt.providerEventId.includes(providerPaymentId) || evt.payloadJson.includes(providerPaymentId))) return true;
      if (orderId && evt.payloadJson.includes(orderId)) return true;
      return false;
    });
  }

  getUnmatchedPayments(): DemoPayment[] {
    return Array.from(this.payments.values())
      .filter((p) => p.matchStatus === "UNMATCHED" || p.unallocatedAmount > 0n)
      .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());
  }

  findReminderById(id: string): DemoReminder | undefined {
    return this.reminders.find((r) => r.id === id);
  }

  updateReminder(id: string, patch: Partial<DemoReminder>): void {
    const idx = this.reminders.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.reminders[idx] = { ...this.reminders[idx], ...patch };
    }
  }

  recordReminderAttempt(
    attempt: Omit<DemoReminderAttempt, "id" | "attemptedAt"> & { attemptedAt?: Date }
  ): DemoReminderAttempt {
    const rec: DemoReminderAttempt = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      attemptedAt: attempt.attemptedAt || new Date(),
      ...attempt,
    };
    this.reminderAttempts.push(rec);
    return rec;
  }

  getAttemptsForReminder(reminderId: string): DemoReminderAttempt[] {
    return this.reminderAttempts
      .filter((a) => a.reminderId === reminderId)
      .sort(
        (a, b) =>
          b.attemptedAt.getTime() - a.attemptedAt.getTime() ||
          b.attemptNumber - a.attemptNumber
      );
  }

  recordAuditLog(data: Omit<DemoAuditLog, "id" | "createdAt">): DemoAuditLog {
    const log: DemoAuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...data,
      createdAt: new Date(),
    };
    this.auditLogs.push(log);
    return log;
  }
}

export const demoPaymentStore = new DemoPaymentStore();
