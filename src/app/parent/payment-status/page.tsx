"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DemoBar } from "@/components/shared/DemoBar";
import { StatusChip } from "@/components/shared/StatusChip";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Download,
  RotateCcw,
  Receipt,
  ShieldCheck,
  FileText,
} from "lucide-react";

export default function PaymentStatusPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "succeeded";
  const orderId = searchParams.get("orderId") || "order_demo_1";
  const receiptNo = searchParams.get("receipt") || "REC-2026-0587-2";

  const [confirmingPollCount, setConfirmingPollCount] = useState(0);

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center">
      <DemoBar />

      <main className="w-full max-w-[420px] px-4 py-8 flex-1 flex flex-col justify-center">
        {/* =========================================================================
            STATE 1: PAYMENT CONFIRMED (P1d)
           ========================================================================= */}
        {status === "succeeded" && (
          <div className="p-6 rounded-hero bg-surface border border-line shadow-xs space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-ok-t text-ok mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-ink">
                Payment Confirmed
              </h1>
              <p className="text-xs text-ink-3">
                HMAC-verified capture received and posted to fee ledger
              </p>
            </div>

            {/* Official GST Receipt Snapshot */}
            <div className="p-4 rounded-panel bg-paper border border-line space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <Receipt className="w-4 h-4 text-teal" />
                  <span>Tax Invoice / Receipt: {receiptNo}</span>
                </div>
                <StatusChip tone="ok" text="Captured" />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-3">Student:</span>
                <span className="font-semibold text-ink">Ishita Sharma (STU-0587)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-3">Amount Paid:</span>
                <span className="font-mono text-base font-bold text-teal">₹15,000</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-3">Payment Method:</span>
                <span className="text-ink font-medium">UPI / Netbanking</span>
              </div>

              {/* GST Metadata Breakdown (Brief requirement) */}
              <div className="pt-2 border-t border-line space-y-1 text-[11px] text-ink-3 font-mono">
                <div className="flex justify-between">
                  <span>GSTIN:</span>
                  <span className="font-semibold text-ink">08AABCC1234D1Z5 [SYNTHETIC]</span>
                </div>
                <div className="flex justify-between">
                  <span>SAC Code:</span>
                  <span>999293 (Coaching Services)</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxable Amount:</span>
                  <span>₹15,000.00</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() =>
                  alert(
                    `Company A Institute, Jaipur\nOFFICIAL RECEIPT: ${receiptNo}\nStudent: Ishita Sharma (STU-0587)\nAmount: ₹15,000\nGSTIN: 08AABCC1234D1Z5 [SYNTHETIC]\nSAC: 999293\nStatus: CAPTURED & ALLOCATED`
                  )
                }
                className="w-full h-11 rounded-input border border-teal text-teal hover:bg-teal-t/20 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Official GST Receipt</span>
              </button>

              <Link
                href="/parent"
                className="w-full h-12 rounded-input bg-teal hover:bg-teal-d text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <span>Return to Parent Portal</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="text-[11px] text-ink-3 text-center border-t border-line pt-3 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-ok" />
              <span>Pending reminders for settled instalment were skipped immediately</span>
            </div>
          </div>
        )}

        {/* =========================================================================
            STATE 2: PAYMENT CONFIRMING / PENDING (P1e)
           ========================================================================= */}
        {status === "pending" && (
          <div className="p-6 rounded-hero bg-surface border border-line shadow-xs space-y-6 text-center">
            <div className="w-14 h-14 rounded-full bg-info-t text-info mx-auto flex items-center justify-center animate-spin">
              <Clock className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-xl font-bold tracking-tight text-ink">
                Confirming Payment...
              </h1>
              <p className="text-xs text-ink-2">
                We are awaiting authoritative signed capture verification from your bank or UPI gateway.
              </p>
            </div>

            <div className="p-3.5 rounded-panel bg-paper border border-dashed border-info/40 text-xs text-ink-2 space-y-1.5 text-left">
              <div className="font-semibold text-ink flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-info" />
                <span>Zero Client-Trust Principle</span>
              </div>
              <p className="text-[11px] text-ink-3">
                Browser redirects never mark an instalment paid. Only a signature-verified webhook creates financial ledger records. Do not make a second payment while this is confirming.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmingPollCount((c) => c + 1)}
                className="w-full h-11 rounded-input border border-line hover:border-teal text-ink font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Check status again ({confirmingPollCount} checks)</span>
              </button>

              <Link
                href="/parent"
                className="w-full h-11 rounded-input bg-teal hover:bg-teal-d text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <span>Return to Parent Home</span>
              </Link>
            </div>
          </div>
        )}

        {/* =========================================================================
            STATE 3: PAYMENT FAILED (P1e)
           ========================================================================= */}
        {status === "failed" && (
          <div className="p-6 rounded-hero bg-surface border border-line shadow-xs space-y-6 text-center">
            <div className="w-14 h-14 rounded-full bg-bad-t text-bad mx-auto flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-xl font-bold tracking-tight text-ink">
                Payment Failed
              </h1>
              <p className="text-xs text-ink-2">
                The payment attempt was declined or cancelled. No funds were debited from your account.
              </p>
            </div>

            <div className="p-3 rounded-panel bg-bad-t/50 border border-bad/30 text-xs text-bad text-left space-y-1">
              <div className="font-semibold">Reason: Gateway authorization declined</div>
              <p className="text-[11px]">
                Your ledger balance remains unchanged. You may retry payment or try an alternate UPI / Card method.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Link
                href="/parent"
                className="w-full h-12 rounded-input bg-teal hover:bg-teal-d text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <span>Try Again</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
