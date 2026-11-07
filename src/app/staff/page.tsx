"use client";

import React, { useState } from "react";
import Link from "next/link";
import { StaffNav } from "@/components/shared/StaffNav";
import { DemoBar } from "@/components/shared/DemoBar";
import { StatusChip } from "@/components/shared/StatusChip";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import {
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  Building,
  Users,
  CreditCard,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export default function StaffDashboardPage() {
  const [centreFilter, setCentreFilter] = useState("ALL");

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <DemoBar />

      <div className="flex flex-1">
        {/* Desktop Sidebar Navigation */}
        <StaffNav currentRole="ACCOUNTS" userName="Neha Verma" />

        {/* Main Content Area */}
        <main className="flex-1 p-8 space-y-8 max-w-6xl">
          {/* Header & Filter Controls */}
          <div className="flex items-center justify-between pb-4 border-b border-line">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-ink">
                  Accounts Dashboard
                </h1>
                <ProvenanceChip kind="Synthetic data" />
              </div>
              <p className="text-xs text-ink-3 mt-0.5">
                Multi-centre collection performance, ageing metrics, and operational exceptions as of 2 Nov 2026
              </p>
            </div>

            {/* Centre Filter Dropdown */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-ink-2 bg-surface px-3 py-1.5 rounded-input border border-line">
                <Filter className="w-3.5 h-3.5 text-teal" />
                <span className="font-semibold">Centre:</span>
                <select
                  value={centreFilter}
                  onChange={(e) => setCentreFilter(e.target.value)}
                  className="bg-transparent font-medium text-ink cursor-pointer focus:outline-none"
                >
                  <option value="ALL">All 4 Centres (Jaipur)</option>
                  <option value="VN">Vaishali Nagar</option>
                  <option value="MN">Malviya Nagar</option>
                  <option value="MS">Mansarovar</option>
                  <option value="TR">Tonk Road</option>
                </select>
              </div>
            </div>
          </div>

          {/* =========================================================================
              KPI SUMMARY STRIP (4 METRICS)
             ========================================================================= */}
          <div className="grid grid-cols-4 gap-4">
            {/* KPI 1: Total Billed */}
            <div className="p-5 rounded-panel bg-surface border border-line shadow-2xs space-y-1.5">
              <span className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
                Total Billed
              </span>
              <div className="text-2xl font-bold font-mono text-ink">₹31.20 Cr</div>
              <div className="text-[11px] text-ink-3">
                Across 2,591 enrolled students (2026-27)
              </div>
            </div>

            {/* KPI 2: Verified Collected */}
            <div className="p-5 rounded-panel bg-surface border border-line shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
                  Verified Collected
                </span>
                <StatusChip tone="ok" text="77.8%" size="sm" />
              </div>
              <div className="text-2xl font-bold font-mono text-ok">₹24.29 Cr</div>
              <div className="text-[11px] text-ink-3">
                Webhook-verified ledger allocations
              </div>
            </div>

            {/* KPI 3: Current Outstanding */}
            <div className="p-5 rounded-panel bg-surface border border-line shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
                  Current Outstanding
                </span>
                <StatusChip tone="warn" text="22.2%" size="sm" />
              </div>
              <div className="text-2xl font-bold font-mono text-warn">₹6.91 Cr</div>
              <div className="text-[11px] text-ink-3">
                Ordinary scheduled future & overdue dues
              </div>
            </div>

            {/* KPI 4: Over-60 Days Ageing */}
            <div className="p-5 rounded-panel bg-surface border border-line shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
                  Over-60 Days Ageing
                </span>
                <StatusChip tone="bad" text="11.4%" size="sm" />
              </div>
              <div className="text-2xl font-bold font-mono text-bad">₹78.8 Lakh</div>
              <div className="text-[11px] text-ink-3">
                Target: reduce from 12% to 6% over 2 terms
              </div>
            </div>
          </div>

          {/* =========================================================================
              "NEEDS ATTENTION" PRIORITY QUEUE
             ========================================================================= */}
          <div className="p-6 rounded-hero bg-surface border border-line shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warn" />
                <h2 className="font-bold text-base text-ink tracking-tight">
                  Needs Attention (4 Active Exceptions)
                </h2>
              </div>
              <span className="text-xs text-ink-3">Requires Accounts action</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Item 1: Unmatched Payment */}
              <div className="p-3.5 rounded-panel border border-line hover:border-teal bg-paper flex items-center justify-between transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">Unmatched Payment</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-warn-t text-warn font-bold">
                      Queue S3
                    </span>
                  </div>
                  <div className="text-ink-2 font-mono font-medium">
                    pay_demo_a91c · ₹15,000 (NEFT)
                  </div>
                  <div className="text-[11px] text-ink-3">
                    Ref: "MOHIT G 0219" (Candidate: STU-0219 Mohit Gurjar, 88% match)
                  </div>
                </div>
                <Link
                  href="/staff/payments"
                  className="px-3 py-1.5 rounded-input bg-teal text-white font-semibold text-xs hover:bg-teal-d transition-colors"
                >
                  Allocate
                </Link>
              </div>

              {/* Item 2: Overdue Student */}
              <div className="p-3.5 rounded-panel border border-line hover:border-teal bg-paper flex items-center justify-between transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">Overdue Instalment (23d)</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-bad-t text-bad font-bold">
                      23 Days
                    </span>
                  </div>
                  <div className="text-ink-2">
                    STU-0587 Ishita Sharma · JEE 2027 Evening (Vaishali Nagar)
                  </div>
                  <div className="text-[11px] text-ink-3 font-mono font-bold text-bad">
                    ₹15,000 remaining on Instalment 2
                  </div>
                </div>
                <Link
                  href="/staff/students/stu_ishita_demo_id"
                  className="px-3 py-1.5 rounded-input border border-line hover:border-teal text-ink font-semibold text-xs transition-colors"
                >
                  View Ledger
                </Link>
              </div>

              {/* Item 3: Withdrawal Under Review */}
              <div className="p-3.5 rounded-panel border border-line hover:border-teal bg-paper flex items-center justify-between transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">Withdrawal Quote Submitted</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-t text-slate font-bold">
                      Informational Shortfall
                    </span>
                  </div>
                  <div className="text-ink-2">
                    STU-0587 Ishita Sharma (c = 144 / 290 days)
                  </div>
                  <div className="text-[11px] text-slate font-medium">
                    Shortfall ₹14,586.21 · Ordinary dues waived to ₹0 on approval
                  </div>
                </div>
                <Link
                  href="/staff/withdrawals"
                  className="px-3 py-1.5 rounded-input border border-line hover:border-teal text-ink font-semibold text-xs transition-colors"
                >
                  Review Quote
                </Link>
              </div>

              {/* Item 4: High Risk Review Task */}
              <div className="p-3.5 rounded-panel border border-line hover:border-teal bg-paper flex items-center justify-between transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">Dropout-Risk Flag (Score 72)</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-bad-t text-bad font-bold">
                      Counsellor Call
                    </span>
                  </div>
                  <div className="text-ink-2">
                    STU-0731 Rohan Saini · Missed fee + 36% attendance drop
                  </div>
                  <div className="text-[11px] text-ink-3">
                    Assigned to Counsellor Pooja Rawat (Zero parent message)
                  </div>
                </div>
                <Link
                  href="/staff/risk"
                  className="px-3 py-1.5 rounded-input bg-surface border border-line hover:border-teal text-ink font-semibold text-xs transition-colors"
                >
                  Review Factors
                </Link>
              </div>
            </div>
          </div>

          {/* =========================================================================
              CENTRE COLLECTION & AGEING BREAKDOWN
             ========================================================================= */}
          <div className="p-6 rounded-hero bg-surface border border-line shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div>
                <h2 className="font-bold text-base text-ink tracking-tight">
                  Centre Ageing & Collection Performance
                </h2>
                <p className="text-xs text-ink-3">
                  Visual collection progress across all 4 Jaipur centres
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-ink-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal" />
                  <span>Collected</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8CBDB7]" />
                  <span>1–30d</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F0C879]" />
                  <span>31–60d</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-bad" />
                  <span>&gt;60d</span>
                </span>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Centre 1: Vaishali Nagar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-ink">Vaishali Nagar (JPR-VN)</span>
                  <span className="font-mono text-ink-2">₹6.48 Cr / ₹8.52 Cr (76.1%)</span>
                </div>
                <div className="w-full h-3 rounded bg-line-2 flex overflow-hidden">
                  <div style={{ width: "76%" }} className="bg-teal" title="Collected: 76%" />
                  <div style={{ width: "12%" }} className="bg-[#8CBDB7]" title="1-30d: 12%" />
                  <div style={{ width: "7%" }} className="bg-[#F0C879]" title="31-60d: 7%" />
                  <div style={{ width: "5%" }} className="bg-bad" title=">60d: 5%" />
                </div>
              </div>

              {/* Centre 2: Malviya Nagar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-ink">Malviya Nagar (JPR-MN)</span>
                  <span className="font-mono text-ink-2">₹7.14 Cr / ₹8.50 Cr (84.0%)</span>
                </div>
                <div className="w-full h-3 rounded bg-line-2 flex overflow-hidden">
                  <div style={{ width: "84%" }} className="bg-teal" title="Collected: 84%" />
                  <div style={{ width: "9%" }} className="bg-[#8CBDB7]" title="1-30d: 9%" />
                  <div style={{ width: "4%" }} className="bg-[#F0C879]" title="31-60d: 4%" />
                  <div style={{ width: "3%" }} className="bg-bad" title=">60d: 3%" />
                </div>
              </div>

              {/* Centre 3: Mansarovar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-ink">Mansarovar (JPR-MS)</span>
                  <span className="font-mono text-ink-2">₹5.82 Cr / ₹7.18 Cr (81.1%)</span>
                </div>
                <div className="w-full h-3 rounded bg-line-2 flex overflow-hidden">
                  <div style={{ width: "81%" }} className="bg-teal" title="Collected: 81%" />
                  <div style={{ width: "10%" }} className="bg-[#8CBDB7]" title="1-30d: 10%" />
                  <div style={{ width: "5%" }} className="bg-[#F0C879]" title="31-60d: 5%" />
                  <div style={{ width: "4%" }} className="bg-bad" title=">60d: 4%" />
                </div>
              </div>

              {/* Centre 4: Tonk Road */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-ink">Tonk Road (JPR-TR)</span>
                  <span className="font-mono text-ink-2">₹4.85 Cr / ₹7.00 Cr (69.3%)</span>
                </div>
                <div className="w-full h-3 rounded bg-line-2 flex overflow-hidden">
                  <div style={{ width: "69%" }} className="bg-teal" title="Collected: 69%" />
                  <div style={{ width: "14%" }} className="bg-[#8CBDB7]" title="1-30d: 14%" />
                  <div style={{ width: "9%" }} className="bg-[#F0C879]" title="31-60d: 9%" />
                  <div style={{ width: "8%" }} className="bg-bad" title=">60d: 8%" />
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              KEY SAMPLE RECORDS TABLE (BRIEF VERBATIM RECORDS)
             ========================================================================= */}
          <div className="p-6 rounded-hero bg-surface border border-line shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div>
                <h2 className="font-bold text-base text-ink tracking-tight">
                  Brief Sample Records & Supporting Fixtures
                </h2>
                <p className="text-xs text-ink-3">
                  Verbatim brief records reproduced as of 2 Nov 2026 demo business date
                </p>
              </div>
              <ProvenanceChip kind="Source" detail="Brief Problem 4" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line text-ink-3 font-semibold">
                    <th className="py-2.5 px-3">Student ID</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Batch & Centre</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-right">Paid</th>
                    <th className="py-2.5 px-3">Status (2 Nov 2026)</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {/* Record 1: STU-0412 Aarav Meena */}
                  <tr className="hover:bg-paper/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-ink">STU-0412</td>
                    <td className="py-3 px-3 font-semibold text-ink">Aarav Meena</td>
                    <td className="py-3 px-3 text-ink-2">JEE 2027 Morning · Malviya Nagar</td>
                    <td className="py-3 px-3 text-ink-2">10 Oct 2026</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-ink">₹30,000</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-ok">₹30,000</td>
                    <td className="py-3 px-3">
                      <StatusChip tone="ok" text="Paid" />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href="/staff/students/stu_aarav_demo_id"
                        className="text-teal font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        Ledger →
                      </Link>
                    </td>
                  </tr>

                  {/* Record 2: STU-0587 Ishita Sharma */}
                  <tr className="hover:bg-paper/80 transition-colors bg-warn-t/10">
                    <td className="py-3 px-3 font-mono font-bold text-ink">STU-0587</td>
                    <td className="py-3 px-3 font-semibold text-ink">Ishita Sharma</td>
                    <td className="py-3 px-3 text-ink-2">JEE 2027 Evening · Vaishali Nagar</td>
                    <td className="py-3 px-3 text-ink-2">10 Oct 2026</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-ink">₹30,000</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-warn">₹15,000</td>
                    <td className="py-3 px-3">
                      <StatusChip tone="bad" text="Part paid, 23d overdue" />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href="/staff/students/stu_ishita_demo_id"
                        className="text-teal font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        Ledger →
                      </Link>
                    </td>
                  </tr>

                  {/* Record 3: STU-0219 Mohit Gurjar */}
                  <tr className="hover:bg-paper/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-ink">STU-0219</td>
                    <td className="py-3 px-3 font-semibold text-ink">Mohit Gurjar</td>
                    <td className="py-3 px-3 text-ink-2">NEET 2027 Morning · Mansarovar</td>
                    <td className="py-3 px-3 text-ink-2">15 Nov 2026</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-ink">₹40,000</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-ink-3">₹0</td>
                    <td className="py-3 px-3">
                      <StatusChip tone="info" text="Due in 13 days" />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href="/staff/students/stu_mohit_demo_id"
                        className="text-teal font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        Ledger →
                      </Link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
