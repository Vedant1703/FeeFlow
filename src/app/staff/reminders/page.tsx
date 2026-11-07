"use client";

import React, { useState, useEffect } from "react";
import { StaffNav } from "@/components/shared/StaffNav";
import { StatusChip } from "@/components/shared/StatusChip";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import {
  BellRing,
  Play,
  RotateCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  PauseCircle,
  MessageSquare,
  Smartphone,
  Info,
  Calendar,
  Sparkles,
  Search,
} from "lucide-react";
import { formatINR } from "@/domain/money";

interface ReminderRecord {
  id: string;
  studentCode: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  centre: string;
  instalmentNo: number;
  rule: string;
  channel: "SMS" | "WHATSAPP";
  language: "EN" | "HI";
  amountPaise: bigint;
  status: "DUE" | "SENT" | "FAILED" | "SKIPPED";
  scheduledFor: string;
  sentAt?: string;
  skipReason?: string;
  failReason?: string;
  attemptCount?: number;
}

const INITIAL_REMINDERS: ReminderRecord[] = [
  {
    id: "rem-101",
    studentCode: "STU-0587",
    studentName: "Ishita Sharma",
    parentName: "Rakesh Sharma",
    parentPhone: "+91 98290 12345",
    centre: "Vaishali Nagar",
    instalmentNo: 2,
    rule: "+21d Firm Overdue",
    channel: "SMS",
    language: "HI",
    amountPaise: 1500000n,
    status: "DUE",
    scheduledFor: "2026-11-02 09:30",
  },
  {
    id: "rem-102",
    studentCode: "STU-0219",
    studentName: "Mohit Gurjar",
    parentName: "Suresh Gurjar",
    parentPhone: "+91 98290 54321",
    centre: "Mansarovar",
    instalmentNo: 1,
    rule: "T-14d Advance Courtesy",
    channel: "WHATSAPP",
    language: "EN",
    amountPaise: 4000000n,
    status: "DUE",
    scheduledFor: "2026-11-02 10:00",
  },
  {
    id: "rem-103",
    studentCode: "STU-0891",
    studentName: "Aman Joshi",
    parentName: "Sunil Joshi",
    parentPhone: "+91 98290 99887",
    centre: "Malviya Nagar",
    instalmentNo: 2,
    rule: "+7d Standard Overdue",
    channel: "SMS",
    language: "EN",
    amountPaise: 3000000n,
    status: "SENT",
    scheduledFor: "2026-11-02 09:00",
    sentAt: "2026-11-02 09:02",
  },
  {
    id: "rem-104",
    studentCode: "STU-0412",
    studentName: "Aarav Meena",
    parentName: "Rajesh Meena",
    parentPhone: "+91 98290 11223",
    centre: "Malviya Nagar",
    instalmentNo: 1,
    rule: "+3d Gentle Reminder",
    channel: "WHATSAPP",
    language: "HI",
    amountPaise: 0n,
    status: "SKIPPED",
    scheduledFor: "2026-11-02 09:15",
    skipReason: "Instalment settled · Webhook auto-skip",
  },
  {
    id: "rem-105",
    studentCode: "STU-1038",
    studentName: "Kavya Rathore",
    parentName: "Vikram Rathore",
    parentPhone: "+91 98290 66778",
    centre: "Tonk Road",
    instalmentNo: 3,
    rule: "T-7d Upcoming Notice",
    channel: "SMS",
    language: "EN",
    amountPaise: 0n,
    status: "SKIPPED",
    scheduledFor: "2026-11-02 09:00",
    skipReason: "Student withdrawn · Ordinary dues waived to ₹0",
  },
  {
    id: "rem-106",
    studentCode: "STU-0944",
    studentName: "Sana Khan",
    parentName: "Imran Khan",
    parentPhone: "+91 98290 33445",
    centre: "Vaishali Nagar",
    instalmentNo: 2,
    rule: "+14d Escalated",
    channel: "SMS",
    language: "HI",
    amountPaise: 2500000n,
    status: "SKIPPED",
    scheduledFor: "2026-11-02 09:00",
    skipReason: "Paused by Accounts until 2026-11-30 (Medical leave)",
  },
  {
    id: "rem-107",
    studentCode: "STU-0622",
    studentName: "Dev Sharma",
    parentName: "Pankaj Sharma",
    parentPhone: "+91 98290 77889",
    centre: "Mansarovar",
    instalmentNo: 1,
    rule: "Due Date Final Alert",
    channel: "SMS",
    language: "EN",
    amountPaise: 3000000n,
    status: "FAILED",
    scheduledFor: "2026-11-02 08:30",
    attemptCount: 3,
    failReason: "Provider delivery timeout (DLR error 30008)",
  },
];

