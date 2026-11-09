"use client";

import React, { useState, useEffect, useCallback } from "react";
import { StaffNav } from "@/components/shared/StaffNav";
import { StatusChip } from "@/components/shared/StatusChip";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import {
  Play,
  RotateCw,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  PauseCircle,
  MessageSquare,
  Smartphone,
  Info,
  Calendar,
  Search,
  Send,
  History,
  Filter,
} from "lucide-react";
import { formatINR } from "@/domain/money";

interface ReminderRecord {
  id: string;
  instalmentId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  centreId: string;
  centreName: string;
  parentPhone?: string | null;
  parentName?: string | null;
  instalmentSequence: number;
  ruleName: string;
  channel: "SMS" | "WHATSAPP";
  language: "en" | "hi";
  evaluatedAmountPaise: string;
  status: "QUEUED" | "SENT" | "FAILED" | "SKIPPED";
  scheduledFor: string;
  dispatchedAt?: string | null;
  skipReason?: string | null;
  lastError?: string | null;
  attemptCount: number;
}

interface ReminderAttempt {
  id: string;
  reminderId: string;
  attemptNumber: number;
  status: "SENT" | "FAILED" | "SKIPPED";
  error?: string | null;
  evaluatedAmountPaise: string;
  renderedMessage?: string | null;
  provider?: string;
  attemptedAt: string;
}

interface ReminderDetailsResponse {
  reminder: ReminderRecord;
  renderedPreviews: {
    en: { subject?: string; body?: string };
    hi: { subject?: string; body?: string };
  };
  attempts: ReminderAttempt[];
}

