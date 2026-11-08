"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { DemoBar } from "@/components/shared/DemoBar";
import { StatusChip } from "@/components/shared/StatusChip";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  CreditCard,
  QrCode,
  Building,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

interface IntentDetails {
  id?: string;
  orderId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  instalmentId?: string;
  amountPaise: string;
  amountRupees: number;
  currency: string;
  provider: "MOCK_GATEWAY" | "RAZORPAY";
  keyId?: string;
  status: string;
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") || "order_demo_10oct";

  const [intent, setIntent] = useState<IntentDetails | null>(null);
  const [actor, setActor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rzpLoaded, setRzpLoaded] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mock gateway states
  const [method, setMethod] = useState<"UPI" | "CARD" | "NETBANKING">("UPI");
  const [processing, setProcessing] = useState<string | null>(null);

  // Fetch intent details and actor on mount
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const [intentRes, actorRes] = await Promise.all([
          fetch(`/api/payments/intent?orderId=${orderId}`),
          fetch("/api/auth/me").catch(() => null),
        ]);

        if (intentRes.ok) {
          const data = await intentRes.json();
          if (isMounted) setIntent(data.intent);
        } else {
          // Fallback fixture if intent query fails in offline mode
          if (isMounted) {
            setIntent({
              orderId,
              studentId: "stu_ishita_0587",
              studentName: "Ishita Sharma",
              studentCode: "STU-0587",
              instalmentId: "inst_ishita_2",
              amountPaise: "1500000",
              amountRupees: 15000,
              currency: "INR",
              provider: "MOCK_GATEWAY",
              status: "CREATED",
            });
          }
        }

