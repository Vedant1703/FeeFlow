import { describe, it, expect } from "vitest";
import {
  scorePaymentCandidates,
  UnmatchedPaymentRecord,
  CandidateStudentProfile,
} from "../matching";

describe("Domain: matching.ts — Accounts Queue Unmatched Payment Scorer", () => {
  const candidateMohit: CandidateStudentProfile = {
    studentId: "stu-mohit",
    studentCode: "STU-0219",
    name: "Mohit Gurjar",
    centreName: "Mansarovar",
    parentPhone: "+91 90000 12342",
    activeInstalmentAmount: 4000000n, // ₹40,000
    outstandingBalance: 4000000n,
  };

  const candidateAarav: CandidateStudentProfile = {
    studentId: "stu-aarav",
    studentCode: "STU-0412",
    name: "Aarav Meena",
    centreName: "Malviya Nagar",
    parentPhone: "+91 90000 12341",
    activeInstalmentAmount: 3000000n,
    outstandingBalance: 0n,
  };

  const candidateIshita: CandidateStudentProfile = {
    studentId: "stu-ishita",
    studentCode: "STU-0587",
    name: "Ishita Sharma",
    centreName: "Vaishali Nagar",
    parentPhone: "+91 90000 12345",
    activeInstalmentAmount: 3000000n,
    outstandingBalance: 1500000n, // ₹15,000
  };

  const allCandidates = [candidateMohit, candidateAarav, candidateIshita];

  it("identifies top candidate based on student code and name in bank ref (pay_demo_a91c: 'MOHIT G 0219')", () => {
    const payment: UnmatchedPaymentRecord = {
      paymentId: "pay_demo_a91c",
      paymentReference: "NEFT-PUNB0123456",
      amount: 1500000n, // ₹15,000
      payerDetails: "MOHIT G 0219 / PUNB0123456",
      paymentDate: "2026-11-01",
    };

    const res = scorePaymentCandidates(payment, allCandidates);
    expect(res.candidates.length).toBeGreaterThan(0);

    const top = res.topCandidate;
    expect(top).not.toBeNull();
    expect(top?.studentCode).toBe("STU-0219");
    expect(top?.name).toBe("Mohit Gurjar");
    expect(top?.score).toBeGreaterThanOrEqual(0.60);
    expect(top?.recommendedAction).toBe("VERIFY_AND_ALLOCATE");
    expect(top?.matchReasons.some((r) => r.includes("0219"))).toBe(true);
    expect(top?.matchReasons.some((r) => r.includes("Mohit Gurjar"))).toBe(true);
  });

  it("scores candidates by exact amount match when name is ambiguous", () => {
    const payment: UnmatchedPaymentRecord = {
      paymentId: "pay-ambiguous",
      paymentReference: "UPI-UNKNOWN-99",
      amount: 1500000n, // ₹15,000 matches Ishita's exact outstanding
      payerDetails: "SHARMA UPI TRANSFER",
      paymentDate: "2026-11-02",
    };

    const res = scorePaymentCandidates(payment, allCandidates);
    const top = res.topCandidate;
    expect(top?.studentCode).toBe("STU-0587"); // Ishita Sharma matches both name token "SHARMA" and exact amount ₹15,000
    expect(top?.isExactAmountMatch).toBe(true);
  });

  it("returns low confidence for completely unmatched payer text", () => {
    const payment: UnmatchedPaymentRecord = {
      paymentId: "pay-no-match",
      paymentReference: "CASH-DEPOSIT",
      amount: 777000n, // random amount
      payerDetails: "UNKNOWN DEPOSITOR XYZ",
      paymentDate: "2026-11-02",
    };

    const res = scorePaymentCandidates(payment, allCandidates);
    expect(res.topCandidate).toBeNull();
    expect(res.candidates).toHaveLength(0);
  });
});

