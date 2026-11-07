"use client";

import React, { useState } from "react";
import Link from "next/link";
import { StaffNav } from "@/components/shared/StaffNav";
import { DemoBar } from "@/components/shared/DemoBar";
import { StatusChip } from "@/components/shared/StatusChip";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { formatINR } from "@/domain/money";
import {
  Receipt,
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
} from "lucide-react";

export default function StaffPaymentsPage() {
  const [activeTab, setActiveTab] = useState<"UNMATCHED" | "CAPTURED" | "EVENTS">("UNMATCHED");
  const [selectedUnmatched, setSelectedUnmatched] = useState<any | null>(null);
  const [allocationReason, setAllocationReason] = useState("Direct NEFT transfer verified against student ID 0219");
  const [isAllocating, setIsAllocating] = useState(false);
  const [allocationSuccess, setAllocationSuccess] = useState(false);

  // Unmatched payments queue fixture
  const unmatchedPayments = [
    {
      id: "pay_demo_a91c",
      ref: "NEFT-PUNB0123456",
      amount: 1500000n, // ₹15,000
      date: "01 Nov 2026, 16:45",
      method: "NEFT",
      payerDetails: "MOHIT G 0219 / PUNB0123456",
      topCandidate: {
        studentId: "stu-mohit-id",
        studentCode: "STU-0219",
        name: "Mohit Gurjar",
        centre: "Mansarovar, Jaipur",
        activeDue: 4000000n, // ₹40,000
        score: 0.88,
        reasons: [
          'Exact student ID digits "0219" found in transaction reference',
          'Name tokens "MOHIT G" match student name "Mohit Gurjar"',
        ],
      },
    },
  ];

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
    {
      ref: "PAY-AARAV-1",
      student: "Aarav Meena (STU-0412)",
      amount: 3000000n,
      date: "10 Jul 2026",
      method: "UPI",
      receipt: "REC-2026-0412-1",
      status: "CAPTURED",
      match: "MATCHED_AUTOMATIC",
    },
    {
      ref: "PAY-MOHIT-1",
      student: "Mohit Gurjar (STU-0219)",
      amount: 4000000n,
      date: "14 Jul 2026",
      method: "UPI",
      receipt: "REC-2026-0219-1",
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
      id: "evt_1010_aarav",
      provider: "MOCK_GATEWAY",
      type: "payment.captured",
      verified: true,
      timestamp: "2026-10-10T10:00:00Z",
      status: "PROCESSED",
    },
    {
      id: "evt_1101_unmatched",
      provider: "MOCK_GATEWAY",
      type: "payment.captured",
      verified: true,
      timestamp: "2026-11-01T16:45:00Z",
      status: "ROUTED_TO_QUEUE",
    },
  ];

  const handleConfirmAllocation = async () => {
    setIsAllocating(true);
    setTimeout(() => {
      setIsAllocating(false);
      setAllocationSuccess(true);
      setTimeout(() => {
        setSelectedUnmatched(null);
        setAllocationSuccess(false);
      }, 1200);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <DemoBar />

      <div className="flex flex-1">
        <StaffNav currentRole="ACCOUNTS" userName="Neha Verma" />

        <main className="flex-1 p-8 space-y-8 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-line">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-ink">
                  Payments & Accounts Exceptions
                </h1>
                <ProvenanceChip kind="Design" detail="Accounts Queue" />
              </div>
              <p className="text-xs text-ink-3 mt-0.5">
                Unallocated captures, webhook signature audit, and verified ledger allocations
              </p>
            </div>
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
                {unmatchedPayments.length}
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
              <div className="p-4 rounded-panel bg-warn-t/30 border border-warn/30 text-xs text-ink-2 space-y-1">
                <div className="font-bold text-warn flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-warn" />
                  <span>Unmatched Payment Guardrail (SRS §4.3):</span>
                </div>
                <p className="text-[11px] text-ink-3 leading-relaxed">
                  Payments received without exact order matches stay unallocated here. The candidate matching engine computes similarity scores, but <strong>never auto-allocates</strong>. Human verification and an audit reason are mandatory.
                </p>
              </div>

              <div className="space-y-3">
                {unmatchedPayments.map((p) => (
                  <div
                    key={p.id}
                    className="p-5 rounded-hero bg-surface border border-line shadow-xs space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-line">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-ink">{p.id}</span>
                          <StatusChip tone="warn" text="Unallocated" />
                        </div>
                        <div className="text-xs text-ink-3">
                          {p.date} · Method: {p.method} · Ref: {p.ref}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-bold font-mono text-ink">
                          {formatINR(p.amount)}
                        </div>
                        <span className="text-[11px] text-ink-3">Unallocated amount</span>
                      </div>
                    </div>

                    {/* Candidate Match Suggestion Card */}
                    <div className="p-4 rounded-panel bg-paper border border-line space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-ink">
                          <Sparkles className="w-4 h-4 text-teal" />
                          <span>Candidate Match Suggestion:</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[11px] bg-teal-t text-teal-d font-bold font-mono">
                          Score: {p.topCandidate.score * 100}%
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
                          <span className="text-ink-2 font-medium">{p.topCandidate.centre}</span>
                        </div>

                        <div>
                          <span className="text-ink-3 block text-[11px]">Active Dues:</span>
                          <span className="font-mono font-bold text-ink">
                            {formatINR(p.topCandidate.activeDue)}
                          </span>
                        </div>
                      </div>

                      {/* Match Reasons */}
                      <div className="pt-2 border-t border-line space-y-1">
                        <span className="text-[11px] font-semibold text-ink-3">Match Reasons:</span>
                        <ul className="space-y-0.5 text-[11px] text-ink-2">
                          {p.topCandidate.reasons.map((r, i) => (
                            <li key={i} className="flex items-center gap-1.5">
                              <CheckCircle className="w-3 h-3 text-ok shrink-0" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedUnmatched(p)}
                          className="px-4 py-2 rounded-input bg-teal text-white font-semibold text-xs hover:bg-teal-d transition-colors flex items-center gap-1.5 shadow-xs"
                        >
                          <span>Review & Allocate to Student</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
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

      {/* Manual Allocation Dialog */}
      {selectedUnmatched && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg bg-surface rounded-panel p-6 space-y-4 border border-line shadow-dialog">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <h3 className="font-bold text-base text-ink">
                Allocate Unmatched Capture ({selectedUnmatched.id})
              </h3>
              <button
                type="button"
                onClick={() => setSelectedUnmatched(null)}
                className="text-ink-3 hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded bg-paper border border-line space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-3">Capture Amount:</span>
                <span className="font-mono font-bold text-base text-teal">
                  {formatINR(selectedUnmatched.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">Target Student:</span>
                <span className="font-bold text-ink">
                  {selectedUnmatched.topCandidate.name} ({selectedUnmatched.topCandidate.studentCode})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">Candidate Confidence:</span>
                <span className="font-mono font-bold text-ok">
                  {selectedUnmatched.topCandidate.score * 100}% Confidence Match
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1">
                Audit Reason for Manual Allocation (Required):
              </label>
              <textarea
                value={allocationReason}
                onChange={(e) => setAllocationReason(e.target.value)}
                required
                className="w-full h-16 p-2 rounded-input border border-line bg-surface text-xs text-ink focus:outline-none focus:ring-2 focus:ring-teal"
              />
            </div>

            {allocationSuccess && (
              <div className="p-3 rounded bg-ok-t text-ok text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Capture successfully allocated to student ledger!</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUnmatched(null)}
                className="px-3 py-2 rounded-input border border-line text-xs font-semibold text-ink-2 hover:bg-paper"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAllocating || !allocationReason.trim()}
                onClick={handleConfirmAllocation}
                className="px-4 py-2 rounded-input bg-teal text-white text-xs font-semibold hover:bg-teal-d disabled:opacity-50"
              >
                {isAllocating ? "Allocating..." : "Confirm Allocation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
