"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LanguageToggle, useLanguage } from "@/components/shared/LanguageToggle";
import { DemoBar } from "@/components/shared/DemoBar";
import { ArrowRight, ShieldCheck, Sparkles, Smartphone, KeyRound, AlertCircle, RotateCcw } from "lucide-react";

function ParentLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();

  const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
  const [phone, setPhone] = useState("+91 90000 12345"); // Seeded parent Sanjay Sharma
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoCodeNotice, setDemoCodeNotice] = useState<string | null>(null);

  // 60-second Resend Cooldown Timer
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) setError(errorParam);
  }, [searchParams]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (cooldown > 0) return;

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
      setCooldown(data.resendAfterSeconds || 60);
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
              <h1 className="font-bold text-sm tracking-tight text-ink">FeeFlow</h1>
              <p className="text-[10px] text-ink-3">Company A, Jaipur</p>
            </div>
          </div>
          <LanguageToggle />
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-panel bg-bad-t border border-bad/30 text-bad text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === "PHONE" ? (
          /* Step P0a: Mobile Number Entry */
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-ink">
                {language === "hi" ? "अभिभावक पोर्टल में प्रवेश करें" : "Sign in to Parent Portal"}
              </h2>
              <p className="text-xs text-ink-2">
                {language === "hi"
                  ? "शुल्क विवरण देखने हेतु अपना पंजीकृत मोबाइल नंबर दर्ज करें"
                  : "Enter your registered mobile number to receive a secure login code"}
              </p>
            </div>

            {/* Google OAuth Alternative for Parents */}
            <div>
              <a
                href="/api/auth/oauth/google?returnTo=/parent"
                className="w-full h-11 rounded-input border border-line-2 bg-surface hover:bg-paper text-ink font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
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
                <span>{language === "hi" ? "गूगल खाते से प्रवेश करें" : "Sign in with Google"}</span>
              </a>

              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-line" />
                </div>
                <span className="relative bg-paper px-2 text-[10px] font-bold text-ink-3 uppercase tracking-wider">
                  {language === "hi" ? "या मोबाइल ओटीपी" : "Or mobile OTP"}
                </span>
              </div>
            </div>

            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1.5">
                  {language === "hi" ? "मोबाइल नंबर" : "Mobile Number"}
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 flex items-center gap-1 text-ink-3 pointer-events-none">
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
                  className="px-2 py-1 rounded bg-teal text-white font-semibold text-[11px] hover:bg-teal-d transition-colors"
                >
                  {language === "hi" ? "स्वतः भरें" : "Autofill"}
                </button>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1.5">
                  {language === "hi" ? "6 अंकों का सुरक्षा कोड" : "6-digit Security Code"}
                </label>
                <div className="relative flex items-center">
                  <KeyRound className="w-4 h-4 text-ink-3 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="482913"
                    required
                    autoFocus
                    className="w-full h-[52px] pl-10 pr-4 rounded-input border border-line-2 bg-surface text-ink font-mono font-bold text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full h-[52px] rounded-input bg-teal hover:bg-teal-d text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                {loading ? (
                  <span>{language === "hi" ? "सत्यापित किया जा रहा है..." : "Verifying code..."}</span>
                ) : (
                  <>
                    <span>{language === "hi" ? "सत्यापित करें एवं आगे बढ़ें" : "Verify and Proceed"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Resend Cooldown Timer */}
            <div className="text-center pt-2">
              {cooldown > 0 ? (
                <div className="text-xs text-ink-3 flex items-center justify-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {language === "hi"
                      ? `${cooldown} सेकंड में नया कोड मांग सकते हैं`
                      : `Resend code in ${cooldown}s`}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendOtp()}
                  disabled={loading}
                  className="text-xs font-semibold text-teal hover:underline inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{language === "hi" ? "नया ओटीपी कोड भेजें" : "Resend OTP code"}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Security & DPDP Notice Footer */}
        <div className="mt-8 pt-4 border-t border-line text-center space-y-1 text-[11px] text-ink-3">
          <div className="flex items-center justify-center gap-1 text-ink-2 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-ok" />
            <span>Digital Personal Data Protection (DPDP) Act Compliant</span>
          </div>
          <p>
            {language === "hi"
              ? "आपका फोन नंबर केवल शुल्क अधिसूचनाओं एवं सुरक्षा सत्यापन हेतु उपयोग किया जाता है।"
              : "Your phone number is used strictly for fee notices and secure account verification."}
          </p>
        </div>
      </main>
    </div>
  );
}

export default function ParentLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper flex items-center justify-center text-xs text-ink-3">
          Loading Parent Sign In...
        </div>
      }
    >
      <ParentLoginContent />
    </Suspense>
  );
}
