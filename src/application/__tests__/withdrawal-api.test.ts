import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as getPolicy } from "@/app/api/withdrawals/policy/route";
import { GET as listWithdrawals } from "@/app/api/withdrawals/route";
import { POST as previewWithdrawal } from "@/app/api/withdrawals/preview/route";
import { POST as requestWithdrawal } from "@/app/api/withdrawals/request/route";
import { POST as approveWithdrawal } from "@/app/api/withdrawals/approve/route";
import { POST as executeRefundItem } from "@/app/api/withdrawals/execute-item/route";
import * as sessionModule from "@/infrastructure/auth/session";
import { Actor } from "@/application/actor";
import { demoPaymentStore } from "@/infrastructure/db/demo-payment-store";

describe("Withdrawal & Refund API Routes", () => {
  const directorActor: Actor = {
    userId: "usr_director_arvind",
    name: "Arvind Mathur",
    role: "DIRECTOR",
    centreIds: ["cen_vaishali", "cen_tonk", "cen_malviya", "cen_mansarovar"],
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  const accountsActor: Actor = {
    userId: "usr_accounts_neha",
    name: "Neha Verma",
    role: "ACCOUNTS",
    centreIds: ["cen_vaishali", "cen_malviya"],
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  beforeEach(() => {
    demoPaymentStore.reset();
    demoPaymentStore.seedKavyaWithdrawalData();
    vi.restoreAllMocks();
  });

  it("GET /api/withdrawals/policy -> returns 200 and statutory policy details", async () => {
    const res = await getPolicy();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.policy.version).toBe("v1.0");
    expect(data.policy.policyHash).toBe("7c3a88bf0a012d9e6e01a5b82098d41e739ad005fbcba72513a890989ad65e91");
  });

  it("GET /api/withdrawals -> returns 403 when unauthenticated", async () => {
    vi.spyOn(sessionModule, "getSessionActor").mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/withdrawals");
    const res = await listWithdrawals(req);
    expect(res.status).toBe(403);
  });

  it("GET /api/withdrawals -> returns 200 and serialized case list for Director", async () => {
    vi.spyOn(sessionModule, "getSessionActor").mockResolvedValue(directorActor);

    const req = new Request("http://localhost:3000/api/withdrawals");
    const res = await listWithdrawals(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.cases.length).toBeGreaterThan(0);
    expect(typeof data.cases[0].netFeePaise).toBe("string");
  });

  it("POST /api/withdrawals/preview -> returns 400 when studentId is missing", async () => {
    vi.spyOn(sessionModule, "getSessionActor").mockResolvedValue(accountsActor);

    const req = new Request("http://localhost:3000/api/withdrawals/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ effectiveWithdrawalDate: "2026-11-05" }),
    });

    const res = await previewWithdrawal(req);
    expect(res.status).toBe(400);
  });

  it("POST /api/withdrawals/preview -> returns 200 with pro-rata calculation breakdown", async () => {
    vi.spyOn(sessionModule, "getSessionActor").mockResolvedValue(accountsActor);

    const req = new Request("http://localhost:3000/api/withdrawals/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: "STU-0587",
        effectiveWithdrawalDate: "2026-11-05",
      }),
    });

    const res = await previewWithdrawal(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.calculation.consumedDays).toBe(144);
    expect(data.calculation.totalServiceDays).toBe(290);
    expect(data.calculation.shortfallIsInformationalOnly).toBe(true);
  });

  it("POST /api/withdrawals/request -> returns 200 and creates withdrawal quote for Accounts", async () => {
    vi.spyOn(sessionModule, "getSessionActor").mockResolvedValue(accountsActor);

    // Create for Ishita
    const req = new Request("http://localhost:3000/api/withdrawals/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: "STU-0587",
        effectiveWithdrawalDate: "2026-11-05",
        notes: "Accounts quote creation",
      }),
    });

    const res = await requestWithdrawal(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.withdrawalId).toBeDefined();
    expect(data.calculation.consumedDays).toBe(144);
  });

  it("POST /api/withdrawals/approve -> returns 403 when Accounts attempts approval", async () => {
    vi.spyOn(sessionModule, "getSessionActor").mockResolvedValue(accountsActor);

    const req = new Request("http://localhost:3000/api/withdrawals/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        withdrawalId: "wd-001",
        decision: "APPROVED",
      }),
    });

    const res = await approveWithdrawal(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/withdrawals/approve -> returns 403 on Maker-Checker violation", async () => {
    // Create a withdrawal requested by Director Arvind Mathur
    const wd = demoPaymentStore.createWithdrawal({
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
      requesterId: directorActor.userId, // Arvind Mathur requested
    });

    // Arvind Mathur attempts to approve own request
    vi.spyOn(sessionModule, "getSessionActor").mockResolvedValue(directorActor);

    const req = new Request("http://localhost:3000/api/withdrawals/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        withdrawalId: wd.id,
        decision: "APPROVED",
      }),
    });

    const res = await approveWithdrawal(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("Maker-checker violation");
  });

  it("POST /api/withdrawals/approve -> returns 200 when Director approves Accounts submission", async () => {
    vi.spyOn(sessionModule, "getSessionActor").mockResolvedValue(directorActor);

    const req = new Request("http://localhost:3000/api/withdrawals/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        withdrawalId: "wd-001", // Requested by Neha Verma
        decision: "APPROVED",
        notes: "Approved under MoE 2024 policy",
      }),
    });

    const res = await approveWithdrawal(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.result.makerCheckerVerified).toBe(true);
    expect(data.result.status).toBe("APPROVED");
  });

  it("POST /api/withdrawals/execute-item -> executes refund item and returns 200", async () => {
    vi.spyOn(sessionModule, "getSessionActor").mockResolvedValue(accountsActor);

    const req = new Request("http://localhost:3000/api/withdrawals/execute-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refundItemId: "item-3", // item-3 is failed in seed
      }),
    });

    const res = await executeRefundItem(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.item.status).toBe("SUCCEEDED");
  });
});
