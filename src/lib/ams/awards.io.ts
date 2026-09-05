// Award Center — CSV/JSON import/export helpers.
// Pure browser code; works against the in-memory awards.api.ts store.

import type { Award, AwardCategory, AwardType, Rarity, AwardStatus, AwardVisibility } from "./types";
import type { AwardDraft } from "./awards.api";

const CSV_COLUMNS = [
  "name", "type", "category", "rarity", "status", "visibility",
  "priority", "description", "xp", "coins", "monetaryValue",
  "supportedModules", "supportedRoles", "themeColor",
] as const;

function esc(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows: Award[]): string {
  const header = CSV_COLUMNS.join(",");
  const lines = rows.map((a) =>
    [
      a.name, a.type, a.category, a.rarity, a.status, a.visibility,
      a.priority, a.description,
      a.rewards.xp, a.rewards.coins, a.rewards.monetaryValue,
      (a.supportedModules ?? []).join("|"),
      (a.supportedRoles ?? []).join("|"),
      a.media.themeColor ?? "",
    ].map(esc).join(","),
  );
  return [header, ...lines].join("\n");
}

export function toJSON(rows: Award[]): string {
  return JSON.stringify(
    rows.map((a) => ({
      name: a.name, description: a.description, type: a.type, category: a.category,
      rarity: a.rarity, status: a.status, visibility: a.visibility, priority: a.priority,
      rewards: a.rewards, media: a.media,
      supportedModules: a.supportedModules, supportedRoles: a.supportedRoles,
    })),
    null, 2,
  );
}

// Minimal RFC-4180-ish CSV parser (handles quoted fields, escaped quotes, CRLF).
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ""));
}

function num(v: string | undefined, d = 0): number {
  const n = Number(v ?? d);
  return Number.isFinite(n) ? n : d;
}

function pickType(v: string | undefined, fallback: AwardType): AwardType {
  const allowed: AwardType[] = ["trophy", "badge", "achievement", "rank", "milestone", "streak"];
  return (allowed as string[]).includes(v ?? "") ? (v as AwardType) : fallback;
}

export function fromCSV(text: string, defaultType: AwardType): AwardDraft[] {
  const rows = parseCSV(text);
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  const idx = (key: string) => header.findIndex((h) => h.trim().toLowerCase() === key.toLowerCase());
  const i = Object.fromEntries(CSV_COLUMNS.map((c) => [c, idx(c)])) as Record<typeof CSV_COLUMNS[number], number>;

  return body
    .map((r): AwardDraft | null => {
      const name = (r[i.name] ?? "").trim();
      if (!name) return null;
      const draft: AwardDraft = {
        name,
        description: r[i.description] ?? "",
        type: pickType(r[i.type], defaultType),
        category: ((r[i.category] ?? "global").trim() || "global") as AwardCategory,
        rarity: ((r[i.rarity] ?? "common").trim() || "common") as Rarity,
        priority: num(r[i.priority], 0),
        visibility: ((r[i.visibility] ?? "public").trim() || "public") as AwardVisibility,
        rewards: {
          xp: num(r[i.xp]), coins: num(r[i.coins]),
          rankImpact: 0, levelImpact: 0, monetaryValue: num(r[i.monetaryValue]),
        },
        media: { themeColor: (r[i.themeColor] ?? "").trim() || undefined },
        supportedModules: (r[i.supportedModules] ?? "").split("|").map((s) => s.trim()).filter(Boolean),
        supportedRoles: (r[i.supportedRoles] ?? "").split("|").map((s) => s.trim()).filter(Boolean),
      };
      return draft;
    })
    .filter((x): x is AwardDraft => x !== null);
}

export function fromJSON(text: string, defaultType: AwardType): AwardDraft[] {
  const parsed = JSON.parse(text);
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr
    .filter((x: unknown): x is { name: string } & Partial<Award> =>
      !!x && typeof x === "object" && typeof (x as { name?: unknown }).name === "string" && (x as { name: string }).name.trim() !== ""
    )
    .map((x): AwardDraft => ({
      name: x.name.trim(),
      description: x.description ?? "",
      type: pickType(x.type, defaultType),
      category: (x.category ?? "global") as AwardCategory,
      rarity: (x.rarity ?? "common") as Rarity,
      priority: x.priority ?? 0,
      visibility: (x.visibility ?? "public") as AwardVisibility,
      rewards: {
        xp: x.rewards?.xp ?? 0, coins: x.rewards?.coins ?? 0,
        rankImpact: x.rewards?.rankImpact ?? 0, levelImpact: x.rewards?.levelImpact ?? 0,
        monetaryValue: x.rewards?.monetaryValue ?? 0,
      },
      media: x.media ?? {},
      supportedModules: x.supportedModules ?? [],
      supportedRoles: x.supportedRoles ?? [],
    }));
}

export function downloadBlob(filename: string, data: string, mime: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Status values valid for bulk operations
export const BULK_STATUSES: AwardStatus[] = ["published", "unpublished", "archived", "approved", "disabled"];
