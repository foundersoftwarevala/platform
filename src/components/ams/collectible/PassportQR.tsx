import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Link } from "@tanstack/react-router";
import { QrCode, ShieldCheck, Download, Copy, Check } from "lucide-react";
import { passportIdentity, passportVerifyPath, passportVerifyUrl } from "@/lib/ams/passport-id";
import type { RoleDNA } from "@/lib/ams/roles";

/**
 * Real, scannable QR verification block for a digital passport.
 * The QR encodes an absolute URL to /verify/<code>, which opens the
 * dedicated passport verification detail page.
 */
export function PassportQR({ role, size = 132 }: { role: RoleDNA; size?: number }) {
  const identity = passportIdentity(role);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    const url = passportVerifyUrl(role);
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
  }, [role, size]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(identity.code);
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
    a.download = `${role.slug}-passport-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div
      className="rounded-xl border p-3 flex gap-3 items-center"
      style={{ borderColor: `${role.accent}44`, background: `linear-gradient(135deg, ${role.accent}12, transparent)` }}
    >
      <div
        className="rounded-lg p-1.5 shrink-0"
        style={{ background: "#fff", boxShadow: `0 0 22px -8px ${role.accent}` }}
      >
        {dataUrl ? (
          <img src={dataUrl} alt={`Verification QR for passport ${identity.code}`} width={size} height={size} style={{ width: size, height: size }} />
        ) : (
          <div className="flex items-center justify-center text-black/40" style={{ width: size, height: size }}>
            <QrCode className="h-6 w-6" />
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-1.5">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em]" style={{ color: `${role.accent}cc` }}>
          Verification Code
        </div>
        <div className="font-mono text-xs text-white break-all">{identity.code}</div>
        <div className="text-[10px] text-white/55">Passport No. {identity.number}</div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Link
            to="/verify/$code"
            params={{ code: identity.code }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold"
            style={{ background: `linear-gradient(135deg, ${role.accent}, ${role.accent}aa)`, color: "#0b0f1a" }}
          >
            <ShieldCheck className="h-3 w-3" /> Verify
          </Link>
          <button
            type="button"
            onClick={copyCode}
            title="Copy verification code"
            aria-label={`Copy verification code ${identity.code}`}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] text-white/80 hover:bg-white/5"
            style={{ borderColor: `${role.accent}55` }}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Code"}
          </button>
          <button
            type="button"
            onClick={downloadQr}
            title="Download QR code"
            aria-label="Download verification QR code as PNG"
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] text-white/80 hover:bg-white/5"
            style={{ borderColor: `${role.accent}55` }}
          >
            <Download className="h-3 w-3" /> QR
          </button>
        </div>
        <div className="text-[10px] text-white/40 font-mono">{passportVerifyPath(role)}</div>
      </div>
    </div>
  );
}
