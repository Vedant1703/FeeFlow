"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { StaffNav } from "@/components/shared/StaffNav";
import { DemoBar } from "@/components/shared/DemoBar";
import { StatusChip } from "@/components/shared/StatusChip";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { formatINR } from "@/domain/money";
import {
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  ShieldCheck,
  Search,
  ExternalLink,
  Sparkles,
  ArrowRight,
  ChevronRight,
  X,
  RefreshCw,
  Filter,
  FileText,
  CreditCard,
  User,
  Building2,
  Calendar,
  Layers,
  Clock,
} from "lucide-react";

export default function StaffPaymentsPage() {
  const [activeTab, setActiveTab] = useState<"UNMATCHED" | "CAPTURED" | "EVENTS">("UNMATCHED");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [centreFilter, setCentreFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNMATCHED" | "PARTIAL">("ALL");

  // Queue Data
  const [isLoading, setIsLoading] = useState(false);
  const [unmatchedList, setUnmatchedList] = useState<any[]>([]);

  // Investigation & Allocation Drawer / Dialog
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [investigationData, setInvestigationData] = useState<any | null>(null);
  const [isLoadingInvestigation, setIsLoadingInvestigation] = useState(false);

  // Allocation Form State
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [studentProfiles, setStudentProfiles] = useState<any[]>([]);
  const [studentPlanData, setStudentPlanData] = useState<any | null>(null);
  const [isLoadingStudentData, setIsLoadingStudentData] = useState(false);
  const [allocationInputs, setAllocationInputs] = useState<Record<string, string>>({});
  const [auditReason, setAuditReason] = useState("");
  const [isSubmittingAllocation, setIsSubmittingAllocation] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [allocationSuccessMsg, setAllocationSuccessMsg] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Default fallback candidates for demo student selection
  const defaultStudents = [
    { id: "stu_mohit_0219", code: "STU-0219", name: "Mohit Gurjar", centre: "Mansarovar, Jaipur" },
    { id: "stu_ishita_0587", code: "STU-0587", name: "Ishita Sharma", centre: "Vaishali Nagar, Jaipur" },
    { id: "stu_kavya_1038", code: "STU-1038", name: "Kavya Rathore", centre: "Tonk Road, Jaipur" },
  ];

  // Fetch Unmatched Queue
  const fetchUnmatchedQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (centreFilter) params.set("centreId", centreFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/payments/unmatched?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.payments) {
          setUnmatchedList(data.payments);
          return;
        }
      }
    } catch {
      // Fallback handled below
    } finally {
      setIsLoading(false);
    }

    // Offline / Demo Fallback Data
    setUnmatchedList([
      {
        id: "pay_demo_a91c",
        paymentReference: "pay_demo_a91c",
        provider: "MOCK_GATEWAY",
        providerPaymentId: "prov_unmatched_a91c",
        orderId: null,
        amount: "1500000",
        unallocatedAmount: "1500000",
        allocatedAmount: "0",
        refundedAmount: "0",
        availableBalance: "1500000",
        paymentDate: "2026-11-01T16:45:00Z",
        method: "NEFT",
        payerDetails: "MOHIT G 0219 / PUNB0123456",
        status: "CAPTURED",
        matchStatus: "UNMATCHED",
        notes: "Direct bank transfer; potential candidate STU-0219 Mohit Gurjar (score 0.88)",
        student: null,
        centre: null,
        topCandidate: {
          studentId: "stu_mohit_0219",
          studentCode: "STU-0219",
          name: "Mohit Gurjar",
          centreName: "Mansarovar, Jaipur",
          score: 0.88,
          matchReasons: [
            'Student ID digits "0219" matched in reference "MOHIT G 0219 / PUNB0123456"',
            'Name token(s) matched: "Mohit Gurjar"',
          ],
          recommendedAction: "VERIFY_AND_ALLOCATE",
        },
        candidateCount: 1,
      },
    ]);
  }, [searchQuery, centreFilter, statusFilter]);

  useEffect(() => {
    fetchUnmatchedQueue();
  }, [fetchUnmatchedQueue]);

  // Accessible Modal: Escape key listener and body scroll lock
  useEffect(() => {
    if (!selectedPayment) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showConfirmModal) {
          setShowConfirmModal(false);
        } else {
          setSelectedPayment(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [selectedPayment, showConfirmModal]);

  // Open Investigation / Allocation Drawer
  const handleOpenInvestigation = async (payment: any) => {
    setSelectedPayment(payment);
    setIsLoadingInvestigation(true);
    setInvestigationData(null);
    setAllocationError(null);
    setAllocationSuccessMsg(null);
    setAllocationInputs({});
    setShowConfirmModal(false);

    // Initial student selection from top candidate or existing student
    const initStudentId = payment.student?.id || payment.topCandidate?.studentId || "stu_mohit_0219";
    setSelectedStudentId(initStudentId);
    setAuditReason(
      payment.topCandidate
        ? `Manual allocation verified for ${payment.topCandidate.name} (${payment.topCandidate.studentCode}) based on reference match`
        : "Manual payment allocation verified by Accounts staff"
    );

    try {
      const res = await fetch(`/api/payments/${payment.id}/investigation`);
      if (res.ok) {
        const data = await res.json();
        setInvestigationData(data);
      }
    } catch {
      // In-memory fallback
    } finally {
      setIsLoadingInvestigation(false);
    }

    // Load candidate student instalments
    loadStudentInstalments(initStudentId);
  };

  // Load target student's outstanding instalments
  const loadStudentInstalments = async (studentId: string) => {
    if (!studentId) return;
    setIsLoadingStudentData(true);
    setAllocationInputs({});
    try {
      const res = await fetch(`/api/students/${studentId}/outstanding-instalments`);
      if (res.ok) {
        const data = await res.json();
        setStudentPlanData(data);
        return;
      }
    } catch {
      // Fallback below
    } finally {
      setIsLoadingStudentData(false);
    }

    // Fallback data for Mohit
    if (studentId === "stu_mohit_0219") {
      setStudentPlanData({
        student: {
          id: "stu_mohit_0219",
          studentCode: "STU-0219",
          name: "Mohit Gurjar",
          centreId: "cen_mansarovar",
          centreName: "Mansarovar, Jaipur",
        },
        feePlan: {
          id: "plan_mohit_neet",
          name: "NEET 2026-27 Standard 3-Instalment Plan",
          totalAmount: "12000000",
        },
        instalments: [
          {
            id: "inst_mohit_1",
            sequence: 1,
            dueDate: "2026-11-15T00:00:00Z",
            amount: "4000000",
            outstandingBalance: "4000000",
            status: "DUE",
          },
          {
            id: "inst_mohit_2",
            sequence: 2,
            dueDate: "2026-12-15T00:00:00Z",
            amount: "4000000",
            outstandingBalance: "4000000",
            status: "UPCOMING",
          },
          {
            id: "inst_mohit_3",
            sequence: 3,
            dueDate: "2027-02-15T00:00:00Z",
            amount: "4000000",
            outstandingBalance: "4000000",
            status: "UPCOMING",
          },
        ],
      });
    }
  };

  // Compute live allocation math
  const availablePaise = BigInt(
    investigationData?.balanceSummary?.availableBalance || selectedPayment?.availableBalance || "0"
  );

  let totalAllocatingPaise = 0n;
  for (const [_, val] of Object.entries(allocationInputs)) {
    if (val && !isNaN(Number(val))) {
      // Input is in Rupees, convert to paise
      const paise = BigInt(Math.round(parseFloat(val) * 100));
      if (paise > 0n) totalAllocatingPaise += paise;
    }
  }

  const remainingPaymentPaise = availablePaise - totalAllocatingPaise;
  const isOverAllocating = totalAllocatingPaise > availablePaise;

  // Handle Quick "Max" fill for an instalment
  const handleSetMax = (instalment: any) => {
    const instOutstanding = BigInt(instalment.outstandingBalance);
    // Other allocations currently entered
    let otherAllocating = 0n;
    for (const [id, val] of Object.entries(allocationInputs)) {
      if (id !== instalment.id && val && !isNaN(Number(val))) {
        otherAllocating += BigInt(Math.round(parseFloat(val) * 100));
      }
    }
    const currentRemainingForPayment = availablePaise - otherAllocating;
    const allocPaise =
      currentRemainingForPayment > 0n
        ? instOutstanding < currentRemainingForPayment
          ? instOutstanding
          : currentRemainingForPayment
        : 0n;

    setAllocationInputs((prev) => ({
      ...prev,
      [instalment.id]: (Number(allocPaise) / 100).toString(),
    }));
  };

  // Execute Allocation
  const handleSubmitAllocation = async () => {
    setIsSubmittingAllocation(true);
    setAllocationError(null);
    setAllocationSuccessMsg(null);

    const allocationsToSend: Array<{ instalmentId: string; amountPaise: string }> = [];
    for (const [instId, val] of Object.entries(allocationInputs)) {
      const amt = parseFloat(val);
      if (!isNaN(amt) && amt > 0) {
        allocationsToSend.push({
          instalmentId: instId,
          amountPaise: Math.round(amt * 100).toString(),
        });
      }
    }

    if (allocationsToSend.length === 0) {
      setAllocationError("Please enter an allocation amount for at least one instalment");
      setIsSubmittingAllocation(false);
      setShowConfirmModal(false);
      return;
    }

    if (!auditReason.trim() || auditReason.trim().length < 3) {
      setAllocationError("Mandatory audit reason must be at least 3 characters");
      setIsSubmittingAllocation(false);
      setShowConfirmModal(false);
      return;
    }

    try {
      const res = await fetch("/api/payments/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: selectedPayment.id,
          studentId: selectedStudentId,
          allocations: allocationsToSend,
          reason: auditReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAllocationError(data.error || "Failed to allocate payment");
        setIsSubmittingAllocation(false);
        setShowConfirmModal(false);
        return;
      }

      setAllocationSuccessMsg(
        `Successfully allocated ${formatINR(totalAllocatingPaise)} to student ledger! Immutable receipt preserved.`
      );
      setShowConfirmModal(false);
      fetchUnmatchedQueue();

      // Refresh drawer details
      setTimeout(() => {
        setSelectedPayment(null);
      }, 1600);
    } catch (err: any) {
      setAllocationError(err.message || "Network error occurred");
    } finally {
      setIsSubmittingAllocation(false);
    }
  };

  // Captured payments log fixture
  const capturedPayments = [
    {
      ref: "PAY-ISHITA-2-PART",
      student: "Ishita Sharma (STU-0587)",
      amount: 1500000n,
      date: "15 Oct 2026",
      method: "Netbanking",
      receipt: "REC-2026-0587-2",
      status: "CAPTURED",
      match: "MATCHED_AUTOMATIC",
    },
    {
      ref: "PAY-ISHITA-1",
      student: "Ishita Sharma (STU-0587)",
      amount: 3000000n,
      date: "09 Jul 2026",
      method: "UPI",
      receipt: "REC-2026-0587-1",
      status: "CAPTURED",
      match: "MATCHED_AUTOMATIC",
    },
    {
      ref: "PAY-AARAV-2",
      student: "Aarav Meena (STU-0412)",
      amount: 3000000n,
      date: "10 Oct 2026",
      method: "UPI",
      receipt: "REC-2026-0412-2",
      status: "CAPTURED",
      match: "MATCHED_AUTOMATIC",
    },
  ];

  const providerEvents = [
    {
      id: "evt_1015_part",
      provider: "MOCK_GATEWAY",
      type: "payment.captured",
      verified: true,
      timestamp: "2026-10-15T11:20:00Z",
      status: "PROCESSED",
    },
    {
      id: "evt_1101_unmatched",
      provider: "MOCK_GATEWAY",
      type: "payment.captured",
      verified: true,
      timestamp: "2026-11-01T16:45:00Z",
      status: "UNMATCHED",
    },
  ];

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <DemoBar />

      <div className="flex flex-1">
        <StaffNav currentRole="ACCOUNTS" userName="Neha Verma" />

        <main className="flex-1 p-8 space-y-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-line">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-ink">
                  Payments & Accounts Exceptions
                </h1>
                <ProvenanceChip kind="Design" detail="Accounts Queue (S3)" />
              </div>
              <p className="text-xs text-ink-3 mt-0.5">
                Investigate unallocated captures, review candidate match suggestions, and manually allocate to student instalments
              </p>
            </div>

            <button
              type="button"
              onClick={fetchUnmatchedQueue}
              disabled={isLoading}
              className="px-3 py-2 rounded-input border border-line text-xs font-semibold text-ink-2 hover:bg-surface flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh Queue</span>
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-line">
            <button
              type="button"
              onClick={() => setActiveTab("UNMATCHED")}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "UNMATCHED"
                  ? "border-teal text-teal"
                  : "border-transparent text-ink-3 hover:text-ink"
              }`}
            >
              <span>Unmatched Queue</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-warn-t text-warn font-bold">
                {unmatchedList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("CAPTURED")}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors ${
                activeTab === "CAPTURED"
                  ? "border-teal text-teal"
                  : "border-transparent text-ink-3 hover:text-ink"
              }`}
            >
              Captured Allocations ({capturedPayments.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("EVENTS")}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "EVENTS"
                  ? "border-teal text-teal"
                  : "border-transparent text-ink-3 hover:text-ink"
              }`}
            >
              Provider Events Log ({providerEvents.length})
            </button>

            <Link
              href="/staff/reconciliation"
              className="pb-3 px-4 text-xs font-bold border-b-2 border-transparent text-ink-3 hover:text-teal transition-colors flex items-center gap-1.5 ml-auto"
            >
              <span>Month-End Reconciliation (S3b)</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* =========================================================================
              TAB 1: UNMATCHED QUEUE
             ========================================================================= */}
          {activeTab === "UNMATCHED" && (
            <div className="space-y-4">
              {/* Guardrail Banner */}
              <div className="p-4 rounded-panel bg-warn-t/30 border border-warn/30 text-xs text-ink-2 space-y-1">
                <div className="font-bold text-warn flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-warn" />
                  <span>Unmatched Payment Guardrail (SRS §4.3 & Financial Integrity Rules):</span>
                </div>
                <p className="text-[11px] text-ink-3 leading-relaxed">
                  Payments received without exact order matches stay unallocated here. The matching engine computes similarity scores, but <strong>never auto-allocates</strong>. Human verification and an audit reason are mandatory. Only CAPTURED payments can be allocated, and excess funds are strictly preserved as unallocated.
                </p>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="p-3.5 rounded-panel bg-surface border border-line flex flex-wrap items-center gap-3 text-xs">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ink-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Payment Ref, Provider ID, Order ID, or Student..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-input border border-line bg-paper text-ink text-xs focus:outline-none focus:ring-1 focus:ring-teal"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-ink-3 text-[11px] font-semibold">Centre:</label>
                  <select
                    value={centreFilter}
                    onChange={(e) => setCentreFilter(e.target.value)}
                    className="py-1.5 px-2.5 rounded-input border border-line bg-paper text-ink text-xs focus:outline-none focus:ring-1 focus:ring-teal"
                  >
                    <option value="">All Centres</option>
                    <option value="cen_vaishali">Vaishali Nagar</option>
                    <option value="cen_mansarovar">Mansarovar</option>
                    <option value="cen_tonk">Tonk Road</option>
                    <option value="cen_malviya">Malviya Nagar</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-ink-3 text-[11px] font-semibold">Status:</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="py-1.5 px-2.5 rounded-input border border-line bg-paper text-ink text-xs focus:outline-none focus:ring-1 focus:ring-teal"
                  >
                    <option value="ALL">All Unallocated</option>
                    <option value="UNMATCHED">Unmatched Only</option>
                    <option value="PARTIAL">Partially Allocated</option>
                  </select>
                </div>
              </div>

              {/* Unmatched Cards List */}
              <div className="space-y-3">
                {unmatchedList.length === 0 ? (
                  <div className="p-12 text-center bg-surface rounded-hero border border-line space-y-2">
                    <CheckCircle className="w-8 h-8 text-ok mx-auto" />
                    <h3 className="font-bold text-sm text-ink">No Unallocated Payments Found</h3>
                    <p className="text-xs text-ink-3">
                      All captured payments are fully matched and allocated to student ledgers.
                    </p>
                  </div>
                ) : (
                  unmatchedList.map((p) => {
                    const amountBig = BigInt(p.amount || "0");
                    const unallocatedBig = BigInt(p.unallocatedAmount || "0");
                    const allocatedBig = BigInt(p.allocatedAmount || "0");

                    return (
                      <div
                        key={p.id}
                        className="p-5 rounded-hero bg-surface border border-line shadow-xs space-y-4"
                      >
                        <div className="flex items-center justify-between pb-3 border-b border-line">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-ink">{p.paymentReference}</span>
                              <StatusChip
                                tone={p.matchStatus === "UNMATCHED" ? "warn" : "ok"}
                                text={p.matchStatus === "UNMATCHED" ? "Unmatched" : "Partially Allocated"}
                              />
                              <span className="text-[11px] text-ink-3 font-mono">
                                Provider ID: {p.providerPaymentId}
                              </span>
                            </div>
                            <div className="text-xs text-ink-3 flex items-center gap-2">
                              <span>{new Date(p.paymentDate).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                              <span>·</span>
                              <span>Method: {p.method}</span>
                              <span>·</span>
                              <span>Payer: {p.payerDetails || "Unknown"}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xl font-bold font-mono text-ink">
                              {formatINR(unallocatedBig)}
                            </div>
                            <span className="text-[11px] text-ink-3">
                              Unallocated (Total: {formatINR(amountBig)})
                            </span>
                          </div>
                        </div>

                        {/* Candidate Match Suggestion or Student Details */}
                        {p.student ? (
                          <div className="p-3.5 rounded-panel bg-paper border border-line flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <User className="w-4 h-4 text-teal" />
                              <div>
                                <span className="font-bold text-ink">{p.student.name}</span>
                                <span className="text-[11px] text-ink-3 font-mono ml-2">
                                  ({p.student.studentCode})
                                </span>
                                <span className="text-[11px] text-ink-3 ml-2">
                                  · Centre: {p.student.centreName}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenInvestigation(p)}
                              className="px-3.5 py-1.5 rounded-input bg-teal text-white font-semibold text-xs hover:bg-teal-d transition-colors flex items-center gap-1.5"
                            >
                              <span>Allocate Balance</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : p.topCandidate ? (
                          <div className="p-4 rounded-panel bg-paper border border-line space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                                <Sparkles className="w-4 h-4 text-teal" />
                                <span>Suggested Candidate Match:</span>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[11px] bg-teal-t text-teal-d font-bold font-mono">
                                Match Score: {Math.round(p.topCandidate.score * 100)}%
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-3 text-xs">
                              <div>
                                <span className="text-ink-3 block text-[11px]">Candidate Student:</span>
                                <span className="font-bold text-ink">{p.topCandidate.name}</span>
                                <span className="text-[11px] text-ink-3 block font-mono">
                                  {p.topCandidate.studentCode}
                                </span>
                              </div>

                              <div>
                                <span className="text-ink-3 block text-[11px]">Centre:</span>
                                <span className="text-ink-2 font-medium">{p.topCandidate.centreName}</span>
                              </div>

                              <div>
                                <span className="text-ink-3 block text-[11px]">Recommended Action:</span>
                                <span className="font-semibold text-teal">{p.topCandidate.recommendedAction}</span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-line space-y-1">
                              <span className="text-[11px] font-semibold text-ink-3">Match Reasons:</span>
                              <ul className="space-y-0.5 text-[11px] text-ink-2">
                                {p.topCandidate.matchReasons.map((r: string, idx: number) => (
                                  <li key={idx} className="flex items-center gap-1.5">
                                    <CheckCircle className="w-3 h-3 text-ok shrink-0" />
                                    <span>{r}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenInvestigation(p)}
                                className="px-4 py-2 rounded-input bg-teal text-white font-semibold text-xs hover:bg-teal-d transition-colors flex items-center gap-1.5 shadow-xs"
                              >
                                <span>Investigate & Allocate</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3.5 rounded-panel bg-paper border border-line flex items-center justify-between text-xs text-ink-3">
                            <span>No candidate match suggestions computed for this reference.</span>
                            <button
                              type="button"
                              onClick={() => handleOpenInvestigation(p)}
                              className="px-3.5 py-1.5 rounded-input bg-teal text-white font-semibold text-xs hover:bg-teal-d transition-colors flex items-center gap-1.5"
                            >
                              <span>Investigate & Select Student</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 2: CAPTURED PAYMENTS LOG
             ========================================================================= */}
          {activeTab === "CAPTURED" && (
            <div className="p-6 rounded-hero bg-surface border border-line shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <h2 className="font-bold text-base text-ink">Verified Captured Payments</h2>
                <span className="text-xs text-ink-3">Official GST Receipt issued on capture</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-line text-ink-3 font-semibold font-sans">
                      <th className="py-2.5 px-3">Payment Reference</th>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3 text-right">Captured</th>
                      <th className="py-2.5 px-3">Receipt No</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {capturedPayments.map((p) => (
                      <tr key={p.ref} className="hover:bg-paper/80 transition-colors">
                        <td className="py-3 px-3 font-bold text-ink">{p.ref}</td>
                        <td className="py-3 px-3 font-sans text-ink">{p.student}</td>
                        <td className="py-3 px-3 text-ink-2">{p.date}</td>
                        <td className="py-3 px-3 text-ink-2">{p.method}</td>
                        <td className="py-3 px-3 text-right font-bold text-ok">
                          {formatINR(p.amount)}
                        </td>
                        <td className="py-3 px-3 text-teal font-semibold">{p.receipt}</td>
                        <td className="py-3 px-3 text-right">
                          <StatusChip tone="ok" text="Captured" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 3: PROVIDER EVENTS LOG
             ========================================================================= */}
          {activeTab === "EVENTS" && (
            <div className="p-6 rounded-hero bg-surface border border-line shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <h2 className="font-bold text-base text-ink">Provider Webhook Events Log</h2>
                <span className="text-xs text-ok font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>HMAC-SHA256 Signature Verified</span>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-line text-ink-3 font-semibold font-sans">
                      <th className="py-2.5 px-3">Event ID</th>
                      <th className="py-2.5 px-3">Provider</th>
                      <th className="py-2.5 px-3">Event Type</th>
                      <th className="py-2.5 px-3">Verified</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {providerEvents.map((evt) => (
                      <tr key={evt.id} className="hover:bg-paper/80 transition-colors">
                        <td className="py-3 px-3 font-bold text-ink">{evt.id}</td>
                        <td className="py-3 px-3 text-ink-2">{evt.provider}</td>
                        <td className="py-3 px-3 text-teal">{evt.type}</td>
                        <td className="py-3 px-3 text-ok font-bold">
                          {evt.verified ? "VALID (HMAC)" : "INVALID"}
                        </td>
                        <td className="py-3 px-3 text-ink-3">{evt.timestamp}</td>
                        <td className="py-3 px-3 text-right">
                          <StatusChip
                            tone={evt.status === "PROCESSED" ? "ok" : "warn"}
                            text={evt.status}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =========================================================================
          DEEP-DIVE INVESTIGATION & MANUAL ALLOCATION DRAWER / DIALOG
         ========================================================================= */}
      {selectedPayment && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
        >
          <div className="w-full max-w-3xl bg-surface rounded-panel p-6 space-y-6 border border-line shadow-dialog max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-ink">
                    Investigate & Allocate Payment ({selectedPayment.paymentReference})
                  </h3>
                  <StatusChip
                    tone={selectedPayment.status === "CAPTURED" ? "ok" : "warn"}
                    text={selectedPayment.status}
                  />
                </div>
                <p className="text-xs text-ink-3">
                  Original Provider: {selectedPayment.provider} · Payment ID: {selectedPayment.providerPaymentId}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="text-ink-3 hover:text-ink p-1 rounded-input hover:bg-paper"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Financial Breakdown Card */}
            <div className="grid grid-cols-4 gap-3 p-4 rounded-panel bg-paper border border-line text-xs">
              <div>
                <span className="text-ink-3 block text-[11px]">Captured Amount:</span>
                <span className="font-mono font-bold text-sm text-ink">
                  {formatINR(BigInt(investigationData?.balanceSummary?.capturedAmount || selectedPayment.amount || "0"))}
                </span>
              </div>

              <div>
                <span className="text-ink-3 block text-[11px]">Total Allocated:</span>
                <span className="font-mono font-bold text-sm text-ink-2">
                  {formatINR(BigInt(investigationData?.balanceSummary?.totalAllocated || selectedPayment.allocatedAmount || "0"))}
                </span>
              </div>

              <div>
                <span className="text-ink-3 block text-[11px]">Refunded:</span>
                <span className="font-mono font-bold text-sm text-warn">
                  {formatINR(BigInt(investigationData?.balanceSummary?.totalRefunded || selectedPayment.refundedAmount || "0"))}
                </span>
              </div>

              <div className="border-l border-line pl-3">
                <span className="text-ink-3 block text-[11px]">Available to Allocate:</span>
                <span className="font-mono font-bold text-base text-teal">
                  {formatINR(availablePaise)}
                </span>
              </div>
            </div>

            {/* Original Transaction Details & HMAC Verification */}
            <div className="p-4 rounded-panel bg-surface border border-line space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-line">
                <span className="font-bold text-ink flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-teal" />
                  <span>Original Provider Transaction Metadata</span>
                </span>
                <span className="text-ok font-semibold text-[11px] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>HMAC Signature Verified</span>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-[11px] pt-1">
                <div>
                  <span className="text-ink-3">Payment Date:</span>
                  <div className="font-medium text-ink">
                    {new Date(selectedPayment.paymentDate).toLocaleString("en-IN")}
                  </div>
                </div>
                <div>
                  <span className="text-ink-3">Payment Method:</span>
                  <div className="font-medium text-ink">{selectedPayment.method}</div>
                </div>
                <div>
                  <span className="text-ink-3">Payer Details:</span>
                  <div className="font-medium text-ink">{selectedPayment.payerDetails || "N/A"}</div>
                </div>
              </div>
            </div>

            {/* Existing Allocations / Refunds History (if any) */}
            {investigationData && investigationData.allocations.length > 0 && (
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-ink">Prior Allocations on this Payment:</h4>
                <div className="rounded border border-line overflow-hidden">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead className="bg-paper border-b border-line">
                      <tr>
                        <th className="py-2 px-3">Instalment</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3">Allocated By</th>
                        <th className="py-2 px-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {investigationData.allocations.map((a: any) => (
                        <tr key={a.id}>
                          <td className="py-2 px-3">Instalment #{a.sequence}</td>
                          <td className="py-2 px-3 text-right font-bold text-ok">
                            {formatINR(BigInt(a.amount))}
                          </td>
                          <td className="py-2 px-3">{a.allocatedByName || a.allocatedById}</td>
                          <td className="py-2 px-3 font-sans text-ink-2">{a.allocationReason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Manual Allocation Section */}
            <div className="space-y-4 pt-2 border-t border-line">
              <h4 className="font-bold text-sm text-ink flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-teal" />
                <span>Manual Allocation to Student Fee Plan</span>
              </h4>

              {/* Student Selector */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-ink-2 font-semibold mb-1">Target Student:</label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => {
                      setSelectedStudentId(e.target.value);
                      loadStudentInstalments(e.target.value);
                    }}
                    className="w-full p-2 rounded-input border border-line bg-paper text-ink font-medium focus:outline-none focus:ring-1 focus:ring-teal"
                  >
                    {defaultStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code}) — {s.centre}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPayment.topCandidate && (
                  <div className="p-2.5 rounded bg-teal-t/20 border border-teal/30 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-teal-d font-bold block">
                        Candidate Match Suggestion:
                      </span>
                      <span className="text-xs font-semibold text-ink">
                        {selectedPayment.topCandidate.name} ({selectedPayment.topCandidate.studentCode})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentId(selectedPayment.topCandidate.studentId);
                        loadStudentInstalments(selectedPayment.topCandidate.studentId);
                      }}
                      className="px-2.5 py-1 rounded bg-teal text-white text-[11px] font-semibold hover:bg-teal-d transition-colors"
                    >
                      Use Suggestion
                    </button>
                  </div>
                )}
              </div>

              {/* Instalments Allocation Table */}
              <div className="space-y-2">
                <label className="block text-ink-2 font-semibold text-xs">
                  Active Outstanding Instalments:
                </label>

                {isLoadingStudentData ? (
                  <div className="p-4 text-center text-xs text-ink-3">
                    Loading student fee plan and instalments...
                  </div>
                ) : studentPlanData?.instalments?.length > 0 ? (
                  <div className="rounded border border-line overflow-hidden text-xs">
                    <table className="w-full text-left font-mono">
                      <thead className="bg-paper border-b border-line text-[11px] text-ink-3">
                        <tr>
                          <th className="py-2.5 px-3">Instalment</th>
                          <th className="py-2.5 px-3">Due Date</th>
                          <th className="py-2.5 px-3 text-right">Instalment Fee</th>
                          <th className="py-2.5 px-3 text-right">Outstanding</th>
                          <th className="py-2.5 px-3 text-right">Allocate (₹)</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line text-[11px]">
                        {studentPlanData.instalments.map((inst: any) => {
                          const outstanding = BigInt(inst.outstandingBalance);
                          const isFullyPaid = outstanding === 0n;

                          return (
                            <tr
                              key={inst.id}
                              className={isFullyPaid ? "bg-paper/40 text-ink-3" : "hover:bg-paper/60"}
                            >
                              <td className="py-2.5 px-3 font-bold text-ink">
                                Instalment #{inst.sequence}
                              </td>
                              <td className="py-2.5 px-3 text-ink-2">
                                {new Date(inst.dueDate).toLocaleDateString("en-IN")}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {formatINR(BigInt(inst.amount))}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-warn">
                                {formatINR(outstanding)}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <input
                                  type="number"
                                  disabled={isFullyPaid}
                                  value={allocationInputs[inst.id] || ""}
                                  onChange={(e) =>
                                    setAllocationInputs((prev) => ({
                                      ...prev,
                                      [inst.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="0.00"
                                  className="w-28 text-right py-1 px-2 rounded-input border border-line bg-surface text-ink font-mono text-xs focus:outline-none focus:ring-1 focus:ring-teal disabled:opacity-40"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  disabled={isFullyPaid}
                                  onClick={() => handleSetMax(inst)}
                                  className="px-2 py-0.5 rounded text-[10px] bg-paper border border-line text-ink font-semibold hover:bg-surface disabled:opacity-40"
                                >
                                  Max
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 rounded bg-paper border border-line text-xs text-ink-3 text-center">
                    No active fee plan or instalments found for selected student.
                  </div>
                )}
              </div>

              {/* Allocation Summary Bar */}
              <div
                className={`p-3.5 rounded-panel border text-xs flex items-center justify-between ${
                  isOverAllocating
                    ? "bg-danger-t/30 border-danger text-danger"
                    : "bg-paper border-line text-ink"
                }`}
              >
                <div className="space-y-0.5">
                  <span className="font-semibold block">Allocation Summary:</span>
                  <div className="text-[11px] text-ink-3">
                    Total Allocating:{" "}
                    <strong className="text-teal font-mono">{formatINR(totalAllocatingPaise)}</strong>
                    {" · "}
                    Remaining Unallocated:{" "}
                    <strong className="font-mono text-ink">
                      {formatINR(remainingPaymentPaise > 0n ? remainingPaymentPaise : 0n)}
                    </strong>
                  </div>
                </div>

                {isOverAllocating && (
                  <div className="text-xs font-bold text-danger flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Cannot allocate more than available funds ({formatINR(availablePaise)})</span>
                  </div>
                )}
              </div>

              {/* Audit Reason Input */}
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1">
                  Mandatory Audit Reason (Required for Ledger Compliance):
                </label>
                <textarea
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  placeholder="e.g. Direct bank transfer verified against student ID 0219 Mohit Gurjar"
                  required
                  className="w-full h-16 p-2 rounded-input border border-line bg-surface text-xs text-ink focus:outline-none focus:ring-1 focus:ring-teal"
                />
              </div>

              {/* Feedback Alert */}
              {allocationError && (
                <div className="p-3 rounded bg-danger-t text-danger text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{allocationError}</span>
                </div>
              )}

              {allocationSuccessMsg && (
                <div className="p-3 rounded bg-ok-t text-ok text-xs font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{allocationSuccessMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  className="px-3 py-2 rounded-input border border-line text-xs font-semibold text-ink-2 hover:bg-paper"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    isSubmittingAllocation ||
                    isOverAllocating ||
                    totalAllocatingPaise <= 0n ||
                    auditReason.trim().length < 3
                  }
                  onClick={() => setShowConfirmModal(true)}
                  className="px-4 py-2 rounded-input bg-teal text-white text-xs font-semibold hover:bg-teal-d disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  <span>Review & Allocate</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-md bg-surface rounded-panel p-6 space-y-4 border border-line shadow-dialog">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <h3 className="font-bold text-base text-ink flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-teal" />
                <span>Confirm Manual Allocation</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-ink-3 hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-ink-2">
              <p className="leading-relaxed">
                You are about to append signed financial ledger entries and update student balance:
              </p>

              <div className="p-3 rounded bg-paper border border-line space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-ink-3">Payment Reference:</span>
                  <span className="font-bold text-ink">{selectedPayment?.paymentReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Target Student:</span>
                  <span className="font-bold text-ink">{studentPlanData?.student?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Total Allocating:</span>
                  <span className="font-bold text-teal">{formatINR(totalAllocatingPaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Remaining Unallocated:</span>
                  <span className="font-bold text-ink">{formatINR(remainingPaymentPaise)}</span>
                </div>
              </div>

              <div className="text-[11px] text-ink-3">
                <strong>Audit Reason:</strong> {auditReason}
              </div>

              <p className="text-[11px] text-warn font-semibold">
                This operation is atomic and append-only. Zero phantom receipts will be issued.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmittingAllocation}
                className="px-3 py-2 rounded-input border border-line text-xs font-semibold text-ink-2 hover:bg-paper"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isSubmittingAllocation}
                onClick={handleSubmitAllocation}
                className="px-4 py-2 rounded-input bg-teal text-white text-xs font-semibold hover:bg-teal-d disabled:opacity-50"
              >
                {isSubmittingAllocation ? "Allocating..." : "Confirm & Post Ledger"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
