import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Link } from "@tanstack/react-router";
import { QrCode, ShieldCheck, Download, Copy, Check } from "lucide-react";

/**
 * Reusable, genuinely scannable QR verification block for any AMS credential
 * (digital passport, certificate, ...). The QR encodes an absolute URL to
 * /verify/<code>, which resolves to the credential's verification record.
 */
export function CredentialQR({
  accent,
  code,
  numberLabel,
  number,
  path,
  url,
  filename,
  size = 132,
}: {
  accent: string;
  /** Verification code, also the /verify route param. */
  code: string;
  /** e.g. "Passport No." or "Certificate No." */
  numberLabel: string;
  number: string;
  /** Relative verification path, shown as fine print. */
  path: string;
  /** Absolute URL encoded into the QR. */
  url: string;
  /** Download filename for the QR PNG. */
  filename: string;
  size?: number;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, {
      width: size * 3,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#050810ff", light: "#ffffffff" },
    })
      .then((d) => alive && setDataUrl(d))
      .catch(() => alive && setDataUrl(null));
    return () => {
      alive = false;
    };
  }, [url, size]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  function downloadQr() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div
      className="rounded-xl border p-3 flex gap-3 items-center"
      style={{ borderColor: `${accent}44`, background: `linear-gradient(135deg, ${accent}12, transparent)` }}
    >
      <div className="rounded-lg p-1.5 shrink-0" style={{ background: "#fff", boxShadow: `0 0 22px -8px ${accent}` }}>
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`Verification QR for ${code}`}
            width={size}
            height={size}
            style={{ width: size, height: size }}
          />
        ) : (
          <div className="flex items-center justify-center text-black/40" style={{ width: size, height: size }}>
            <QrCode className="h-6 w-6" />
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-1.5">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em]" style={{ color: `${accent}cc` }}>
          Verification Code
        </div>
        <div className="font-mono text-xs text-white break-all">{code}</div>
        <div className="text-[10px] text-white/55">
          {numberLabel} {number}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Link
            to="/verify/$code"
            params={{ code }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)`, color: "#0b0f1a" }}
          >
            <ShieldCheck className="h-3 w-3" /> Verify
          </Link>
          <button
            type="button"
            onClick={copyCode}
            title="Copy verification code"
            aria-label={`Copy verification code ${code}`}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] text-white/80 hover:bg-white/5"
            style={{ borderColor: `${accent}55` }}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Code"}
          </button>
          <button
            type="button"
            onClick={downloadQr}
            title="Download QR code"
            aria-label="Download verification QR code as PNG"
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] text-white/80 hover:bg-white/5"
            style={{ borderColor: `${accent}55` }}
          >
            <Download className="h-3 w-3" /> QR
          </button>
        </div>
        <div className="text-[10px] text-white/40 font-mono">{path}</div>
      </div>
    </div>
  );
}
