import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Notices that a visitor arrived on a referral link.
 *
 * Before this, `?ref=` was read by nothing anywhere in the application, so a
 * referral link tracked no one. This runs on every page: when a `ref` parameter
 * is present it tells the server once, and the server records the visit and
 * sets the first-party cookie that carries the attribution from then on.
 *
 * It is deliberately thin. It reports the code and the page, never a name, an
 * address or anything about the person; and it does not itself decide anything
 * about money — the server owns the session, the cookie is HttpOnly, and this
 * component cannot read it back.
 */

const SENT_KEY = "sv.ref.sent.v1";

function deviceClass(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

export function ReferralCapture() {
  const location = useRouterState({ select: (s) => s.location });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const code = (params.get("ref") ?? params.get("aff") ?? "").trim();
    if (!code) return;

    // Report a given code once per tab. A visitor reloading the same link
    // should not look like a new click every time.
    let alreadySent: string | null = null;
    try {
      alreadySent = window.sessionStorage.getItem(SENT_KEY);
    } catch {
      /* private mode — fall through and report once per mount */
    }
    if (alreadySent === code) return;

    const payload = {
      code,
      landing: window.location.pathname,
      productId: params.get("product") ?? undefined,
      utm_source: params.get("utm_source") ?? undefined,
      utm_medium: params.get("utm_medium") ?? undefined,
      utm_campaign: params.get("utm_campaign") ?? undefined,
      country: params.get("country") ?? undefined,
      language: typeof navigator !== "undefined" ? navigator.language?.slice(0, 12) : undefined,
      device: deviceClass(),
    };

    void fetch("/api/track/ref", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Same-origin so the first-party cookie is sent and can be set back.
      credentials: "same-origin",
      body: JSON.stringify(payload),
      keepalive: true,
    })
      .then(() => {
        try {
          window.sessionStorage.setItem(SENT_KEY, code);
        } catch {
          /* nothing to do */
        }
      })
      .catch(() => {
        // Tracking must never break the page a visitor came to read.
      });
  }, [location.pathname, location.searchStr]);

  return null;
}

export default ReferralCapture;
