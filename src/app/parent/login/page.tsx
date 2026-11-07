"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LanguageToggle, useLanguage } from "@/components/shared/LanguageToggle";
import { DemoBar } from "@/components/shared/DemoBar";
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Smartphone,
  KeyRound,
  AlertCircle,
  RotateCcw,
  UserPlus,
  LogIn,
  CheckCircle2,
  Mail,
  User,
  GraduationCap,
} from "lucide-react";

declare global {
  interface Window {
    initSendOTP?: (config: any) => void;
    sendOtp?: (
      identifier: string | any,
      success?: (data: any) => void,
      failure?: (err: any) => void
    ) => any;
    retryOtp?: (
      channel: any,
      success?: (data: any) => void,
      failure?: (err: any) => void,
      reqId?: string
    ) => any;
    verifyOtp?: (
      otp: string | any,
      success?: (data: any) => void,
      failure?: (err: any) => void,
      reqId?: string
    ) => any;
  }
}

function ParentLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();

  // Mode: "SIGN_IN" or "REGISTER"
  const [mode, setMode] = useState<"SIGN_IN" | "REGISTER">("SIGN_IN");

  // Step: "CREDENTIALS" or "OTP"
  const [step, setStep] = useState<"CREDENTIALS" | "OTP">("CREDENTIALS");

  // Form Fields
  const [phone, setPhone] = useState("+91 90000 12345"); // Default seeded parent Sanjay Sharma
  const [name, setName] = useState("");
  const [studentCode, setStudentCode] = useState("STU-0587");
  const [studentName, setStudentName] = useState("");
  const [relationship, setRelationship] = useState("Guardian");

  // OTP Verification
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // MSG91 Widget Challenge State
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [reqId, setReqId] = useState<string | null>(null);
  const [widgetStatus, setWidgetStatus] = useState<"disabled" | "loading" | "ready" | "failed">("loading");

  const widgetId = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID;
  const widgetToken = process.env.NEXT_PUBLIC_MSG91_WIDGET_TOKEN;
  const isWidgetConfigured = Boolean(widgetId && widgetToken);

  // Incoming SMS simulation state (used for Mock / Demo mode)
  const [receivedSms, setReceivedSms] = useState<{
    code: string;
    sender: string;
    timestamp: string;
    message: string;
  } | null>(null);

  // 60-second Resend Cooldown Timer
  const [cooldown, setCooldown] = useState(0);

  // Safely initialize the MSG91 Web SDK when credentials are configured
  useEffect(() => {
    if (!isWidgetConfigured) {
      setWidgetStatus("disabled");
      return;
    }

    if (typeof window !== "undefined" && window.initSendOTP) {
      setWidgetStatus("ready");
      return;
    }

    const scriptId = "msg91-otp-provider-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://verify.msg91.com/otp-provider.js";
      script.async = true;

      script.onload = () => {
        try {
          if (window.initSendOTP) {
            const configuration = {
              widgetId,
              tokenAuth: widgetToken,
              exposeMethods: true,
              success: () => {},
              failure: () => {},
            };
            window.initSendOTP(configuration);
            setWidgetStatus("ready");
          } else {
            setWidgetStatus("failed");
          }
        } catch {
          setWidgetStatus("failed");
        }
      };

      script.onerror = () => {
        setWidgetStatus("failed");
      };

      document.body.appendChild(script);
    } else {
      setWidgetStatus("ready");
    }
  }, [isWidgetConfigured, widgetId, widgetToken]);

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

  // Handle Requesting OTP (Existing Parent Sign-In)
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (cooldown > 0) return;

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (isWidgetConfigured) {
        if (widgetStatus === "failed") {
          throw new Error("MSG91 OTP Widget failed to load. Please verify your network connection or credentials.");
        }

        // 1. FeeFlow backend validates phone, intent, and enforces 60s cooldown & 3/10m rate limits
        const chalRes = await fetch("/api/auth/otp/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });

        const chalData = await chalRes.json();
        if (!chalRes.ok) {
          if (chalData.notRegistered) {
            setError(`${chalData.error} You can switch to the Register tab above to create an account.`);
            return;
          }
          throw new Error(chalData.error || "Failed to initiate OTP challenge");
        }

        const activeChallengeId = chalData.challengeId;
        const widgetPhone = chalData.widgetPhone; // Country code without '+' (e.g. 919829012345)
        setChallengeId(activeChallengeId);

        // 2. Trigger MSG91 sendOtp via Custom UI exposed method
        await new Promise<void>((resolve, reject) => {
          if (!window.sendOtp) {
            return reject(new Error("MSG91 sendOtp method is not available on window."));
          }

          window.sendOtp(
            widgetPhone,
            async (successData: any) => {
              try {
                // Extract provider request ID
                const extractedReqId =
                  successData?.reqId ||
                  successData?.request_id ||
                  successData?.message ||
                  (typeof successData === "string" ? successData : "");

                if (!extractedReqId) {
                  return reject(new Error("MSG91 did not return a valid provider request ID (reqId)."));
                }

                // 3. Register reqId against FeeFlow challenge
                const regRes = await fetch("/api/auth/otp/register-reqid", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    challengeId: activeChallengeId,
                    reqId: extractedReqId,
                  }),
                });

                const regData = await regRes.json();
                if (!regRes.ok) {
                  return reject(new Error(regData.error || "Failed to register provider request ID with FeeFlow"));
                }

                setReqId(extractedReqId);
                setCooldown(chalData.resendAfterSeconds || 60);
                setStep("OTP");
                setSuccessMsg("OTP code sent to your mobile via SMS. Please enter the code.");
                resolve();
              } catch (innerErr: any) {
                reject(innerErr);
              }
            },
            (failureData: any) => {
              const msg = failureData?.message || failureData?.error || "Failed to send OTP via MSG91";
              reject(new Error(typeof msg === "string" ? msg : JSON.stringify(msg)));
            }
          );
        });
      } else {
        // Fallback to Mock OTP flow (for local tests / demo)
        const res = await fetch("/api/auth/otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });

        const data = await res.json();
        if (!res.ok) {
          if (data.notRegistered) {
            setError(`${data.error} You can switch to the Register tab above to create an account.`);
            return;
          }
          throw new Error(data.error || "Failed to send OTP");
        }

        const generatedCode = data.code || data.demoCode || "482913";

        setReceivedSms({
          code: generatedCode,
          sender: "VK-FEEFLO (Jaipur Hub)",
          timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          message: `Your FeeFlow verification code is ${generatedCode}. Valid for 5 minutes. Do not share with anyone.`,
        });

        setCooldown(data.resendAfterSeconds || 60);
        setStep("OTP");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle New Parent Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/parent/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          studentCode,
          studentName: studentCode === "NEW" ? studentName.trim() : undefined,
          relationship,
          preferredLanguage: language,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      if (isWidgetConfigured) {
        // Create challenge for newly registered parent
        const chalRes = await fetch("/api/auth/otp/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, allowUnregistered: true }),
        });

        const chalData = await chalRes.json();
        if (!chalRes.ok) {
          throw new Error(chalData.error || "Account created, but failed to initiate OTP challenge.");
        }

        const activeChallengeId = chalData.challengeId;
        const widgetPhone = chalData.widgetPhone;
        setChallengeId(activeChallengeId);

        await new Promise<void>((resolve, reject) => {
          if (!window.sendOtp) {
            return reject(new Error("MSG91 sendOtp method is not available on window."));
          }

          window.sendOtp(
            widgetPhone,
            async (successData: any) => {
              try {
                const extractedReqId =
                  successData?.reqId ||
                  successData?.request_id ||
                  successData?.message ||
                  (typeof successData === "string" ? successData : "");

                if (!extractedReqId) {
                  return reject(new Error("MSG91 did not return a valid provider request ID (reqId)."));
                }

                const regRes = await fetch("/api/auth/otp/register-reqid", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    challengeId: activeChallengeId,
                    reqId: extractedReqId,
                  }),
                });

                const regData = await regRes.json();
                if (!regRes.ok) {
                  return reject(new Error(regData.error || "Failed to register provider request ID"));
                }

                setReqId(extractedReqId);
                setSuccessMsg("Account created! Verification OTP sent via SMS.");
                setCooldown(chalData.resendAfterSeconds || 60);
                setStep("OTP");
                resolve();
              } catch (innerErr: any) {
                reject(innerErr);
              }
            },
            (failureData: any) => {
              const msg = failureData?.message || failureData?.error || "Failed to send OTP via MSG91";
              reject(new Error(typeof msg === "string" ? msg : JSON.stringify(msg)));
            }
          );
        });
      } else {
        const generatedCode = data.code || data.demoCode || "482913";

        setReceivedSms({
          code: generatedCode,
          sender: "VK-FEEFLO (Registration)",
          timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          message: `Welcome to FeeFlow! Your registration verification code is ${generatedCode}. Valid for 5 minutes.`,
        });

        setSuccessMsg(data.message || "Registration successful! OTP sent.");
        setCooldown(data.resendAfterSeconds || 60);
        setStep("OTP");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP Verification & Session Issuance
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isWidgetConfigured && challengeId && reqId) {
        // MSG91 Web SDK Custom UI verify flow
        await new Promise<void>((resolve, reject) => {
          if (!window.verifyOtp) {
            return reject(new Error("MSG91 verifyOtp method not available on window."));
          }

          window.verifyOtp(
            otp.trim(),
            async (verifyData: any) => {
              try {
                const accessToken =
                  typeof verifyData === "string"
                    ? verifyData
                    : verifyData?.["access-token"] ||
                      verifyData?.accessToken ||
                      verifyData?.token ||
                      verifyData?.message;

                if (!accessToken || typeof accessToken !== "string") {
                  return reject(new Error("MSG91 verification did not return an access token."));
                }

                // Call FeeFlow backend to verify directly with MSG91 verifyAccessToken API
                const res = await fetch("/api/auth/otp/verify-widget", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    challengeId,
                    reqId,
                    accessToken,
                  }),
                });

                const data = await res.json();
                if (!res.ok) {
                  return reject(new Error(data.error || "Failed to verify access token with server"));
                }

                if (data.requiresConsent) {
                  router.push("/parent/consent");
                } else {
                  router.push("/parent");
                }
                resolve();
              } catch (innerErr: any) {
                reject(innerErr);
              }
            },
            (failureData: any) => {
              const msg = failureData?.message || failureData?.error || "Invalid OTP code entered.";
              reject(new Error(typeof msg === "string" ? msg : JSON.stringify(msg)));
            },
            reqId
          );
        });
      } else {
        // Mock OTP verification
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
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setError(null);
    setSuccessMsg(null);

    if (isWidgetConfigured && reqId && window.retryOtp) {
      setLoading(true);
      window.retryOtp(
        "11", // SMS channel
        () => {
          setLoading(false);
          setCooldown(60);
          setSuccessMsg("OTP resent via SMS.");
        },
        (failureData: any) => {
          setLoading(false);
          const msg = failureData?.message || failureData?.error || "Failed to resend OTP via MSG91";
          setError(typeof msg === "string" ? msg : JSON.stringify(msg));
        },
        reqId
      );
    } else {
      await handleSendOtp();
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
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-line">
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

        {/* Mode Indicator: MSG91 Widget vs Mock Mode */}
        <div className="mb-4 flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded bg-surface border border-line">
          <span className="text-ink-3">Auth Mode:</span>
          {isWidgetConfigured ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-teal">
              <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse"></span>
              MSG91 OTP Widget ({widgetStatus === "ready" ? "SDK Ready" : widgetStatus})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink-2">
              <span className="w-1.5 h-1.5 rounded-full bg-ink-3"></span>
              Mock Provider (Deterministic Demo)
            </span>
          )}
        </div>
        <div id="msg91-captcha-container"></div>

        {error && (
          <div className="mb-4 p-3 rounded-panel bg-bad-t border border-bad/30 text-bad text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
              {error.includes("not registered") && mode === "SIGN_IN" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("REGISTER");
                    setError(null);
                  }}
                  className="block mt-1 font-semibold text-teal underline"
                >
                  Click here to register with this phone number →
                </button>
              )}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-panel bg-ok/10 border border-ok/30 text-ok text-xs flex items-start gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {step === "CREDENTIALS" ? (
          <div className="space-y-6">
            {/* Mode Switcher Tabs: Sign In vs Register */}
            <div className="flex rounded-lg border border-line-2 bg-surface p-1 shadow-xs">
              <button
                type="button"
                onClick={() => {
                  setMode("SIGN_IN");
                  setError(null);
                }}
                className={`flex-1 py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  mode === "SIGN_IN"
                    ? "bg-teal text-white shadow-xs"
                    : "text-ink-2 hover:text-ink"
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{language === "hi" ? "लॉगिन करें" : "Sign In"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("REGISTER");
                  setError(null);
                }}
                className={`flex-1 py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  mode === "REGISTER"
                    ? "bg-teal text-white shadow-xs"
                    : "text-ink-2 hover:text-ink"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{language === "hi" ? "नया पंजीकरण" : "New Register"}</span>
              </button>
            </div>

            {mode === "SIGN_IN" ? (
              /* ================= SIGN IN TAB ================= */
              <div className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold tracking-tight text-ink">
                    {language === "hi" ? "अभिभावक पोर्टल में प्रवेश करें" : "Parent Portal Sign In"}
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
                      <span>{language === "hi" ? "ओटीपी भेजा जा रहा है..." : "Sending OTP..."}</span>
                    ) : (
                      <>
                        <span>{language === "hi" ? "ओटीपी कोड भेजें" : "Send OTP Code"}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Quick Seeded Demo Presets */}
                <div className="p-3.5 rounded-panel border border-dashed border-line-2 bg-surface/60 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                    <Sparkles className="w-3.5 h-3.5 text-teal" />
                    <span>Seeded Institute Parent Accounts:</span>
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
              /* ================= REGISTER TAB ================= */
              <div className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold tracking-tight text-ink">
                    {language === "hi" ? "अभिभावक खाता बनाएं" : "Register Parent Account"}
                  </h2>
                  <p className="text-xs text-ink-2">
                    {language === "hi"
                      ? "नया अभिभावक खाता जोड़ें और छात्र से लिंक करें"
                      : "Create your parent profile and link to your student to begin tracking fees"}
                  </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-ink-2 mb-1">
                      {language === "hi" ? "अभिभावक का पूरा नाम" : "Parent Full Name"}
                    </label>
                    <div className="relative flex items-center">
                      <User className="w-4 h-4 text-ink-3 absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar"
                        required
                        className="w-full h-11 pl-9 pr-3 rounded-input border border-line-2 bg-surface text-ink text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-2 mb-1">
                      {language === "hi" ? "मोबाइल नंबर (10 अंक)" : "Mobile Number (10 Digits)"}
                    </label>
                    <div className="relative flex items-center">
                      <Smartphone className="w-4 h-4 text-ink-3 absolute left-3 pointer-events-none" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98290 12345"
                        required
                        className="w-full h-11 pl-9 pr-3 rounded-input border border-line-2 bg-surface text-ink text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-2 mb-1">
                      {language === "hi" ? "छात्र लिंक करें" : "Link Student"}
                    </label>
                    <select
                      value={studentCode}
                      onChange={(e) => setStudentCode(e.target.value)}
                      className="w-full h-11 px-3 rounded-input border border-line-2 bg-surface text-ink text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal"
                    >
                      <option value="STU-0587">Ishita Sharma (STU-0587) - Vaishali Nagar</option>
                      <option value="STU-0412">Aarav Meena (STU-0412) - Malviya Nagar</option>
                      <option value="STU-0219">Mohit Gurjar (STU-0219) - Mansarovar</option>
                      <option value="STU-1038">Kavya Rathore (STU-1038) - Tonk Road</option>
                      <option value="NEW">+ Register a New Student</option>
                    </select>
                  </div>

                  {studentCode === "NEW" && (
                    <div className="animate-in fade-in">
                      <label className="block text-xs font-semibold text-ink-2 mb-1">
                        {language === "hi" ? "नए छात्र का नाम" : "New Student Name"}
                      </label>
                      <div className="relative flex items-center">
                        <GraduationCap className="w-4 h-4 text-ink-3 absolute left-3 pointer-events-none" />
                        <input
                          type="text"
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                          placeholder="e.g. Priyanshu Kumar"
                          required
                          className="w-full h-11 pl-9 pr-3 rounded-input border border-line-2 bg-surface text-ink text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-ink-2 mb-1">
                      {language === "hi" ? "संबंध" : "Relationship"}
                    </label>
                    <select
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                      className="w-full h-11 px-3 rounded-input border border-line-2 bg-surface text-ink text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal"
                    >
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Guardian">Guardian</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !phone || !name}
                    className="w-full h-[52px] mt-2 rounded-input bg-teal hover:bg-teal-d text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                  >
                    {loading ? (
                      <span>{language === "hi" ? "पंजीकरण हो रहा है..." : "Creating Account..."}</span>
                    ) : (
                      <>
                        <span>{language === "hi" ? "पंजीकरण करें एवं ओटीपी भेजें" : "Register & Send OTP"}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          /* ================= STEP 2: OTP VERIFICATION & SMS SIMULATOR ================= */
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-ink">
                {language === "hi" ? "6 अंकों का कोड दर्ज करें" : "Enter the 6-Digit Code"}
              </h2>
              <p className="text-xs text-ink-2">
                {language === "hi" ? "कोड भेजा गया: " : "Code sent to "}
                <span className="font-semibold text-ink">{phone}</span>
                <button
                  type="button"
                  onClick={() => setStep("CREDENTIALS")}
                  className="ml-2 text-teal underline font-medium"
                >
                  {language === "hi" ? "नंबर बदलें" : "Change"}
                </button>
              </p>
            </div>

            {/* Realistic Live SMS Delivery Simulator Card */}
            {receivedSms && (
              <div className="p-4 rounded-panel bg-surface border-2 border-teal/40 shadow-sm space-y-2.5 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between text-[11px] text-ink-3 pb-1 border-b border-line">
                  <div className="flex items-center gap-1.5 font-bold text-teal">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>SMS RECEIVED (VIRTUAL GATEWAY)</span>
                  </div>
                  <span>{receivedSms.timestamp}</span>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-ink-2">From: {receivedSms.sender}</div>
                  <p className="text-xs text-ink font-medium leading-relaxed bg-paper p-2 rounded border border-line">
                    {receivedSms.message}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-xs text-ink-2">
                    Code: <strong className="font-mono text-base text-teal font-extrabold">{receivedSms.code}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOtp(receivedSms.code)}
                    className="px-3 py-1.5 rounded bg-teal text-white font-semibold text-xs hover:bg-teal-d transition-colors flex items-center gap-1 shadow-xs"
                  >
                    <span>Auto-fill {receivedSms.code}</span>
                  </button>
                </div>
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
                    placeholder="e.g. 784920"
                    required
                    autoFocus
                    className="w-full h-[52px] pl-10 pr-4 rounded-input border border-line-2 bg-surface text-ink font-mono font-bold text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal transition-all text-center"
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
                  onClick={() => handleResendOtp()}
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
          Loading Parent Portal...
        </div>
      }
    >
      <ParentLoginContent />
    </Suspense>
  );
}
