import React from "react";
import { cn } from "@/lib/utils";
import { ShieldCheck, HelpCircle, FileText, Sparkles, AlertCircle } from "lucide-react";

export type ProvenanceKind =
  | "Assumption"
  | "Design"
  | "Source"
  | "Provisional"
  | "Synthetic data"
  | "Rajasthan option";

interface ProvenanceChipProps {
  kind: ProvenanceKind;
  detail?: string;
  className?: string;
}

export function ProvenanceChip({ kind, detail, className }: ProvenanceChipProps) {
  let toneClass = "bg-slate-t text-slate border-slate/30";
  let Icon = HelpCircle;

  switch (kind) {
    case "Source":
      toneClass = "bg-teal-t text-teal-d border-teal/30";
      Icon = FileText;
      break;
    case "Synthetic data":
      toneClass = "bg-slate-t text-slate border-dashed border-slate/40";
      Icon = Sparkles;
      break;
    case "Provisional":
      toneClass = "bg-warn-t text-warn border-warn/30";
      Icon = AlertCircle;
      break;
    case "Assumption":
      toneClass = "bg-warn-t text-warn border-warn/30";
      Icon = HelpCircle;
      break;
    case "Design":
      toneClass = "bg-slate-t text-slate border-slate/30";
      Icon = ShieldCheck;
      break;
    case "Rajasthan option":
      toneClass = "bg-info-t text-info border-info/30";
      Icon = FileText;
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium tracking-tight",
        toneClass,
        className
      )}
      title={detail}
    >
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>{detail ? `${kind}: ${detail}` : kind}</span>
    </span>
  );
}

