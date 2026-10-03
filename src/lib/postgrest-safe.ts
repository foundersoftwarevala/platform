/**
 * Two small guards that several Marketplace Manager routes needed and each
 * either wrote differently or left out.
 *
 * Neither imports anything, so a browser component can use the CSV one too.
 */

/**
 * A search term made safe to place inside a PostgREST `or=(...)` list.
 *
 * encodeURIComponent is not enough there: PostgREST decodes the query string
 * before it parses the list, so a comma or a parenthesis in the term ends the
 * condition early. A search for "Smith, John" answered 400, which the screens
 * read as "nothing matches", and a crafted term could add conditions of its
 * own. The list's own syntax characters are removed; what is left is encoded.
 */
export function orSearchTerm(value: string): string {
  return encodeURIComponent(value.replace(/[(),*"\\]/g, " ").replace(/\s+/g, " ").trim());
}

/**
 * One CSV cell, quoted, and never read by a spreadsheet as a formula.
 *
 * Product names, customer names and ticket subjects are typed by people
 * outside the company. A value starting with = + - @ (or a tab or carriage
 * return) runs as a formula when an operator opens the export in Excel or
 * Sheets; a leading apostrophe makes it text.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
