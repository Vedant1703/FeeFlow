import React from "react";
import { cn } from "@/lib/utils";

export type RailSegment = {
  state: "paid" | "part" | "upcoming";
  paidPct?: number;
  overdue?: boolean;
  label?: string;
};

export function railLabel(segs: RailSegment[]): string {
  const parts = segs.map((s, i) => {
    if (s.state === "paid") return `Instalment ${i + 1}: Paid`;
    if (s.state === "part") {
      return `Instalment ${i + 1}: Part paid (${s.paidPct ?? 0}%)${s.overdue ? ", Overdue" : ""}`;
    }
    return `Instalment ${i + 1}: Upcoming`;
  });
  return `Fee plan progress: ${parts.join("; ")}`;
}

export function Rail({
  segs,
  tall,
  className,
}: {
  segs: RailSegment[];
  tall?: boolean;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={railLabel(segs)}
      className={cn("flex gap-1 w-full rail", className)}
    >
      {segs.map((s, i) => (
        <i
          key={i}
          style={{ "--f": `${s.paidPct ?? 0}%` } as React.CSSProperties}
          className={cn(
            "block flex-1 rounded-[2px] transition-all",
            tall ? "h-3" : "h-2",
            s.state === "paid" && "bg-teal",
            s.state === "upcoming" && "border-[1.5px] border-line-2 bg-surface",
            s.state === "part" &&
              (s.overdue
                ? "bg-[linear-gradient(90deg,var(--teal)_var(--f),#F2C6C2_var(--f))]"
                : "bg-[linear-gradient(90deg,var(--teal)_var(--f),#F4DDAF_var(--f))]")
          )}
        />
      ))}
    </div>
  );
}

