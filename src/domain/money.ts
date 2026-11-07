/**
 * Pure domain money utilities for FeeFlow.
 * Hard invariant: All money is stored and computed in integer paise (bigint).
 * Zero floating-point math for any financial calculation.
 */

export type Paise = bigint;

/**
 * Deterministic integer division with Round-Half-Up (standard commercial rounding).
 * (numerator / denominator) where if remainder * 2 >= denominator, increment quotient.
 */
export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new Error("Division by zero in roundHalfUp");
  }
  if (numerator === 0n) {
    return 0n;
  }

  // Handle negative values safely
  const sign = (numerator < 0n ? -1n : 1n) * (denominator < 0n ? -1n : 1n);
  const absNum = numerator < 0n ? -numerator : numerator;
  const absDen = denominator < 0n ? -denominator : denominator;

  const quotient = absNum / absDen;
  const remainder = absNum % absDen;

  // Round half up: if 2 * remainder >= denominator, add 1
  const rounded = remainder * 2n >= absDen ? quotient + 1n : quotient;
  return sign < 0n ? -rounded : rounded;
}

/**
 * Format integer paise into standard Indian Rupee notation (e.g., ₹1,20,000 or ₹66,082.19).
 */
export function formatINR(
  paise: bigint,
  options: { showPaise?: "auto" | "always" | "never" } = { showPaise: "auto" }
): string {
  const isNegative = paise < 0n;
  const absPaise = isNegative ? -paise : paise;
  const rupees = Number(absPaise / 100n);
  const fractionalPaise = Number(absPaise % 100n);

  const shouldShowPaise =
    options.showPaise === "always" ||
    (options.showPaise === "auto" && fractionalPaise > 0);

  const formattedRupees = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: shouldShowPaise ? 2 : 0,
    maximumFractionDigits: shouldShowPaise ? 2 : 0,
  }).format(shouldShowPaise ? rupees + fractionalPaise / 100 : rupees);

  const prefix = isNegative ? "-₹" : "₹";
  return `${prefix}${formattedRupees}`;
}

/**
 * Parse a rupee string or number into integer paise.
 * E.g., "30000" or 30000 -> 3000000n paise.
 */
export function rupeesToPaise(rupees: number | string): bigint {
  const str = typeof rupees === "number" ? rupees.toFixed(2) : rupees.trim();
  const cleanStr = str.replace(/[₹,\s]/g, "");
  if (!cleanStr || isNaN(Number(cleanStr))) {
    throw new Error(`Invalid rupee amount: ${rupees}`);
  }

  const parts = cleanStr.split(".");
  const whole = BigInt(parts[0] || "0");
  const frac = parts[1] || "0";
  const fracPadded = (frac + "00").slice(0, 2);
  const fracBig = BigInt(fracPadded);

  const sign = cleanStr.startsWith("-") ? -1n : 1n;
  const absWhole = whole < 0n ? -whole : whole;
  return sign * (absWhole * 100n + fracBig);
}

/**
 * Converts paise to a numeric rupee value (for charts/analytics only, never financial storage).
 */
export function paiseToRupees(paise: bigint): number {
  return Number(paise) / 100;
}

