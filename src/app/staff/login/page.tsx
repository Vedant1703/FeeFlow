"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DemoBar } from "@/components/shared/DemoBar";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { Lock, Mail, ArrowRight, ShieldCheck, Sparkles, AlertCircle } from "lucide-react";

function StaffLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("neha.verma@demo.companya.test");
  const [password, setPassword] = useState("DemoPassword123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(errorParam);
    }
  }, [searchParams]);

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
            Company A Institute, Jaipur · Staff Workspace
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-panel bg-bad-t border border-bad/30 text-bad text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-6 rounded-hero bg-surface border border-line shadow-xs space-y-6">
          {/* OAuth 2.0 Google Workspace SSO */}
          <div>
            <a
              href="/api/auth/oauth/google?returnTo=/staff"
              className="w-full h-11 rounded-input border border-line-2 bg-surface hover:bg-paper text-ink font-semibold text-xs transition-colors flex items-center justify-center gap-2.5 shadow-xs"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google Workspace (SSO)</span>
            </a>

            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-line" />
              </div>
              <span className="relative bg-surface px-2 text-[10px] font-bold text-ink-3 uppercase tracking-wider">
                Or password login
              </span>
            </div>
          </div>

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
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-ok-t text-ok">
                    DIRECTOR
                  </span>
                </div>
                <div className="text-[11px] text-ink-3">
                  All 4 Jaipur Centres · Checker Approvals, Audit & Health
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
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-warn-t text-warn">
                    COUNSELLOR
                  </span>
                </div>
                <div className="text-[11px] text-ink-3">
                  Vaishali Nagar · Academic Imports & Dropout-Risk Queue (Zero Ledger Access)
                </div>
              </button>
            </div>
          </div>

          <div className="text-center pt-2">
            <ProvenanceChip kind="Design" detail="Role-based access" />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper flex items-center justify-center text-xs text-ink-3">
          Loading Staff Sign In...
        </div>
      }
    >
      <StaffLoginContent />
    </Suspense>
  );
}
