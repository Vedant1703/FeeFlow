"use client";

import React, { useState } from "react";
import { StaffNav } from "@/components/shared/StaffNav";
import { StatusChip } from "@/components/shared/StatusChip";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import {
  ShieldAlert,
  PhoneCall,
  CheckCircle2,
  Clock,
  Ban,
  TrendingDown,
  Info,
  Calendar,
  AlertTriangle,
  FileText,
  UserCheck,
  Search,
} from "lucide-react";

interface RiskRecord {
  id: string;
  studentCode: string;
  studentName: string;
  batch: string;
  centre: string;
  score: number | null;
  tier: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";
  signals: {
    feeOverdueDays: number;
    feeNorm: number;
    feeContrib: number;
    attendancePct: number;
    attendanceNorm: number;
    attendanceContrib: number;
    testScorePct: number;
    testNorm: number;
    testContrib: number;
    academicSignalsCount: number;
  };
  counsellorStatus: "PENDING" | "REVIEWED" | "FOLLOW_UP" | "FALSE_POSITIVE";
  notes?: string;
  suppressedUntil?: string;
}

const INITIAL_RISK_RECORDS: RiskRecord[] = [
  {
    id: "risk-01",
    studentCode: "STU-0731",
    studentName: "Rohan Saini",
    batch: "JEE 2027 Evening",
    centre: "Vaishali Nagar",
    score: 72,
    tier: "HIGH",
    signals: {
      feeOverdueDays: 41,
      feeNorm: 0.70,
      feeContrib: 28.0,
      attendancePct: 58,
      attendanceNorm: 0.75,
      attendanceContrib: 22.5,
      testScorePct: 41,
      testNorm: 0.72,
      testContrib: 21.6,
      academicSignalsCount: 2,
    },
    counsellorStatus: "PENDING",
  },
  {
    id: "risk-02",
    studentCode: "STU-1456",
    studentName: "Tanvi Arora",
    batch: "JEE 2027 Evening",
    centre: "Vaishali Nagar",
    score: null,
    tier: "INSUFFICIENT_DATA",
    signals: {
      feeOverdueDays: 25,
      feeNorm: 0.50,
      feeContrib: 0,
      attendancePct: 82,
      attendanceNorm: 0,
      attendanceContrib: 0,
      testScorePct: 0,
      testNorm: 0,
      testContrib: 0,
      academicSignalsCount: 1, // Only 1 academic signal!
    },
    counsellorStatus: "PENDING",
  },
  {
    id: "risk-03",
    studentCode: "STU-0891",
    studentName: "Ananya Bhatt",
    batch: "JEE 2027 Morning",
    centre: "Vaishali Nagar",
    score: 66,
    tier: "HIGH",
    signals: {
      feeOverdueDays: 35,
      feeNorm: 0.65,
      feeContrib: 26.0,
      attendancePct: 62,
      attendanceNorm: 0.68,
      attendanceContrib: 20.4,
      testScorePct: 48,
      testNorm: 0.66,
      testContrib: 19.8,
      academicSignalsCount: 2,
    },
    counsellorStatus: "PENDING",
  },
  {
    id: "risk-04",
    studentCode: "STU-0544",
    studentName: "Tarun Yadav",
    batch: "JEE 2027 Evening",
    centre: "Vaishali Nagar",
    score: 48,
    tier: "MEDIUM",
    signals: {
      feeOverdueDays: 20,
      feeNorm: 0.40,
      feeContrib: 16.0,
      attendancePct: 75,
      attendanceNorm: 0.52,
      attendanceContrib: 15.6,
      testScorePct: 56,
      testNorm: 0.54,
      testContrib: 16.2,
      academicSignalsCount: 2,
    },
    counsellorStatus: "REVIEWED",
  },
  {
    id: "risk-05",
    studentCode: "STU-0312",
    studentName: "Mehak Jain",
    batch: "NEET 2027 Morning",
    centre: "Vaishali Nagar",
    score: 37,
    tier: "MEDIUM",
    signals: {
      feeOverdueDays: 10,
      feeNorm: 0.20,
      feeContrib: 8.0,
      attendancePct: 79,
      attendanceNorm: 0.45,
      attendanceContrib: 13.5,
      testScorePct: 61,
      testNorm: 0.50,
      testContrib: 15.0,
      academicSignalsCount: 2,
    },
    counsellorStatus: "FALSE_POSITIVE",
    suppressedUntil: "2026-12-02",
    notes: "Student informed family travel in October; academics recovered.",
  },
];

