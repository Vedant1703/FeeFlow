"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DemoBar } from "@/components/shared/DemoBar";
import { LanguageToggle, useLanguage } from "@/components/shared/LanguageToggle";
import { Rail, RailSegment } from "@/components/shared/Rail";
import { StatusChip } from "@/components/shared/StatusChip";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { formatINR } from "@/domain/money";
import {
  ChevronDown,
  CheckCircle2,
  Calendar,
  CreditCard,
  Receipt,
  FileText,
  AlertTriangle,
  ArrowRight,
  X,
  Sparkles,
  Download,
  Clock,
  ShieldCheck,
  User,
} from "lucide-react";

export default function ParentHomePage() {
  const router = useRouter();
  const { language, t } = useLanguage();

  // Multi-child switcher state (Ishita Sharma vs Kabir Sharma)
  const [selectedChild, setSelectedChild] = useState<"ISHITA" | "KABIR">("ISHITA");
  const [isPaySheetOpen, setIsPaySheetOpen] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<"FULL" | "PARTIAL">("FULL");
  const [customAmountRupees, setCustomAmountRupees] = useState("5000");
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [activeTab, setActiveTab] = useState<"FEES" | "RECEIPTS">("FEES");

  // Child data fixtures
  const isIshita = selectedChild === "ISHITA";

  const studentData = isIshita
    ? {
        id: "stu_ishita_demo_id",
        studentCode: "STU-0587",
        name: "Ishita Sharma",
        batchName: "JEE 2027 Evening",
        centreName: "Vaishali Nagar, Jaipur",
        dueAmountPaise: 1500000n, // ₹15,000
        totalBilledPaise: 12000000n,
        totalPaidPaise: 4500000n,
        dueDate: "10 Oct 2026",
        daysOverdue: 23,
        statusChipTone: "bad" as const,
        statusText: language === "hi" ? "23 दिन से बकाया" : "Overdue by 23 days",
        railSegments: [
          { state: "paid" as const, paidPct: 100 },
          { state: "part" as const, paidPct: 50, overdue: true },
          { state: "upcoming" as const, paidPct: 0 },
          { state: "upcoming" as const, paidPct: 0 },
        ],
        instalments: [
          {
            seq: 1,
            title: language === "hi" ? "किस्त 1" : "Instalment 1",
            due: "10 Jul 2026",
            amount: 3000000n,
            paid: 3000000n,
            status: "PAID",
            statusText: language === "hi" ? "जमा" : "Paid",
          },
          {
            seq: 2,
            title: language === "hi" ? "किस्त 2" : "Instalment 2",
            due: "10 Oct 2026",
            amount: 3000000n,
            paid: 1500000n,
            status: "OVERDUE",
            statusText: language === "hi" ? "आंशिक जमा · 23 दिन बकाया" : "Part paid · 23d overdue",
          },
          {
            seq: 3,
            title: language === "hi" ? "किस्त 3" : "Instalment 3",
            due: "10 Jan 2027",
            amount: 3000000n,
            paid: 0n,
            status: "UPCOMING",
            statusText: language === "hi" ? "आगामी" : "Upcoming",
          },
          {
            seq: 4,
            title: language === "hi" ? "किस्त 4" : "Instalment 4",
            due: "10 Mar 2027",
            amount: 3000000n,
            paid: 0n,
            status: "UPCOMING",
            statusText: language === "hi" ? "आगामी" : "Upcoming",
          },
        ],
        receipts: [
          {
            receiptNo: "REC-2026-0587-2",
            date: "15 Oct 2026",
            amount: 1500000n,
            method: "Netbanking",
            gstin: "08AABCC1234D1Z5 [SYNTHETIC]",
          },
          {
            receiptNo: "REC-2026-0587-1",
            date: "09 Jul 2026",
            amount: 3000000n,
            method: "UPI",
            gstin: "08AABCC1234D1Z5 [SYNTHETIC]",
          },
        ],
      }
    : {
        id: "stu_kabir_demo_id",
        studentCode: "STU-0588",
        name: "Kabir Sharma",
        batchName: "JEE 2027 Evening",
        centreName: "Vaishali Nagar, Jaipur",
        dueAmountPaise: 0n,
        totalBilledPaise: 12000000n,
        totalPaidPaise: 12000000n,
        dueDate: "All paid",
        daysOverdue: 0,
        statusChipTone: "ok" as const,
        statusText: language === "hi" ? "सभी फीस जमा" : "All Paid",
        railSegments: [
          { state: "paid" as const, paidPct: 100 },
          { state: "paid" as const, paidPct: 100 },
          { state: "paid" as const, paidPct: 100 },
          { state: "paid" as const, paidPct: 100 },
        ],
        instalments: [
          { seq: 1, title: "Instalment 1", due: "10 Jul 2026", amount: 3000000n, paid: 3000000n, status: "PAID", statusText: "Paid" },
          { seq: 2, title: "Instalment 2", due: "10 Oct 2026", amount: 3000000n, paid: 3000000n, status: "PAID", statusText: "Paid" },
          { seq: 3, title: "Instalment 3", due: "10 Jan 2027", amount: 3000000n, paid: 3000000n, status: "PAID", statusText: "Paid" },
          { seq: 4, title: "Instalment 4", due: "10 Mar 2027", amount: 3000000n, paid: 3000000n, status: "PAID", statusText: "Paid" },
        ],
        receipts: [
          { receiptNo: "REC-2026-0588-4", date: "10 Mar 2026", amount: 3000000n, method: "UPI", gstin: "08AABCC1234D1Z5 [SYNTHETIC]" },
          { receiptNo: "REC-2026-0588-3", date: "10 Jan 2026", amount: 3000000n, method: "UPI", gstin: "08AABCC1234D1Z5 [SYNTHETIC]" },
          { receiptNo: "REC-2026-0588-2", date: "10 Oct 2026", amount: 3000000n, method: "UPI", gstin: "08AABCC1234D1Z5 [SYNTHETIC]" },
          { receiptNo: "REC-2026-0588-1", date: "10 Jul 2026", amount: 3000000n, method: "UPI", gstin: "08AABCC1234D1Z5 [SYNTHETIC]" },
        ],
      };

  const handleInitiatePayment = async () => {
    setIsCreatingIntent(true);
    try {
      const amountToPayPaise =
        paymentChoice === "FULL"
          ? studentData.dueAmountPaise
          : BigInt(Number(customAmountRupees) * 100);

      const res = await fetch("/api/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentData.id,
          amountPaise: amountToPayPaise.toString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create payment intent");
      }

      router.push(`/parent/checkout?orderId=${data.orderId}`);
    } catch (err: any) {
      alert(err.message);
      setIsCreatingIntent(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center">
      <DemoBar />

      <main className="w-full max-w-[420px] px-4 py-5 flex-1 flex flex-col space-y-5 pb-16">
        {/* =========================================================================
            PARENT 5-SECOND CLARITY SECTION (ABOVE 640px FOLD)
            1. Top Row: App Title, Child Switcher, Language Toggle
            2. Hero Card: Amount Due (52px), Chip, <Rail />, Pay Button (54px)
           ========================================================================= */}
        <section aria-label="Fee Overview" className="space-y-4">
          {/* Header & Child Switcher Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-line">
            {/* Child Switcher Dropdown */}
            <div className="relative">
              <label htmlFor="child-switcher" className="sr-only">
                {t("child_switcher")}
              </label>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-teal-t text-teal flex items-center justify-center font-bold text-xs">
                  <User className="w-4 h-4" />
                </div>
                <select
                  id="child-switcher"
                  value={selectedChild}
                  onChange={(e) => setSelectedChild(e.target.value as any)}
                  className="bg-transparent font-bold text-ink text-sm appearance-none pr-6 cursor-pointer focus:outline-none"
                >
                  <option value="ISHITA">Ishita Sharma (STU-0587)</option>
                  <option value="KABIR">Kabir Sharma (STU-0588)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-ink-3 -ml-5 pointer-events-none" />
              </div>
            </div>

            <LanguageToggle />
          </div>

          {/* Student Sub-heading & Batch */}
          <div className="flex items-center justify-between text-xs text-ink-2 px-1">
            <span>{studentData.batchName} · {studentData.centreName}</span>
            <ProvenanceChip kind="Synthetic data" />
          </div>

          {/* Signature Amount Due Card (5-Second Rule) */}
          <div className="p-6 rounded-hero bg-surface border border-line shadow-xs space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-2">
                  {t("amount_due")}
                </span>
                <StatusChip
                  tone={studentData.statusChipTone}
                  text={studentData.statusText}
                />
              </div>

              {/* Hero Amount: 52px Tabular Numerals */}
              <div className="text-amount font-semibold tracking-tight text-ink">
                {formatINR(studentData.dueAmountPaise)}
              </div>

              <div className="text-xs text-ink-3 flex items-center justify-between pt-1">
                <span>
                  {isIshita ? `Due date: 10 Oct 2026 (${studentData.daysOverdue} days overdue)` : "All terms settled"}
                </span>
                <span>Term: 2026-27</span>
              </div>
            </div>

            {/* Signature Instalment Rail (4 segments) */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] text-ink-3">
                <span>{language === "hi" ? "किस्त प्रगति" : "Instalment plan"}</span>
                <span>
                  {isIshita ? "Instalment 2: part paid" : "4 of 4 paid"}
                </span>
              </div>
              <Rail segs={studentData.railSegments} tall />
            </div>

            {/* Primary Action Button (54px Touch Target) */}
            {isIshita ? (
              <button
                type="button"
                onClick={() => setIsPaySheetOpen(true)}
                className="w-full h-[54px] rounded-input bg-teal hover:bg-teal-d text-white font-semibold text-base transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <CreditCard className="w-5 h-5" />
                <span>{language === "hi" ? "₹15,000 का भुगतान करें" : "Pay ₹15,000"}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            ) : (
              /* All Paid Celebration Card (Kabir Sharma) */
              <div className="p-3.5 rounded-panel bg-ok-t/40 border border-ok/30 flex items-center gap-3 text-ok text-xs font-semibold">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-ok" />
                <span>{t("all_paid_celebration")}</span>
              </div>
            )}
          </div>
        </section>

        {/* Tab Navigation: Fees Breakdown vs Receipts */}
        <div className="flex border-b border-line pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("FEES")}
            className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "FEES"
                ? "border-teal text-teal"
                : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            {t("tab_fees")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("RECEIPTS")}
            className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "RECEIPTS"
                ? "border-teal text-teal"
                : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            {t("tab_receipts")} ({studentData.receipts.length})
          </button>
        </div>

        {/* =========================================================================
            TAB CONTENT: FEES BREAKDOWN
           ========================================================================= */}
        {activeTab === "FEES" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-ink-2 px-1">
              <span>{t("all_instalments")} (4 × ₹30,000)</span>
              <span>Total: ₹1,20,000</span>
            </div>

            <div className="space-y-2">
              {studentData.instalments.map((inst) => (
                <div
                  key={inst.seq}
                  className="p-3.5 rounded-panel bg-surface border border-line flex items-center justify-between shadow-2xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-xs text-ink">{inst.title}</div>
                    <div className="text-[11px] text-ink-3 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-ink-3" />
                      <span>{inst.due}</span>
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="font-mono text-xs font-bold text-ink">
                      {formatINR(inst.amount)}
                    </div>
                    <div>
                      {inst.status === "PAID" && (
                        <StatusChip tone="ok" text={inst.statusText} size="sm" />
                      )}
                      {inst.status === "OVERDUE" && (
                        <StatusChip tone="bad" text={inst.statusText} size="sm" />
                      )}
                      {inst.status === "UPCOMING" && (
                        <StatusChip tone="slate" text={inst.statusText} size="sm" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Public Refund Policy Link */}
            <div className="pt-3 text-center">
              <Link
                href="/parent/refund-policy"
                className="inline-flex items-center gap-1.5 text-xs text-teal hover:underline font-semibold"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{language === "hi" ? "संस्थान रिफंड नीति देखें" : "View Institute Pro-Rata Refund Policy"}</span>
              </Link>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB CONTENT: RECEIPTS
           ========================================================================= */}
        {activeTab === "RECEIPTS" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-ink-2 px-1">
              <span>{t("recent_receipts")}</span>
              <span className="text-[11px] text-ok font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>GST Configured</span>
              </span>
            </div>

            <div className="space-y-2">
              {studentData.receipts.map((r) => (
                <div
                  key={r.receiptNo}
                  className="p-3.5 rounded-panel bg-surface border border-line flex items-center justify-between shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-xs text-ink flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-teal" />
                      <span>{r.receiptNo}</span>
                    </div>
                    <div className="text-[11px] text-ink-3">
                      {r.date} · {r.method}
                    </div>
                    <div className="text-[10px] text-ink-3 font-mono">
                      GSTIN: {r.gstin}
                    </div>
                  </div>

                  <div className="text-right space-y-1.5">
                    <div className="font-mono text-sm font-bold text-ink">
                      {formatINR(r.amount)}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        alert(
                          `Official Tax Invoice / Receipt: ${r.receiptNo}\nAmount: ${formatINR(r.amount)}\nGSTIN: ${r.gstin}\nSAC: 999293\nVerified Captured Payment`
                        )
                      }
                      className="inline-flex items-center gap-1 text-[11px] text-teal hover:underline font-semibold"
                    >
                      <Download className="w-3 h-3" />
                      <span>Receipt</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Security Assurance */}
        <div className="text-center text-[11px] text-ink-3 pt-6 flex items-center justify-center gap-1.5 border-t border-line">
          <ShieldCheck className="w-3.5 h-3.5 text-ok" />
          <span>Encrypted 256-Bit SSL · Verified Payment Callbacks Only</span>
        </div>
      </main>

      {/* =========================================================================
          VAUL-STYLE BOTTOM PAY SHEET (P1b)
         ========================================================================= */}
      {isPaySheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs transition-opacity"
        >
          {/* Backdrop click to close */}
          <div
            className="flex-1"
            onClick={() => setIsPaySheetOpen(false)}
          />

          <div className="w-full max-w-[420px] mx-auto bg-surface rounded-t-[22px] border-t border-line p-6 space-y-5 shadow-dialog animate-in slide-in-from-bottom duration-200">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 rounded-full bg-line-2 mx-auto -mt-2" />

            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="space-y-0.5">
                <h3 className="font-bold text-base text-ink tracking-tight">
                  {language === "hi" ? "भुगतान राशि चुनें" : "Select Payment Amount"}
                </h3>
                <p className="text-xs text-ink-3">
                  {studentData.name} ({studentData.studentCode})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaySheetOpen(false)}
                className="p-1 rounded-full text-ink-3 hover:text-ink hover:bg-paper"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payment Choice Radio options */}
            <div className="space-y-3">
              {/* Option 1: Full Outstanding */}
              <label
                onClick={() => setPaymentChoice("FULL")}
                className={`p-3.5 rounded-panel border flex items-center justify-between cursor-pointer transition-all ${
                  paymentChoice === "FULL"
                    ? "border-teal bg-teal-t/20"
                    : "border-line bg-surface hover:bg-paper"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="payOption"
                    checked={paymentChoice === "FULL"}
                    onChange={() => setPaymentChoice("FULL")}
                    className="w-4 h-4 text-teal focus:ring-teal"
                  />
                  <div>
                    <div className="font-semibold text-xs text-ink">
                      {language === "hi" ? "पूरी बकाया राशि" : "Pay full overdue balance"}
                    </div>
                    <div className="text-[11px] text-ink-3">
                      Instalment 2 remaining balance
                    </div>
                  </div>
                </div>
                <span className="font-mono text-sm font-bold text-ink">
                  ₹15,000
                </span>
              </label>

              {/* Option 2: Custom / Partial Payment */}
              <label
                onClick={() => setPaymentChoice("PARTIAL")}
                className={`p-3.5 rounded-panel border flex flex-col space-y-3 cursor-pointer transition-all ${
                  paymentChoice === "PARTIAL"
                    ? "border-teal bg-teal-t/20"
                    : "border-line bg-surface hover:bg-paper"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payOption"
                      checked={paymentChoice === "PARTIAL"}
                      onChange={() => setPaymentChoice("PARTIAL")}
                      className="w-4 h-4 text-teal focus:ring-teal"
                    />
                    <div>
                      <div className="font-semibold text-xs text-ink">
                        {t("pay_other")}
                      </div>
                      <div className="text-[11px] text-ink-3">
                        Min ₹1,000 up to ₹15,000
                      </div>
                    </div>
                  </div>
                </div>

                {paymentChoice === "PARTIAL" && (
                  <div className="pt-2">
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-ink text-sm font-semibold">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="1000"
                        max="15000"
                        step="500"
                        value={customAmountRupees}
                        onChange={(e) => setCustomAmountRupees(e.target.value)}
                        className="w-full h-11 pl-8 pr-4 rounded-input border border-line-2 bg-surface text-ink font-mono font-bold text-base focus:outline-none focus:ring-2 focus:ring-teal"
                      />
                    </div>
                  </div>
                )}
              </label>
            </div>

            {/* Summary & Submit */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between text-xs text-ink-2 px-1">
                <span>{language === "hi" ? "भुगतान की जाने वाली राशि" : "Amount to pay now"}:</span>
                <span className="font-mono text-base font-bold text-ink">
                  ₹{paymentChoice === "FULL" ? "15,000" : Number(customAmountRupees || 0).toLocaleString("en-IN")}
                </span>
              </div>

              <button
                type="button"
                onClick={handleInitiatePayment}
                disabled={isCreatingIntent}
                className="w-full h-[52px] rounded-input bg-teal hover:bg-teal-d text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                {isCreatingIntent ? (
                  <span>Opening secure checkout...</span>
                ) : (
                  <>
                    <span>Proceed to Mock Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
