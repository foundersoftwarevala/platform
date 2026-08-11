import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Download, Share2, Copy, ImageIcon, FileImage, QrCode as QrCodeIcon, Link2, AlertTriangle, RefreshCcw, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/dashboard/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/* --------------------- QR cache --------------------- */

type QrOpts = { size?: number; fg?: string; bg?: string; margin?: number };
const MAX_CACHE = 64;
const svgCache = new Map<string, string>();
const pngCache = new Map<string, string>();

function cacheKey(data: string, o: QrOpts, kind: "svg" | "png") {
  return `${kind}|${o.size ?? 320}|${o.fg ?? "#0b0b12"}|${o.bg ?? "#ffffff"}|${o.margin ?? 2}|${data}`;
}
function lruSet<T>(map: Map<string, T>, k: string, v: T) {
  if (map.has(k)) map.delete(k);
  map.set(k, v);
  while (map.size > MAX_CACHE) {
    const first = map.keys().next().value;
    if (first === undefined) break;
    map.delete(first);
  }
}

/** Exposed for tests */
export function _clearQrCache() {
  svgCache.clear();
  pngCache.clear();
}

/* --------------------- real QR (SVG) --------------------- */

export async function generateQrSvg(data: string, opts: QrOpts = {}): Promise<string> {
  const k = cacheKey(data, opts, "svg");
  const hit = svgCache.get(k);
  if (hit) { lruSet(svgCache, k, hit); return hit; }
  const svg = await QRCode.toString(data, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: opts.margin ?? 2,
    width: opts.size ?? 320,
    color: { dark: opts.fg ?? "#0b0b12", light: opts.bg ?? "#ffffff" },
  });
  lruSet(svgCache, k, svg);
  return svg;
}

export async function generateQrPngDataUrl(data: string, opts: QrOpts = {}): Promise<string> {
  const k = cacheKey(data, opts, "png");
  const hit = pngCache.get(k);
  if (hit) { lruSet(pngCache, k, hit); return hit; }
  const url = await QRCode.toDataURL(data, {
    errorCorrectionLevel: "M",
    margin: opts.margin ?? 2,
    width: opts.size ?? 1024,
    color: { dark: opts.fg ?? "#0b0b12", light: opts.bg ?? "#ffffff" },
  });
  lruSet(pngCache, k, url);
  return url;
}

export type ShareKind = "card" | "badge" | "trophy" | "ranking" | "poster" | "qr";

export type SharePayload = {
  kind: ShareKind;
  title: string;
  subtitle?: string;
  role?: string;
  partnerId?: string;
  level?: string;
  xp?: string;
  rank?: string;
  accent?: string;
  footnote?: string;
};

/* --------------------- verification URL --------------------- */

export function buildVerifyUrl(p: SharePayload): string {
  const q = new URLSearchParams();
  if (p.partnerId) q.set("p", p.partnerId);
  q.set("k", p.kind);
  q.set("t", p.title);
  if (p.level) q.set("l", p.level);
  if (p.rank) q.set("r", p.rank);
  return `https://softwarevala.com/verify?${q.toString()}`;
}

/* --------------------- poster SVG (with embedded real QR) --------------------- */

