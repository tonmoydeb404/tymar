export type CsvOptions = {
  delimiter: "," | ";" | "\t" | "|";
  /** Prefix a UTF-8 BOM so Excel opens non-ASCII text correctly. */
  bom: boolean;
  /** Neutralise cells a spreadsheet would run as a formula (=, +, @, …). */
  protectFormulas: boolean;
};

function guardFormula(value: string): string {
  // A cell starting with these is executed by Excel/Sheets. Task and
  // project names are user-supplied, so neutralise them with a leading '.
  return /^[=+@\t\r]/.test(value) || /^-(?![\d.,]*$)/.test(value)
    ? `'${value}`
    : value;
}

function escapeCell(value: string, o: CsvOptions): string {
  const safe = o.protectFormulas ? guardFormula(value) : value;
  const needsQuotes =
    safe.includes(o.delimiter) ||
    safe.includes('"') ||
    safe.includes("\n") ||
    safe.includes("\r") ||
    safe !== safe.trim();
  return needsQuotes ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Serialises rows to CSV text (CRLF line endings, per RFC 4180). */
export function toCsv(rows: string[][], options: CsvOptions): string {
  const body = rows
    .map((row) => row.map((cell) => escapeCell(cell, options)).join(options.delimiter))
    .join("\r\n");
  return (options.bom ? "﻿" : "") + body + (rows.length ? "\r\n" : "");
}
