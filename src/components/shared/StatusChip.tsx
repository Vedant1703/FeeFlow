import React from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  Clock,
  AlertTriangle,
  X,
  Info,
  Flag,
  Calendar,
  Ban,
  LucideIcon,
} from "lucide-react";

export type ChipTone = "ok" | "warn" | "bad" | "info" | "slate" | "teal";

export interface StatusChipProps {
  tone: ChipTone;
  text: string;
  icon?: LucideIcon;
  iconName?: "check" | "clock" | "warning" | "x" | "info" | "flag" | "calendar" | "ban";
  className?: string;
  size?: "sm" | "md";
}

const toneStyles: Record<ChipTone, { bg: string; text: string; border: string }> = {
  ok: { bg: "bg-ok-t", text: "text-ok", border: "border-ok/30" },
  warn: { bg: "bg-warn-t", text: "text-warn", border: "border-warn/30" },
  bad: { bg: "bg-bad-t", text: "text-bad", border: "border-bad/30" },
  info: { bg: "bg-info-t", text: "text-info", border: "border-info/30" },
  slate: { bg: "bg-slate-t", text: "text-slate", border: "border-slate/30" },
  teal: { bg: "bg-teal-t", text: "text-teal-d", border: "border-teal/30" },
};

export function StatusChip({
  tone,
  text,
  icon: CustomIcon,
  iconName,
  className,
  size = "sm",
}: StatusChipProps) {
  let IconToRender: LucideIcon | null = CustomIcon || null;

  if (!IconToRender && iconName) {
    switch (iconName) {
      case "check":
        IconToRender = Check;
        break;
      case "clock":
        IconToRender = Clock;
        break;
      case "warning":
        IconToRender = AlertTriangle;
        break;
      case "x":
        IconToRender = X;
        break;
      case "info":
        IconToRender = Info;
        break;
      case "flag":
        IconToRender = Flag;
        break;
      case "calendar":
        IconToRender = Calendar;
        break;
      case "ban":
        IconToRender = Ban;
        break;
    }
  }

  // Default fallback icon based on tone to ensure icon + text invariant
  if (!IconToRender) {
    switch (tone) {
      case "ok":
        IconToRender = Check;
        break;
      case "warn":
        IconToRender = Clock;
        break;
      case "bad":
        IconToRender = AlertTriangle;
        break;
      case "info":
        IconToRender = Info;
        break;
      case "slate":
        IconToRender = Calendar;
        break;
      case "teal":
        IconToRender = Check;
        break;
    }
  }

  const styles = toneStyles[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        styles.bg,
        styles.text,
        styles.border,
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className
      )}
    >
      {IconToRender && (
        <IconToRender
          className={cn(size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4", "shrink-0")}
          aria-hidden="true"
        />
      )}
      <span>{text}</span>
    </span>
  );
}

