/**
 * Client-side silhouette fingerprinting used by the duplicate checker.
 *
 * Two fingerprints per render:
 *  - shape: 16x16 occupancy bitmap of the trophy silhouette, isolated from the
 *    dark studio backdrop and normalised to its own bounding box. Recolouring a
 *    trophy does not change this, so identical shapes are caught.
 *  - tone: coarse luminance signature, used only to report whether a matching
 *    pair is also the same colour (a straight reuse) or a recolour.
 */

const GRID = 16;

export interface Fingerprint {
  id: string;
  shape: Uint8Array; // GRID*GRID occupancy bits
  tone: Float32Array; // 8-bucket luminance histogram of the subject
  coverage: number; // fraction of the bbox filled — silhouette mass
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export async function fingerprint(id: string, src: string): Promise<Fingerprint> {
  const img = await loadImage(src);
  const W = 128;
  const H = 128;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);

  const lum = new Float32Array(W * H);
  const alpha = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 4] ?? 0;
    const g = data[i * 4 + 1] ?? 0;
    const b = data[i * 4 + 2] ?? 0;
    alpha[i] = (data[i * 4 + 3] ?? 255) / 255;
    lum[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  // Backdrop = dark, transparent-safe. Subject pixels are brighter than the plate.
  const sorted = Float32Array.from(lum).sort();
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0.2;
  const cut = Math.max(0.14, median + 0.06);
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    mask[i] = alpha[i]! > 0.35 && lum[i]! > cut ? 1 : 0;
  }

  // Bounding box of the subject so scale/placement never fakes a difference.
  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (mask[y * W + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    minX = 0;
    minY = 0;
    maxX = W - 1;
    maxY = H - 1;
  }
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;

  const shape = new Uint8Array(GRID * GRID);
  const tone = new Float32Array(8);
  let subjectPixels = 0;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      let on = 0;
      let total = 0;
      const x0 = minX + Math.floor((gx * bw) / GRID);
      const x1 = minX + Math.floor(((gx + 1) * bw) / GRID);
      const y0 = minY + Math.floor((gy * bh) / GRID);
      const y1 = minY + Math.floor(((gy + 1) * bh) / GRID);
      for (let y = y0; y < Math.max(y1, y0 + 1); y++) {
        for (let x = x0; x < Math.max(x1, x0 + 1); x++) {
          const i = y * W + x;
          total++;
          if (mask[i]) {
            on++;
            subjectPixels++;
            const bucket = Math.min(7, Math.floor(lum[i]! * 8));
            tone[bucket] = (tone[bucket] ?? 0) + 1;
          }
        }
      }
      shape[gy * GRID + gx] = total > 0 && on / total > 0.4 ? 1 : 0;
    }
  }
  if (subjectPixels > 0) for (let i = 0; i < tone.length; i++) tone[i] = tone[i]! / subjectPixels;

  const coverage = shape.reduce<number>((a, b) => a + b, 0) / (GRID * GRID);
  return { id, shape, tone, coverage };
}

/** 0 = identical silhouette, 1 = nothing in common. */
export function shapeDistance(a: Fingerprint, b: Fingerprint): number {
  let diff = 0;
  for (let i = 0; i < a.shape.length; i++) if (a.shape[i] !== b.shape[i]) diff++;
  return diff / a.shape.length;
}

/** 0 = same tonal palette (likely straight reuse), higher = recoloured/different. */
export function toneDistance(a: Fingerprint, b: Fingerprint): number {
  let d = 0;
  for (let i = 0; i < a.tone.length; i++) d += Math.abs((a.tone[i] ?? 0) - (b.tone[i] ?? 0));
  return d / 2;
}

export interface DuplicatePair {
  a: string;
  b: string;
  shape: number;
  tone: number;
  verdict: "reused" | "recoloured" | "similar";
}

export function findDuplicates(prints: Fingerprint[], threshold = 0.1): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < prints.length; i++) {
    for (let j = i + 1; j < prints.length; j++) {
      const a = prints[i]!;
      const b = prints[j]!;
      const shape = shapeDistance(a, b);
      if (shape > threshold) continue;
      const tone = toneDistance(a, b);
      pairs.push({
        a: a.id,
        b: b.id,
        shape,
        tone,
        verdict: shape < 0.04 && tone < 0.12 ? "reused" : tone >= 0.12 ? "recoloured" : "similar",
      });
    }
  }
  return pairs.sort((x, y) => x.shape - y.shape);
}
