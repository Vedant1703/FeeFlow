"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DemoBar } from "@/components/shared/DemoBar";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import {
  Printer,
  ArrowLeft,
  ShieldCheck,
  Building2,
  Receipt,
  Download,
  CheckCircle2,
} from "lucide-react";

export default function GSTReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const receiptId = (params?.id as string) || "REC-2026-0587-2";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center">
      {/* Top Demo Bar - Hidden during print */}
      <div className="w-full print:hidden">
        <DemoBar />
      </div>

      <main className="w-full max-w-[680px] px-4 py-8 flex flex-col space-y-6">
        {/* Navigation & Action Bar - Hidden during print */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href="/parent"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Parent Portal</span>
          </Link>

          <button
            onClick={handlePrint}
            className="bg-teal hover:bg-teal-d text-white font-medium px-4 py-2 rounded-lg text-xs flex items-center gap-2 shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>

        {/* Printable Official GST Tax Invoice Card (P3) */}
        <div
          id="tax-invoice"
          className="bg-surface border border-line rounded-2xl p-8 shadow-xs print:border-none print:shadow-none print:p-0 space-y-6 text-ink"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-line pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal text-white font-bold flex items-center justify-center text-sm">
                  FF
                </div>
                <h1 className="text-xl font-bold tracking-tight text-ink">
                  Company A Coaching Institute Pvt. Ltd.
                </h1>
              </div>
              <p className="text-xs text-ink-2">
                Registered Office: Plot 42, Knowledge Corridor, Tonk Road, Jaipur, Rajasthan 302015
              </p>
              <div className="text-xs text-ink-3 flex items-center gap-4 pt-1 font-mono">
                <span>
                  <strong>GSTIN:</strong> 08AABCC1234D1Z5 [SYNTHETIC]
                </span>
                <span>
                  <strong>State Code:</strong> 08 (Rajasthan)
                </span>
              </div>
            </div>

            <div className="text-right space-y-1">
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-teal-t text-teal px-2 py-0.5 rounded">
                TAX INVOICE / RECEIPT
              </span>
              <div className="font-mono font-bold text-sm text-ink">{receiptId}</div>
              <div className="text-[11px] text-ink-3">Date: 02 Nov 2026, 09:42 IST</div>
            </div>
          </div>

          {/* Student & Parent Metadata */}
          <div className="grid grid-cols-2 gap-6 p-4 bg-paper/60 rounded-xl border border-line text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
                Student Details
              </span>
              <div className="font-bold text-ink text-sm">Ishita Sharma</div>
              <div className="text-ink-2">Student ID: STU-0587</div>
              <div className="text-ink-2">Course: JEE 2027 Evening (2-Year Classroom)</div>
              <div className="text-ink-2">Centre: Vaishali Nagar Centre, Jaipur</div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
                Parent / Payer Details
              </span>
              <div className="font-bold text-ink text-sm">Rakesh Sharma</div>
              <div className="text-ink-2">Mobile: +91 98290 12345</div>
              <div className="text-ink-2">Payment Method: UPI (Google Pay)</div>
              <div className="text-ink-2 font-mono">Ref / UTR: upi_202611029871</div>
            </div>
          </div>

          {/* Line Items Table with GST Breakdown */}
          <div className="border border-line rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-paper font-semibold text-ink-3 border-b border-line">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Description of Service</th>
                  <th className="px-4 py-3 text-center">SAC Code</th>
                  <th className="px-4 py-3 text-right">Taxable Value</th>
                  <th className="px-4 py-3 text-right">CGST (9%)</th>
                  <th className="px-4 py-3 text-right">SGST (9%)</th>
                  <th className="px-4 py-3 text-right">Total (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                <tr>
                  <td className="px-4 py-3 text-ink-3 font-mono">1</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">Classroom Coaching & Tuition</div>
                    <div className="text-[11px] text-ink-3">
                      JEE 2027 Evening · Instalment 2 of 4 (Part Allocation)
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-mono">999293</td>
                  <td className="px-4 py-3 text-right font-mono">₹12,711.86</td>
                  <td className="px-4 py-3 text-right font-mono">₹1,144.07</td>
                  <td className="px-4 py-3 text-right font-mono">₹1,144.07</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-ink">
                    ₹15,000.00
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-paper font-semibold border-t border-line">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-ink">
                    Total Amount Received
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-ink-3">₹12,711.86</td>
                  <td className="px-4 py-2.5 text-right font-mono text-ink-3">₹1,144.07</td>
                  <td className="px-4 py-2.5 text-right font-mono text-ink-3">₹1,144.07</td>
                  <td className="px-4 py-2.5 text-right font-mono text-base font-bold text-teal">
                    ₹15,000.00
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Amount in Words */}
          <div className="p-3 bg-paper rounded-xl border border-line text-xs flex items-center justify-between">
            <span className="text-ink-3">Amount in Words:</span>
            <span className="font-semibold text-ink">
              Indian Rupees Fifteen Thousand Only
            </span>
          </div>

          {/* Ledger Effect Snapshot */}
          <div className="p-4 bg-teal-t/30 rounded-xl border border-teal/20 text-xs space-y-2">
            <div className="font-bold text-teal flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-ok" />
              <span>Signed Ledger Posting Confirmation</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-ink-2">
              <div>
                <span className="text-ink-3 block">Instalment Due:</span>
                <span className="font-mono font-semibold">₹30,000.00</span>
              </div>
              <div>
                <span className="text-ink-3 block">Total Paid to Date:</span>
                <span className="font-mono font-semibold text-ok">₹15,000.00</span>
              </div>
              <div>
                <span className="text-ink-3 block">Remaining Overdue:</span>
                <span className="font-mono font-semibold text-ink">₹15,000.00</span>
              </div>
            </div>
          </div>

          {/* Statutory Sign-off */}
          <div className="pt-6 border-t border-line flex items-end justify-between text-xs">
            <div className="space-y-1 text-ink-3 text-[11px]">
              <div>• Computer generated tax invoice; no physical signature required.</div>
              <div>• Subject to Jaipur jurisdiction only.</div>
              <div>• Coaching service SAC: 999293. GST is 18% (9% CGST + 9% SGST).</div>
            </div>

            <div className="text-right space-y-1">
              <div className="font-serif italic text-ink-2 text-sm tracking-wide">
                Authorized Signatory
              </div>
              <div className="text-[11px] text-ink-3">For Company A Coaching Institute Pvt. Ltd.</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

