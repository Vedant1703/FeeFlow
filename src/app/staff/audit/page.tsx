"use client";

import React, { useState } from "react";
import { StaffNav } from "@/components/shared/StaffNav";
import { StatusChip } from "@/components/shared/StatusChip";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import {
  History,
  ShieldCheck,
  Activity,
  CheckCircle2,
  Lock,
  Download,
  RotateCw,
  Search,
  Filter,
  FileText,
  Clock,
  Sparkles,
  Server,
  AlertCircle,
} from "lucide-react";

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  details: string;
  hash: string;
}

const INITIAL_AUDIT_LOG: AuditEntry[] = [
  {
    id: "aud-01",
    timestamp: "2026-11-02 10:21 IST",
    actor: "Arvind Mathur",
    role: "DIRECTOR",
    action: "WITHDRAWAL_APPROVED",
    target: "STU-1038 Kavya Rathore",
    details: "Approved statutory refund quote ₹63,724.14 across 3 payment items. Invariant approverId !== requesterId verified.",
    hash: "af91c784...e901",
  },
  {
    id: "aud-02",
    timestamp: "2026-11-02 10:15 IST",
    actor: "Neha Verma",
    role: "ACCOUNTS",
    action: "PAYMENT_ALLOCATED",
    target: "STU-0219 Mohit Gurjar",
    details: "Allocated ₹15,000 from pay_demo_a91c to Instalment 1. Reason: 'Verified bank UTR match'.",
    hash: "4c12bb90...a342",
  },
  {
    id: "aud-03",
    timestamp: "2026-11-02 09:58 IST",
    actor: "Payment Webhook Worker",
    role: "SYSTEM",
    action: "WEBHOOK_DUPLICATE_IGNORED",
    target: "pay_dup_8812",
    details: "Received duplicate HMAC-signed capture event. Idempotency key verified; no double-allocation.",
    hash: "98da01ef...77c4",
  },
  {
    id: "aud-04",
    timestamp: "2026-11-02 09:30 IST",
    actor: "Reminder Scheduler",
    role: "SYSTEM",
    action: "REMINDERS_EVALUATED",
    target: "Batch JEE2027",
    details: "Evaluated 12 queued items; 2 auto-skipped due to live zero-balance; 0 quiet hour violations.",
    hash: "b20ec91a...4421",
  },
  {
    id: "aud-05",
    timestamp: "2026-11-01 16:45 IST",
    actor: "Pooja Sharma",
    role: "COUNSELLOR",
    action: "RISK_STATUS_UPDATED",
    target: "STU-0731 Rohan Saini",
    details: "Status marked 'FOLLOW_UP'. Telephonic parent interview scheduled. Zero financial data accessed.",
    hash: "e311a62d...f18b",
  },
  {
    id: "aud-06",
    timestamp: "2026-10-31 11:20 IST",
    actor: "Arvind Mathur",
    role: "DIRECTOR",
    action: "POLICY_PUBLISHED",
    target: "Refund Policy v1",
    details: "Published statutory pro-rata policy v1. Fixed deduction locked at ₹0.00.",
    hash: "7c3a0109...be91",
  },
];

