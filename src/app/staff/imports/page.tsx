"use client";

import React, { useState } from "react";
import { StaffNav } from "@/components/shared/StaffNav";
import { StatusChip } from "@/components/shared/StatusChip";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  RotateCw,
  ArrowRight,
  FileText,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";

interface ImportRow {
  rowNo: number;
  studentCode: string;
  studentName: string;
  field: string;
  oldValue: string;
  newValue: string;
  status: "VALID_NEW" | "UNCHANGED" | "CHANGED" | "DUPLICATE" | "INVALID";
  reason?: string;
}

const INITIAL_PREVIEW_ROWS: ImportRow[] = [
  {
    rowNo: 14,
    studentCode: "STU-0999",
    studentName: "Unknown Student",
    field: "Session 22 Oct Attendance",
    oldValue: "—",
    newValue: "Present",
    status: "INVALID",
    reason: "Student code STU-0999 not enrolled in JEE 2027 Evening batch",
  },
  {
    rowNo: 88,
    studentCode: "STU-0731",
    studentName: "Rohan Saini",
    field: "Session 18 Oct Attendance",
    oldValue: "Absent",
    newValue: "Present",
    status: "CHANGED",
    reason: "Faculty biometric override: manual mark changed to Present",
  },
  {
    rowNo: 102,
    studentCode: "STU-0587",
    studentName: "Ishita Sharma",
    field: "Session 28 Oct Attendance",
    oldValue: "—",
    newValue: "Present",
    status: "VALID_NEW",
  },
  {
    rowNo: 115,
    studentCode: "STU-0412",
    studentName: "Aarav Meena",
    field: "Session 28 Oct Attendance",
    oldValue: "Present",
    newValue: "Present",
    status: "UNCHANGED",
  },
  {
    rowNo: 142,
    studentCode: "STU-0219",
    studentName: "Mohit Gurjar",
    field: "Session 28 Oct Attendance",
    oldValue: "Present",
    newValue: "Present",
    status: "DUPLICATE",
    reason: "Duplicate entry for same date and session in row 141",
  },
  {
    rowNo: 194,
    studentCode: "STU-0622",
    studentName: "Dev Sharma",
    field: "Test 4 Score",
    oldValue: "—",
    newValue: "120/100",
    status: "INVALID",
    reason: "Score 120 exceeds maximum possible marks (100)",
  },
];

