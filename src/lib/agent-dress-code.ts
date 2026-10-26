/** Agent dress code table — each agent role owns its dress colour (hue, chroma). */
export type DressCode = {
  role: string;
  dress: string;
  primary: number;
  accent: number;
  c?: number;
};

export const AGENT_DRESS_CODE: Record<string, DressCode> = {
  "Hermes Agent": {
    role: "Market Intelligence",
    dress: "Royal Gold",
    primary: 80,
    accent: 95,
    c: 0.15,
  },
  "Code Agent": { role: "Engineering", dress: "Matrix Green", primary: 150, accent: 165 },
  "SEO Agent": { role: "Search & Growth", dress: "Electric Violet", primary: 295, accent: 280 },
  "Data Agent": { role: "Analytics", dress: "Deep Cyan", primary: 220, accent: 200 },
  "Content Agent": { role: "Marketing", dress: "Magenta Rose", primary: 350, accent: 335 },
  "Support Agent": { role: "Customer Care", dress: "Sunset Amber", primary: 55, accent: 70 },
};

export function dressColor(d: DressCode, l = 0.72) {
  return `oklch(${l} ${d.c ?? 0.17} ${d.primary})`;
}

export function applyTheme(t: { primary: number; accent: number; c?: number }) {
  const c = t.c ?? 0.17;
  const s = document.documentElement.style;
  s.setProperty("--primary", `oklch(0.72 ${c} ${t.primary})`);
  s.setProperty("--accent", `oklch(0.82 ${c * 0.85} ${t.accent})`);
  s.setProperty("--ring", `oklch(0.72 ${c} ${t.primary})`);
  s.setProperty("--border", `oklch(0.6 0.15 ${t.primary} / 0.35)`);
}
