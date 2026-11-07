"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/shared/LanguageToggle";
import { Home, Receipt, GraduationCap, ShieldCheck } from "lucide-react";

export type ParentNavTab = "FEES" | "RECEIPTS" | "ATTENDANCE" | "TESTS" | "POLICY";

interface ParentBottomNavProps {
  activeTab?: ParentNavTab;
  onTabChange?: (tab: "FEES" | "RECEIPTS" | "ATTENDANCE" | "TESTS") => void;
}

export function ParentBottomNav({ activeTab = "FEES", onTabChange }: ParentBottomNavProps) {
  let pathname = "/parent";
  try {
    pathname = usePathname() || "/parent";
  } catch {
    pathname = "/parent";
  }
  const { language } = useLanguage();

  const isPolicyPage = pathname === "/parent/refund-policy";
  const isReceiptDetailPage = pathname.startsWith("/parent/receipts/");
  const isParentHome = pathname === "/parent";

  const handleNavClick = (
    destination: "FEES" | "RECEIPTS" | "ATTENDANCE" | "POLICY",
    e: React.MouseEvent
  ) => {
    if (destination === "POLICY") {
      // Navigate to policy page
      return;
    }

    if (isParentHome && onTabChange) {
      e.preventDefault();
      onTabChange(destination);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (!isParentHome) {
      // Let standard Link navigate back to /parent?tab=...
    }
  };

  const navItems = [
    {
      id: "FEES" as const,
      labelEn: "Fees",
      labelHi: "शुल्क",
      icon: Home,
      href: "/parent?tab=FEES",
      isActive: activeTab === "FEES" && !isPolicyPage && !isReceiptDetailPage,
    },
    {
      id: "RECEIPTS" as const,
      labelEn: "Receipts",
      labelHi: "रसीदें",
      icon: Receipt,
      href: isReceiptDetailPage ? pathname : "/parent?tab=RECEIPTS",
      isActive: isReceiptDetailPage || activeTab === "RECEIPTS",
    },
    {
      id: "ATTENDANCE" as const,
      labelEn: "Academics",
      labelHi: "शिक्षा",
      icon: GraduationCap,
      href: "/parent?tab=ATTENDANCE",
      isActive: activeTab === "ATTENDANCE" || activeTab === "TESTS",
    },
    {
      id: "POLICY" as const,
      labelEn: "Policy",
      labelHi: "नीति",
      icon: ShieldCheck,
      href: "/parent/refund-policy",
      isActive: isPolicyPage || activeTab === "POLICY",
    },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Parent Portal Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-line shadow-lg"
    >
      <div className="max-w-[420px] mx-auto h-16 px-2 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const label = language === "hi" ? item.labelHi : item.labelEn;

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={(e) => handleNavClick(item.id, e)}
              className={`flex-1 h-12 flex flex-col items-center justify-center gap-1 rounded-panel transition-all duration-150 ${
                item.isActive
                  ? "text-teal font-bold"
                  : "text-ink-3 hover:text-ink hover:bg-paper/50"
              }`}
              aria-current={item.isActive ? "page" : undefined}
            >
              <div
                className={`p-1 rounded-full transition-colors ${
                  item.isActive ? "bg-teal-t" : "bg-transparent"
                }`}
              >
                <Icon className={`w-4 h-4 ${item.isActive ? "text-teal" : "text-ink-3"}`} />
              </div>
              <span className="text-[11px] tracking-tight leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