export function posterSvg(p: SharePayload, qrPngDataUrl: string): string {
  const accent = p.accent ?? "#8b5cf6";
  const label = p.kind === "badge" ? "BADGE"
              : p.kind === "trophy" ? "TROPHY"
              : p.kind === "ranking" ? "RANKING"
              : p.kind === "qr" ? "ACHIEVEMENT QR"
              : p.kind === "poster" ? "PREMIUM POSTER"
              : "ACHIEVEMENT";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-label="${escapeXml(p.title)} — Software Vala ${label}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b0b14"/>
      <stop offset="1" stop-color="#151530"/>
    </linearGradient>
    <linearGradient id="ac" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#22d3ee" stop-opacity="0.9"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.35" r="0.7">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1080" height="1350" fill="url(#bg)"/>
  <rect width="1080" height="1350" fill="url(#glow)"/>
  <rect x="40" y="40" width="1000" height="1270" rx="36" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)"/>

  <g font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" fill="#fff">
    <text x="90" y="140" font-size="18" letter-spacing="6" fill="rgba(255,255,255,0.7)">SOFTWARE VALA · ${label}</text>
    <text x="90" y="270" font-size="72" font-weight="700">${escapeXml(p.title)}</text>
    ${p.subtitle ? `<text x="90" y="322" font-size="28" fill="rgba(255,255,255,0.75)">${escapeXml(p.subtitle)}</text>` : ""}

    <rect x="90" y="360" width="200" height="6" rx="3" fill="url(#ac)"/>

    <g transform="translate(90,430)" font-size="20">
      ${row(0, "Partner", p.role ?? "—")}
      ${row(1, "Partner ID", p.partnerId ?? "—")}
      ${row(2, "Level", p.level ?? "—")}
      ${row(3, "Lifetime XP", p.xp ?? "—")}
      ${row(4, "Rank", p.rank ?? "—")}
    </g>

    <g transform="translate(90,1140)">
      <text font-size="16" fill="rgba(255,255,255,0.55)" letter-spacing="3">VERIFY AT</text>
      <text y="34" font-size="22" font-weight="600">softwarevala.com/verify</text>
      <text y="70" font-size="14" fill="rgba(255,255,255,0.4)">${escapeXml(p.footnote ?? "Issued by Software Vala Partner Program")}</text>
    </g>

    <g transform="translate(810,1120)">
      <rect x="-14" y="-14" width="208" height="208" rx="20" fill="#ffffff"/>
      <image href="${qrPngDataUrl}" x="0" y="0" width="180" height="180"/>
    </g>
  </g>
