"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DemoBar } from "@/components/shared/DemoBar";
import { LanguageToggle, useLanguage } from "@/components/shared/LanguageToggle";
import { Shield, Check, AlertCircle, ArrowRight, Lock } from "lucide-react";

export default function ParentConsentPage() {
  const router = useRouter();
  const { language } = useLanguage();

  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check session info
    fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+91 90000 12345", code: "482913" }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.students && data.students.length > 0) {
          setStudents(data.students);
          setSelectedStudentId(data.students[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleGrantConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      setError("Please check the affirmative consent box to proceed.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/parent/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId || (students[0]?.id ?? ""),
          noticeVersion: "v1.0",
          language,
          affirmativeConsent: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record consent");
      }

      router.push("/parent");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const studentName = students.find((s) => s.id === selectedStudentId)?.name || "your child";

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center">
      <DemoBar />

      <main className="w-full max-w-sm px-4 py-8 flex-1 flex flex-col justify-center">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-teal" />
            <span className="font-bold text-ink text-sm">Parental Privacy Gate</span>
          </div>
          <LanguageToggle />
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-panel bg-bad-t border border-bad/30 text-bad text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-5 rounded-panel bg-surface border border-line shadow-xs space-y-5">
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-teal bg-teal-t px-2 py-0.5 rounded-full border border-teal/20">
              DPDP Act 2023 · Verifiable Consent
            </span>
            <h1 className="text-lg font-bold text-ink tracking-tight">
              {language === "hi"
                ? `कंपनी ए इंस्टीट्यूट को ${studentName} के रिकॉर्ड्स दिखाने की अनुमति दें?`
                : `Allow Company A Institute to show you ${studentName}'s records?`}
            </h1>
            <p className="text-xs text-ink-2 leading-relaxed">
              {language === "hi"
                ? "डिजिटल पर्सनल डेटा प्रोटेक्शन एक्ट 2023 के तहत, किसी नाबालिग विद्यार्थी के शैक्षणिक व वित्तीय रिकॉर्ड्स देखने से पहले अभिभावक की स्पष्ट सहमति आवश्यक है।"
                : "Under the Digital Personal Data Protection Act 2023, access to records of a minor student requires verifiable guardian consent."}
            </p>
          </div>

          {/* Purposes list */}
          <div className="space-y-2 text-xs bg-paper p-3 rounded-input border border-line">
            <div className="font-semibold text-ink text-[11px] uppercase tracking-wider text-ink-3">
              {language === "hi" ? "सहमति के उद्देश्य:" : "Purposes of data processing:"}
            </div>
            <ul className="space-y-1.5 text-ink-2">
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-ok shrink-0 mt-0.5" />
                <span>
                  {language === "hi"
                    ? "किस्त योजना, देय राशि और रसीदें देखना व भुगतान करना"
                    : "View instalment plan, current dues, official receipts & pay online"}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-ok shrink-0 mt-0.5" />
                <span>
                  {language === "hi"
                    ? "समय पर व्हाट्सएप अथवा एसएमएस पर बकाया सूचना प्राप्त करना"
                    : "Receive timely fee notices via WhatsApp / SMS"}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-ok shrink-0 mt-0.5" />
                <span>
                  {language === "hi"
                    ? "उपस्थिति व परीक्षण प्रगति रिपोर्ट देखना"
                    : "View academic attendance and test progress"}
                </span>
              </li>
            </ul>
          </div>

          <form onSubmit={handleGrantConsent} className="space-y-4">
            {/* Hard rule: Non-preselected checkbox */}
            <label className="flex items-start gap-2.5 p-3 rounded-input border border-line-2 bg-surface hover:bg-paper cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-teal border-line-2 rounded focus:ring-teal"
              />
              <span className="text-xs text-ink leading-snug font-medium">
                {language === "hi"
                  ? `मैं पुष्टि करता/करती हूँ कि मैं ${studentName} का अभिभावक हूँ और रिकॉर्ड्स देखने की सहमति देता/देती हूँ।`
                  : `I confirm that I am the parent/guardian of ${studentName} and consent to access their student records.`}
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !agreed}
              className="w-full h-[50px] rounded-input bg-teal hover:bg-teal-d text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-40"
            >
              {loading ? (
                <span>{language === "hi" ? "सहमति दर्ज हो रही है..." : "Recording consent..."}</span>
              ) : (
                <>
                  <span>
                    {language === "hi" ? "सहमति दें और पोर्टल खोलें" : "Grant Consent & Open Portal"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-[11px] text-ink-3 text-center border-t border-line pt-3 flex items-center justify-center gap-1">
            <Lock className="w-3 h-3 text-ink-3" />
            <span>Notice Version: v1.0 · Single-use verifiable grant</span>
          </div>
        </div>
      </main>
    </div>
  );
}
