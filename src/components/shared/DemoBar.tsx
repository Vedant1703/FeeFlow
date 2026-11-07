import React from "react";
import { Sparkles, Clock } from "lucide-react";

export function DemoBar({ className }: { className?: string }) {
  return (
    <div
      className={`w-full bg-surface border-b border-line-2 px-3 py-1.5 text-xs text-ink-2 flex items-center justify-between z-50 ${className || ""}`}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 font-semibold text-teal">
          <Sparkles className="w-3.5 h-3.5" />
          <span>FeeFlow Demo</span>
        </span>
        <span className="hidden sm:inline text-line-2">|</span>
        <span className="hidden sm:inline text-ink-3">
          Company A, Jaipur · Problem 4
        </span>
      </div>

      <div className="flex items-center gap-3 text-[11px]">
        <span className="inline-flex items-center gap-1 text-slate font-medium bg-slate-t px-2 py-0.5 rounded-full border border-slate/30">
          <Clock className="w-3 h-3 text-slate" />
          <span>Demo clock: 2 Nov 2026</span>
        </span>
        <span className="text-ink-3 hidden md:inline">Synthetic Data</span>
      </div>
    </div>
  );
}
