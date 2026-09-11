import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Copy one value a customer is expected to quote back to us.
 *
 * There are exactly three of those on the customer's side: a licence key, a
 * payment reference for a rail somebody settles by hand, and an order number.
 * All three are strings a customer would otherwise retype, and the payment
 * reference is the one where a typo means the money arrives and cannot be
 * matched to the order.
 *
 * The purchases page already had a copy control written inline; this is that
 * control lifted out rather than a second design, so the styling, the icon and
 * the two-second confirmation are unchanged. Nothing new is introduced: the
 * icons are the same lucide set the page already imports.
 *
 * Two things it fixes on the way out. Each button now says what it copies, so a
 * screen reader user hearing the fourth "Copy" on the page knows which key it
 * belongs to. And the confirmation timer is cleared when the component goes
 * away, so a customer who navigates off mid-copy does not leave a timer trying
 * to set state on something that no longer exists.
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  /** What is being copied, for the accessible name: "licence key for Acme CRM". */
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused in some browsers and over plain HTTP. The
      // value is on screen either way, so this is not worth an error.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      className={
        className ??
        // The visible control is deliberately small -- it sits inline beside a
        // licence key and a reference, and making it physically bigger would
        // change a layout that is not ours to change. What it was missing is a
        // touch target: at roughly 22px tall it was half the size a thumb can
        // reliably hit, on the one control a customer on a phone actually needs
        // (S43). The `after:` layer adds a 44px-tall hit area centred on the
        // button and paints nothing, so the design is untouched and the button
        // is reachable.
        "relative inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-400 after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']"
      }
    >
      {copied ? (
        <Check className="h-3 w-3" aria-hidden="true" />
      ) : (
        <Copy className="h-3 w-3" aria-hidden="true" />
      )}
      {/* Announced through aria-label above; this is the visible half only. */}
      <span aria-hidden="true">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
