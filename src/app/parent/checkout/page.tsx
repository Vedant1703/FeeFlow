"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DemoBar } from "@/components/shared/DemoBar";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  ArrowLeft,
  CreditCard,
  QrCode,
  Building,
} from "lucide-react";

export default function MockCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") || "order_demo_10oct";

  const [method, setMethod] = useState<"UPI" | "CARD" | "NETBANKING">("UPI");
  const [processing, setProcessing] = useState<string | null>(null);

  // Trigger simulated webhook
  const handleSimulatePayment = async (outcome: "SUCCEED" | "FAIL" | "PENDING") => {
    setProcessing(outcome);

    if (outcome === "PENDING") {
      // Stay pending: browser redirect without webhook capture
      setTimeout(() => {
        router.push(`/parent/payment-status?orderId=${orderId}&status=pending`);
      }, 600);
      return;
    }

    try {
      // Trigger signed webhook directly via simulation helper
      const eventType = outcome === "SUCCEED" ? "payment.captured" : "payment.failed";
      const payload = {
        eventId: `evt_${Date.now()}_mock`,
        eventType,
        orderId,
        providerPaymentId: `pay_${Date.now()}_mock`,
        amountPaise: "1500000", // ₹15,000
        currency: "INR",
        method,
        payerDetails: "Parent UPI / Sanjay Sharma",
        timestamp: new Date().toISOString(),
      };

      const rawBody = JSON.stringify(payload);

      // In client mode, compute client-side HMAC or call internal simulation API
      const res = await fetch("/api/webhooks/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Demo secret used in mock adapter
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

  // Simple client-side SHA256 simulation matching server default secret
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

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center">
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

        {/* Hosted Mock Checkout Card */}
        <div className="p-6 rounded-hero bg-surface border border-line shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal text-white flex items-center justify-center font-bold text-xs">
                PG
              </div>
              <div>
                <h1 className="font-bold text-sm text-ink tracking-tight">
                  Hosted Mock Payment Gateway
                </h1>
                <p className="text-[10px] text-ink-3">
                  Exercises real HMAC-SHA256 webhook verification
                </p>
              </div>
            </div>
            <ProvenanceChip kind="Design" detail="Mock adapter" />
          </div>

          {/* Transaction Summary */}
          <div className="p-4 rounded-panel bg-paper border border-line space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-3">Merchant:</span>
              <span className="font-semibold text-ink">Company A Institute, Jaipur</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-3">Order ID:</span>
              <span className="font-mono text-ink-2 font-medium text-[11px]">{orderId}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-3">Student:</span>
              <span className="font-semibold text-ink">Ishita Sharma (STU-0587)</span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-line pt-2">
              <span className="text-ink font-semibold">Payable Amount:</span>
              <span className="text-xl font-bold font-mono text-teal">₹15,000</span>
            </div>
          </div>

          {/* Payment Method Selector */}
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

          {/* Deterministic Simulation Actions */}
          <div className="space-y-2.5 pt-2">
            <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">
              Trigger Deterministic Gateway Outcomes:
            </div>

            {/* Outcome 1: Succeed */}
            <button
              type="button"
              disabled={!!processing}
              onClick={() => handleSimulatePayment("SUCCEED")}
              className="w-full h-12 rounded-input bg-ok hover:bg-ok/90 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>
                {processing === "SUCCEED" ? "Sending signed capture webhook..." : "Simulate Success (Capture ₹15,000)"}
              </span>
            </button>

            {/* Outcome 2: Fail */}
            <button
              type="button"
              disabled={!!processing}
              onClick={() => handleSimulatePayment("FAIL")}
              className="w-full h-11 rounded-input border border-bad/30 bg-bad-t hover:bg-bad-t/80 text-bad font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              <span>Simulate Gateway Failure</span>
            </button>

            {/* Outcome 3: Stay Pending */}
            <button
              type="button"
              disabled={!!processing}
              onClick={() => handleSimulatePayment("PENDING")}
              className="w-full h-11 rounded-input border border-info/30 bg-info-t hover:bg-info-t/80 text-info font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Clock className="w-4 h-4" />
              <span>Simulate Pending / Confirming State</span>
            </button>
          </div>

          <div className="text-[11px] text-ink-3 text-center pt-2 border-t border-line flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-ok" />
            <span>Strict Invariant: Redirect alone never marks payment paid</span>
          </div>
        </div>
      </main>
    </div>
  );
}
