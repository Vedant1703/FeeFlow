"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { DemoBar } from "@/components/shared/DemoBar";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { Lock, Mail, ArrowRight, ShieldCheck, Sparkles, AlertCircle } from "lucide-react";

export default function StaffLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("neha.verma@demo.companya.test");
  const [password, setPassword] = useState("DemoPassword123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      if (data.actor.role === "COUNSELLOR") {
        router.push("/staff/risk");
      } else {
        router.push("/staff");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, role: string) => {
    setEmail(demoEmail);
    setPassword("DemoPassword123!");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center">
      <DemoBar />

      <main className="w-full max-w-md px-6 py-12 flex-1 flex flex-col justify-center">
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <div className="w-12 h-12 rounded-xl bg-teal text-white font-bold text-lg flex items-center justify-center mx-auto shadow-xs">
            FF
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Staff Sign In</h1>
          <p className="text-xs text-ink-3">
            Company A Institute, Jaipur · Problem 4 Staff Workspace
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-panel bg-bad-t border border-bad/30 text-bad text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-6 rounded-hero bg-surface border border-line shadow-xs space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1.5">
                Staff Email
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-ink-3 absolute left-3 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-11 pl-10 pr-3 rounded-input border border-line-2 bg-surface text-ink text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1.5">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-ink-3 absolute left-3 pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-11 pl-10 pr-3 rounded-input border border-line-2 bg-surface text-ink text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-input bg-teal hover:bg-teal-d text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Reviewer Logins */}
          <div className="pt-4 border-t border-line space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
              <Sparkles className="w-3.5 h-3.5 text-teal" />
              <span>Reviewer 1-Click Demo Profiles:</span>
            </div>

            <div className="space-y-2 text-xs">
              {/* Accounts Executive */}
              <button
                type="button"
                onClick={() => handleQuickLogin("neha.verma@demo.companya.test", "ACCOUNTS")}
                className={`w-full text-left p-2.5 rounded-input border transition-all ${
                  email === "neha.verma@demo.companya.test"
                    ? "border-teal bg-teal-t/30"
                    : "border-line bg-surface hover:bg-paper"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">Neha Verma</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-t text-teal">
                    ACCOUNTS
                  </span>
                </div>
                <div className="text-[11px] text-ink-3">
                  Vaishali Nagar & Malviya Nagar · Dues, Reminders, Unmatched Queue
                </div>
              </button>

              {/* Founder-Director */}
              <button
                type="button"
                onClick={() => handleQuickLogin("arvind.mathur@demo.companya.test", "DIRECTOR")}
                className={`w-full text-left p-2.5 rounded-input border transition-all ${
                  email === "arvind.mathur@demo.companya.test"
                    ? "border-teal bg-teal-t/30"
                    : "border-line bg-surface hover:bg-paper"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">Arvind Mathur</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-t text-teal">
                    DIRECTOR
                  </span>
                </div>
                <div className="text-[11px] text-ink-3">
                  All 4 Centres · Maker-Checker Refund Approvals & System Audit
                </div>
              </button>

              {/* Student Counsellor */}
              <button
                type="button"
                onClick={() => handleQuickLogin("pooja.rawat@demo.companya.test", "COUNSELLOR")}
                className={`w-full text-left p-2.5 rounded-input border transition-all ${
                  email === "pooja.rawat@demo.companya.test"
                    ? "border-teal bg-teal-t/30"
                    : "border-line bg-surface hover:bg-paper"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">Pooja Rawat</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-t text-teal">
                    COUNSELLOR
                  </span>
                </div>
                <div className="text-[11px] text-ink-3">
                  Vaishali Nagar · AI Risk Review (No financial ledger access)
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-ink-3 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-ok" />
          <span>Role-Based Access Control · Server-Side Centre Scoping</span>
        </div>
      </main>
    </div>
  );
}