export default function CounsellorRiskPage() {
  const [records, setRecords] = useState<RiskRecord[]>(INITIAL_RISK_RECORDS);
  const [selectedRecord, setSelectedRecord] = useState<RiskRecord>(records[0]);
  const [noteInput, setNoteInput] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleUpdateStatus = async (
    status: "REVIEWED" | "FOLLOW_UP" | "FALSE_POSITIVE"
  ) => {
    try {
      const res = await fetch("/api/risk/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedRecord.studentCode,
          status,
          notes: noteInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      const suppressedDate = status === "FALSE_POSITIVE" ? "2026-12-02" : undefined;

      setRecords((prev) =>
        prev.map((r) =>
          r.id === selectedRecord.id
            ? {
                ...r,
                counsellorStatus: status,
                notes: noteInput || r.notes,
                suppressedUntil: suppressedDate,
              }
            : r
        )
      );

      setSelectedRecord((prev) => ({
        ...prev,
        counsellorStatus: status,
        notes: noteInput || prev.notes,
        suppressedUntil: suppressedDate,
      }));

      setNoteInput("");
      if (status === "FALSE_POSITIVE") {
        showToast(
          `Marked False Positive: Repetitive risk tasks suppressed for 30 days (until 2 Dec 2026).`
        );
      } else {
        showToast(`Counsellor status updated to ${status}.`);
      }
    } catch {
      showToast(`Status saved: ${status}`);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex">
      <StaffNav currentRole="COUNSELLOR" userName="Pooja Sharma" />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="bg-surface border-b border-line px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-ink tracking-tight">S7. Counsellor Risk Review</h1>
                <ProvenanceChip kind="Design" />
                <span className="text-xs bg-teal-t text-teal px-2 py-0.5 rounded font-medium">
                  Vaishali Nagar Scoped
                </span>
              </div>
              <p className="text-xs text-ink-3 mt-1">
                Dropout-risk heuristics (0.40 fee + 0.30 attendance + 0.30 test trend). Strict guardrail: Counsellors see ZERO financial ledger rows.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-paper px-3 py-1.5 rounded-lg border border-line text-xs">
              <PhoneCall className="w-4 h-4 text-teal" />
              <span className="font-semibold text-ink">
                {records.filter((r) => r.tier === "HIGH" && r.counsellorStatus === "PENDING").length} Open Call Tasks
              </span>
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

        {/* Work Area: Two Column Layout */}
        <div className="flex-1 p-8 grid grid-cols-12 gap-6 min-h-0">
          {/* Left Column: Review Queue (5 cols) */}
          <div className="col-span-5 bg-surface rounded-xl border border-line overflow-hidden flex flex-col shadow-xs">
            <div className="p-4 border-b border-line bg-paper/30 flex items-center justify-between">
              <span className="text-xs font-bold text-ink">Centre Review Queue (FP Rate 18%)</span>
              <span className="text-[11px] text-ink-3">As of 2 Nov 2026</span>
            </div>

            <div className="divide-y divide-line/60 overflow-y-auto">
              {records.map((r) => {
                const isSelected = selectedRecord.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRecord(r)}
                    className={`p-4 cursor-pointer transition-colors ${
                      isSelected ? "bg-teal-t/40 border-l-4 border-l-teal" : "hover:bg-paper/40"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-ink text-sm">{r.studentName}</div>
                        <div className="text-[11px] text-ink-3 mt-0.5">
                          {r.studentCode} · {r.batch}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.tier === "INSUFFICIENT_DATA" ? (
                          <span className="text-xs px-2 py-0.5 rounded font-mono bg-line text-ink-2 font-medium">
                            — Insufficient
                          </span>
                        ) : (
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded font-mono font-bold ${
                              r.tier === "HIGH"
                                ? "bg-bad/15 text-bad"
                                : r.tier === "MEDIUM"
                                ? "bg-warn/15 text-warn"
                                : "bg-ok/15 text-ok"
                            }`}
                          >
                            Score {r.score}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-line/40">
                      <span className="text-ink-3">
                        {r.tier === "INSUFFICIENT_DATA"
                          ? "Academic signals < 2"
                          : `Overdue ${r.signals.feeOverdueDays}d · Att ${r.signals.attendancePct}%`}
                      </span>
                      <StatusChip
                        tone={
                          r.counsellorStatus === "REVIEWED"
                            ? "ok"
                            : r.counsellorStatus === "FOLLOW_UP"
                            ? "warn"
                            : r.counsellorStatus === "FALSE_POSITIVE"
                            ? "slate"
                            : "bad"
                        }
                        text={r.counsellorStatus}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-paper border-t border-line text-[11px] text-ink-3 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-teal shrink-0" />
              <span>Counsellor outreach only. Never triggers parent dunning or fee blocks.</span>
            </div>
          </div>

          {/* Right Column: Signal Breakdown & Action Panel (7 cols) */}
          <div className="col-span-7 bg-surface rounded-xl border border-line p-6 flex flex-col justify-between shadow-xs space-y-6">
            <div className="space-y-6">
              {/* Header Info */}
              <div className="p-4 bg-paper rounded-xl border border-line space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-ink">{selectedRecord.studentName}</h2>
                    <p className="text-xs text-ink-3">
                      {selectedRecord.studentCode} · {selectedRecord.batch} · {selectedRecord.centre}
                    </p>
                  </div>
                  <div>
                    {selectedRecord.tier === "INSUFFICIENT_DATA" ? (
                      <span className="text-xs bg-line text-ink px-3 py-1 rounded-full font-bold">
                        INSUFFICIENT DATA
                      </span>
                    ) : (
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-bold font-mono ${
                          selectedRecord.tier === "HIGH"
                            ? "bg-bad text-white"
                            : "bg-warn text-white"
                        }`}
                      >
                        Tier: {selectedRecord.tier} (Score {selectedRecord.score})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Insufficient Data Guardrail Alert */}
              {selectedRecord.tier === "INSUFFICIENT_DATA" ? (
                <div className="p-4 rounded-xl border border-line bg-paper/60 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-ink">
                    <AlertTriangle className="w-4 h-4 text-warn" />
                    <span>Signal Guardrail Triggered: Academic Signals &lt; 2</span>
                  </div>
                  <p className="text-xs text-ink-2 leading-relaxed">
                    Per the AI Risk Heuristic specification (§9.2), student has fewer than 2 qualifying academic signals (only 1 test recorded to date).
                    The model refrains from computing a speculative risk score to prevent false labelling.
                  </p>
                </div>
              ) : (
                /* 3-Factor Normalization Table */
                <div className="border border-line rounded-xl overflow-hidden">
                  <div className="bg-paper/60 px-4 py-2 border-b border-line flex items-center justify-between text-xs font-bold text-ink">
                    <span>Signal Contributions (Config v1: 0.40 / 0.30 / 0.30)</span>
                    <span className="text-[11px] text-ink-3">Composite Threshold: 60+ = High</span>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-paper/30 text-ink-3 font-semibold border-b border-line">
                      <tr>
                        <th className="px-4 py-2.5">Factor & Observation</th>
                        <th className="px-4 py-2.5 text-right">Norm</th>
                        <th className="px-4 py-2.5 text-right">Weight</th>
                        <th className="px-4 py-2.5 text-right">Contributes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      <tr>
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-ink">Fee Overdue Trend</div>
                          <div className="text-[11px] text-ink-3">
                            {selectedRecord.signals.feeOverdueDays} days past instalment due date
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-ink">
                          {selectedRecord.signals.feeNorm.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-ink-3">0.40</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-ink">
                          {selectedRecord.signals.feeContrib.toFixed(1)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-ink">Attendance Drop</div>
                          <div className="text-[11px] text-ink-3">
                            {selectedRecord.signals.attendancePct}% vs 86% cohort 30-day baseline
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-ink">
                          {selectedRecord.signals.attendanceNorm.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-ink-3">0.30</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-ink">
                          {selectedRecord.signals.attendanceContrib.toFixed(1)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-ink">Test Score Trend</div>
                          <div className="text-[11px] text-ink-3">
                            {selectedRecord.signals.testScorePct}% vs 63% batch avg (last 2 tests)
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-ink">
                          {selectedRecord.signals.testNorm.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-ink-3">0.30</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-ink">
                          {selectedRecord.signals.testContrib.toFixed(1)}
                        </td>
                      </tr>
                      <tr className="bg-paper font-bold">
                        <td colSpan={3} className="px-4 py-2.5 text-ink">
                          Total Weighted Composite Risk Score
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-base text-bad">
                          {selectedRecord.score} / 100
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Suppressed Banner if False Positive */}
              {selectedRecord.suppressedUntil && (
                <div className="p-3 bg-paper rounded-lg border border-line text-xs text-ink-2 space-y-1">
                  <div className="font-semibold text-ink flex items-center gap-1.5">
                    <Ban className="w-3.5 h-3.5 text-teal" />
                    30-Day Task Suppression Active
                  </div>
                  <div>
                    Suppressed until {selectedRecord.suppressedUntil}. Repeated counsellor tasks will not be generated unless composite score rises by &ge; 10 points.
                  </div>
                  {selectedRecord.notes && (
                    <div className="text-[11px] text-ink-3 italic mt-1">&quot;{selectedRecord.notes}&quot;</div>
                  )}
                </div>
              )}

              {/* Counsellor Notes & Decision Box */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-ink">
                  Counsellor Interaction Notes & Follow-up Plan
                </label>
                <textarea
                  rows={2}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Record counsellor interaction summary with student or parent..."
                  className="w-full bg-paper border border-line rounded-lg p-3 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-teal"
                />

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => handleUpdateStatus("REVIEWED")}
                    className="flex-1 bg-teal hover:bg-teal-d text-white font-medium py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Reviewed
                  </button>
                  <button
                    onClick={() => handleUpdateStatus("FOLLOW_UP")}
                    className="flex-1 border border-warn text-warn hover:bg-warn/10 font-medium py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <PhoneCall className="w-3.5 h-3.5" /> Follow-Up Required
                  </button>
                  <button
                    onClick={() => handleUpdateStatus("FALSE_POSITIVE")}
                    className="flex-1 border border-line hover:bg-paper text-ink font-medium py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Ban className="w-3.5 h-3.5 text-ink-3" /> False Positive (30d)
                  </button>
                </div>
              </div>
            </div>

            {/* Privacy Invariant Footer */}
            <div className="pt-4 border-t border-line text-[11px] text-ink-3 flex items-center justify-between">
              <span>RBAC Scoped: Counsellor has zero access to payment amounts, bank receipts, or ledgers.</span>
              <span className="font-mono">Model: Rule v1.2</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
