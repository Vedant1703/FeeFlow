"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "hi";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    app_title: "FeeFlow",
    amount_due: "Amount due now",
    due_today: "Due today",
    due_in_days: "Due in {n} days",
    overdue_days: "Overdue by {n} days",
    paid_status: "Paid",
    part_paid_status: "Part paid",
    upcoming_status: "Upcoming",
    pay_action: "Pay",
    pay_full: "Pay {amount}",
    pay_other: "Pay a different amount",
    child_switcher: "Switch child",
    all_instalments: "All instalments",
    recent_receipts: "Recent receipts",
    tab_fees: "Fees",
    tab_receipts: "Receipts",
    tab_attendance: "Attendance",
    tab_tests: "Tests",
    policy_link: "Refund policy",
    all_paid_celebration: "All fees paid for this academic year",
    withdrawn_notice: "Student has withdrawn from course",
    confirming_payment: "Confirming payment with bank...",
    payment_successful: "Payment successful",
    download_receipt: "Download GST Receipt",
    logout: "Log out",
  },
  hi: {
    app_title: "फीफ्लो",
    amount_due: "अभी देय राशि",
    due_today: "आज ही देय है",
    due_in_days: "{n} दिन में देय",
    overdue_days: "{n} दिन से बकाया",
    paid_status: "जमा",
    part_paid_status: "आंशिक जमा",
    upcoming_status: "आगामी",
    pay_action: "भुगतान करें",
    pay_full: "{amount} का भुगतान करें",
    pay_other: "कोई अन्य राशि भरें",
    child_switcher: "बच्चा बदलें",
    all_instalments: "सभी किस्तें",
    recent_receipts: "हाल की रसीदें",
    tab_fees: "फीस",
    tab_receipts: "रसीदें",
    tab_attendance: "उपस्थिति",
    tab_tests: "परीक्षा",
    policy_link: "रिफंड नीति",
    all_paid_celebration: "इस शैक्षणिक वर्ष की सभी फीस जमा हो चुकी है",
    withdrawn_notice: "विद्यार्थी ने पाठ्यक्रम से नाम वापस ले लिया है",
    confirming_payment: "बैंक से भुगतान की पुष्टि हो रही है...",
    payment_successful: "भुगतान सफल रहा",
    download_receipt: "जीएसटी रसीद डाउनलोड करें",
    logout: "लॉग आउट",
  },
};

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("feeflow_lang") as Language;
    if (saved === "en" || saved === "hi") {
      setLanguageState(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("feeflow_lang", lang);
    document.documentElement.lang = lang;
  };

  const t = (key: string): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language selection"
      className={`inline-flex items-center rounded-full border border-line-2 bg-surface p-0.5 text-xs font-semibold ${className || ""}`}
    >
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`px-2 py-0.5 rounded-full transition-colors ${
          language === "en"
            ? "bg-teal text-white shadow-xs"
            : "text-ink-2 hover:text-ink"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage("hi")}
        className={`px-2 py-0.5 rounded-full transition-colors ${
          language === "hi"
            ? "bg-teal text-white shadow-xs"
            : "text-ink-2 hover:text-ink"
        }`}
      >
        हिं
      </button>
    </div>
  );
}
