/**
 * Real file downloads for the export buttons.
 *
 * Several consoles had an "Export" button whose entire behaviour was
 * `toast.success("Exported")` — the operator was told the export had happened
 * and no file ever arrived. These helpers give those buttons something real to
 * do with the rows already on screen.
 *
 * Everything here is client-side and synchronous: no server round trip, no
 * queue, nothing that could report success before it happened.
 */

/** Quotes a CSV field so commas, quotes and newlines survive the round trip. */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function save(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Today's date, for filenames that should sort chronologically. */
export function stampedName(base: string, extension: string): string {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  return `${base}-${iso}.${extension}`;
}

/**
 * Writes the rows to a CSV file and returns how many were written, so the
 * caller can tell the operator the truth about what they just received.
 *
 * Columns are taken from the union of every row's keys, in first-seen order, so
 * a row missing a field still lines up.
 */
export function downloadCsv(
  filename: string,
  rows: ReadonlyArray<Record<string, unknown>>,
  columns?: ReadonlyArray<string>,
): number {
  const keys =
    columns && columns.length
      ? [...columns]
      : Array.from(rows.reduce<Set<string>>((set, row) => {
          Object.keys(row).forEach((k) => set.add(k));
          return set;
        }, new Set<string>()));

  const lines = [
    keys.map(csvField).join(","),
    ...rows.map((row) => keys.map((k) => csvField(row[k])).join(",")),
  ];

  // The BOM makes Excel open UTF-8 correctly instead of mangling accents.
  save(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), filename);
  return rows.length;
}

export function downloadJson(filename: string, data: unknown): void {
  save(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }),
    filename,
  );
}

/** For a data: URL that is already in hand, such as a generated QR image. */
export function downloadDataUrl(filename: string, dataUrl: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Copies text and reports whether it worked. The clipboard is unavailable over
 * plain HTTP and in some embedded views, and a "Copied" toast that fires when
 * nothing was copied is the same lie this module exists to remove.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