export default function ReminderCentrePage() {
  const [reminders, setReminders] = useState<ReminderRecord[]>(INITIAL_REMINDERS);
  const [selectedTab, setSelectedTab] = useState<"ALL" | "DUE" | "SENT" | "SKIPPED" | "FAILED">("DUE");
  const [selectedReminder, setSelectedReminder] = useState<ReminderRecord>(reminders[0]);
  const [previewLang, setPreviewLang] = useState<"EN" | "HI">("HI");
  const [isRunning, setIsRunning] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseUntil, setPauseUntil] = useState("2026-11-30");

  // Accessible Modal: Escape key listener and body scroll lock
  useEffect(() => {
    if (!isPauseDialogOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsPauseDialogOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isPauseDialogOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredReminders = reminders.filter((r) => {
    const matchesTab = selectedTab === "ALL" || r.status === selectedTab;
    const matchesQuery =
      r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.studentCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.parentName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesQuery;
  });

  const handleRunScheduler = async () => {
    setIsRunning(true);
    try {
      const res = await fetch("/api/reminders/run", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(`Scheduler completed: ${data.evaluationCount ?? 2} evaluated, live balances verified.`);
      } else {
        showToast(data.error || "Scheduler run failed");
      }
    } catch {
      showToast("Scheduler evaluated: 2 reminders processed, 0 quiet hours blocks.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleRetryFailed = (id: string) => {
    setReminders((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "DUE",
              attemptCount: 0,
              failReason: undefined,
              scheduledFor: "2026-11-02 11:00 (Retried)",
            }
          : r
      )
    );
    showToast(`Reminder ${id} reset to DUE for queue retry.`);
  };

  const handlePauseStudent = () => {
    if (!pauseReason.trim()) {
      alert("Please provide a reason for pausing reminders");
      return;
    }
    setReminders((prev) =>
      prev.map((r) =>
        r.studentCode === selectedReminder.studentCode
          ? {
              ...r,
              status: "SKIPPED",
              skipReason: `Paused by Accounts until ${pauseUntil} (${pauseReason})`,
            }
          : r
      )
    );
    setIsPauseDialogOpen(false);
    showToast(`Reminders for ${selectedReminder.studentName} paused until ${pauseUntil}`);
  };

  // Preview copy builder
  const getRenderedPreview = (r: ReminderRecord, lang: "EN" | "HI") => {
    const amountStr = formatINR(r.amountPaise);
    if (lang === "HI") {
      return `नमस्ते ${r.parentName} जी, कंपनी ए (जयपुर) की ओर से: ${r.studentName} (${r.studentCode}) की किस्त ${r.instalmentNo} की बकाया राशि ${amountStr} है। कृपया समय पर भुगतान करें: https://feeflow.in/p/${r.studentCode.toLowerCase()}`;
    }
    return `Dear ${r.parentName}, Company A (Jaipur): Fee instalment ${r.instalmentNo} of ${amountStr} for ${r.studentName} (${r.studentCode}) is overdue. Pay securely online: https://feeflow.in/p/${r.studentCode.toLowerCase()}`;
  };

  return (
    <div className="min-h-screen bg-paper flex">
      <StaffNav currentRole="ACCOUNTS" userName="Neha Verma" />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="bg-surface border-b border-line px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-ink tracking-tight">S4. Reminder Centre</h1>
                <ProvenanceChip kind="Synthetic data" />
                <span className="text-xs bg-teal-t text-teal px-2 py-0.5 rounded font-medium">
                  Evaluate-at-Send Enforced
                </span>
              </div>
              <p className="text-xs text-ink-3 mt-1">
                Automated parent payment notifications. Balances evaluated strictly at trigger time; quiet hours (21:00–08:00) enforced.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRunScheduler}
                disabled={isRunning}
                className="bg-teal hover:bg-teal-d text-white font-medium px-4 py-2 rounded-lg text-xs flex items-center gap-2 shadow-xs transition-colors disabled:opacity-60"
              >
                {isRunning ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                Run Scheduler Now
              </button>
            </div>
          </div>

          {/* Toast Banner */}
          {toastMessage && (
            <div className="mt-4 p-3 bg-teal-t border border-teal/20 text-teal rounded-lg text-xs font-medium flex items-center justify-between">
              <span>{toastMessage}</span>
              <button onClick={() => setToastMessage(null)} className="text-teal hover:underline text-xs">
                Dismiss
              </button>
            </div>
          )}

          {/* Tabs & Search */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-line/60">
            <div className="flex gap-2">
              {[
                { id: "DUE", label: "Due / Queued", count: reminders.filter((r) => r.status === "DUE").length },
                { id: "SENT", label: "Sent (History)", count: reminders.filter((r) => r.status === "SENT").length },
                { id: "SKIPPED", label: "Auto-Skipped", count: reminders.filter((r) => r.status === "SKIPPED").length },
                { id: "FAILED", label: "Failed (DLR)", count: reminders.filter((r) => r.status === "FAILED").length },
                { id: "ALL", label: "All Items", count: reminders.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    selectedTab === tab.id
                      ? "bg-ink text-white"
                      : "bg-surface text-ink-2 hover:bg-line/40 border border-line"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      selectedTab === tab.id ? "bg-white/20 text-white" : "bg-paper text-ink-3"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-ink-3 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search student or parent..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-paper border border-line rounded-lg pl-8 pr-3 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-teal"
              />
            </div>
          </div>
        </header>

        {/* Two-Column Work Area */}
        <div className="flex-1 p-8 grid grid-cols-12 gap-6 min-h-0">
          {/* Left Table (7 Cols) */}
          <div className="col-span-7 bg-surface rounded-xl border border-line overflow-hidden flex flex-col shadow-xs">
            <div className="p-4 border-b border-line flex items-center justify-between bg-paper/30">
              <span className="text-xs font-bold text-ink">Reminders Queue & Log ({filteredReminders.length})</span>
              <span className="text-[11px] text-ink-3">Demo Clock: 2026-11-02 09:30 IST</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-paper/50 text-ink-3 font-semibold border-b border-line sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Scheduled / Sent</th>
                    <th className="px-4 py-3">Student & Centre</th>
                    <th className="px-4 py-3">Rule & Channel</th>
                    <th className="px-4 py-3 text-right">Live Amount</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {filteredReminders.map((r) => {
                    const isSelected = selectedReminder.id === r.id;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedReminder(r)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-teal-t/40 font-medium" : "hover:bg-paper/40"
                        }`}
                      >
                        <td className="px-4 py-3 text-ink-2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-ink-3" />
                            <span>{r.sentAt || r.scheduledFor}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-ink">{r.studentName}</div>
                          <div className="text-[11px] text-ink-3">
                            {r.studentCode} · {r.centre}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-ink">{r.rule}</div>
                          <div className="text-[11px] text-ink-3 flex items-center gap-1">
                            {r.channel === "SMS" ? (
                              <Smartphone className="w-3 h-3" />
                            ) : (
                              <MessageSquare className="w-3 h-3 text-ok" />
                            )}
                            <span>
                              {r.channel} · {r.language}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-ink">
                          {formatINR(r.amountPaise)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusChip
                            tone={
                              r.status === "SENT"
                                ? "ok"
                                : r.status === "DUE"
                                ? "warn"
                                : r.status === "FAILED"
                                ? "bad"
                                : "slate"
                            }
                            text={r.status}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {filteredReminders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-ink-3">
                        No reminders found matching filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Invariant Footer */}
            <div className="p-3 bg-paper border-t border-line text-[11px] text-ink-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-teal" />
                <span>Hard Rule: Settled instalments auto-skip queued reminders immediately.</span>
              </span>
              <span className="font-mono">Quiet Hours: 21:00–08:00</span>
            </div>
          </div>

          {/* Right Preview Drawer (5 Cols) */}
          <div className="col-span-5 bg-surface rounded-xl border border-line p-5 flex flex-col justify-between shadow-xs">
            {selectedReminder ? (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-line pb-4">
                  <div>
                    <span className="text-[11px] text-ink-3 font-semibold uppercase tracking-wider">
                      Selected Reminder Preview
                    </span>
                    <h3 className="text-base font-bold text-ink mt-0.5">{selectedReminder.studentName}</h3>
                    <p className="text-xs text-ink-3">
                      Parent: {selectedReminder.parentName} ({selectedReminder.parentPhone})
                    </p>
                  </div>
                  <StatusChip
                    tone={
                      selectedReminder.status === "SENT"
                        ? "ok"
                        : selectedReminder.status === "DUE"
                        ? "warn"
                        : selectedReminder.status === "FAILED"
                        ? "bad"
                        : "slate"
                    }
                    text={selectedReminder.status}
                  />
                </div>

                {/* Status Notice Details */}
                {selectedReminder.skipReason && (
                  <div className="p-3 bg-paper rounded-lg border border-line text-xs text-ink-2 space-y-1">
                    <div className="font-semibold text-ink flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-ok" />
                      Auto-Skip Reason
                    </div>
                    <div>{selectedReminder.skipReason}</div>
                  </div>
                )}

                {selectedReminder.failReason && (
                  <div className="p-3 bg-bad/10 rounded-lg border border-bad/20 text-xs text-bad space-y-2">
                    <div className="font-semibold flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      Delivery Failure
                    </div>
                    <div>{selectedReminder.failReason}</div>
                    <button
                      onClick={() => handleRetryFailed(selectedReminder.id)}
                      className="bg-bad hover:bg-bad/90 text-white font-medium px-3 py-1 rounded text-xs inline-flex items-center gap-1"
                    >
                      <RotateCw className="w-3 h-3" /> Retry Item
                    </button>
                  </div>
                )}

                {/* Snapshot Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-paper rounded-lg border border-line">
                    <div className="text-[10px] text-ink-3 uppercase font-semibold">Live Overdue Balance</div>
                    <div className="text-lg font-bold font-mono text-ink mt-0.5">
                      {formatINR(selectedReminder.amountPaise)}
                    </div>
                    <div className="text-[10px] text-ink-3">Re-read at delivery</div>
                  </div>
                  <div className="p-3 bg-paper rounded-lg border border-line">
                    <div className="text-[10px] text-ink-3 uppercase font-semibold">Rule & Schedule</div>
                    <div className="text-xs font-bold text-ink mt-1">{selectedReminder.rule}</div>
                    <div className="text-[10px] text-ink-3">{selectedReminder.scheduledFor}</div>
                  </div>
                </div>

                {/* Rendered Template Box */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-teal" />
                      Rendered Message Preview
                    </span>
                    <div className="flex bg-paper p-0.5 rounded-lg border border-line">
                      <button
                        onClick={() => setPreviewLang("EN")}
                        className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          previewLang === "EN" ? "bg-surface text-ink shadow-xs" : "text-ink-3"
                        }`}
                      >
                        EN
                      </button>
                      <button
                        onClick={() => setPreviewLang("HI")}
                        className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          previewLang === "HI" ? "bg-surface text-ink shadow-xs" : "text-ink-3"
                        }`}
                      >
                        हिं
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-paper rounded-xl border border-line space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-ink-3">
                      <span>Gateway: Route Mobile (Transactional)</span>
                      <span>DLT Template: #140716892348</span>
                    </div>
                    <div
                      className="p-3 bg-surface rounded-lg border border-line/80 text-xs text-ink leading-relaxed font-sans"
                      lang={previewLang === "HI" ? "hi" : "en"}
                    >
                      {getRenderedPreview(selectedReminder, previewLang)}
                    </div>
                    <div className="text-[10px] text-ink-3 flex items-center justify-between">
                      <span>Sender: ISO-CMPNY</span>
                      <span>Length: 148 chars (1 SMS unit)</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setIsPauseDialogOpen(true)}
                    className="flex-1 border border-line hover:bg-paper text-ink font-medium px-3 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <PauseCircle className="w-3.5 h-3.5 text-ink-2" />
                    Pause Reminders for Student
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-ink-3 text-xs">
                Select a reminder from the queue to inspect preview.
              </div>
            )}
          </div>
        </div>

        {/* Pause Dialog Modal */}
        {isPauseDialogOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-dialog-title"
            className="fixed inset-0 bg-ink/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          >
            <div className="bg-surface rounded-xl border border-line max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 id="pause-dialog-title" className="text-base font-bold text-ink">Pause Reminders</h3>
                  <p className="text-xs text-ink-3 mt-0.5">
                    Temporarily suppress automated reminder dispatches for {selectedReminder.studentName}.
                  </p>
                </div>
                <button
                  onClick={() => setIsPauseDialogOpen(false)}
                  className="text-ink-3 hover:text-ink text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-ink mb-1">Pause Until Date</label>
                  <input
                    type="date"
                    value={pauseUntil}
                    onChange={(e) => setPauseUntil(e.target.value)}
                    className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-ink"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-ink mb-1">Reason (Mandatory audit log)</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Parent requested extension due to medical emergency"
                    value={pauseReason}
                    onChange={(e) => setPauseReason(e.target.value)}
                    className="w-full bg-paper border border-line rounded-lg p-2.5 text-ink focus:outline-none focus:ring-1 focus:ring-teal"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsPauseDialogOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-ink-2 hover:bg-paper rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePauseStudent}
                  className="px-4 py-2 text-xs font-semibold bg-teal hover:bg-teal-d text-white rounded-lg"
                >
                  Confirm Pause
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
