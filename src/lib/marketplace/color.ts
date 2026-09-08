/**
 * Marketplace colour management.
 *
 * Section 20 asks for one place that decides action colours, rather than each
 * button carrying its own. This is that place: semantic tokens, one source of
 * truth per token, and the other two representations derived from it rather
 * than stored separately and allowed to drift.
 *
 * Section 21 asks for the mapping to be semantic. An action is not "the green
 * button" — Approve is success, Delete is danger, Archive is warning — so a
 * change to what success means reaches every approve button at once.
 */

export type TokenKey =
  | "brand" | "primary" | "secondary" | "success" | "warning"
  | "danger" | "info" | "neutral" | "disabled";

export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };

export type Token = {
  key: TokenKey;
  label: string;
  hex: string;
  /** Derived, never stored independently — section 22. */
  rgb: Rgb;
  hsl: Hsl;
};

/** Which semantic token each action uses. Section 21. */
export const ACTION_TOKENS: Record<string, TokenKey> = {
  approve: "success",
  restore: "success",
  publish: "primary",
  reject: "danger",
  delete: "danger",
  archive: "warning",
  unpublish: "warning",
  preview: "neutral",
  edit: "secondary",
  feature: "brand",
  license: "info",
  view: "neutral",
  duplicate: "secondary",
};

/** The Software Vala defaults. Reset restores exactly these — section 26. */
export const DEFAULT_HEX: Record<TokenKey, { label: string; hex: string }> = {
  brand: { label: "Brand", hex: "#00D0FF" },
  primary: { label: "Primary", hex: "#22D3EE" },
  secondary: { label: "Secondary", hex: "#94A3B8" },
  success: { label: "Success", hex: "#10B981" },
  warning: { label: "Warning", hex: "#F59E0B" },
  danger: { label: "Danger", hex: "#F43F5E" },
  info: { label: "Info", hex: "#38BDF8" },
  neutral: { label: "Neutral", hex: "#64748B" },
  disabled: { label: "Disabled", hex: "#475569" },
};

export const PALETTE_KEY = "marketplace_colour_palette";

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Rejects anything that is not a colour, rather than storing it — section 22. */
export function normaliseHex(input: string): string | null {
  const value = String(input ?? "").trim();
  if (!HEX_RE.test(value)) return null;
  let hex = value.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return `#${hex.toUpperCase()}`;
}

export function hexToRgb(hex: string): Rgb {
  const h = (normaliseHex(hex) ?? "#000000").slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0));
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: Math.round(h * 60), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hn = ((h % 360) + 360) % 360 / 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const channel = (t: number) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  return {
    r: Math.round(channel(hn + 1 / 3) * 255),
    g: Math.round(channel(hn) * 255),
    b: Math.round(channel(hn - 1 / 3) * 255),
  };
}

/** One stored hex per token; the other two are always computed from it. */
export function buildToken(key: TokenKey, hex: string, label: string): Token {
  const normalised = normaliseHex(hex) ?? DEFAULT_HEX[key].hex;
  const rgb = hexToRgb(normalised);
  return { key, label, hex: normalised, rgb, hsl: rgbToHsl(rgb) };
}

export function defaultPalette(): Token[] {
  return (Object.keys(DEFAULT_HEX) as TokenKey[]).map((k) =>
    buildToken(k, DEFAULT_HEX[k].hex, DEFAULT_HEX[k].label),
  );
}

/** Relative luminance, for the contrast check section 27 asks for. */
function luminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Contrast against a background, reported rather than enforced.
 *
 * A token that fails is flagged with the ratio and the threshold it missed, so
 * the choice is visible. Section 27 also asks that colour is never the only
 * signal, which is why every action carries a label and an icon as well.
 */
export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a), lb = luminance(b);
  const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  return Math.round(ratio * 100) / 100;
}