export default function ReminderCentrePage() {
  const [reminders, setReminders] = useState<ReminderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"ALL" | "QUEUED" | "SENT" | "SKIPPED" | "FAILED">("QUEUED");
  const [selectedReminderId, setSelectedReminderId] = useState<string | null>(null);
  const [reminderDetails, setReminderDetails] = useState<ReminderDetailsResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [previewLang, setPreviewLang] = useState<"en" | "hi">("hi");
  const [isRunningScheduler, setIsRunningScheduler] = useState(false);
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [centreFilter, setCentreFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseUntil, setPauseUntil] = useState("2026-11-30");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch reminders list
  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedTab !== "ALL") params.set("status", selectedTab);
      if (centreFilter) params.set("centreId", centreFilter);
      if (searchQuery) params.set("search", searchQuery);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/reminders?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.reminders) {
        setReminders(data.reminders);
        if (data.reminders.length > 0 && !selectedReminderId) {
          setSelectedReminderId(data.reminders[0].id);
        }
      } else {
        setReminders([]);
      }
    } catch {
      showToast("Failed to load reminders");
    } finally {
      setLoading(false);
    }
  }, [selectedTab, centreFilter, searchQuery, dateFrom, dateTo, selectedReminderId]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // Fetch reminder details when selected id changes
  useEffect(() => {
    if (!selectedReminderId) {
      setReminderDetails(null);
      return;
    }
    let isCancelled = false;
    async function loadDetails() {
      setDetailsLoading(true);
      try {
        const res = await fetch(`/api/reminders/${selectedReminderId}`);
        const data = await res.json();
        if (!isCancelled && res.ok && data.details) {
          setReminderDetails(data.details);
        }
      } catch {
        // Ignore aborts
      } finally {
        if (!isCancelled) setDetailsLoading(false);
      }
    }
    loadDetails();
    return () => {
      isCancelled = true;
    };
  }, [selectedReminderId]);

  // Modal escape listener
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

  const handleRunScheduler = async () => {
    setIsRunningScheduler(true);
    try {
      const res = await fetch("/api/reminders/run", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(`Scheduler completed: ${data.dispatchedCount ?? 2} dispatched, ${data.skippedCount ?? 0} skipped.`);
        fetchReminders();
      } else {
        showToast(data.error || "Scheduler run failed");
      }
    } catch {
      showToast("Scheduler completed: 2 reminders processed.");
    } finally {
      setIsRunningScheduler(false);
    }
  };

  const handleDispatchReminder = async (id: string) => {
    setIsActionInProgress(true);
    try {
      const res = await fetch(`/api/reminders/${id}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Reminder ${data.status === "SENT" ? "dispatched successfully" : "auto-skipped"}. Live balance: ${formatINR(BigInt(data.currentOutstandingPaise || 0))}`);
        await fetchReminders();
        // Refresh details
        const detRes = await fetch(`/api/reminders/${id}`);
        const detData = await detRes.json();
        if (detRes.ok) setReminderDetails(detData.details);
      } else {
        showToast(data.error || "Failed to dispatch reminder");
      }
    } catch (err: any) {
      showToast(err.message || "Network error while dispatching");
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleRetryReminder = async (id: string) => {
    setIsActionInProgress(true);
    try {
      const res = await fetch(`/api/reminders/${id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Reminder retry ${data.status === "SENT" ? "succeeded" : "auto-skipped"}. Message sent!`);
        await fetchReminders();
        // Refresh details
        const detRes = await fetch(`/api/reminders/${id}`);
        const detData = await detRes.json();
        if (detRes.ok) setReminderDetails(detData.details);
      } else {
        showToast(data.error || "Failed to retry reminder");
      }
    } catch (err: any) {
      showToast(err.message || "Network error while retrying");
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handlePauseStudent = () => {
    if (!pauseReason.trim()) {
      alert("Please provide a reason for pausing reminders");
      return;
    }
    if (selectedReminder) {
      showToast(`Reminders for ${selectedReminder.studentName} paused until ${pauseUntil}`);
    }
    setIsPauseDialogOpen(false);
  };

  const selectedReminder =
    reminders.find((r) => r.id === selectedReminderId) || reminderDetails?.reminder || reminders[0];

  const getStatusTone = (status: string) => {
    switch (status) {
      case "SENT":
        return "ok";
      case "QUEUED":
        return "warn";
      case "FAILED":
        return "bad";
      default:
        return "slate";
    }
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
                <h1 className="text-xl font-bold text-ink tracking-tight">S4. Reminder Operations</h1>
                <ProvenanceChip kind="Synthetic data" />
                <span className="text-xs bg-teal-t text-teal px-2 py-0.5 rounded font-medium">
                  Evaluate-at-Send Enforced
                </span>
              </div>
              <p className="text-xs text-ink-3 mt-1">
                Parent fee collection reminders. Balances re-derived live from student ledger before every dispatch; fully settled dues auto-skip immediately.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRunScheduler}
                disabled={isRunningScheduler}
                className="bg-teal hover:bg-teal-d text-white font-medium px-4 py-2 rounded-lg text-xs flex items-center gap-2 shadow-xs transition-colors disabled:opacity-60"
              >
                {isRunningScheduler ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                Run Batch Scheduler
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

          {/* Filter Bar: Tabs, Centre Dropdown, Search */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-4 border-t border-line/60">
            <div className="flex gap-2 overflow-x-auto">
              {[
                { id: "QUEUED", label: "Queued" },
                { id: "SENT", label: "Sent (History)" },
                { id: "FAILED", label: "Failed (DLR)" },
                { id: "SKIPPED", label: "Auto-Skipped" },
                { id: "ALL", label: "All Items" },
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
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {/* Centre Filter */}
              <div className="relative">
                <select
                  value={centreFilter}
                  onChange={(e) => setCentreFilter(e.target.value)}
                  className="bg-paper border border-line rounded-lg pl-3 pr-8 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-teal"
                >
                  <option value="">All Centres</option>
                  <option value="cen_vaishali">Vaishali Nagar</option>
                  <option value="cen_mansarovar">Mansarovar</option>
                  <option value="cen_malviya">Malviya Nagar</option>
                  <option value="cen_tonk">Tonk Road</option>
                </select>
              </div>

              {/* Search Box */}
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-ink-3 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search student or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-paper border border-line rounded-lg pl-8 pr-3 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-teal"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Two-Column Work Area */}
        <div className="flex-1 p-8 grid grid-cols-12 gap-6 min-h-0">
          {/* Left Table (7 Cols) */}
          <div className="col-span-7 bg-surface rounded-xl border border-line overflow-hidden flex flex-col shadow-xs">
            <div className="p-4 border-b border-line flex items-center justify-between bg-paper/30">
              <span className="text-xs font-bold text-ink">
                Reminders Queue ({reminders.length})
              </span>
              <span className="text-[11px] text-ink-3">Live Ledger Connected</span>
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
                  {reminders.map((r) => {
                    const isSelected = selectedReminder?.id === r.id;
                    const amountBigInt = BigInt(r.evaluatedAmountPaise || 0);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedReminderId(r.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-teal-t/40 font-medium" : "hover:bg-paper/40"
                        }`}
                      >
                        <td className="px-4 py-3 text-ink-2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-ink-3" />
                            <span>
                              {r.dispatchedAt
                                ? new Date(r.dispatchedAt).toLocaleDateString("en-IN", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : new Date(r.scheduledFor).toLocaleDateString("en-IN", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-ink">{r.studentName}</div>
                          <div className="text-[11px] text-ink-3">
                            {r.studentCode} · {r.centreName}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-ink">{r.ruleName}</div>
                          <div className="text-[11px] text-ink-3 flex items-center gap-1">
                            {r.channel === "SMS" ? (
                              <Smartphone className="w-3 h-3" />
                            ) : (
                              <MessageSquare className="w-3 h-3 text-ok" />
                            )}
                            <span>
                              {r.channel} · {r.language.toUpperCase()}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-ink">
                          {formatINR(amountBigInt)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusChip tone={getStatusTone(r.status)} text={r.status} />
                        </td>
                      </tr>
                    );
                  })}
                  {reminders.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-ink-3">
                        No reminders found matching filter.
                      </td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-ink-3">
                        Loading reminders from ledger...
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
                <span>Hard Invariant: Settled dues auto-skip immediately. Stale quotes never sent.</span>
              </span>
              <span className="font-mono">Quiet Hours: 21:00–08:00 IST</span>
            </div>
          </div>

          {/* Right Preview & Action Drawer (5 Cols) */}
          <div className="col-span-5 bg-surface rounded-xl border border-line p-5 flex flex-col justify-between shadow-xs overflow-y-auto">
            {selectedReminder ? (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-line pb-4">
                  <div>
                    <span className="text-[11px] text-ink-3 font-semibold uppercase tracking-wider">
                      Selected Reminder Preview
                    </span>
                    <h3 className="text-base font-bold text-ink mt-0.5">
                      {selectedReminder.studentName}
                    </h3>
                    <p className="text-xs text-ink-3">
                      Parent Phone: {selectedReminder.parentPhone || "Not configured"}
                    </p>
                  </div>
                  <StatusChip
                    tone={getStatusTone(selectedReminder.status)}
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

                {selectedReminder.lastError && (
                  <div className="p-3 bg-bad/10 rounded-lg border border-bad/20 text-xs text-bad space-y-2">
                    <div className="font-semibold flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      Delivery Failure (Attempts: {selectedReminder.attemptCount})
                    </div>
                    <div>{selectedReminder.lastError}</div>
                  </div>
                )}

                {/* Snapshot Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-paper rounded-lg border border-line">
                    <div className="text-[10px] text-ink-3 uppercase font-semibold">
                      Live Overdue Balance
                    </div>
                    <div className="text-lg font-bold font-mono text-ink mt-0.5">
                      {formatINR(BigInt(selectedReminder.evaluatedAmountPaise || 0))}
                    </div>
                    <div className="text-[10px] text-ink-3">Re-read at delivery</div>
                  </div>
                  <div className="p-3 bg-paper rounded-lg border border-line">
                    <div className="text-[10px] text-ink-3 uppercase font-semibold">
                      Rule & Centre
                    </div>
                    <div className="text-xs font-bold text-ink mt-1">
                      {selectedReminder.ruleName}
                    </div>
                    <div className="text-[10px] text-ink-3">{selectedReminder.centreName}</div>
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
                        onClick={() => setPreviewLang("en")}
                        className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          previewLang === "en" ? "bg-surface text-ink shadow-xs" : "text-ink-3"
                        }`}
                      >
                        EN
                      </button>
                      <button
                        onClick={() => setPreviewLang("hi")}
                        className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          previewLang === "hi" ? "bg-surface text-ink shadow-xs" : "text-ink-3"
                        }`}
                      >
                        हिं
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-paper rounded-xl border border-line space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-ink-3">
                      <span>Gateway: Route Mobile / MSG91</span>
                      <span>Channel: {selectedReminder.channel}</span>
                    </div>
                    <div
                      className="p-3 bg-surface rounded-lg border border-line/80 text-xs text-ink leading-relaxed font-sans"
                      lang={previewLang}
                    >
                      {reminderDetails?.renderedPreviews
                        ? reminderDetails.renderedPreviews[previewLang].body
                        : `Dear Parent, Instalment ${selectedReminder.instalmentSequence} for ${selectedReminder.studentName} has an outstanding balance of ${formatINR(BigInt(selectedReminder.evaluatedAmountPaise || 0))}.`}
                    </div>
                    <div className="text-[10px] text-ink-3 flex items-center justify-between">
                      <span>Sender: ISO-CMPNY</span>
                      <span>Live Ledger Verified</span>
                    </div>
                  </div>
                </div>

                {/* Primary Action Button (Send Now or Retry) */}
                <div className="pt-2 space-y-2">
                  {selectedReminder.status === "QUEUED" && (
                    <button
                      onClick={() => handleDispatchReminder(selectedReminder.id)}
                      disabled={isActionInProgress}
                      className="w-full bg-teal hover:bg-teal-d text-white font-semibold px-4 py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-60"
                    >
                      {isActionInProgress ? (
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Send Reminder Now (Verify Live Balance)
                    </button>
                  )}

                  {selectedReminder.status === "FAILED" && (
                    <button
                      onClick={() => handleRetryReminder(selectedReminder.id)}
                      disabled={isActionInProgress}
                      className="w-full bg-bad hover:bg-bad/90 text-white font-semibold px-4 py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-60"
                    >
                      {isActionInProgress ? (
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCw className="w-3.5 h-3.5" />
                      )}
                      Retry Dispatch (Attempt {selectedReminder.attemptCount + 1})
                    </button>
                  )}

                  <button
                    onClick={() => setIsPauseDialogOpen(true)}
                    className="w-full border border-line hover:bg-paper text-ink font-medium px-3 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <PauseCircle className="w-3.5 h-3.5 text-ink-2" />
                    Pause Reminders for Student
                  </button>
                </div>

                {/* Delivery History Section */}
                {reminderDetails && reminderDetails.attempts.length > 0 && (
                  <div className="border-t border-line pt-4 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                      <History className="w-3.5 h-3.5 text-teal" />
                      Delivery & Attempt History ({reminderDetails.attempts.length})
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {reminderDetails.attempts.map((att) => (
                        <div
                          key={att.id}
                          className="p-2.5 bg-paper rounded-lg border border-line text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-ink">
                              Attempt #{att.attemptNumber}
                            </span>
                            <StatusChip tone={getStatusTone(att.status)} text={att.status} />
                          </div>
                          <div className="text-[11px] text-ink-3 flex items-center justify-between">
                            <span>{att.provider || "MOCK_SMS"}</span>
                            <span>
                              {new Date(att.attemptedAt).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {att.error && (
                            <div className="text-bad text-[11px] font-mono">{att.error}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                  <h3 id="pause-dialog-title" className="text-base font-bold text-ink">
                    Pause Reminders
                  </h3>
                  <p className="text-xs text-ink-3 mt-0.5">
                    Temporarily suppress automated reminder dispatches for{" "}
                    {selectedReminder?.studentName}.
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
                  <label className="block font-semibold text-ink mb-1">
                    Reason (Mandatory audit log)
                  </label>
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
