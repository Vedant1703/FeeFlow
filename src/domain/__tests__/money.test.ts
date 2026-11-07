import { describe, it, expect } from "vitest";
import { formatINR, roundHalfUp, rupeesToPaise, paiseToRupees } from "../money";
import { DemoClock, inclusiveCalendarDays, calculateDaysOverdue } from "../clock";

describe("Domain: money.ts", () => {
  it("converts rupees to paise and vice versa", () => {
    expect(rupeesToPaise(30000)).toBe(3000000n);
    expect(rupeesToPaise("30000")).toBe(3000000n);
    expect(rupeesToPaise("1,20,000")).toBe(12000000n);
    expect(rupeesToPaise("66082.19")).toBe(6608219n);
    expect(paiseToRupees(3000000n)).toBe(30000);
  });

  it("formats integer paise to standard en-IN currency string", () => {
    expect(formatINR(3000000n)).toBe("₹30,000");
    expect(formatINR(12000000n)).toBe("₹1,20,000");
    expect(formatINR(6608219n)).toBe("₹66,082.19");
    expect(formatINR(0n)).toBe("₹0");
    expect(formatINR(-1500000n)).toBe("-₹15,000");
  });

  it("calculates roundHalfUp accurately", () => {
    // 1,20,000 * 73 / 365 = 24,000.00
    const earnedF1 = roundHalfUp(12000000n * 73n, 365n);
    expect(earnedF1).toBe(2400000n);

    // 1,20,000 * 201 / 365 = 66,082.19178... -> 66,082.19 (6608219n paise)
    const earnedF2 = roundHalfUp(12000000n * 201n, 365n);
    expect(earnedF2).toBe(6608219n);

    // 1,20,000 * 144 / 290 = 59,586.20689... -> 59,586.21 (5958621n paise) [U1 fixture]
    const earnedU1 = roundHalfUp(12000000n * 144n, 290n);
    expect(earnedU1).toBe(5958621n);

    // 1,20,000 * 136 / 290 = 56,275.86206... -> 56,275.86 (5627586n paise) [U2 fixture]
    const earnedU2 = roundHalfUp(12000000n * 136n, 290n);
    expect(earnedU2).toBe(5627586n);
  });
});

describe("Domain: clock.ts", () => {
  it("defaults to 2026-11-02 in demo mode", () => {
    const clock = new DemoClock();
    expect(clock.businessDate()).toBe("2026-11-02");
  });

  it("calculates inclusive calendar days", () => {
    // 15 Jun 2026 to 31 Mar 2027 inclusive is 290 days
    const days = inclusiveCalendarDays("2026-06-15", "2027-03-31");
    expect(days).toBe(290);

    // 1 Apr 2026 to 31 Mar 2027 inclusive is 365 days
    const daysFullYear = inclusiveCalendarDays("2026-04-01", "2027-03-31");
    expect(daysFullYear).toBe(365);

    // 15 Jun 2026 to 5 Nov 2026 inclusive is 144 days (U1 Ishita)
    const consumedU1 = inclusiveCalendarDays("2026-06-15", "2026-11-05");
    expect(consumedU1).toBe(144);

    // 15 Jun 2026 to 28 Oct 2026 inclusive is 136 days (U2 Kavya)
    const consumedU2 = inclusiveCalendarDays("2026-06-15", "2026-10-28");
    expect(consumedU2).toBe(136);
  });

  it("calculates days overdue correctly from 2026-11-02", () => {
    // Ishita due 2026-10-10 -> 23 days overdue on 2026-11-02
    const overdueIshita = calculateDaysOverdue("2026-11-02", "2026-10-10");
    expect(overdueIshita).toBe(23);

    // Mohit due 2026-11-15 -> 0 days overdue (due in 13 days)
    const overdueMohit = calculateDaysOverdue("2026-11-02", "2026-11-15");
    expect(overdueMohit).toBe(0);
  });
});

