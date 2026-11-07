/**
 * CSV Sanitization Utility for FeeFlow.
 * Neutralizes spreadsheet formula injection (CSV Injection / Formula Injection)
 * as mandated by .agents/rules/integrations.md §5.
 */

const DANGEROUS_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Sanitizes an individual CSV cell to prevent formula injection.
 * If the string begins with any dangerous formula character, it is safely prefixed with a single quote.
 * Quotes are properly escaped by doubling them ("" -> ").
 */
export function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value);

  // Neutralize formula injection
  if (DANGEROUS_PREFIXES.some((prefix) => str.startsWith(prefix))) {
    // Avoid double prefixing if already sanitized
    if (!str.startsWith("'-") && !str.startsWith("'=") && !str.startsWith("'+") && !str.startsWith("'@")) {
      str = `'${str}`;
    }
  }

  // Escape existing double quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Converts an array of cell values into a compliant CSV line.
 */
export function buildCsvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map((cell) => sanitizeCsvCell(cell)).join(",");
}

/**
 * Builds a complete CSV document with header and rows.
 */
export function buildCsvDocument(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const headerLine = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(",");
  const dataLines = rows.map((r) => buildCsvRow(r));
  return [headerLine, ...dataLines].join("\n");
}