</svg>`;
}
function row(i: number, k: string, v: string) {
  const y = i * 58;
  return `<text x="0" y="${y}" fill="rgba(255,255,255,0.55)" font-size="16" letter-spacing="3">${escapeXml(k.toUpperCase())}</text>
          <text x="0" y="${y + 30}" font-size="30" font-weight="600">${escapeXml(v)}</text>`;
}
function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}

/* --------------------- downloads --------------------- */

function svgToBlob(svg: string) {
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}
function dataUrlToBlob(dataUrl: string) {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(meta)?.[1] ?? "application/octet-stream";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function svgToPngBlob(svg: string, w: number, h: number) {
  const url = URL.createObjectURL(svgToBlob(svg));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("img")); img.src = url; });
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

/* --------------------- one-click helpers --------------------- */

export async function downloadPosterPng(payload: SharePayload) {
  const verifyUrl = buildVerifyUrl(payload);
  const qrPng = await generateQrPngDataUrl(verifyUrl, { size: 512 });
  const svg = posterSvg(payload, qrPng);
  const blob = await svgToPngBlob(svg, 1080, 1350);
  download(blob, `${safeFileName(payload.title)}-poster.png`);
}
export async function downloadQrPng(payload: SharePayload) {
  const verifyUrl = buildVerifyUrl(payload);
  const dataUrl = await generateQrPngDataUrl(verifyUrl, { size: 1024 });
  download(dataUrlToBlob(dataUrl), `${safeFileName(payload.title)}-qr.png`);
}
export async function copyQrPngToClipboard(payload: SharePayload) {
  const verifyUrl = buildVerifyUrl(payload);
  const dataUrl = await generateQrPngDataUrl(verifyUrl, { size: 1024 });
  const blob = dataUrlToBlob(dataUrl);
  // @ts-ignore
  if (navigator.clipboard && window.ClipboardItem) {
    // @ts-ignore
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return "image" as const;
  }
  await navigator.clipboard.writeText(verifyUrl);
  return "link" as const;
}
export async function copyVerifyLink(payload: SharePayload) {
  await navigator.clipboard.writeText(buildVerifyUrl(payload));
}
function safeFileName(s: string) {
  return s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

/* --------------------- component --------------------- */

type RenderState = "idle" | "loading" | "ready" | "error";

export function ShareAssetDialog({
  open, onOpenChange, payload,
}: { open: boolean; onOpenChange: (v: boolean) => void; payload: SharePayload | null }) {
  const [tab, setTab] = useState<"poster" | "qr">("poster");
  const previewRef = useRef<HTMLDivElement>(null);

  const verifyUrl = useMemo(() => (payload ? buildVerifyUrl(payload) : ""), [payload]);

  const [qrSvg, setQrSvg] = useState<string>("");
  const [qrPngDataUrl, setQrPngDataUrl] = useState<string>("");
  const [poster, setPoster] = useState<string>("");
  const [state, setState] = useState<RenderState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [attempt, setAttempt] = useState(0);

  const regenerate = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (!payload) { setQrSvg(""); setQrPngDataUrl(""); setPoster(""); setState("idle"); setErrorMsg(""); return; }
    setState("loading");
    setErrorMsg("");
    (async () => {
      try {
        const [svg, png] = await Promise.all([
          generateQrSvg(verifyUrl, { size: 320 }),
          generateQrPngDataUrl(verifyUrl, { size: 512 }),
        ]);
        if (cancelled) return;
        setQrSvg(svg);
        setQrPngDataUrl(png);
        setPoster(posterSvg(payload, png));
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        setState("error");
        setErrorMsg(err instanceof Error ? err.message : "Failed to render QR");
      }
    })();
    return () => { cancelled = true; };
  }, [payload, verifyUrl, attempt]);

  if (!payload) return null;

  const safeName = safeFileName(payload.title);
  const kind = payload.kind === "poster" ? "poster" : payload.kind === "qr" ? "qr" : tab;
  const ready = state === "ready" && qrSvg && qrPngDataUrl && poster;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" aria-describedby="share-asset-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Share2 className="h-4 w-4" aria-hidden="true" /> Share — {payload.title}</DialogTitle>
          <DialogDescription id="share-asset-desc">
            Preview a branded shareable asset. Download as PNG or SVG, or copy a verification link.
          </DialogDescription>
        </DialogHeader>

        {state === "error" ? (
          <ErrorState message={errorMsg} onRetry={regenerate} />
        ) : payload.kind !== "poster" && payload.kind !== "qr" ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList aria-label="Asset type">
              <TabsTrigger value="poster"><FileImage className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Poster</TabsTrigger>
              <TabsTrigger value="qr"><QrCodeIcon className="h-3.5 w-3.5 mr-1" aria-hidden="true" />QR</TabsTrigger>
            </TabsList>
            <TabsContent value="poster"><PosterPreview svg={poster} innerRef={previewRef} loading={state === "loading"} /></TabsContent>
            <TabsContent value="qr"><QrPreview svg={qrSvg} label={payload.title} loading={state === "loading"} /></TabsContent>
          </Tabs>
        ) : payload.kind === "qr" ? (
          <QrPreview svg={qrSvg} label={payload.title} loading={state === "loading"} />
        ) : (
          <PosterPreview svg={poster} innerRef={previewRef} loading={state === "loading"} />
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2" role="group" aria-label="Share actions">
          <Button size="sm" disabled={!ready} aria-label="Download PNG" onClick={async () => {
            try {
              if (kind === "qr") {
                download(dataUrlToBlob(qrPngDataUrl), `${safeName}-qr.png`);
              } else {
                const blob = await svgToPngBlob(poster, 1080, 1350);
                download(blob, `${safeName}-poster.png`);
              }
              toast.success("PNG downloaded.");
            } catch { toast.error("Could not render PNG."); }
          }}>
            <ImageIcon className="h-4 w-4 mr-1" aria-hidden="true" /> Download PNG
          </Button>
          <Button size="sm" variant="outline" disabled={!ready} aria-label="Download SVG" onClick={() => {
            const svg = kind === "qr" ? qrSvg : poster;
            download(svgToBlob(svg), `${safeName}-${kind}.svg`);
            toast.success("SVG downloaded.");
          }}>
            <Download className="h-4 w-4 mr-1" aria-hidden="true" /> Download SVG
          </Button>
          <Button size="sm" variant="outline" disabled={!ready} aria-label="Copy QR image" onClick={async () => {
            try {
              const result = await copyQrPngToClipboard(payload);
              toast.success(result === "image" ? "QR image copied." : "Verify link copied.");
            } catch { toast.error("Copy failed."); }
          }}>
            <Copy className="h-4 w-4 mr-1" aria-hidden="true" /> Copy QR
          </Button>
          <Button size="sm" variant="outline" aria-label="Copy verify link" onClick={async () => {
            try { await copyVerifyLink(payload); toast.success("Verify link copied."); }
            catch { toast.error("Copy failed."); }
          }}>
            <Link2 className="h-4 w-4 mr-1" aria-hidden="true" /> Copy link
          </Button>
          <Button size="sm" variant="outline" aria-label="Share via system share" onClick={async () => {
            try {
              // @ts-ignore
              if (navigator.share) { await navigator.share({ title: payload.title, url: verifyUrl }); }
              else { await navigator.clipboard.writeText(verifyUrl); toast.success("Link copied."); }
            } catch { /* dismissed */ }
          }}>
            <Share2 className="h-4 w-4 mr-1" aria-hidden="true" /> Share…
          </Button>
          {state === "ready" && (
            <Button size="sm" variant="ghost" aria-label="Regenerate QR" onClick={regenerate}>
              <RefreshCcw className="h-4 w-4 mr-1" aria-hidden="true" /> Regenerate
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" aria-live="assertive"
      className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 flex flex-col items-center text-center gap-3">
      <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
      <div>
        <div className="font-medium">Could not render QR code</div>
        <div className="text-sm text-muted-foreground mt-1">{message || "Something went wrong while generating the asset."}</div>
      </div>
      <Button size="sm" onClick={onRetry} aria-label="Retry rendering QR code">
        <RefreshCcw className="h-4 w-4 mr-1" aria-hidden="true" /> Try again
      </Button>
    </div>
  );
}

function PosterPreview({ svg, innerRef, loading }: { svg: string; innerRef: React.RefObject<HTMLDivElement | null>; loading?: boolean }) {
  return (
    <div ref={innerRef}
      className="rounded-xl overflow-hidden border border-border bg-black/40 flex items-center justify-center p-3 min-h-[320px]"
      role="img" aria-label="Achievement poster preview" aria-busy={loading || undefined}>
      {loading || !svg
        ? <LoadingBlock label="Rendering poster…" />
        : <div className="w-full max-w-[360px] aspect-[1080/1350]" dangerouslySetInnerHTML={{ __html: svg }} />}
    </div>
  );
}
function QrPreview({ svg, label, loading }: { svg: string; label: string; loading?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-6 flex flex-col items-center"
      role="img" aria-label={`Achievement QR code for ${label}`} aria-busy={loading || undefined}>
      <div className="w-56 h-56 bg-white rounded-lg p-3 flex items-center justify-center">
        {loading || !svg
          ? <LoadingBlock label="Generating QR…" compact />
          : <div dangerouslySetInnerHTML={{ __html: svg }} />}
      </div>
      <div className="mt-3 text-sm font-medium">{label}</div>
      <div className="text-[11px] text-muted-foreground">Scan to verify · softwarevala.com/verify</div>
    </div>
  );
}
function LoadingBlock({ label, compact }: { label: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-muted-foreground ${compact ? "" : "py-10"}`}>
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span className="text-xs">{label}</span>
    </div>
  );
}
