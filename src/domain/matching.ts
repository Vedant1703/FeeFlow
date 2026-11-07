/**
 * Pure domain payment matching engine for FeeFlow.
 * Aligned with SRS v2.2 (§4.3) and Wireframe S3.
 *
 * Hard Invariant:
 * Captures with unknown order IDs or unallocated amounts route to the Accounts Queue (S3).
 * The matching engine scores candidates and suggests matches with explainable reasons.
 * A match suggestion is NEVER auto-allocated.
 * It requires human review and an explicit allocation reason.
 */

export interface UnmatchedPaymentRecord {
  paymentId: string;
  paymentReference: string;
  amount: bigint; // Integer paise
  payerDetails?: string | null;
  paymentDate: Date | string;
}

export interface CandidateStudentProfile {
  studentId: string;
  studentCode: string; // e.g. "STU-0219"
  name: string; // e.g. "Mohit Gurjar"
  centreName: string;
  parentPhone?: string | null;
  activeInstalmentAmount: bigint;
  outstandingBalance: bigint;
}

export interface MatchCandidateResult {
  studentId: string;
  studentCode: string;
  name: string;
  centreName: string;
  score: number; // 0.0 to 1.0
  matchReasons: string[];
  isExactAmountMatch: boolean;
  recommendedAction: "VERIFY_AND_ALLOCATE" | "LOW_CONFIDENCE";
}

export interface MatchingEvaluationResult {
  paymentId: string;
  paymentReference: string;
  amount: bigint;
  candidates: MatchCandidateResult[];
  topCandidate: MatchCandidateResult | null;
}

/**
 * Normalizes text for comparison by removing punctuation and converting to uppercase.
 */
function normalizeText(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Evaluates candidate student matches for an unallocated/unmatched payment capture.
 */
export function scorePaymentCandidates(
  payment: UnmatchedPaymentRecord,
  candidates: CandidateStudentProfile[]
): MatchingEvaluationResult {
  const payerText = normalizeText(payment.payerDetails || "");
  const scoredCandidates: MatchCandidateResult[] = [];

  for (const candidate of candidates) {
    let score = 0;
    const matchReasons: string[] = [];

    // 1. Student Code match (e.g., "0219" or "STU-0219")
    const codeDigits = candidate.studentCode.replace(/\D/g, "");
    const cleanCode = normalizeText(candidate.studentCode);

    if (cleanCode && payerText.includes(cleanCode)) {
      score += 0.50;
      matchReasons.push(`Exact student code "${candidate.studentCode}" present in payer text`);
    } else if (codeDigits && codeDigits.length >= 3 && payerText.includes(codeDigits)) {
      score += 0.40;
      matchReasons.push(`Student ID digits "${codeDigits}" matched in reference "${payment.payerDetails}"`);
    }

    // 2. Name matching (tokens from candidate name found in payer text)
    const nameTokens = normalizeText(candidate.name).split(" ").filter((t) => t.length >= 2);
    let matchedTokens = 0;
    for (const token of nameTokens) {
      if (payerText.includes(token)) {
        matchedTokens++;
      }
    }

    if (matchedTokens > 0) {
      const nameScore = Math.min(0.35, 0.20 + (matchedTokens / nameTokens.length) * 0.15);
      score += nameScore;
      matchReasons.push(`Name token(s) matched: "${candidate.name}"`);
    }

    // 3. Parent Phone matching
    if (candidate.parentPhone) {
      const phoneDigits = candidate.parentPhone.replace(/\D/g, "");
      const last8Digits = phoneDigits.slice(-8);
      if (last8Digits && payerText.includes(last8Digits)) {
        score += 0.30;
        matchReasons.push(`Parent phone number "${candidate.parentPhone}" matched in transaction`);
      }
    }

    // 4. Exact amount matching
    const isExactAmountMatch =
      payment.amount === candidate.outstandingBalance ||
      payment.amount === candidate.activeInstalmentAmount;

    if (isExactAmountMatch) {
      score += 0.20;
      matchReasons.push("Exact payment amount matches student's instalment or outstanding balance");
    }

    // Normalize final score to 0.0 - 1.0 (rounded to 2 decimal places)
    const finalScore = Math.min(1.0, Math.round(score * 100) / 100);

    if (finalScore >= 0.20) {
      scoredCandidates.push({
        studentId: candidate.studentId,
        studentCode: candidate.studentCode,
        name: candidate.name,
        centreName: candidate.centreName,
        score: finalScore,
        matchReasons,
        isExactAmountMatch,
        recommendedAction: finalScore >= 0.60 ? "VERIFY_AND_ALLOCATE" : "LOW_CONFIDENCE",
      });
    }
  }

  // Sort descending by score
  scoredCandidates.sort((a, b) => b.score - a.score);

  return {
    paymentId: payment.paymentId,
    paymentReference: payment.paymentReference,
    amount: payment.amount,
    candidates: scoredCandidates,
    topCandidate: scoredCandidates.length > 0 ? scoredCandidates[0] : null,
  };
}