export default function AuditAndHealthPage() {
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(INITIAL_AUDIT_LOG);
  const [filterAction, setFilterAction] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [integrityStatus, setIntegrityStatus] = useState<"IDLE" | "CHECKING" | "VERIFIED">("VERIFIED");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredLogs = auditLog.filter((log) => {
    const matchesAction = filterAction === "ALL" || log.action === filterAction;
    const matchesQuery =
      log.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAction && matchesQuery;
  });

  const handleRunIntegrityCheck = () => {
    setIntegrityStatus("CHECKING");
    setTimeout(() => {
      setIntegrityStatus("VERIFIED");
      showToast("Ledger Integrity Verified: 100% append-only hash chains valid. Zero balance discrepancies across 2,591 student ledgers.");
    }, 700);
  };

  const handleExportAudit = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Timestamp,Actor,Role,Action,Target,Hash,Details"]
        .concat(
          filteredLogs.map(
            (l) => `"${l.timestamp}","${l.actor}","${l.role}","${l.action}","${l.target}","${l.hash}","${l.details}"`
          )
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `feeflow_audit_trail_20261102.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Audit trail exported successfully as CSV.");
  };

  return (
    <div className="min-h-screen bg-paper flex">
      <StaffNav currentRole="DIRECTOR" userName="Arvind Mathur" />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="bg-surface border-b border-line px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-ink tracking-tight">S8. Policy, Audit & System Health</h1>
                <ProvenanceChip kind="Provisional" />
                <span className="text-xs bg-teal-t text-teal px-2 py-0.5 rounded font-medium">
                  Director Exclusive
                </span>
              </div>
              <p className="text-xs text-ink-3 mt-1">
                Immutable hash-chained audit events, statutory policy governance, and real-time ledger consistency monitoring.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRunIntegrityCheck}
                disabled={integrityStatus === "CHECKING"}
                className="border border-line hover:bg-paper text-ink font-medium px-3.5 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors"
              >
                <RotateCw
                  className={`w-3.5 h-3.5 text-teal ${
                    integrityStatus === "CHECKING" ? "animate-spin" : ""
                  }`}
                />
                Run Ledger Integrity Check
              </button>
              <button
                onClick={handleExportAudit}
                className="bg-teal hover:bg-teal-d text-white font-medium px-4 py-2 rounded-lg text-xs flex items-center gap-2 shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export Audit Log
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

        {/* Health & Status Strip */}
        <section className="px-8 py-6 border-b border-line bg-paper/50">
          <div className="grid grid-cols-6 gap-4">
            <div className="p-3 bg-surface rounded-xl border border-line shadow-xs">
              <div className="text-[10px] text-ink-3 uppercase font-semibold">Scheduler</div>
              <div className="text-sm font-bold text-ok mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Running
              </div>
              <div className="text-[10px] text-ink-3">Quiet: 21:00-08:00</div>
            </div>

            <div className="p-3 bg-surface rounded-xl border border-line shadow-xs">
              <div className="text-[10px] text-ink-3 uppercase font-semibold">Outbox Queue</div>
              <div className="text-sm font-bold text-ink mt-1">0 items</div>
              <div className="text-[10px] text-ink-3">Clean dispatch</div>
            </div>

            <div className="p-3 bg-surface rounded-xl border border-line shadow-xs">
              <div className="text-[10px] text-ink-3 uppercase font-semibold">Failed Reminders</div>
              <div className="text-sm font-bold text-bad mt-1">4 items</div>
              <div className="text-[10px] text-ink-3">Retryable (DLR timeout)</div>
            </div>

            <div className="p-3 bg-surface rounded-xl border border-line shadow-xs">
              <div className="text-[10px] text-ink-3 uppercase font-semibold">Unmatched Payments</div>
              <div className="text-sm font-bold text-warn mt-1">7 items</div>
              <div className="text-[10px] text-ink-3">₹1.84 lakh unapplied</div>
            </div>

            <div className="p-3 bg-surface rounded-xl border border-line shadow-xs">
              <div className="text-[10px] text-ink-3 uppercase font-semibold">Rejected Webhooks</div>
              <div className="text-sm font-bold text-ink mt-1">1 signature err</div>
              <div className="text-[10px] text-ink-3">HMAC enforced</div>
            </div>

            <div className="p-3 bg-surface rounded-xl border border-line shadow-xs">
              <div className="text-[10px] text-ink-3 uppercase font-semibold">Ledger Invariant</div>
              <div className="text-sm font-bold text-ok mt-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> 100% Balanced
              </div>
              <div className="text-[10px] text-ink-3">Zero float drift</div>
            </div>
          </div>
        </section>

        {/* Work Area: Two Column Layout */}
        <div className="flex-1 p-8 grid grid-cols-12 gap-6 min-h-0">
          {/* Policy Governance Box (4 cols) */}
          <div className="col-span-4 bg-surface rounded-xl border border-line p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-bold text-sm text-ink">Statutory Refund Policy</h3>
                <p className="text-[11px] text-ink-3">Rajasthan Coaching Institutes Act 2024</p>
              </div>
              <span className="text-[10px] bg-ok/10 text-ok px-2 py-0.5 rounded font-bold font-mono">
                v1 PUBLISHED 🔒
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-paper rounded-lg border border-line space-y-2">
                <div className="flex justify-between">
                  <span className="text-ink-3">Proration Method</span>
                  <span className="font-semibold text-ink">Inclusive Days (T, c)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Fixed Deductions</span>
                  <span className="font-semibold text-ink font-mono">🔒 ₹0.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Percentage Deductions</span>
                  <span className="font-semibold text-ink font-mono">🔒 0 bp (0.00%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Refund SLA Window</span>
                  <span className="font-semibold text-ink">10 days from request</span>
                </div>
              </div>

              <div className="p-3 bg-paper rounded-lg border border-line space-y-1.5 text-[11px] text-ink-2">
                <div className="font-semibold text-ink flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-teal" />
                  Policy Guardrails
                </div>
                <div>
                  • Non-zero deductions disabled until legal counsel approves revision.
                </div>
                <div>
                  • Shortfalls on part-paid students remain informational only.
                </div>
                <div className="font-mono text-[10px] text-ink-3 pt-1 border-t border-line">
                  Hash: 7c3a0109...be91 · Published 31 Oct 2026
                </div>
              </div>

              <button
                disabled
                className="w-full border border-line/60 bg-paper/60 text-ink-3 cursor-not-allowed font-medium py-2 rounded-lg text-xs"
              >
                Publish v2 (Draft Locked)
              </button>
            </div>
          </div>

          {/* Immutable Audit Trail (8 cols) */}
          <div className="col-span-8 bg-surface rounded-xl border border-line overflow-hidden flex flex-col shadow-xs">
            <div className="p-4 border-b border-line bg-paper/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-ink">Immutable Audit Trail ({filteredLogs.length})</span>
                <span className="text-[11px] bg-paper px-2 py-0.5 rounded border border-line text-ink-3">
                  Append-Only Signed
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="bg-paper border border-line rounded-lg px-2.5 py-1 text-xs text-ink"
                >
                  <option value="ALL">All Actions</option>
                  <option value="WITHDRAWAL_APPROVED">Withdrawals</option>
                  <option value="PAYMENT_ALLOCATED">Allocations</option>
                  <option value="WEBHOOK_DUPLICATE_IGNORED">Webhooks</option>
                  <option value="REMINDERS_EVALUATED">Reminders</option>
                  <option value="RISK_STATUS_UPDATED">Counselling</option>
                </select>

                <div className="relative w-44">
                  <Search className="w-3 h-3 text-ink-3 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Search audit..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-paper border border-line rounded-lg pl-7 pr-2.5 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-teal"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-line/60">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-paper/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-ink">{log.action}</span>
                        <span className="text-[10px] bg-paper border border-line px-1.5 py-0.2 rounded font-mono text-ink-2">
                          {log.role}
                        </span>
                        <span className="text-xs text-ink-3">by {log.actor}</span>
                      </div>
                      <div className="text-xs font-medium text-teal mt-0.5">Target: {log.target}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-ink-3 font-mono">{log.timestamp}</div>
                      <div className="text-[10px] text-ink-3 font-mono">hash: {log.hash}</div>
                    </div>
                  </div>

                  <p className="text-xs text-ink-2 mt-2 leading-relaxed bg-paper/60 p-2.5 rounded-lg border border-line/60">
                    {log.details}
                  </p>
                </div>
              ))}

              {filteredLogs.length === 0 && (
                <div className="py-12 text-center text-ink-3 text-xs">
                  No audit records match the current filter.
                </div>
              )}
            </div>

            <div className="p-3 bg-paper border-t border-line text-[11px] text-ink-3 flex items-center justify-between">
              <span>Cryptographic hash chains guarantee zero post-hoc modifications.</span>
              <span className="font-mono">Demo Anchor: 2026-11-02</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
