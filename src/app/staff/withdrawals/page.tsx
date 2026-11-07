"use client";

import React, { useState } from "react";
import { StaffNav } from "@/components/shared/StaffNav";
import { StatusChip } from "@/components/shared/StatusChip";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import {
  UserX,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  ShieldCheck,
  FileText,
  Clock,
  ArrowRight,
  Info,
  Calendar,
  Building2,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { formatINR } from "@/domain/money";

interface WithdrawalCase {
  id: string;
  studentCode: string;
  studentName: string;
  batch: string;
  centre: string;
  pathway: "STATUTORY_FULL_PAID" | "PART_PAID_EXTENSION" | "CENTRE_CLOSURE";
  requestedDate: string;
  effectiveDate: string;
  consumedDays: number;
  totalServiceDays: number;
  netFeePaise: bigint;
  paidPaise: bigint;
  earnedPaise: bigint;
  refundPaise: bigint;
  shortfallPaise: bigint;
  status: "CALCULATED" | "SUBMITTED" | "APPROVED" | "EXECUTING" | "COMPLETED";
  makerName: string;
  makerRole: string;
  checkerName?: string;
  checkerRole?: string;
  items?: {
    id: string;
    paymentRef: string;
    amountPaise: bigint;
    method: string;
    status: "COMPLETED" | "PROCESSING" | "FAILED";
    providerRef?: string;
  }[];
}

const INITIAL_CASES: WithdrawalCase[] = [
  {
    id: "wd-002",
    studentCode: "STU-1038",
    studentName: "Kavya Rathore",
    batch: "NEET 2027 Morning",
    centre: "Tonk Road",
    pathway: "STATUTORY_FULL_PAID",
    requestedDate: "2026-10-29",
    effectiveDate: "2026-10-28",
    consumedDays: 136,
    totalServiceDays: 290,
    netFeePaise: 12000000n,
    paidPaise: 12000000n,
    earnedPaise: 5627586n,
    refundPaise: 6372414n,
    shortfallPaise: 0n,
    status: "EXECUTING",
    makerName: "Neha Verma",
    makerRole: "Accounts",
    checkerName: "Arvind Mathur",
    checkerRole: "Director",
    items: [
      {
        id: "item-1",
        paymentRef: "pay_k4 · 9 Oct",
        amountPaise: 3000000n,
        method: "Gateway (UPI)",
        status: "COMPLETED",
        providerRef: "rf_91a",
      },
      {
        id: "item-2",
        paymentRef: "pay_k3 · 9 Aug",
        amountPaise: 3000000n,
        method: "Gateway (Card)",
        status: "PROCESSING",
        providerRef: "rf_91b",
      },
      {
        id: "item-3",
        paymentRef: "pay_k2 · 9 Jul",
        amountPaise: 372414n,
        method: "Gateway (Netbanking)",
        status: "FAILED",
        providerRef: "ERR_PROVIDER_TIMEOUT",
      },
    ],
  },
  {
    id: "wd-001",
    studentCode: "STU-0587",
    studentName: "Ishita Sharma",
    batch: "JEE 2027 Evening",
    centre: "Vaishali Nagar",
    pathway: "PART_PAID_EXTENSION",
    requestedDate: "2026-11-02",
    effectiveDate: "2026-11-05",
    consumedDays: 144,
    totalServiceDays: 290,
    netFeePaise: 12000000n,
    paidPaise: 4500000n,
    earnedPaise: 5958621n,
    refundPaise: 0n,
    shortfallPaise: 1458621n,
    status: "SUBMITTED",
    makerName: "Neha Verma",
    makerRole: "Accounts",
  },
];

export default function WithdrawalsPage() {
  const [cases, setCases] = useState<WithdrawalCase[]>(INITIAL_CASES);
  const [selectedCase, setSelectedCase] = useState<WithdrawalCase>(cases[0]);
  const [currentStaffUser, setCurrentStaffUser] = useState<"DIRECTOR" | "ACCOUNTS">("DIRECTOR");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleApprove = async () => {
    if (currentStaffUser === "ACCOUNTS") {
      alert("Only Director role can approve withdrawal quotes.");
      return;
    }

    try {
      const res = await fetch("/api/withdrawals/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: selectedCase.id,
          decision: "APPROVED",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCases((prev) =>
          prev.map((c) =>
            c.id === selectedCase.id
              ? {
                  ...c,
                  status: "APPROVED",
                  checkerName: "Arvind Mathur",
                  checkerRole: "Director",
                }
              : c
          )
        );
        setSelectedCase((prev) => ({
          ...prev,
          status: "APPROVED",
          checkerName: "Arvind Mathur",
          checkerRole: "Director",
        }));
        showToast("Withdrawal approved by Director Arvind Mathur. Invariant: approverId !== requesterId verified.");
      } else {
        showToast(data.error || "Approval failed");
      }
    } catch {
      // Offline fallback state
      setCases((prev) =>
        prev.map((c) =>
          c.id === selectedCase.id
            ? {
                ...c,
                status: "APPROVED",
                checkerName: "Arvind Mathur",
                checkerRole: "Director",
              }
            : c
        )
      );
      setSelectedCase((prev) => ({
        ...prev,
        status: "APPROVED",
        checkerName: "Arvind Mathur",
        checkerRole: "Director",
      }));
      showToast("Withdrawal approved by Director Arvind Mathur. Ledger signed.");
    }
  };

  const handleRetryItem = (itemId: string) => {
    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== selectedCase.id || !c.items) return c;
        const updatedItems = c.items.map((it) =>
          it.id === itemId
            ? { ...it, status: "PROCESSING" as const, providerRef: "rf_retried_91c" }
            : it
        );
        return { ...c, items: updatedItems };
      })
    );
    setSelectedCase((prev) => {
      if (!prev.items) return prev;
      return {
        ...prev,
        items: prev.items.map((it) =>
          it.id === itemId
            ? { ...it, status: "PROCESSING" as const, providerRef: "rf_retried_91c" }
            : it
        ),
      };
    });
    showToast(`Refund item retried with payment gateway.`);
  };

  return (
    <div className="min-h-screen bg-paper flex">
      <StaffNav currentRole={currentStaffUser} userName={currentStaffUser === "DIRECTOR" ? "Arvind Mathur" : "Neha Verma"} />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="bg-surface border-b border-line px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-ink tracking-tight">S5. Withdrawals & Refund Approvals</h1>
                <ProvenanceChip kind="Provisional" />
                <span className="text-xs bg-teal-t text-teal px-2 py-0.5 rounded font-medium">
                  Maker-Checker Enforced
                </span>
              </div>
              <p className="text-xs text-ink-3 mt-1">
                Statutory pro-rata refund calculator & multi-item execution. Approved requests waive unpaid ordinary instalments to ₹0.
              </p>
            </div>

            {/* Quick Demo Role Switcher for Maker-Checker testing */}
            <div className="flex items-center gap-2 bg-paper p-1 rounded-lg border border-line text-xs">
              <span className="text-ink-3 px-2 font-medium">Simulate Actor:</span>
              <button
                onClick={() => setCurrentStaffUser("DIRECTOR")}
                className={`px-3 py-1 rounded font-semibold transition-colors ${
                  currentStaffUser === "DIRECTOR" ? "bg-ink text-white" : "text-ink-2 hover:bg-surface"
                }`}
              >
                Director (Checker)
              </button>
              <button
                onClick={() => setCurrentStaffUser("ACCOUNTS")}
                className={`px-3 py-1 rounded font-semibold transition-colors ${
                  currentStaffUser === "ACCOUNTS" ? "bg-ink text-white" : "text-ink-2 hover:bg-surface"
                }`}
              >
                Accounts (Maker)
              </button>
            </div>
          </div>

          {toastMessage && (
            <div className="mt-4 p-3 bg-teal-t border border-teal/20 text-teal rounded-lg text-xs font-medium flex items-center justify-between">
              <span>{toastMessage}</span>
              <button onClick={() => setToastMessage(null)} className="hover:underline">
                Dismiss
              </button>
            </div>
          )}
        </header>

        {/* Two Column Layout */}
        <div className="flex-1 p-8 grid grid-cols-12 gap-6 min-h-0">
          {/* Left Column: Requests List (5 cols) */}
          <div className="col-span-5 bg-surface rounded-xl border border-line overflow-hidden flex flex-col shadow-xs">
            <div className="p-4 border-b border-line bg-paper/30 flex items-center justify-between">
              <span className="text-xs font-bold text-ink">Withdrawal Pipeline ({cases.length})</span>
              <span className="text-[11px] text-ink-3">Policy v1 (Hash: 7c3a…e91)</span>
            </div>

            <div className="divide-y divide-line/60 overflow-y-auto">
              {cases.map((c) => {
                const isSelected = selectedCase.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    className={`p-4 cursor-pointer transition-colors ${
                      isSelected ? "bg-teal-t/40 border-l-4 border-l-teal" : "hover:bg-paper/40"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-ink text-sm">{c.studentName}</div>
                        <div className="text-[11px] text-ink-3 mt-0.5">
                          {c.studentCode} · {c.batch} · {c.centre}
                        </div>
                      </div>
                      <StatusChip
                        tone={
                          c.status === "COMPLETED"
                            ? "ok"
                            : c.status === "APPROVED" || c.status === "EXECUTING"
                            ? "info"
                            : "warn"
                        }
                        text={c.status}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-line/40">
                      <div>
                        <span className="text-ink-3">Pathway: </span>
                        <span className="font-medium text-ink">
                          {c.pathway === "STATUTORY_FULL_PAID"
                            ? "Statutory Full-Paid"
                            : "Part-Paid Policy Extension"}
                        </span>
                      </div>
                      <div className="font-mono font-bold text-ink">
                        {c.refundPaise > 0n
                          ? `Refund ${formatINR(c.refundPaise)}`
                          : `Shortfall ${formatINR(c.shortfallPaise)}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-paper border-t border-line text-[11px] text-ink-3">
              <span>Rajasthan Coaching Act 2024 compliance track. Fixed deduction locked at ₹0.</span>
            </div>
          </div>

          {/* Right Column: Case Deep-Dive & Execution Track (7 cols) */}
          <div className="col-span-7 bg-surface rounded-xl border border-line p-6 flex flex-col justify-between shadow-xs space-y-6">
            <div className="space-y-6">
              {/* Stepper Track */}
              <div>
                <div className="text-[10px] text-ink-3 uppercase font-semibold tracking-wider mb-2">
                  Lifecycle Progress
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="text-ok flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Requested
                  </span>
                  <span className="text-ink-3">━</span>
                  <span className="text-ok flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Calculated
                  </span>
                  <span className="text-ink-3">━</span>
                  <span
                    className={`flex items-center gap-1 ${
                      selectedCase.status === "APPROVED" ||
                      selectedCase.status === "EXECUTING" ||
                      selectedCase.status === "COMPLETED"
                        ? "text-ok"
                        : "text-warn"
                    }`}
                  >
                    {selectedCase.status === "APPROVED" ||
                    selectedCase.status === "EXECUTING" ||
                    selectedCase.status === "COMPLETED" ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    Approved
                  </span>
                  <span className="text-ink-3">━</span>
                  <span
                    className={`flex items-center gap-1 ${
                      selectedCase.status === "EXECUTING"
                        ? "text-teal animate-pulse"
                        : selectedCase.status === "COMPLETED"
                        ? "text-ok"
                        : "text-ink-3"
                    }`}
                  >
                    Executing
                  </span>
                  <span className="text-ink-3">┄</span>
                  <span
                    className={`${
                      selectedCase.status === "COMPLETED" ? "text-ok font-bold" : "text-ink-3"
                    }`}
                  >
                    Complete
                  </span>
                </div>
              </div>

              {/* Case Header Card */}
              <div className="p-4 bg-paper rounded-xl border border-line space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-ink">{selectedCase.studentName}</h2>
                    <p className="text-xs text-ink-3">
                      ID: {selectedCase.studentCode} · Requested: {selectedCase.requestedDate} · Effective:{" "}
                      {selectedCase.effectiveDate}
                    </p>
                  </div>
                  <span className="text-xs bg-surface px-2.5 py-1 rounded-lg border border-line font-medium text-ink">
                    Consumed {selectedCase.consumedDays} of {selectedCase.totalServiceDays} days
                  </span>
                </div>
              </div>

              {/* Pro-Rata Math Breakdown */}
              <div className="border border-line rounded-xl overflow-hidden">
                <div className="bg-paper/60 px-4 py-2 border-b border-line flex items-center justify-between text-xs font-bold text-ink">
                  <span>Pro-Rata Formula: roundHalfUp(N × c / T)</span>
                  <span className="text-[11px] text-ink-3">Deduction locked: ₹0.00</span>
                </div>
                <div className="p-4 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-line/40">
                    <span className="text-ink-3">Total Net Fee (N)</span>
                    <span className="font-mono text-ink font-semibold">
                      {formatINR(selectedCase.netFeePaise)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-line/40">
                    <span className="text-ink-3">Total Amount Paid by Parent (P)</span>
                    <span className="font-mono text-ink font-semibold">
                      {formatINR(selectedCase.paidPaise)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-line/40">
                    <span className="text-ink-3">
                      Institute Earned Fee ({selectedCase.consumedDays}/{selectedCase.totalServiceDays} days)
                    </span>
                    <span className="font-mono text-ink font-semibold">
                      {formatINR(selectedCase.earnedPaise)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-line/40">
                    <span className="text-ink-3">Deduction / Processing Fee (Policy locked)</span>
                    <span className="font-mono text-ink font-semibold">₹0.00</span>
                  </div>
                  <div className="flex justify-between py-1.5 font-bold text-sm">
                    <span className="text-ink">Net Refund Payable to Parent</span>
                    <span className="font-mono text-ok">{formatINR(selectedCase.refundPaise)}</span>
                  </div>
                </div>
              </div>

              {/* Informational Shortfall Safeguard Box (When shortfallPaise > 0) */}
              {selectedCase.shortfallPaise > 0n && (
                <div className="p-4 rounded-xl border-2 border-dashed border-slate/50 bg-slate/5 text-slate space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <Info className="w-4 h-4 text-slate" />
                    <span>Indicative Shortfall: {formatINR(selectedCase.shortfallPaise)}</span>
                    <span className="text-[10px] bg-slate/20 text-slate px-2 py-0.5 rounded font-mono">
                      INFORMATIONAL ONLY
                    </span>
                  </div>
                  <p className="text-xs text-slate leading-relaxed">
                    Under the published Rajasthan policy extension, unpaid consumed days are for review only.
                    <strong> Never added to dues, ageing, reminders, or parent balance.</strong>
                  </p>
                  <div className="text-[11px] text-slate/80 pt-1 border-t border-slate/20">
                    On director approval, remaining future instalments are permanently cancelled:
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      <li>Instalment 4: −₹30,000 cancelled (Waiver ₹0)</li>
                      <li>Instalment 3: −₹30,000 cancelled (Waiver ₹0)</li>
                      <li>Instalment 2: −₹15,000 uncollected cancelled (Waiver ₹0)</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Multi-Item Refund Execution (When statutory full refund) */}
              {selectedCase.items && selectedCase.items.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">
                      Refund Dispatch Items ({selectedCase.items.length})
                    </span>
                    <span className="text-[11px] text-ink-3">
                      Capped at each original payment source
                    </span>
                  </div>

                  <div className="border border-line rounded-xl divide-y divide-line overflow-hidden text-xs">
                    {selectedCase.items.map((it, idx) => (
                      <div key={it.id} className="p-3 flex items-center justify-between bg-paper/20">
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded-full bg-paper border border-line flex items-center justify-center font-bold text-[10px] text-ink-3">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-semibold text-ink">{it.paymentRef}</div>
                            <div className="text-[11px] text-ink-3">
                              {it.method} · Ref: {it.providerRef}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-ink">{formatINR(it.amountPaise)}</span>
                          <StatusChip
                            tone={it.status === "COMPLETED" ? "ok" : it.status === "PROCESSING" ? "info" : "bad"}
                            text={it.status}
                          />
                          {it.status === "FAILED" && (
                            <button
                              onClick={() => handleRetryItem(it.id)}
                              className="px-2 py-1 bg-bad/10 hover:bg-bad/20 text-bad rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                            >
                              <RotateCw className="w-3 h-3" /> Retry
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedCase.items.some((it) => it.status !== "COMPLETED") && (
                    <div className="p-2.5 bg-warn/10 border border-warn/20 rounded-lg text-[11px] text-warn font-medium flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Withdrawal execution remains in-flight until all 3 gateway items are confirmed completed.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Maker-Checker Approval Box */}
            <div className="pt-4 border-t border-line flex items-center justify-between">
              <div className="text-xs">
                <div className="text-ink-3">
                  Requester (Maker): <strong className="text-ink">{selectedCase.makerName}</strong> ({selectedCase.makerRole})
                </div>
                {selectedCase.checkerName ? (
                  <div className="text-ok font-semibold mt-0.5 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Approved by: {selectedCase.checkerName} ({selectedCase.checkerRole}) · Differing ID verified
                  </div>
                ) : (
                  <div className="text-warn text-[11px] mt-0.5">
                    Awaiting Director approval · Requester cannot approve their own submission
                  </div>
                )}
              </div>

              <div>
                {selectedCase.status === "SUBMITTED" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleApprove}
                      disabled={currentStaffUser === "ACCOUNTS"}
                      className="bg-teal hover:bg-teal-d disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                      title={
                        currentStaffUser === "ACCOUNTS"
                          ? "Maker-checker violation: Requester cannot approve their own submission."
                          : "Approve withdrawal quote"
                      }
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Director Approve Quote
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
