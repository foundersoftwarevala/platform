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
      : Array.from(
          rows.reduce<Set<string>>((set, row) => {
            Object.keys(row).forEach((k) => set.add(k));
            return set;
          }, new Set<string>()),
        );

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
 * Copies text and reports whether it worked. A "Copied" toast that fires when
 * nothing was copied is the same lie this module exists to remove, so the
 * answer is always the truth about what happened.
 *
 * Two attempts, because one is not enough. navigator.clipboard is the right
 * API and the only one with a real permission model, but it does not exist
 * over plain HTTP, is missing from older Safari, and is withheld inside a good
 * number of in-app browsers — and in every one of those cases the Share button
 * on a product page could only ever report failure. The older
 * document.execCommand("copy") still works in exactly those places, so it is
 * tried second rather than not at all.
 *
 * The textarea is positioned off-screen rather than hidden: a display:none or
 * visibility:hidden element cannot be selected, so the copy would silently do
 * nothing. It is removed in a finally block, and the caller's selection is put
 * back, so a failed copy does not leave the page with text highlighted.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fall through to the older path below */
  }

  if (typeof document === "undefined") return false;

  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "-1000px";
  area.style.opacity = "0";
  const previous = document.activeElement as HTMLElement | null;

  try {
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
    window.getSelection?.()?.removeAllRanges();
    previous?.focus?.();
  }
}
