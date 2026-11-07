import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Rail, RailSegment, railLabel } from "@/components/shared/Rail";
import { StatusChip } from "@/components/shared/StatusChip";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { DemoBar } from "@/components/shared/DemoBar";

describe("Component Unit Tests", () => {
  describe("Rail Component (Instalment Progress Bar)", () => {
    it("renders 4 instalment segments with correct filled states and accessible label", () => {
      const segs: RailSegment[] = [
        { state: "paid" },
        { state: "part", paidPct: 50, overdue: true },
        { state: "upcoming" },
        { state: "upcoming" },
      ];

      const label = railLabel(segs);
      expect(label).toBe(
        "Fee plan progress: Instalment 1: Paid; Instalment 2: Part paid (50%), Overdue; Instalment 3: Upcoming; Instalment 4: Upcoming"
      );

      const html = renderToString(<Rail segs={segs} tall={true} />);

      expect(html).toContain('role="img"');
      expect(html).toContain('aria-label="Fee plan progress: Instalment 1: Paid;');
      expect(html).toContain('--f:50%');
      expect(html).toContain("h-3");
    });

    it("handles 3 instalments for NEET course plan", () => {
      const segs: RailSegment[] = [
        { state: "upcoming" },
        { state: "upcoming" },
        { state: "upcoming" },
      ];

      const html = renderToString(<Rail segs={segs} />);
      expect(html).toContain('role="img"');
      expect(html).toContain("Instalment 3: Upcoming");
      expect(html).toContain("h-2");
    });
  });

  describe("StatusChip Component", () => {
    it("renders tone and vocabulary accurately with icon + text", () => {
      const htmlOk = renderToString(<StatusChip tone="ok" text="Paid" />);
      expect(htmlOk).toContain("Paid");
      expect(htmlOk).toContain("bg-ok-t");

      const htmlWarn = renderToString(<StatusChip tone="warn" text="Part paid" />);
      expect(htmlWarn).toContain("Part paid");
      expect(htmlWarn).toContain("bg-warn-t");

      const htmlBad = renderToString(<StatusChip tone="bad" text="Overdue" />);
      expect(htmlBad).toContain("Overdue");
      expect(htmlBad).toContain("bg-bad-t");

      const htmlSlate = renderToString(<StatusChip tone="slate" text="Upcoming" />);
      expect(htmlSlate).toContain("Upcoming");
      expect(htmlSlate).toContain("bg-slate-t");
    });
  });

  describe("ProvenanceChip Component", () => {
    it("renders all statutory provenance kinds required by UI reference", () => {
      const htmlSynthetic = renderToString(<ProvenanceChip kind="Synthetic data" />);
      expect(htmlSynthetic).toContain("Synthetic data");

      const htmlDesign = renderToString(<ProvenanceChip kind="Design" detail="Accounts Queue" />);
      expect(htmlDesign).toContain("Design");
      expect(htmlDesign).toContain("Accounts Queue");

      const htmlProvisional = renderToString(<ProvenanceChip kind="Provisional" />);
      expect(htmlProvisional).toContain("Provisional");

      const htmlAssumption = renderToString(<ProvenanceChip kind="Assumption" />);
      expect(htmlAssumption).toContain("Assumption");

      const htmlSource = renderToString(<ProvenanceChip kind="Source" />);
      expect(htmlSource).toContain("Source");

      const htmlRajasthan = renderToString(<ProvenanceChip kind="Rajasthan option" />);
      expect(htmlRajasthan).toContain("Rajasthan option");
    });
  });

  describe("DemoBar Component", () => {
    it("renders fixed demo clock 2 Nov 2026 and synthetic data indicator", () => {
      const html = renderToString(<DemoBar />);
      expect(html).toContain("FeeFlow Demo");
      expect(html).toContain("Demo clock: 2 Nov 2026");
      expect(html).toContain("Synthetic Data");
      expect(html).toContain("Company A, Jaipur · Problem 4");
    });
  });
});
