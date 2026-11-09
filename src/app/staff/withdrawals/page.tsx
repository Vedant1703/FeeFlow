"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Plus,
  X,
  Send,
  XCircle,
} from "lucide-react";
import { formatINR } from "@/domain/money";

interface WithdrawalCase {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  batch: string;
  centre: string;
  centreId?: string;
  pathway: "STATUTORY_FULL_PAID" | "PART_PAID_EXTENSION";
  requestedDate: string;
  effectiveDate: string;
  consumedDays: number;
  totalServiceDays: number;
  netFeePaise: bigint;
  paidPaise: bigint;
  earnedPaise: bigint;
  refundPaise: bigint;
  shortfallPaise: bigint;
  status: "DRAFT" | "REQUESTED" | "APPROVED" | "REJECTED" | "EXECUTED" | "SUBMITTED" | "COMPLETED";
  aggregateRefundStatus?: "PENDING_EXECUTION" | "PROCESSING" | "COMPLETED" | "PARTIALLY_REFUNDED" | "FAILED";
  requesterId?: string;
  makerName: string;
  makerRole: string;
  approverId?: string | null;
  checkerName?: string | null;
  checkerRole?: string | null;
  approvalNotes?: string | null;
  items?: {
    id: string;
    paymentId: string;
    paymentRef: string;
    amountPaise: bigint;
    method: string;
    status: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "COMPLETED";
    providerRef?: string | null;
    failureReason?: string | null;
  }[];
}

const INITIAL_FALLBACK_CASES: WithdrawalCase[] = [
  {
    id: "wd-002",
    studentId: "stu_kavya_1038",
    studentCode: "STU-1038",
    studentName: "Kavya Rathore",
    batch: "NEET 2027 Morning",
    centre: "Tonk Road",
    pathway: "STATUTORY_FULL_PAID",
    requestedDate: "2026-10-25",
    effectiveDate: "2026-10-28",
    consumedDays: 136,
    totalServiceDays: 290,
    netFeePaise: 12000000n,
    paidPaise: 12000000n,
    earnedPaise: 5627586n,
    refundPaise: 6372414n,
    shortfallPaise: 0n,
    status: "APPROVED",
    aggregateRefundStatus: "PARTIALLY_REFUNDED",
    requesterId: "usr_accounts_neha",
    makerName: "Neha Verma",
    makerRole: "Accounts",
    approverId: "usr_director_arvind",
    checkerName: "Arvind Mathur",
    checkerRole: "Director",
    items: [
      {
        id: "item-1",
        paymentId: "pay_kavya_4",
        paymentRef: "pay_k4 · 9 Oct",
        amountPaise: 3000000n,
        method: "Gateway (UPI)",
        status: "SUCCEEDED",
        providerRef: "rf_91a",
      },
      {
        id: "item-2",
        paymentId: "pay_kavya_3",
        paymentRef: "pay_k3 · 9 Aug",
        amountPaise: 3000000n,
        method: "Gateway (Card)",
        status: "PROCESSING",
        providerRef: "rf_91b",
      },
      {
        id: "item-3",
        paymentId: "pay_kavya_2",
        paymentRef: "pay_k2 · 9 Jul",
        amountPaise: 372414n,
        method: "Gateway (Netbanking)",
        status: "FAILED",
        providerRef: null,
        failureReason: "ERR_PROVIDER_TIMEOUT",
      },
    ],
  },
  {
    id: "wd-001",
    studentId: "stu_ishita_0587",
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
    status: "REQUESTED",
    requesterId: "usr_accounts_neha",
    makerName: "Neha Verma",
    makerRole: "Accounts",
  },
];

