"use client";

import React from "react";
import Link from "next/link";
import { DemoBar } from "@/components/shared/DemoBar";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { LanguageToggle, useLanguage } from "@/components/shared/LanguageToggle";
import { ArrowLeft, FileText, ShieldCheck, HelpCircle, CheckCircle } from "lucide-react";

export default function PublicRefundPolicyPage() {
  const { language } = useLanguage();

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center">
      <DemoBar />

      <main className="w-full max-w-[480px] px-4 py-8 flex-1 flex flex-col space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <Link
            href="/parent"
            className="inline-flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{language === "hi" ? "वापस जाएं" : "Back to Portal"}</span>
          </Link>
          <LanguageToggle />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ProvenanceChip kind="Source" detail="MoE Jan 2024 Guidelines" />
            <ProvenanceChip kind="Assumption" detail="Inclusive calendar days" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-ink">
            {language === "hi"
              ? "संस्थान प्रो-राटा रिफंड एवं पाठ्यक्रम वापसी नीति (v1.0)"
              : "Institute Pro-Rata Refund & Withdrawal Policy (v1.0)"}
          </h1>

          <p className="text-xs text-ink-2 leading-relaxed">
            {language === "hi"
              ? "शिक्षा मंत्रालय (MoE) की जनवरी 2024 कोचिंग गाइडलाइंस के अनुरूप, यदि कोई विद्यार्थी पाठ्यक्रम के बीच में नाम वापस लेता है, तो शेष अवधि की प्रो-राटा आनुपातिक राशि 10 दिनों के भीतर वापस की जाती है।"
              : "In accordance with the Ministry of Education (MoE) January 2024 Coaching Guidelines, any student withdrawing mid-course is entitled to a pro-rata refund for the unexpired period within 10 days of request."}
          </p>

          {/* Formula Table Box */}
          <div className="p-4 rounded-panel bg-surface border border-line shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-teal" />
              <span>Pro-Rata Formula Convention</span>
            </h2>

            <div className="bg-paper p-3 rounded-input border border-line font-mono text-[11px] text-ink-2 space-y-1">
              <div>T = days(E) - days(S) + 1 (Total inclusive service days)</div>
              <div>c = clamp(days(W) - days(S) + 1, 0, T) (Consumed days)</div>
              <div>earned = roundHalfUp(N * c / T)</div>
              <div>deduction = ₹0 (Zero administrative deduction)</div>
              <div>potentialRefund = max(0, Paid - earned)</div>
            </div>

            <div className="space-y-2 text-xs text-ink-2 pt-1">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                <span>
                  <strong>Zero Fixed Deductions:</strong> No registration, processing, or library deductions are applied.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                <span>
                  <strong>10-Day Processing Window:</strong> Operational target tracked from written withdrawal submission date.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                <span>
                  <strong>Shortfall Safeguard:</strong> On part-paid withdrawals, any unearned shortfall is review-only and never collectible debt.
                </span>
              </div>
            </div>
          </div>

          {/* Rajasthan Coaching Act Notice */}
          <div className="p-3.5 rounded-panel bg-slate-t border border-slate/30 text-xs text-slate space-y-1">
            <div className="font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Statutory Compliance Notice</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Company A, Jaipur provides a 4-equal-instalment payment plan aligned with the Rajasthan Coaching Centres (Control and Regulation) Act provisions. All figures are maintained in integer paise with zero floating-point drift.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
