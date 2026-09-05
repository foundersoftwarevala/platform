/** Shared CSV helpers for Marketing Manager exports. */

const escape = (v: unknown) =>
  `"${String(Array.isArray(v) ? v.join("|") : (v ?? "")).replace(/"/g, '""')}"`;

export function buildCsv(rows: Array<Record<string, unknown>>, headers?: readonly string[]) {
  if (rows.length === 0) return "";
  const cols = headers ?? Object.keys(rows[0] as Record<string, unknown>);
  return [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => escape(r[c])).join(",")),
  ].join("\n");
}

/** Triggers a browser download for the given CSV text. */
export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the download has been handed to the browser.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const csvFilename = (slug: string) =>
  `${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