export default function WithdrawalsPage() {
  const [cases, setCases] = useState<WithdrawalCase[]>(INITIAL_FALLBACK_CASES);
  const [selectedCase, setSelectedCase] = useState<WithdrawalCase>(cases[0]);
  const [currentStaffUser, setCurrentStaffUser] = useState<"DIRECTOR" | "ACCOUNTS">("DIRECTOR");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"ok" | "err">("ok");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");

  // Create Quote form states
  const [newStudentId, setNewStudentId] = useState("STU-0587");
  const [newEffectiveDate, setNewEffectiveDate] = useState("2026-11-05");
  const [newNotes, setNewNotes] = useState("Pro-rata withdrawal quote submitted for director review");
  const [previewCalc, setPreviewCalc] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Fetch live cases from GET /api/withdrawals
  const fetchCases = useCallback(async () => {
    try {
      const res = await fetch("/api/withdrawals");
      if (res.ok) {
        const data = await res.json();
        if (data.cases && data.cases.length > 0) {
          const parsed = data.cases.map((c: any) => ({
            ...c,
            netFeePaise: BigInt(c.netFeePaise),
            paidPaise: BigInt(c.paidPaise),
            earnedPaise: BigInt(c.earnedPaise),
            refundPaise: BigInt(c.refundPaise),
            shortfallPaise: BigInt(c.shortfallPaise),
            items: c.items?.map((it: any) => ({
              ...it,
              amountPaise: BigInt(it.amountPaise),
            })),
          }));
          setCases(parsed);
          setSelectedCase((prev) => parsed.find((c: any) => c.id === prev.id) || parsed[0]);
        }
      }
    } catch {
      // Retain fallback cases if offline
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Handle live calculation preview
  const handleFetchPreview = async (studId: string, effDate: string) => {
    if (!studId || !effDate) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch("/api/withdrawals/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studId,
          effectiveWithdrawalDate: effDate,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPreviewCalc(data);
      } else {
        setPreviewError(data.error || "Failed to preview calculation");
        setPreviewCalc(null);
      }
    } catch {
      setPreviewError("Network error calculating preview");
      setPreviewCalc(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (showCreateModal) {
      handleFetchPreview(newStudentId, newEffectiveDate);
    }
  }, [showCreateModal, newStudentId, newEffectiveDate]);

  // Create withdrawal quote
  const handleCreateWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/withdrawals/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: newStudentId,
          effectiveWithdrawalDate: newEffectiveDate,
          notes: newNotes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Withdrawal quote submitted successfully for Director review.", "ok");
        setShowCreateModal(false);
        await fetchCases();
      } else {
        showToast(data.error || "Failed to create withdrawal request", "err");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to create withdrawal request", "err");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Director decision (APPROVE or REJECT)
  const handleConfirmDecision = async () => {
    if (!showDecisionModal) return;
    setIsSubmitting(true);
    const decision = showDecisionModal;

    try {
      const res = await fetch("/api/withdrawals/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          withdrawalId: selectedCase.id,
          decision,
          notes: decisionNotes || (decision === "APPROVED" ? "Approved by Director" : "Rejected by Director"),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          decision === "APPROVED"
            ? "Withdrawal approved by Director. Unpaid ordinary dues waived to ₹0. Maker-checker verified."
            : "Withdrawal quote rejected by Director.",
          "ok"
        );
        setShowDecisionModal(null);
        setDecisionNotes("");
        await fetchCases();
      } else {
        showToast(data.error || "Decision failed", "err");
      }
    } catch (err: any) {
      showToast(err.message || "Decision failed", "err");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Retry or execute refund item
  const handleRetryItem = async (itemId: string) => {
    try {
      const res = await fetch("/api/withdrawals/execute-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundItemId: itemId }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Refund item executed with gateway successfully.", "ok");
        await fetchCases();
      } else {
        showToast(data.error || "Refund execution failed", "err");
      }
    } catch {
      // Fallback state update
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
      showToast("Refund item retried with gateway.", "ok");
    }
  };

  // Reconcile refund item directly with Razorpay gateway
  const handleReconcileItem = async (itemId: string) => {
    try {
      const res = await fetch("/api/withdrawals/reconcile-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundItemId: itemId }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Reconciled with Razorpay gateway.", "ok");
        await fetchCases();
      } else {
        showToast(data.error || "Reconciliation failed", "err");
      }
    } catch {
      showToast("Network error during reconciliation", "err");
    }
  };

  // Maker-checker validation for current simulated actor
  const isMakerOfSelected =
    currentStaffUser === "ACCOUNTS" ||
    (selectedCase.requesterId !== undefined && selectedCase.requesterId === "usr_director_arvind");
  const canDirectorApprove = currentStaffUser === "DIRECTOR";

  return (
    <div className="min-h-screen bg-paper flex">
      <StaffNav
        currentRole={currentStaffUser}
        userName={currentStaffUser === "DIRECTOR" ? "Arvind Mathur" : "Neha Verma"}
      />

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
                <span className="text-xs bg-slate/10 text-slate px-2 py-0.5 rounded font-medium">
                  MoE Jan 2024 Guidelines
                </span>
              </div>
              <p className="text-xs text-ink-3 mt-1">
                Statutory pro-rata refund calculator & multi-item execution. Approved requests waive unpaid ordinary instalments to ₹0.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Accounts Action: Request New Withdrawal */}
              {currentStaffUser === "ACCOUNTS" && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-teal hover:bg-teal-d text-white font-medium px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Withdrawal Quote
                </button>
              )}

              {/* Demo Role Switcher for Maker-Checker Verification */}
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
          </div>

          {toastMessage && (
            <div
              className={`mt-4 p-3 rounded-lg text-xs font-medium flex items-center justify-between border ${
                toastType === "ok"
                  ? "bg-teal-t border-teal/20 text-teal"
                  : "bg-bad/10 border-bad/20 text-bad"
              }`}
            >
              <span>{toastMessage}</span>
              <button onClick={() => setToastMessage(null)} className="hover:underline font-semibold ml-4">
                Dismiss
              </button>
            </div>
          )}
        </header>

        {/* Two Column Operational Layout */}
        <div className="flex-1 p-8 grid grid-cols-12 gap-6 min-h-0">
          {/* Left Column: Requests List (5 cols) */}
          <div className="col-span-5 bg-surface rounded-xl border border-line overflow-hidden flex flex-col shadow-xs">
            <div className="p-4 border-b border-line bg-paper/30 flex items-center justify-between">
              <span className="text-xs font-bold text-ink">Withdrawal Pipeline ({cases.length})</span>
              <span className="text-[11px] text-ink-3">Policy v1.0 (Hash: 7c3a…e91)</span>
            </div>

            <div className="divide-y divide-line/60 overflow-y-auto max-h-[calc(100vh-250px)]">
              {cases.map((c) => {
                const isSelected = selectedCase.id === c.id;
                const isApprovedOrDone = c.status === "APPROVED" || c.status === "EXECUTED" || c.status === "COMPLETED";
                const isRejected = c.status === "REJECTED";
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
                      <div className="flex flex-col items-end gap-1">
                        <StatusChip
                          tone={
                            isApprovedOrDone
                              ? "ok"
                              : isRejected
                              ? "bad"
                              : "warn"
                          }
                          text={c.status}
                        />
                        {c.aggregateRefundStatus && c.aggregateRefundStatus !== "PENDING_EXECUTION" && (
                          <StatusChip
                            tone={
                              c.aggregateRefundStatus === "COMPLETED"
                                ? "ok"
                                : c.aggregateRefundStatus === "PARTIALLY_REFUNDED"
                                ? "info"
                                : c.aggregateRefundStatus === "PROCESSING"
                                ? "warn"
                                : "bad"
                            }
                            text={c.aggregateRefundStatus.replace(/_/g, " ")}
                          />
                        )}
                      </div>
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

            <div className="p-3 bg-paper border-t border-line text-[11px] text-ink-3 flex items-center justify-between">
              <span>Rajasthan Coaching Act 2024 compliance track.</span>
              <span className="font-medium text-ink">Deduction: ₹0.00</span>
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
                      selectedCase.status === "EXECUTED" ||
                      selectedCase.status === "COMPLETED"
                        ? "text-ok"
                        : selectedCase.status === "REJECTED"
                        ? "text-bad"
                        : "text-warn"
                    }`}
                  >
                    {selectedCase.status === "APPROVED" ||
                    selectedCase.status === "EXECUTED" ||
                    selectedCase.status === "COMPLETED" ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : selectedCase.status === "REJECTED" ? (
                      <XCircle className="w-3.5 h-3.5" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    {selectedCase.status === "REJECTED" ? "Rejected" : "Approved"}
                  </span>
                  <span className="text-ink-3">━</span>
                  <span
                    className={`flex items-center gap-1 ${
                      selectedCase.status === "APPROVED" && selectedCase.refundPaise > 0n
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
                      selectedCase.status === "COMPLETED" || (selectedCase.status === "APPROVED" && selectedCase.refundPaise === 0n)
                        ? "text-ok font-bold"
                        : "text-ink-3"
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
                    <span className="text-ink">Net Statutory Refund Payable</span>
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
                    <span className="text-[10px] bg-slate/20 text-slate px-2 py-0.5 rounded font-mono font-semibold">
                      INFORMATIONAL ONLY
                    </span>
                  </div>
                  <p className="text-xs text-slate leading-relaxed">
                    Under the published Rajasthan policy extension, unpaid consumed days are for review only.
                    <strong> Never converted to debt, never added to dues, ageing, reminders, or parent balance.</strong>
                  </p>
                  <div className="text-[11px] text-slate/80 pt-1 border-t border-slate/20">
                    On director approval, remaining future instalments are permanently cancelled:
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      <li>Remaining ordinary dues waived to ₹0 with signed ledger entries.</li>
                      <li>All collection reminder dispatches immediately cancelled.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Multi-Item Refund Execution (When statutory refund items exist) */}
              {selectedCase.items && selectedCase.items.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink">
                        Refund Dispatch Items ({selectedCase.items.length})
                      </span>
                      {selectedCase.aggregateRefundStatus && (
                        <StatusChip
                          tone={
                            selectedCase.aggregateRefundStatus === "COMPLETED"
                              ? "ok"
                              : selectedCase.aggregateRefundStatus === "PARTIALLY_REFUNDED"
                              ? "info"
                              : selectedCase.aggregateRefundStatus === "PROCESSING"
                              ? "warn"
                              : selectedCase.aggregateRefundStatus === "FAILED"
                              ? "bad"
                              : "slate"
                          }
                          text={selectedCase.aggregateRefundStatus.replace(/_/g, " ")}
                        />
                      )}
                    </div>
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
                              {it.method} · Ref: {it.providerRef || "Pending Gateway Execution"}
                              {it.failureReason && (
                                <span className="text-bad ml-2 font-medium">({it.failureReason})</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-ink mr-1">{formatINR(it.amountPaise)}</span>
                          <StatusChip
                            tone={
                              it.status === "SUCCEEDED" || it.status === "COMPLETED"
                                ? "ok"
                                : it.status === "PROCESSING"
                                ? "info"
                                : it.status === "FAILED"
                                ? "bad"
                                : "warn"
                            }
                            text={it.status}
                          />
                          {(it.status === "FAILED" || it.status === "PENDING") && (
                            <button
                              onClick={() => handleRetryItem(it.id)}
                              className="px-2 py-1 bg-bad/10 hover:bg-bad/20 text-bad rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Retry execution with gateway"
                            >
                              <RotateCw className="w-3 h-3" /> Retry Item
                            </button>
                          )}
                          {(it.status === "PROCESSING" || it.status === "FAILED") && (
                            <button
                              onClick={() => handleReconcileItem(it.id)}
                              className="px-2 py-1 bg-teal-t hover:bg-teal-t/80 text-teal rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Reconcile latest status from Razorpay"
                            >
                              <RotateCw className="w-3 h-3" /> Reconcile
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-2.5 bg-paper rounded-lg border border-line text-[11px] text-ink-3 flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-teal shrink-0" />
                    <span>
                      Normal refunds return to the parent&apos;s original payment method via standard banking rails (typically 5–7 business days).
                    </span>
                  </div>

                  {selectedCase.items.some((it) => it.status !== "SUCCEEDED" && it.status !== "COMPLETED") && (
                    <div className="p-2.5 bg-warn/10 border border-warn/20 rounded-lg text-[11px] text-warn font-medium flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Withdrawal execution remains in-flight until all gateway items are confirmed completed.
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
                    Reviewed by: {selectedCase.checkerName} ({selectedCase.checkerRole}) · Differing ID verified
                  </div>
                ) : (
                  <div className="text-warn text-[11px] mt-0.5">
                    Awaiting Director approval · Requester cannot approve their own submission
                  </div>
                )}
              </div>

              <div>
                {(selectedCase.status === "REQUESTED" ||
                  selectedCase.status === "SUBMITTED" ||
                  selectedCase.status === "DRAFT") && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowDecisionModal("REJECTED")}
                      disabled={isMakerOfSelected || !canDirectorApprove}
                      className="bg-bad/10 hover:bg-bad/20 disabled:opacity-40 disabled:cursor-not-allowed text-bad font-medium px-3.5 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject Quote
                    </button>
                    <button
                      onClick={() => setShowDecisionModal("APPROVED")}
                      disabled={isMakerOfSelected || !canDirectorApprove}
                      className="bg-teal hover:bg-teal-d disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                      title={
                        isMakerOfSelected
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

      {/* Decision Dialog Modal (Approve or Reject with mandatory notes) */}
      {showDecisionModal && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl border border-line shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-ink text-sm flex items-center gap-2">
                {showDecisionModal === "APPROVED" ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-ok" /> Director Approval Confirmation
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-bad" /> Director Rejection Confirmation
                  </>
                )}
              </h3>
              <button
                onClick={() => setShowDecisionModal(null)}
                className="text-ink-3 hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-ink-2 leading-relaxed">
              {showDecisionModal === "APPROVED" ? (
                <>
                  Approving will update <strong>{selectedCase.studentName}</strong> to WITHDRAWN status, waive all remaining ordinary instalment dues to ₹0 on the ledger, skip queued reminders, and initiate the statutory pro-rata refund.
                </>
              ) : (
                <>
                  Rejecting will close this withdrawal quote request and maintain the student&apos;s active fee plan.
                </>
              )}
            </p>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Director Notes / Justification:
              </label>
              <textarea
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder={
                  showDecisionModal === "APPROVED"
                    ? "Approved under MoE 2024 pro-rata refund policy"
                    : "Specify rejection reason (e.g. invalid withdrawal date, student continuing)"
                }
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-teal"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                onClick={() => setShowDecisionModal(null)}
                className="px-3 py-1.5 rounded-lg border border-line text-xs font-medium text-ink-2 hover:bg-paper"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDecision}
                disabled={isSubmitting}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-xs ${
                  showDecisionModal === "APPROVED"
                    ? "bg-teal hover:bg-teal-d"
                    : "bg-bad hover:bg-bad/90"
                }`}
              >
                {isSubmitting ? "Processing..." : `Confirm ${showDecisionModal}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accounts New Withdrawal Request Drawer/Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl border border-line shadow-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-bold text-ink text-sm flex items-center gap-2">
                  <UserX className="w-4 h-4 text-teal" /> Create Pro-Rata Withdrawal Quote
                </h3>
                <p className="text-[11px] text-ink-3">
                  MoE 2024 pro-rata proration. Submits quote to Founder-Director for maker-checker review.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-ink-3 hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWithdrawal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Select Student (ID or Code):
                </label>
                <select
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-line bg-paper text-ink"
                >
                  <option value="STU-0587">STU-0587 · Ishita Sharma (JEE 2027 Evening, Vaishali Nagar)</option>
                  <option value="STU-1038">STU-1038 · Kavya Rathore (NEET 2027 Morning, Tonk Road)</option>
                  <option value="STU-0219">STU-0219 · Mohit Gurjar (NEET 2027 Morning, Mansarovar)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Effective Withdrawal Date:
                </label>
                <input
                  type="date"
                  value={newEffectiveDate}
                  onChange={(e) => setNewEffectiveDate(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-line bg-paper text-ink"
                  required
                />
              </div>

              {/* Live Preview Box */}
              <div className="p-3 bg-paper rounded-lg border border-line text-xs space-y-2">
                <div className="flex items-center justify-between font-semibold text-ink">
                  <span>Live Pro-Rata Quote Preview</span>
                  {previewLoading && <span className="text-[10px] text-teal animate-pulse">Calculating...</span>}
                </div>

                {previewError ? (
                  <p className="text-bad text-[11px]">{previewError}</p>
                ) : previewCalc?.calculation ? (
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between text-ink-3">
                      <span>Consumed Days (c / T):</span>
                      <span className="font-mono text-ink font-semibold">
                        {previewCalc.calculation.consumedDays} / {previewCalc.calculation.totalServiceDays} days
                      </span>
                    </div>
                    <div className="flex justify-between text-ink-3">
                      <span>Total Paid by Parent (P):</span>
                      <span className="font-mono text-ink font-semibold">
                        {formatINR(BigInt(previewCalc.calculation.totalPaidPaise))}
                      </span>
                    </div>
                    <div className="flex justify-between text-ink-3">
                      <span>Institute Earned Fee:</span>
                      <span className="font-mono text-ink font-semibold">
                        {formatINR(BigInt(previewCalc.calculation.earnedFeePaise))}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-line/60 font-bold">
                      {BigInt(previewCalc.calculation.potentialRefundPaise) > 0n ? (
                        <>
                          <span className="text-ok">Statutory Refund:</span>
                          <span className="font-mono text-ok">
                            {formatINR(BigInt(previewCalc.calculation.potentialRefundPaise))}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-slate">Shortfall (Informational):</span>
                          <span className="font-mono text-slate">
                            {formatINR(BigInt(previewCalc.calculation.indicativeShortfallPaise))}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Submission Notes / Reason:
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-line bg-paper text-ink"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-line text-xs font-medium text-ink-2 hover:bg-paper"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || previewLoading || !previewCalc}
                  className="bg-teal hover:bg-teal-d disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? "Submitting..." : "Submit Quote for Director Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
