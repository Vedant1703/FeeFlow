"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LanguageToggle, useLanguage } from "@/components/shared/LanguageToggle";
import { DemoBar } from "@/components/shared/DemoBar";
import { ArrowRight, ShieldCheck, Sparkles, Smartphone, KeyRound, AlertCircle } from "lucide-react";

export default function ParentLoginPage() {
  const router = useRouter();
  const { language } = useLanguage();

  const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
  const [phone, setPhone] = useState("+91 90000 12345"); // Seeded parent Sanjay Sharma
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoCodeNotice, setDemoCodeNotice] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setDemoCodeNotice(data.demoCode || "482913");
      setStep("OTP");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid OTP code");
      }

      if (data.requiresConsent) {
        router.push("/parent/consent");
      } else {
        router.push("/parent");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setPresetPhone = (num: string) => {
    setPhone(num);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center">
      <DemoBar />

      <main className="w-full max-w-sm px-4 py-8 flex-1 flex flex-col justify-center">
        {/* Header with App Title and Language Toggle */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-line">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal text-white font-bold flex items-center justify-center text-sm shadow-xs">
              FF
            </div>
            <div>
              <h1 className="font-bold text-ink text-lg tracking-tight">FeeFlow</h1>
              <p className="text-[11px] text-ink-3">Parent Mobile Portal</p>
            </div>
          </div>
          <LanguageToggle />
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-panel bg-bad-t border border-bad/30 text-bad text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === "PHONE" ? (
          /* Step P0a: Mobile Number Entry */
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-ink">
                {language === "hi"
                  ? "बच्चे की फीस देखने के लिए लॉगिन करें"
                  : "Log in to see your child's fees"}
              </h2>
              <p className="text-xs text-ink-2">
                {language === "hi"
                  ? "संस्थान में पंजीकृत अपना 10 अंकों का मोबाइल नंबर दर्ज करें।"
                  : "Enter the registered 10-digit mobile number given to the institute."}
              </p>
            </div>

            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1.5">
                  {language === "hi" ? "मोबाइल नंबर" : "Mobile number"}
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-ink-3 text-sm font-medium">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 90000 12345"
                    required
                    className="w-full h-[52px] pl-10 pr-4 rounded-input border border-line-2 bg-surface text-ink font-medium text-sm focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !phone}
                className="w-full h-[52px] rounded-input bg-teal hover:bg-teal-d text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                {loading ? (
                  <span>{language === "hi" ? "भेजा जा रहा है..." : "Sending code..."}</span>
                ) : (
                  <>
                    <span>{language === "hi" ? "ओटीपी कोड भेजें" : "Send code"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Phone Picker */}
            <div className="p-3.5 rounded-panel border border-dashed border-line-2 bg-surface/60 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                <Sparkles className="w-3.5 h-3.5 text-teal" />
                <span>Demo Institute Parent Accounts:</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPresetPhone("+91 90000 12345")}
                  className="text-left p-2 rounded border border-line hover:border-teal bg-surface hover:bg-teal-t/20 transition-colors"
                >
                  <div className="font-semibold text-ink">Sanjay Sharma (+91 90000 12345)</div>
                  <div className="text-[11px] text-ink-3">
                    Ishita (₹15,000 overdue) & Kabir (All paid)
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPresetPhone("+91 90000 12341")}
                  className="text-left p-2 rounded border border-line hover:border-teal bg-surface hover:bg-teal-t/20 transition-colors"
                >
                  <div className="font-semibold text-ink">Rajesh Meena (+91 90000 12341)</div>
                  <div className="text-[11px] text-ink-3">Aarav Meena (All paid on 10 Oct)</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPresetPhone("+91 90000 12342")}
                  className="text-left p-2 rounded border border-line hover:border-teal bg-surface hover:bg-teal-t/20 transition-colors"
                >
                  <div className="font-semibold text-ink">Ramesh Gurjar (+91 90000 12342)</div>
                  <div className="text-[11px] text-ink-3">Mohit Gurjar (₹40,000 due in 13 days)</div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Step P0b: 6-Digit OTP Entry */
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-ink">
                {language === "hi" ? "6 अंकों का कोड दर्ज करें" : "Enter the 6-digit code"}
              </h2>
              <p className="text-xs text-ink-2">
                {language === "hi" ? "कोड भेजा गया: " : "Code sent to "}
                <span className="font-semibold text-ink">{phone}</span>
                <button
                  type="button"
                  onClick={() => setStep("PHONE")}
                  className="ml-2 text-teal underline font-medium"
                >
                  {language === "hi" ? "नंबर बदलें" : "Change"}
                </button>
              </p>
            </div>

            {demoCodeNotice && (
              <div className="p-3 rounded-panel bg-teal-t border border-teal/30 text-teal-d text-xs flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 shrink-0 text-teal" />
                  <span>
                    Demo OTP: <strong className="font-mono text-sm">{demoCodeNotice}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setOtp(demoCodeNotice)}
                  className="text-[11px] bg-teal text-white px-2 py-0.5 rounded font-semibold hover:bg-teal-d"
                >
                  Auto-fill
                </button>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1.5">
                  {language === "hi" ? "सत्यापन कोड" : "Verification code"}
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-ink-3">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="482913"
                    autoComplete="one-time-code"
                    required
                    className="w-full h-[52px] pl-10 pr-4 text-center font-mono tracking-widest text-lg rounded-input border border-line-2 bg-surface text-ink font-bold focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full h-[52px] rounded-input bg-teal hover:bg-teal-d text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                {loading ? (
                  <span>{language === "hi" ? "सत्यापित हो रहा है..." : "Verifying..."}</span>
                ) : (
                  <span>
                    {language === "hi" ? "सत्यापित करें और आगे बढ़ें" : "Verify & Continue"}
                  </span>
                )}
              </button>
            </form>
          </div>
        )}

        <div className="mt-8 text-center text-[11px] text-ink-3 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-ok" />
          <span>DPDP Act 2023 Compliant · Verifiable Parental Consent Gate</span>
        </div>
      </main>
    </div>
  );
}

