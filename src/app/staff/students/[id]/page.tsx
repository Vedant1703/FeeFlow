"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { StaffNav } from "@/components/shared/StaffNav";
import { DemoBar } from "@/components/shared/DemoBar";
import { Rail } from "@/components/shared/Rail";
import { StatusChip } from "@/components/shared/StatusChip";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { formatINR } from "@/domain/money";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  UserX,
  Clock,
  Sparkles,
  ShieldCheck,
  Receipt,
  AlertTriangle,
  History,
  FileText,
  PauseCircle,
  PlusCircle,
  CheckCircle,
} from "lucide-react";

export default function StudentFeeLedgerPage() {
  const params = useParams();
  const router = useRouter();

  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [pauseSuccess, setPauseSuccess] = useState(false);
  const [pauseDays, setPauseDays] = useState("7");
  const [withdrawalNotes, setWithdrawalNotes] = useState("Student relocating to Kota");

  // Synthetic student data for Ishita Sharma STU-0587
  const student = {
    id: "stu_ishita_demo_id",
    studentCode: "STU-0587",
    name: "Ishita Sharma",
    parentName: "Sanjay Sharma",
    phone: "+91 90000 12345",
    batchName: "JEE 2027 Evening (2-Year Integrated)",
    centreName: "Vaishali Nagar, Jaipur",
    enrollmentDate: "15 May 2026",
    totalBilled: 12000000n, // ₹1,20,000
    totalPaid: 4500000n, // ₹45,000
    totalOutstanding: 7500000n, // ₹75,000
    maxOverdue: 23,
    railSegments: [
      { state: "paid" as const, paidPct: 100 },
      { state: "part" as const, paidPct: 50, overdue: true },
      { state: "upcoming" as const, paidPct: 0 },
      { state: "upcoming" as const, paidPct: 0 },
    ],
    instalments: [
      {
        id: "inst-1",
        seq: 1,
        dueDate: "10 Jul 2026",
        amount: 3000000n,
        paid: 3000000n,
        outstanding: 0n,
        overdueDays: 0,
        status: "PAID" as const,
      },
      {
        id: "inst-2",
        seq: 2,
        dueDate: "10 Oct 2026",
        amount: 3000000n,
        paid: 1500000n,
        outstanding: 1500000n,
        overdueDays: 23,
        status: "OVERDUE" as const,
      },
      {
        id: "inst-3",
        seq: 3,
        dueDate: "10 Jan 2027",
        amount: 3000000n,
        paid: 0n,
        outstanding: 3000000n,
        overdueDays: 0,
        status: "UPCOMING" as const,
      },
      {
        id: "inst-4",
        seq: 4,
        dueDate: "10 Mar 2027",
        amount: 3000000n,
        paid: 0n,
        outstanding: 3000000n,
        overdueDays: 0,
        status: "UPCOMING" as const,
      },
    ],
    ledgerEntries: [
      {
        id: "led-1",
        date: "15 Jun 2026",
        type: "CHARGE" as const,
        amount: 12000000n,
        ref: "PLAN_CREATION",
        notes: "4 × ₹30,000 Annual Fee Plan established",
        by: "System",
      },
      {
        id: "led-2",
        date: "09 Jul 2026",
        type: "ALLOCATION" as const,
        amount: -3000000n,
        ref: "PAY-ISHITA-1",
        notes: "UPI capture allocated to Instalment 1 (Receipt REC-2026-0587-1)",
        by: "Webhook",
      },
      {
        id: "led-3",
        date: "15 Oct 2026",
        type: "ALLOCATION" as const,
        amount: -1500000n,
        ref: "PAY-ISHITA-2-PART",
        notes: "Partial Netbanking capture allocated to Instalment 2 (Receipt REC-2026-0587-2)",
        by: "Webhook",
      },
    ],
  };

  const handlePauseReminders = () => {
    setPauseSuccess(true);
    setTimeout(() => {
      setIsPauseModalOpen(false);
      setPauseSuccess(false);
    }, 1200);
  };

  const handleRequestWithdrawal = async () => {
    try {
      const res = await fetch("/api/withdrawals/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          effectiveWithdrawalDate: "2026-11-05",
          notes: withdrawalNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push("/staff/withdrawals");
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <DemoBar />

      <div className="flex flex-1">
        <StaffNav currentRole="ACCOUNTS" userName="Neha Verma" />

        <main className="flex-1 p-8 space-y-8 max-w-6xl">
          {/* Header & Back Link */}
          <div className="flex items-center justify-between pb-4 border-b border-line">
            <div className="space-y-1">
              <Link
                href="/staff"
                className="inline-flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Dashboard</span>
              </Link>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-ink">
                  {student.name}
                </h1>
                <span className="font-mono text-sm font-bold text-ink-3 bg-surface px-2.5 py-0.5 rounded border border-line">
                  {student.studentCode}
                </span>
                <StatusChip tone="bad" text="Part paid, 23d overdue" />
              </div>
              <p className="text-xs text-ink-3">
                {student.batchName} · {student.centreName} · Guardian: {student.parentName} ({student.phone})
              </p>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPauseModalOpen(true)}
                className="px-3 py-2 rounded-input border border-line hover:border-teal bg-surface text-ink text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <PauseCircle className="w-4 h-4 text-warn" />
                <span>Pause Reminders</span>
              </button>

              <button
                type="button"
                onClick={() => setIsWithdrawalModalOpen(true)}
                className="px-3 py-2 rounded-input border border-line hover:border-bad bg-surface text-bad text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <UserX className="w-4 h-4 text-bad" />
                <span>Request Withdrawal</span>
              </button>
            </div>
          </div>

          {/* Financial Metrics Strip */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 rounded-panel bg-surface border border-line shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">
                Approved Fee Plan
              </span>
              <div className="text-xl font-bold font-mono text-ink">
                {formatINR(student.totalBilled)}
              </div>
              <div className="text-[11px] text-ink-3">4 equal instalments of ₹30,000</div>
            </div>

            <div className="p-4 rounded-panel bg-surface border border-line shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">
                Verified Paid
              </span>
              <div className="text-xl font-bold font-mono text-ok">
                {formatINR(student.totalPaid)}
              </div>
              <div className="text-[11px] text-ink-3">Instalment 1 + Part Instalment 2</div>
            </div>

            <div className="p-4 rounded-panel bg-surface border border-line shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">
                Current Outstanding
              </span>
              <div className="text-xl font-bold font-mono text-warn">
                {formatINR(student.totalOutstanding)}
              </div>
              <div className="text-[11px] text-ink-3">Remaining term liability</div>
            </div>

            <div className="p-4 rounded-panel bg-surface border border-line shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">
                Days Overdue
              </span>
              <div className="text-xl font-bold font-mono text-bad">
                {student.maxOverdue} Days
              </div>
              <div className="text-[11px] text-ink-3">As of 2 Nov 2026 demo clock</div>
            </div>
          </div>

          {/* Signature Rail */}
          <div className="p-5 rounded-panel bg-surface border border-line shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-ink-2">
              <span>Instalment Progress Rail (4 Segments)</span>
              <span>Instalment 2: 50% paid (23 days overdue)</span>
            </div>
            <Rail segs={student.railSegments} tall />
          </div>

          {/* =========================================================================
              INSTALMENT SCHEDULE TABLE
             ========================================================================= */}
          <div className="p-6 rounded-hero bg-surface border border-line shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <h2 className="font-bold text-base text-ink tracking-tight">
                Instalment Schedule & Allocation State
              </h2>
              <span className="text-xs text-ink-3">Derived strictly from signed ledger</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line text-ink-3 font-semibold">
                    <th className="py-2.5 px-3">Instalment</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-right">Scheduled</th>
                    <th className="py-2.5 px-3 text-right">Verified Paid</th>
                    <th className="py-2.5 px-3 text-right">Outstanding</th>
                    <th className="py-2.5 px-3 text-center">Overdue</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {student.instalments.map((inst) => (
                    <tr key={inst.id} className="hover:bg-paper/80 transition-colors">
                      <td className="py-3 px-3 font-semibold text-ink">
                        Instalment {inst.seq}
                      </td>
                      <td className="py-3 px-3 text-ink-2 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-ink-3" />
                        <span>{inst.dueDate}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-medium text-ink">
                        {formatINR(inst.amount)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-ok">
                        {formatINR(inst.paid)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-ink">
                        {formatINR(inst.outstanding)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {inst.overdueDays > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[11px] bg-bad-t text-bad font-bold">
                            {inst.overdueDays}d
                          </span>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {inst.status === "PAID" && <StatusChip tone="ok" text="Paid" />}
                        {inst.status === "OVERDUE" && <StatusChip tone="bad" text="Overdue" />}
                        {inst.status === "UPCOMING" && <StatusChip tone="slate" text="Upcoming" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* =========================================================================
              APPEND-ONLY SIGNED LEDGER TIMELINE
             ========================================================================= */}
          <div className="p-6 rounded-hero bg-surface border border-line shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-teal" />
                <h2 className="font-bold text-base text-ink tracking-tight">
                  Append-Only Signed Ledger Timeline
                </h2>
              </div>
              <span className="text-xs text-ok font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Immutable Financial Source of Truth</span>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-line text-ink-3 font-semibold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Entry Type</th>
                    <th className="py-2.5 px-3 text-right">Signed Amount</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3 text-right">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {student.ledgerEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-paper/80 transition-colors">
                      <td className="py-3 px-3 text-ink-2">{e.date}</td>
                      <td className="py-3 px-3 font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            e.type === "CHARGE"
                              ? "bg-slate-t text-slate font-bold"
                              : "bg-ok-t text-ok font-bold"
                          }`}
                        >
                          {e.type}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-bold text-sm ${
                          e.amount < 0n ? "text-ok" : "text-ink"
                        }`}
                      >
                        {formatINR(e.amount)}
                      </td>
                      <td className="py-3 px-3 text-ink-2">{e.ref}</td>
                      <td className="py-3 px-3 text-ink-3 font-sans text-xs">{e.notes}</td>
                      <td className="py-3 px-3 text-right text-ink-3">{e.by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Pause Modal */}
      {isPauseModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md bg-surface rounded-panel p-6 space-y-4 border border-line shadow-dialog">
            <h3 className="font-bold text-base text-ink">Pause Automated Reminders</h3>
            <p className="text-xs text-ink-2">
              Temporarily suppress WhatsApp & SMS payment reminder dispatches for {student.name}.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1">
                  Pause Duration:
                </label>
                <select
                  value={pauseDays}
                  onChange={(e) => setPauseDays(e.target.value)}
                  className="w-full h-10 px-3 rounded-input border border-line bg-surface text-xs text-ink"
                >
                  <option value="7">7 Days (until 9 Nov 2026)</option>
                  <option value="14">14 Days (until 16 Nov 2026)</option>
                  <option value="30">30 Days (until 2 Dec 2026)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1">
                  Reason for Pause (Required):
                </label>
                <input
                  type="text"
                  defaultValue="Parent promised payment by post-dated cheque on 8 Nov"
                  className="w-full h-10 px-3 rounded-input border border-line bg-surface text-xs text-ink"
                />
              </div>
            </div>

            {pauseSuccess && (
              <div className="p-2.5 rounded bg-ok-t text-ok text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Reminders paused until selected date</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPauseModalOpen(false)}
                className="px-3 py-2 rounded-input border border-line text-xs font-semibold text-ink-2 hover:bg-paper"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePauseReminders}
                className="px-4 py-2 rounded-input bg-teal text-white text-xs font-semibold hover:bg-teal-d"
              >
                Confirm Pause
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Quote Modal */}
      {isWithdrawalModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg bg-surface rounded-panel p-6 space-y-4 border border-line shadow-dialog">
            <h3 className="font-bold text-base text-ink">Submit Withdrawal & Pro-Rata Refund Quote</h3>
            <p className="text-xs text-ink-2">
              Calculates pro-rata refund according to MoE 2024 Guidelines. Unpaid ordinary instalments will be waived to ₹0 upon Director approval.
            </p>

            {/* Quote Formula Preview Box */}
            <div className="p-4 rounded bg-paper border border-line space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-3">Total Inclusive Term (T):</span>
                <span className="font-mono font-bold">290 Days (15 Jun 2026–31 Mar 2027)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">Consumed Days (c):</span>
                <span className="font-mono font-bold">144 Days (until 5 Nov 2026)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">Earned Fee:</span>
                <span className="font-mono font-bold text-ink">₹59,586.21</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">Verified Paid:</span>
                <span className="font-mono font-bold text-ok">₹45,000.00</span>
              </div>
              <div className="flex justify-between border-t border-line pt-2">
                <span className="font-semibold text-slate">Indicative Shortfall (Informational):</span>
                <span className="font-mono font-bold text-slate">₹14,586.21</span>
              </div>
            </div>

            <div className="p-3 rounded bg-slate-t text-[11px] text-slate border border-slate/30">
              <strong>Shortfall Safeguard:</strong> The ₹14,586.21 shortfall is informational only. Approved withdrawal will waive the ₹75,000 ordinary outstanding to ₹0.
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1">
                Reason for Withdrawal:
              </label>
              <textarea
                value={withdrawalNotes}
                onChange={(e) => setWithdrawalNotes(e.target.value)}
                className="w-full h-16 p-2 rounded-input border border-line bg-surface text-xs text-ink focus:outline-none focus:ring-2 focus:ring-teal"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsWithdrawalModalOpen(false)}
                className="px-3 py-2 rounded-input border border-line text-xs font-semibold text-ink-2 hover:bg-paper"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestWithdrawal}
                className="px-4 py-2 rounded-input bg-bad text-white text-xs font-semibold hover:bg-bad/90"
              >
                Submit for Director Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