        if (actorRes && actorRes.ok) {
          const actorData = await actorRes.json();
          if (isMounted && actorData.actor) setActor(actorData.actor);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || "Failed to load checkout details");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  // Launch Razorpay Standard Checkout modal
  const handleLaunchRazorpay = () => {
    if (!intent) return;
    if (typeof window === "undefined" || !(window as any).Razorpay) {
      setErrorMessage("Razorpay Checkout SDK is still loading. Please try again.");
      return;
    }

    setIsPaying(true);
    setErrorMessage(null);

    try {
      const rzp = new (window as any).Razorpay({
        key: intent.keyId,
        amount: Number(intent.amountPaise),
        currency: intent.currency || "INR",
        name: "Company A Institute, Jaipur",
        description: `Fee Payment - ${intent.studentName} (${intent.studentCode})`,
        order_id: intent.orderId,
        prefill: {
          name: actor?.name || "Parent",
          contact: actor?.phone || "+918180082194",
        },
        theme: {
          color: "#005F60", // FeeFlow Teal
        },
        modal: {
          ondismiss: () => {
            setIsPaying(false);
          },
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            // Post-checkout signature verification (API)
            const verifyRes = await fetch("/api/payments/verify-checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
              throw new Error(verifyData.error || "Payment signature verification failed");
            }

            // Milestone 2 Boundary: redirect to payment confirmation pending screen
            router.push(`/parent/payment-status?orderId=${intent.orderId}&status=pending`);
          } catch (verErr: any) {
            setIsPaying(false);
            setErrorMessage(verErr.message || "Failed to verify payment signature");
          }
        },
      });

      rzp.on("payment.failed", (response: any) => {
        setIsPaying(false);
        const reason = response.error?.description || "Payment attempt declined";
        setErrorMessage(`Payment declined: ${reason}`);
      });

      rzp.open();
    } catch (err: any) {
      setIsPaying(false);
      setErrorMessage(err.message || "Failed to open Razorpay Checkout");
    }
  };

  // Mock payment gateway deterministic simulation
  const handleSimulateMockPayment = async (outcome: "SUCCEED" | "FAIL" | "PENDING") => {
    setProcessing(outcome);

    if (outcome === "PENDING") {
      setTimeout(() => {
        router.push(`/parent/payment-status?orderId=${orderId}&status=pending`);
      }, 600);
      return;
    }

    try {
      const eventType = outcome === "SUCCEED" ? "payment.captured" : "payment.failed";
      const payload = {
        eventId: `evt_${Date.now()}_mock`,
        eventType,
        orderId,
        providerPaymentId: `pay_${Date.now()}_mock`,
        amountPaise: intent?.amountPaise || "1500000",
        currency: "INR",
        method,
        payerDetails: `${actor?.name || "Parent"} UPI`,
        timestamp: new Date().toISOString(),
      };

      const rawBody = JSON.stringify(payload);

      const res = await fetch("/api/webhooks/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-feeflow-signature": await computeClientSignature(rawBody),
        },
        body: rawBody,
      });

      const data = await res.json();
      if (outcome === "SUCCEED") {
        router.push(
          `/parent/payment-status?orderId=${orderId}&status=succeeded&receipt=${data.receiptNumber || "REC-2026-DEMO"}`
        );
      } else {
        router.push(`/parent/payment-status?orderId=${orderId}&status=failed`);
      }
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
      setProcessing(null);
    }
  };

  async function computeClientSignature(str: string): Promise<string> {
    const secret = "feeflow_demo_webhook_hmac_secret_key_12345";
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, enc.encode(str));
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  const isRazorpay = intent?.provider === "RAZORPAY";

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center">
      {/* Razorpay Standard Checkout SDK */}
      {isRazorpay && (
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
          onLoad={() => setRzpLoaded(true)}
        />
      )}

      <DemoBar />

      <main className="w-full max-w-[420px] px-4 py-8 flex-1 flex flex-col justify-center">
        {/* Top return link */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => router.push("/parent")}
            className="inline-flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cancel and return to FeeFlow</span>
          </button>
        </div>

        {loading ? (
          <div className="p-8 rounded-hero bg-surface border border-line text-center text-xs text-ink-3">
            Loading order details...
          </div>
        ) : (
          <div className="p-6 rounded-hero bg-surface border border-line shadow-xs space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal text-white flex items-center justify-center font-bold text-xs">
                  {isRazorpay ? "RZP" : "PG"}
                </div>
                <div>
                  <h1 className="font-bold text-sm text-ink tracking-tight">
                    {isRazorpay ? "Razorpay Standard Checkout" : "Hosted Mock Payment Gateway"}
                  </h1>
                  <p className="text-[10px] text-ink-3">
                    {isRazorpay
                      ? "Razorpay Test Mode (Card / UPI / Netbanking)"
                      : "Exercises real HMAC-SHA256 webhook verification"}
                  </p>
                </div>
              </div>
              {isRazorpay ? (
                <StatusChip tone="info" text="Razorpay Test Mode" />
              ) : (
                <ProvenanceChip kind="Design" detail="Mock adapter" />
              )}
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div className="p-3 rounded-panel bg-bad-t text-bad text-xs flex items-start gap-2 border border-bad/30">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Payment Error</p>
                  <p className="text-[11px]">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Transaction Summary */}
            <div className="p-4 rounded-panel bg-paper border border-line space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-3">Merchant:</span>
                <span className="font-semibold text-ink">Company A Institute, Jaipur</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-3">Order ID:</span>
                <span className="font-mono text-ink-2 font-medium text-[11px]">
                  {intent?.orderId || orderId}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-3">Student:</span>
                <span className="font-semibold text-ink">
                  {intent?.studentName || "Ishita Sharma"} ({intent?.studentCode || "STU-0587"})
                </span>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-line pt-2">
                <span className="text-ink font-semibold">Payable Amount:</span>
                <span className="text-xl font-bold font-mono text-teal">
                  ₹{(intent?.amountRupees || 15000).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* =============================================================
                CASE 1: REAL RAZORPAY TEST MODE CHECKOUT
               ============================================================= */}
            {isRazorpay ? (
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  disabled={isPaying || !rzpLoaded}
                  onClick={handleLaunchRazorpay}
                  className="w-full h-12 rounded-input bg-teal hover:bg-teal-d text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {isPaying
                      ? "Awaiting Checkout..."
                      : !rzpLoaded
                      ? "Loading Gateway SDK..."
                      : `Pay ₹${(intent?.amountRupees || 15000).toLocaleString("en-IN")} with Razorpay`}
                  </span>
                </button>

                {errorMessage && (
                  <button
                    type="button"
                    onClick={handleLaunchRazorpay}
                    className="w-full h-10 rounded-input border border-line hover:border-teal text-ink font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Checkout</span>
                  </button>
                )}
              </div>
            ) : (
              /* =============================================================
                  CASE 2: MOCK GATEWAY SIMULATOR
                 ============================================================= */
              <div className="space-y-4">
                {/* Method selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-ink-2">
                    Select Mock Payment Method:
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setMethod("UPI")}
                      className={`p-2.5 rounded-panel border flex flex-col items-center gap-1.5 transition-all ${
                        method === "UPI"
                          ? "border-teal bg-teal-t/20 font-bold text-teal"
                          : "border-line bg-surface hover:bg-paper text-ink-2"
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>UPI / QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod("CARD")}
                      className={`p-2.5 rounded-panel border flex flex-col items-center gap-1.5 transition-all ${
                        method === "CARD"
                          ? "border-teal bg-teal-t/20 font-bold text-teal"
                          : "border-line bg-surface hover:bg-paper text-ink-2"
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>RuPay / Card</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod("NETBANKING")}
                      className={`p-2.5 rounded-panel border flex flex-col items-center gap-1.5 transition-all ${
                        method === "NETBANKING"
                          ? "border-teal bg-teal-t/20 font-bold text-teal"
                          : "border-line bg-surface hover:bg-paper text-ink-2"
                      }`}
                    >
                      <Building className="w-4 h-4" />
                      <span>Netbanking</span>
                    </button>
                  </div>
                </div>

                {/* Simulation actions */}
                <div className="space-y-2.5 pt-2">
                  <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">
                    Trigger Deterministic Gateway Outcomes:
                  </div>

                  <button
                    type="button"
                    disabled={!!processing}
                    onClick={() => handleSimulateMockPayment("SUCCEED")}
                    className="w-full h-12 rounded-input bg-ok hover:bg-ok/90 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>
                      {processing === "SUCCEED"
                        ? "Sending signed capture webhook..."
                        : `Simulate Success (Capture ₹${(intent?.amountRupees || 15000).toLocaleString("en-IN")})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={!!processing}
                    onClick={() => handleSimulateMockPayment("FAIL")}
                    className="w-full h-11 rounded-input border border-bad/30 bg-bad-t hover:bg-bad-t/80 text-bad font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Simulate Gateway Failure</span>
                  </button>

                  <button
                    type="button"
                    disabled={!!processing}
                    onClick={() => handleSimulateMockPayment("PENDING")}
                    className="w-full h-11 rounded-input border border-info/30 bg-info-t hover:bg-info-t/80 text-info font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Simulate Pending / Confirming State</span>
                  </button>
                </div>
              </div>
            )}

            {/* Zero Client-Trust Guard */}
            <div className="text-[11px] text-ink-3 text-center pt-2 border-t border-line flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-ok" />
              <span>Strict Invariant: Redirect alone never marks payment paid</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper flex items-center justify-center text-xs text-ink-3">
          Loading checkout...
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
