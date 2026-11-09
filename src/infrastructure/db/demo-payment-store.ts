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
  status: "PENDING" | "CAPTURED" | "FAILED" | "REFUNDED";
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
  status: "QUEUED" | "SENT" | "SKIPPED" | "CANCELLED";
  skipReason?: string;
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

    // 2. Mohit Gurjar (STU-0219): NEET 2027 Morning, Mansarovar
    // 3 x ₹40,000 instalments.
    // Inst 1: Due 2026-11-15, Paid ₹0.
    const mohitId = "stu_mohit_0219";
    const instMohit1Id = "inst_mohit_1";

    this.instalments.set(instMohit1Id, {
      id: instMohit1Id,
      studentId: mohitId,
      feePlanId: "plan_mohit_neet",
      sequence: 1,
      dueDate: new Date("2026-11-15"),
      amount: 4000000n,
      status: "DUE",
    });

    this.ledgerEntries.push({
      id: "led_mohit_chg_1",
      studentId: mohitId,
      instalmentId: instMohit1Id,
      entryType: "CHARGE",
      amount: 4000000n,
      entryDate: new Date("2026-06-15"),
    });

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
}

export const demoPaymentStore = new DemoPaymentStore();
