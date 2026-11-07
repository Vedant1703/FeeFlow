import { describe, it, expect } from "vitest";
import { sanitizeCsvCell, buildCsvRow, buildCsvDocument } from "@/lib/csv-sanitizer";

describe("CSV Sanitizer Utility (.agents/rules/integrations.md §5)", () => {
  describe("sanitizeCsvCell", () => {
    it("neutralizes formula injection characters (=, +, -, @, \\t, \\r)", () => {
      expect(sanitizeCsvCell("=SUM(A1:A10)")).toBe('"\'=SUM(A1:A10)"');
      expect(sanitizeCsvCell("+12345")).toBe('"\' +12345"'.replace(" ", ""));
      expect(sanitizeCsvCell("-500")).toBe('"\' -500"'.replace(" ", ""));
      expect(sanitizeCsvCell("@SUM")).toBe('"\'@SUM"');
      expect(sanitizeCsvCell("\tcmd")).toBe('"\'\tcmd"');
    });

    it("escapes quotes by doubling them", () => {
      expect(sanitizeCsvCell('Hello "World"')).toBe('"Hello ""World"""');
    });

    it("handles safe strings and numbers without modifying content", () => {
      expect(sanitizeCsvCell("Regular Student Name")).toBe('"Regular Student Name"');
      expect(sanitizeCsvCell(15000)).toBe('"15000"');
      expect(sanitizeCsvCell("STU-0587")).toBe('"STU-0587"');
    });

    it("handles null and undefined safely", () => {
      expect(sanitizeCsvCell(null)).toBe('""');
      expect(sanitizeCsvCell(undefined)).toBe('""');
    });

    it("avoids duplicate single quotes if already sanitized", () => {
      expect(sanitizeCsvCell("'-100")).toBe('"\' -100"'.replace(" ", ""));
      expect(sanitizeCsvCell("'=1+1")).toBe('"\'=1+1"');
    });
  });

  describe("buildCsvRow and buildCsvDocument", () => {
    it("constructs an RFC 4180 compliant CSV line with sanitized values", () => {
      const row = buildCsvRow(["2026-10-10", "=CMD()", 'Note with "quotes"', 30000]);
      expect(row).toBe('"2026-10-10","\'=CMD()","Note with ""quotes""","30000"');
    });

    it("generates a complete multi-line CSV document with headers", () => {
      const headers = ["Date", "Description", "Amount"];
      const rows = [
        ["2026-10-10", "Tuition Fee", 30000],
        ["2026-10-11", "@Injected Formula", 15000],
      ];

      const doc = buildCsvDocument(headers, rows);
      const lines = doc.split("\n");

      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('"Date","Description","Amount"');
      expect(lines[1]).toBe('"2026-10-10","Tuition Fee","30000"');
      expect(lines[2]).toBe('"2026-10-11","\'@Injected Formula","15000"');
    });
  });
});
