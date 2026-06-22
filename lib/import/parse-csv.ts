/**
 * A tiny dependency-free RFC-4180 CSV parser (no npm dep). Handles quoted fields with embedded commas
 * (e.g. "Fixed Assets, net"), escaped quotes (""), CRLF/LF line endings, a leading BOM, and a missing
 * trailing newline — the conventions import-templates/README.md specifies. Returns a grid of rows of
 * string cells; blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // strip a leading BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawCell = false; // distinguishes a real empty row from end-of-file

  const endField = () => {
    row.push(field);
    field = "";
    sawCell = true;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
    sawCell = false;
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      endField();
    } else if (c === "\n") {
      endRow();
    } else if (c === "\r") {
      // ignore — the following \n ends the row (or EOF does)
    } else {
      field += c;
      sawCell = true;
    }
  }
  if (sawCell || field.length > 0) endRow(); // flush a final row with no trailing newline

  // drop fully blank rows (e.g. a trailing empty line)
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}