export default function BulkImportsPage() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(3); // Default at Step 3 (Review) for rich preview
  const [fileName, setFileName] = useState("JEE2027_Eve_Attendance_Oct.csv");
  const [fileHash, setFileHash] = useState("a41c8902...77d4");
  const [rows, setRows] = useState<ImportRow[]>(INITIAL_PREVIEW_ROWS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDownloadTemplate = (type: "ATTENDANCE" | "TESTS") => {
    const csvContent =
      type === "ATTENDANCE"
        ? "student_code,student_name,date,session_topic,status\nSTU-0587,Ishita Sharma,2026-10-28,Physics Rotational,Present\nSTU-0731,Rohan Saini,2026-10-28,Physics Rotational,Absent\n"
        : "student_code,student_name,test_date,test_name,physics,chemistry,maths,total,max_marks\nSTU-0587,Ishita Sharma,2026-10-26,Phase Test 3,78,84,72,234,300\n";

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `feeflow_${type.toLowerCase()}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Downloaded ${type} CSV template`);
  };

  const handleDownloadErrorCsv = () => {
    const invalidRows = rows.filter((r) => r.status === "INVALID");
    const csvContent =
      "Row,StudentCode,StudentName,Field,AttemptedValue,ErrorReason\n" +
      invalidRows
        .map(
          (r) =>
            `"${r.rowNo}","${r.studentCode}","${r.studentName}","${r.field}","${r.newValue}","${r.reason}"`
        )
        .join("\n");

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `import_errors_${fileName}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Downloaded Error CSV with ${invalidRows.length} flagged rows.`);
  };

  const handleCommit = () => {
    setIsCommitting(true);
    setTimeout(() => {
      setIsCommitting(false);
      setCurrentStep(4);
      showToast("Committed 185 rows successfully. Student risk signals refreshed.");
    }, 800);
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
                <h1 className="text-xl font-bold text-ink tracking-tight">S6. Bulk Academic Imports</h1>
                <ProvenanceChip kind="Design" />
                <span className="text-xs bg-teal-t text-teal px-2 py-0.5 rounded font-medium">
                  Two-Stage Pre-Commit Validation
                </span>
              </div>
              <p className="text-xs text-ink-3 mt-1">
                Upload batch attendance or test scores CSV. Validates hashes against duplicate uploads and flags row errors before committing.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadTemplate("ATTENDANCE")}
                className="border border-line hover:bg-paper text-ink font-medium px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-teal" />
                Attendance Template
              </button>
              <button
                onClick={() => handleDownloadTemplate("TESTS")}
                className="border border-line hover:bg-paper text-ink font-medium px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-teal" />
                Scores Template
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

          {/* Stepper Track */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-line/60">
            <div className="flex items-center gap-3 text-xs font-semibold">
              <div
                className={`flex items-center gap-1.5 ${
                  currentStep >= 1 ? "text-teal" : "text-ink-3"
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-teal-t text-teal flex items-center justify-center text-[10px]">
                  1
                </span>
                <span>Upload</span>
              </div>
              <span className="text-ink-3">──</span>
              <div
                className={`flex items-center gap-1.5 ${
                  currentStep >= 2 ? "text-teal" : "text-ink-3"
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-teal-t text-teal flex items-center justify-center text-[10px]">
                  2
                </span>
                <span>Validate</span>
              </div>
              <span className="text-ink-3">──</span>
              <div
                className={`flex items-center gap-1.5 ${
                  currentStep >= 3 ? "text-teal" : "text-ink-3"
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-teal text-white flex items-center justify-center text-[10px]">
                  3
                </span>
                <span className="font-bold text-ink">Review Decisions</span>
              </div>
              <span className="text-ink-3">──</span>
              <div
                className={`flex items-center gap-1.5 ${
                  currentStep === 4 ? "text-ok" : "text-ink-3"
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-line text-ink-3 flex items-center justify-center text-[10px]">
                  4
                </span>
                <span>Commit</span>
              </div>
            </div>

            <span className="text-xs text-ink-3 font-mono">File Hash: {fileHash}</span>
          </div>
        </header>

        {/* Work Area */}
        <div className="flex-1 p-8 min-h-0 space-y-6">
          {/* Summary Stat Chips */}
          <div className="grid grid-cols-5 gap-4">
            <div className="p-3.5 bg-surface rounded-xl border border-line shadow-xs">
              <div className="text-[10px] text-ink-3 uppercase font-semibold">Valid New Rows</div>
              <div className="text-xl font-bold text-ok mt-0.5">176</div>
              <div className="text-[10px] text-ink-3">Ready to import</div>
            </div>
            <div className="p-3.5 bg-surface rounded-xl border border-line shadow-xs">
              <div className="text-[10px] text-ink-3 uppercase font-semibold">Unchanged</div>
              <div className="text-xl font-bold text-ink mt-0.5">21</div>
              <div className="text-[10px] text-ink-3">Exact matches</div>
            </div>
            <div className="p-3.5 bg-surface rounded-xl border border-line shadow-xs">
              <div className="text-[10px] text-ink-3 uppercase font-semibold">Changed Overrides</div>
              <div className="text-xl font-bold text-teal mt-0.5">9</div>
              <div className="text-[10px] text-ink-3">Updates historical record</div>
            </div>
            <div className="p-3.5 bg-surface rounded-xl border border-line shadow-xs">
              <div className="text-[10px] text-ink-3 uppercase font-semibold">Duplicates</div>
              <div className="text-xl font-bold text-warn mt-0.5">4</div>
              <div className="text-[10px] text-ink-3">Filtered automatically</div>
            </div>
            <div className="p-3.5 bg-surface rounded-xl border border-line shadow-xs">
              <div className="text-[10px] text-ink-3 uppercase font-semibold">Invalid Errors</div>
              <div className="text-xl font-bold text-bad mt-0.5">4</div>
              <div className="text-[10px] text-ink-3">Excluded from commit</div>
            </div>
          </div>

          {/* If Step 3: Review Table */}
          {currentStep === 3 && (
            <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-xs flex flex-col">
              <div className="p-4 border-b border-line bg-paper/30 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-ink">
                    Rows Needing Decision or Action ({rows.length} sample items shown)
                  </span>
                  <div className="text-[11px] text-ink-3">
                    Nothing is saved to database records until you click &quot;Commit&quot;.
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDownloadErrorCsv}
                    className="border border-bad/30 bg-bad/5 text-bad hover:bg-bad/10 font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Error CSV (4 rows)
                  </button>

                  <button
                    onClick={handleCommit}
                    disabled={isCommitting}
                    className="bg-teal hover:bg-teal-d text-white font-medium px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60"
                  >
                    {isCommitting ? (
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Commit 185 Valid Rows
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-paper text-ink-3 font-semibold border-b border-line">
                    <tr>
                      <th className="px-4 py-3">Row #</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Field</th>
                      <th className="px-4 py-3">Old Value</th>
                      <th className="px-4 py-3">Import Value</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Validation Message / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {rows.map((r) => (
                      <tr key={r.rowNo} className="hover:bg-paper/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-ink-3">{r.rowNo}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-ink">{r.studentName}</div>
                          <div className="text-[11px] text-ink-3 font-mono">{r.studentCode}</div>
                        </td>
                        <td className="px-4 py-3 text-ink-2">{r.field}</td>
                        <td className="px-4 py-3 font-mono text-ink-3">{r.oldValue}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-ink">{r.newValue}</td>
                        <td className="px-4 py-3">
                          <StatusChip
                            tone={
                              r.status === "VALID_NEW"
                                ? "ok"
                                : r.status === "CHANGED"
                                ? "info"
                                : r.status === "DUPLICATE"
                                ? "warn"
                                : r.status === "INVALID"
                                ? "bad"
                                : "slate"
                            }
                            text={r.status}
                          />
                        </td>
                        <td className="px-4 py-3 text-ink-2 text-[11px]">
                          {r.reason || "Valid row; will be applied upon commit"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-paper border-t border-line text-[11px] text-ink-3 flex items-center justify-between">
                <span>
                  Anti-Corruption Guard: Parents will only see committed rows in their academic progress view (P2).
                </span>
                <span className="font-mono">Batch ID: IMP-20261102-01</span>
              </div>
            </div>
          )}

          {/* Step 4: Success View */}
          {currentStep === 4 && (
            <div className="p-8 bg-surface rounded-xl border border-line text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 rounded-full bg-ok-t text-ok mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-ink">185 Rows Committed Successfully</h2>
              <p className="text-xs text-ink-3 max-w-md mx-auto">
                Attendance and score signals have been persisted to the database. AI dropout-risk heuristics have recalculated composite scores for the batch.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="bg-teal hover:bg-teal-d text-white font-medium px-4 py-2 rounded-lg text-xs"
                >
                  Import Another File
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
