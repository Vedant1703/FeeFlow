"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  BellRing,
  UserX,
  ShieldAlert,
  History,
  LogOut,
  Building2,
  Clock,
  Sparkles,
} from "lucide-react";

export interface StaffNavProps {
  currentRole?: "ACCOUNTS" | "COUNSELLOR" | "DIRECTOR";
  userName?: string;
  userEmail?: string;
}

export function StaffNav({
  currentRole = "ACCOUNTS",
  userName = "Neha Verma",
  userEmail = "neha.verma@demo.companya.test",
}: StaffNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/staff/login");
  };

  const navItems = [
    {
      label: "Dashboard",
      href: "/staff",
      icon: LayoutDashboard,
      roles: ["ACCOUNTS", "DIRECTOR"],
    },
    {
      label: "Payments & Queue",
      href: "/staff/payments",
      icon: Receipt,
      roles: ["ACCOUNTS", "DIRECTOR"],
    },
    {
      label: "Reminder Centre",
      href: "/staff/reminders",
      icon: BellRing,
      roles: ["ACCOUNTS", "DIRECTOR"],
    },
    {
      label: "Withdrawals & Refunds",
      href: "/staff/withdrawals",
      icon: UserX,
      roles: ["ACCOUNTS", "DIRECTOR"],
    },
    {
      label: "Risk Review",
      href: "/staff/risk",
      icon: ShieldAlert,
      roles: ["COUNSELLOR", "DIRECTOR"],
    },
    {
      label: "Audit & Policy",
      href: "/staff/audit",
      icon: History,
      roles: ["DIRECTOR"],
    },
  ];

  return (
    <aside className="w-64 bg-surface border-r border-line flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal text-white font-bold flex items-center justify-center text-sm shadow-xs">
            FF
          </div>
          <div>
            <div className="font-bold text-ink text-base tracking-tight">FeeFlow</div>
            <div className="text-[11px] text-ink-3">Staff Operations</div>
          </div>
        </div>
      </div>

      {/* User Scope & Role Card */}
      <div className="p-4 border-b border-line bg-paper/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-xs text-ink">{userName}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-t text-teal uppercase tracking-wider">
            {currentRole}
          </span>
        </div>
        <div className="text-[11px] text-ink-3 truncate">{userEmail}</div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate font-medium pt-1">
          <Building2 className="w-3 h-3 text-slate" />
          <span>
            {currentRole === "DIRECTOR"
              ? "All 4 Jaipur Centres Scope"
              : currentRole === "ACCOUNTS"
              ? "Vaishali Nagar & Malviya Nagar"
              : "Vaishali Nagar Risk Scope"}
          </span>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="p-3 space-y-1 flex-1">
        {navItems
          .filter((item) => item.roles.includes(currentRole))
          .map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/staff"
                ? pathname === "/staff"
                : pathname?.startsWith(item.href);

            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-input text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-teal-t text-teal-d"
                    : "text-ink-2 hover:text-ink hover:bg-paper"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-teal" : "text-ink-3"}`} />
                <span>{item.label}</span>
              </a>
            );
          })}
      </nav>

      {/* Footer & Demo Info */}
      <div className="p-4 border-t border-line space-y-3">
        <div className="p-2.5 rounded-panel bg-paper border border-line-2 text-[11px] text-ink-3 space-y-1">
          <div className="font-semibold text-ink flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-teal" />
            <span>Clock: 2 Nov 2026</span>
          </div>
          <div>Company A, Jaipur · Problem 4</div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 p-2 rounded-input border border-line hover:border-bad/40 text-bad hover:bg-bad-t/20 text-xs font-semibold transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
