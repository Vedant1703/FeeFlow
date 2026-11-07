"use client";

import React, { useState } from "react";
import { StaffNav } from "@/components/shared/StaffNav";
import { StatusChip } from "@/components/shared/StatusChip";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { buildCsvDocument } from "@/lib/csv-sanitizer";
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  Download,
  Lock,
  FileSpreadsheet,
  RotateCw,
  Info,
  Calendar,
  Building2,
  DollarSign,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

export default function ReconciliationPage() {
  const [selectedMonth, setSelectedMonth] = useState("OCT_2026");
  const [selectedCentre, setSelectedCentre] = useState("ALL");
  const [isMonthClosed, setIsMonthClosed] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Money Identity Figures for Oct 2026
  const providerCapturesPaise = 4926000000n; // ₹4,92,60,000
  const completedRefundsPaise = 34500000n;   // ₹3,45,000
  const netReceivedPaise = 4891500000n;      // ₹4,89,15,000

  const allocatedPaise = 4873100000n;        // ₹4,87,31,000
  const unallocatedPaise = 18400000n;        // ₹1,84,000
  const totalAppliedPaise = 4891500000n;     // ₹4,89,15,000

  const isBalanced = netReceivedPaise === totalAppliedPaise;

  const handleDownloadTallyCsv = () => {
    const headers = [
      "VoucherDate",
      "VoucherType",
      "VoucherNo",
      "LedgerName",
      "Debit",
      "Credit",
      "Narration",
    ];

    const dataRows = [
      ["2026-10-10", "Receipt", "RCP-2026-10-0412", "HDFC Bank Current A/c", "30000.00", "0.00", "Tuition fee STU-0412 Aarav Meena"],
      ["2026-10-10", "Receipt", "RCP-2026-10-0412", "Course Fee Income - JEE", "0.00", "25423.73", "Instalment 1 fee income"],
      ["2026-10-10", "Receipt", "RCP-2026-10-0412", "Output CGST 9%", "0.00", "2288.14", "CGST @ 9% on SAC 999293"],
      ["2026-10-10", "Receipt", "RCP-2026-10-0412", "Output SGST 9%", "0.00", "2288.14", "SGST @ 9% on SAC 999293"],
      ["2026-10-10", "Receipt", "RCP-2026-10-0587", "HDFC Bank Current A/c", "15000.00", "0.00", "Part fee STU-0587 Ishita Sharma"],
      ["2026-10-10", "Receipt", "RCP-2026-10-0587", "Course Fee Income - JEE", "0.00", "12711.86", "Instalment 2 part fee"],
      ["2026-10-10", "Receipt", "RCP-2026-10-0587", "Output CGST 9%", "0.00", "1144.07", "CGST @ 9% on SAC 999293"],
      ["2026-10-10", "Receipt", "RCP-2026-10-0587", "Output SGST 9%", "0.00", "1144.07", "SGST @ 9% on SAC 999293"],
      ["2026-10-28", "Journal", "CRN-2026-10-1038", "Refund Payable - Kavya Rathore", "63724.14", "0.00", "Approved pro-rata withdrawal refund"],
      ["2026-10-28", "Journal", "CRN-2026-10-1038", "Course Fee Income - NEET", "0.00", "63724.14", "Reversal of unearned tuition"],
      ["2026-10-31", "Receipt", "REC-UNMATCHED-001", "Unallocated Suspense A/c", "15000.00", "0.00", "pay_demo_a91c ref MOHIT G 0219 unallocated"],
    ];

    const csvContent = buildCsvDocument(headers, dataRows);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tally_export_TX-2026-10-001.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Downloaded Tally CSV export batch TX-2026-10-001 (formula-neutralized).");
  };

  const handleConfirmCloseMonth = () => {
    setIsMonthClosed(true);
    setIsCloseModalOpen(false);
    showToast("October 2026 closed successfully. Snapshot sealed with immutable hash chain.");
  };

  return (
    <div className="min-h-screen bg-paper flex">
      <StaffNav currentRole="ACCOUNTS" userName="Neha Verma" />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="bg-surface border-b border-line px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-ink tracking-tight">S3b. Reconciliation & Tally Export</h1>
                <ProvenanceChip kind="Design" />
                <span className="text-xs bg-teal-t text-teal px-2 py-0.5 rounded font-medium">
                  Dual-Entry Identity Equation
                </span>
              </div>
              <p className="text-xs text-ink-3 mt-1">
                Month-end financial close and deduplicated Tally-compatible voucher CSV export. Balances verified before locking.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-paper border border-line rounded-lg px-3 py-1.5 text-xs text-ink font-semibold"
              >
                <option value="OCT_2026">October 2026</option>
                <option value="SEP_2026">September 2026 (Closed)</option>
                <option value="AUG_2026">August 2026 (Closed)</option>
              </select>

              <select
                value={selectedCentre}
                onChange={(e) => setSelectedCentre(e.target.value)}
                className="bg-paper border border-line rounded-lg px-3 py-1.5 text-xs text-ink"
              >
                <option value="ALL">All 4 Centres</option>
                <option value="MALVIYA">Malviya Nagar</option>
                <option value="VAISHALI">Vaishali Nagar</option>
                <option value="MANSAROVAR">Mansarovar</option>
                <option value="TONK">Tonk Road</option>
              </select>
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

        {/* Work Area */}
        <div className="flex-1 p-8 grid grid-cols-12 gap-6 min-h-0">
          {/* Left Column: Money Identity Equation Box (7 cols) */}
          <div className="col-span-7 bg-surface rounded-xl border border-line p-6 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-teal" />
                  <h2 className="text-sm font-bold text-ink">Money Identity Equation (October 2026)</h2>
                </div>
                {isBalanced ? (
                  <span className="text-xs bg-ok-t text-ok px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Both Sides Equal
                  </span>
                ) : (
                  <span className="text-xs bg-bad/15 text-bad px-2.5 py-0.5 rounded-full font-bold">
                    Discrepancy Detected
                  </span>
                )}
              </div>

              {/* Side A: Inflow - Outflow */}
              <div className="p-4 bg-paper rounded-xl border border-line space-y-3">
                <span className="text-[11px] text-ink-3 uppercase font-bold tracking-wider">
                  Side A: Cash & Gateway Inflow / Outflow
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-ink">Provider Captures (412 receipts)</span>
                    <span className="font-mono font-semibold text-ink">₹4,92,60,000.00</span>
                  </div>
                  <div className="flex justify-between text-bad">
                    <span>Completed Statutory Refunds (3 credit notes)</span>
                    <span className="font-mono font-semibold">−₹3,45,000.00</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-line font-bold text-sm">
                    <span className="text-ink">= Net Received Cash</span>
                    <span className="font-mono text-teal">₹4,89,15,000.00</span>
                  </div>
                </div>
              </div>

              {/* Side B: Ledger Applications */}
              <div className="p-4 bg-paper rounded-xl border border-line space-y-3">
                <span className="text-[11px] text-ink-3 uppercase font-bold tracking-wider">
                  Side B: Ledger Applications & Unallocated Suspense
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-ink">Allocated to Student Instalments (405 payments)</span>
                    <span className="font-mono font-semibold text-ink">₹4,87,31,000.00</span>
                  </div>
                  <div className="flex justify-between text-warn">
                    <span>Unallocated Queue Items (7 unmatched items)</span>
                    <span className="font-mono font-semibold">+₹1,84,000.00</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-line font-bold text-sm">
                    <span className="text-ink">= Total Ledger Applications</span>
                    <span className="font-mono text-teal">₹4,89,15,000.00</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-ok-t/30 rounded-xl border border-ok/20 text-xs text-ink-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-ok shrink-0" />
                <span>
                  <strong>Identity Verified:</strong> Net Received Cash matches Allocated + Unallocated to the exact paise. Zero float discrepancy.
                </span>
              </div>
            </div>

            <div className="text-[11px] text-ink-3 border-t border-line pt-3 flex items-center justify-between">
              <span>Anchor: Demo Business Date 2 Nov 2026</span>
              <span className="font-mono">Checked in 4ms</span>
            </div>
          </div>

          {/* Right Column: Tally Export & Month-End Close (5 cols) */}
          <div className="col-span-5 bg-surface rounded-xl border border-line p-6 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-teal" />
                  <h2 className="text-sm font-bold text-ink">Tally ERP / Prime Export</h2>
                </div>
                <p className="text-xs text-ink-3 mt-0.5">Batch TX-2026-10-001</p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-paper rounded-lg border border-line space-y-2">
                  <div className="flex justify-between">
                    <span className="text-ink-3">Total Vouchers</span>
                    <span className="font-bold text-ink">409 receipts · 3 credit notes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-3">Not Yet Exported</span>
                    <span className="font-mono font-bold text-teal">₹6,25,000.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-3">GST Ledger Mapping</span>
                    <span className="text-ink font-mono">SAC 999293 (18%)</span>
                  </div>
                </div>

                <div className="p-3 bg-paper rounded-lg border border-line text-[11px] text-ink-2 space-y-1">
                  <div className="font-semibold text-ink flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-teal" />
                    Idempotent Export Guarantee
                  </div>
                  <div>
                    Exporting generates a deduplicated CSV formatted for Tally XML/CSV import. Repeated downloads will not create double postings.
                  </div>
                </div>

                <button
                  onClick={handleDownloadTallyCsv}
                  className="w-full bg-teal hover:bg-teal-d text-white font-medium py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Tally CSV (Batch TX-2026-10-001)
                </button>
              </div>

              {/* Month Close Section */}
              <div className="pt-4 border-t border-line space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">Month-End Closure</span>
                  {isMonthClosed ? (
                    <span className="text-[10px] bg-ok/10 text-ok px-2 py-0.5 rounded font-bold font-mono">
                      CLOSED & SEALED 🔒
                    </span>
                  ) : (
                    <span className="text-[10px] bg-warn/15 text-warn px-2 py-0.5 rounded font-bold font-mono">
                      OPEN FOR AUDIT
                    </span>
                  )}
                </div>

                <p className="text-xs text-ink-3">
                  Closing locks the month against any backdated ledger insertions or reversals.
                </p>

                <button
                  onClick={() => setIsCloseModalOpen(true)}
                  disabled={isMonthClosed}
                  className={`w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                    isMonthClosed
                      ? "bg-paper text-ink-3 border border-line cursor-not-allowed"
                      : "bg-ink hover:bg-ink-2 text-white shadow-xs"
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  {isMonthClosed ? "Month October 2026 Closed" : "🔒 Close Month October 2026"}
                </button>
              </div>
            </div>

            <div className="text-[11px] text-ink-3 border-t border-line pt-3">
              Complies with ICAI multi-centre coaching accounting standards.
            </div>
          </div>
        </div>

        {/* Confirmation Modal for Month Close */}
        {isCloseModalOpen && (
          <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-xl border border-line max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-ink">Confirm Month-End Close</h3>
                  <p className="text-xs text-ink-3 mt-0.5">
                    Sealing October 2026 financials. This operation creates an immutable cryptographic snapshot.
                  </p>
                </div>
                <button
                  onClick={() => setIsCloseModalOpen(false)}
                  className="text-ink-3 hover:text-ink text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 bg-paper rounded-xl border border-line space-y-2 text-xs">
                <div className="flex justify-between font-semibold">
                  <span className="text-ink-3">Total Net Collections:</span>
                  <span className="font-mono text-ink">₹4,89,15,000.00</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-ink-3">Total Applied & Suspense:</span>
                  <span className="font-mono text-ink">₹4,89,15,000.00</span>
                </div>
                <div className="flex justify-between font-bold text-ok pt-1 border-t border-line">
                  <span>Reconciliation Delta:</span>
                  <span className="font-mono">₹0.00 (Balanced)</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsCloseModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-ink-2 hover:bg-paper rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmCloseMonth}
                  className="px-4 py-2 text-xs font-semibold bg-ink hover:bg-ink-2 text-white rounded-lg flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Confirm and Seal Month
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

