import { useEffect, useMemo, useState } from "react";
import { useHomeRouteData } from "@/lib/marketplace/home-route-data";
import { Bot, MessageCircle, Plus, Sparkles, X } from "lucide-react";
import type { FloatingElement, FloatingSnapshot } from "@/lib/storefront/chrome.functions";

/**
 * The floating elements on the public storefront.
 *
 * Everything about them — whether they exist at all, which devices see them,
 * which corner they sit in, when they appear and where they go — comes from the
 * published snapshot the Floating Elements manager writes. There is no
 * configuration in this file, only the rendering of it.
 *
 * The storefront carried no floating widget before this, so nothing is being
 * replaced. Each element points at something that already exists: the public
 * assistant route, the WhatsApp number the business actually answers, and the
 * marketplace lead endpoint. No second chat, support or lead system is created.
 *
 * If nothing is published, or the lookup failed, this renders nothing at all.
 * A page that cannot read its widget configuration should be a page without
 * widgets, not a broken one.
 */

const ICONS: Record<string, typeof Bot> = {
  Bot,
  MessageCircle,
  Sparkles,
  Plus,
};

const THEME: Record<string, string> = {
  accent: "bg-cyan-500 text-white hover:bg-cyan-400",
  primary: "bg-blue-600 text-white hover:bg-blue-500",
  success: "bg-emerald-600 text-white hover:bg-emerald-500",
  premium: "bg-amber-500 text-slate-900 hover:bg-amber-400",
  neutral: "bg-slate-700 text-white hover:bg-slate-600",
};

/**
 * Corner placement.
 *
 * Bottom-centre is deliberately not offered: on a phone that is where the
 * browser's own controls and any bottom navigation sit, and section 7 asks for
 * widgets that do not cover them.
 */
const CORNER: Record<string, string> = {
  "bottom-right": "bottom-0 right-0",
  "bottom-left": "bottom-0 left-0",
  "top-right": "top-0 right-0",
  "top-left": "top-0 left-0",
};

function useFloating(): FloatingElement[] {
  const chrome = useHomeRouteData()?.chrome as { floating?: FloatingSnapshot } | undefined;
  const snapshot = chrome?.floating;
  return snapshot?.published ? (snapshot.elements ?? []) : [];
}

/** Whether this element's trigger has fired yet. */
function useTriggered(element: FloatingElement): boolean {
  const immediate = element.trigger === "immediate";
  const [shown, setShown] = useState(immediate);

  useEffect(() => {
    if (immediate) return;

    if (element.trigger === "delay") {
      const t = setTimeout(() => setShown(true), Math.max(0, element.trigger_value));
      return () => clearTimeout(t);
    }

    if (element.trigger === "scroll") {
      const onScroll = () => {
        const doc = document.documentElement;
        const height = doc.scrollHeight - doc.clientHeight;
        // A page too short to scroll would never reach any percentage, so its
        // widget is shown rather than withheld forever.
        if (height <= 0) return setShown(true);
        if ((doc.scrollTop / height) * 100 >= element.trigger_value) setShown(true);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }

    if (element.trigger === "exit_intent") {
      const onLeave = (e: MouseEvent) => {
        if (e.clientY <= 0) setShown(true);
      };
      document.addEventListener("mouseout", onLeave);
      return () => document.removeEventListener("mouseout", onLeave);
    }
  }, [element.trigger, element.trigger_value, immediate]);

  return shown;
}

/** Device visibility, applied with breakpoints so the server need not guess. */
function deviceClasses(el: FloatingElement): string {
  const parts: string[] = [];
  parts.push(el.mobile ? "flex" : "hidden");
  parts.push(el.tablet ? "md:flex" : "md:hidden");
  parts.push(el.desktop ? "lg:flex" : "lg:hidden");
  return parts.join(" ");
}

/**
 * The demo request form.
 *
 * Posts to /api/marketplace/lead — the existing public endpoint, which is rate
 * limited, validates its input and writes with the service role because RLS
 * correctly refuses an anonymous insert. Nothing here is a second lead system,
 * and there is no success message that is not a real answer from the server.
 */
export function DemoForm({
  onClose,
  product,
}: {
  onClose: () => void;
  /**
   * The product this request is about, when there is one. A product page passes
   * it; the floating button on the home page does not, and that request goes in
   * as a general enquiry - which is the endpoint's own distinction, not a
   * workaround for it.
   */
  product?: { id?: string | null; name?: string | null };
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-[#0d1e36] p-4 shadow-2xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-sm font-bold text-white">Request a demo</h2>
        <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-white/10">
          <X className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {state === "sent" ? (
        <p className="text-[13px] text-emerald-300">
          Thank you — the team will be in touch shortly.
        </p>
      ) : (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setState("sending");
            const form = new FormData(e.currentTarget);
            try {
              const res = await fetch("/api/marketplace/lead", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // The field names the endpoint actually reads. It read none
                // of the three this form used to send, which is why every
                // request came back "Product could not be identified" and why
                // the visitor's message never arrived.
                body: JSON.stringify({
                  ctaAction: product?.name ? "request_demo" : "enquiry",
                  name: form.get("name"),
                  email: form.get("email"),
                  phone: form.get("phone"),
                  requirements: form.get("message"),
                  productName: product?.name ?? "",
                  productId: product?.id ?? "",
                  // The endpoint resolves the product from this exactly when it
                  // is a /marketplace/product/<slug> path.
                  sourcePage:
                    typeof window === "undefined" ? "" : window.location.pathname,
                }),
              });
              if (!res.ok) {
                // The server's own words, not a generic apology.
                const body = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(body.error ?? `Request failed (${res.status})`);
              }
              setState("sent");
            } catch (err) {
              setState("idle");
              setError(err instanceof Error ? err.message : "Could not send the request.");
            }
          }}
        >
          <label htmlFor="fd-name" className="sr-only">Your name</label>
          <input id="fd-name" name="name" required placeholder="Your name"
            className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400" />

          <label htmlFor="fd-email" className="sr-only">Email address</label>
          <input id="fd-email" name="email" type="email" required placeholder="Email address"
            className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400" />

          <label htmlFor="fd-phone" className="sr-only">Phone or WhatsApp</label>
          <input id="fd-phone" name="phone" placeholder="Phone or WhatsApp"
            className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400" />

          <label htmlFor="fd-message" className="sr-only">What are you looking for?</label>
          <textarea id="fd-message" name="message" rows={2} placeholder="What are you looking for?"
            className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400" />

          {error && <p className="text-[12px] text-red-400">{error}</p>}

          <button type="submit" disabled={state === "sending"}
            className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-[13px] font-bold text-white transition-colors hover:bg-cyan-400 disabled:opacity-60">
            {state === "sending" ? "Sending…" : "Request demo"}
          </button>
        </form>
      )}
    </div>
  );
}

function FloatingButton({ element }: { element: FloatingElement }) {
  const shown = useTriggered(element);
  const [openForm, setOpenForm] = useState(false);
  const Icon = ICONS[element.icon ?? ""] ?? MessageCircle;

  if (!shown) return null;

  const corner = CORNER[element.position] ?? CORNER["bottom-right"];
  const style = {
    marginRight: element.position.endsWith("right") ? element.offset_x : undefined,
    marginLeft: element.position.endsWith("left") ? element.offset_x : undefined,
    marginBottom: element.position.startsWith("bottom") ? element.offset_y : undefined,
    marginTop: element.position.startsWith("top") ? element.offset_y : undefined,
  };

  const button = (
    <span
      className={`items-center gap-2 rounded-full px-4 py-3 text-[13px] font-bold shadow-2xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
        THEME[element.theme] ?? THEME.accent
      } ${deviceClasses(element)}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {element.label}
    </span>
  );

  return (
    <div className={`pointer-events-none fixed z-40 p-4 ${corner}`} style={style}>
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        {openForm && <DemoForm onClose={() => setOpenForm(false)} />}

        {element.action === "lead_form" ? (
          <button
            type="button"
            aria-label={element.label}
            aria-expanded={openForm}
            onClick={() => setOpenForm((v) => !v)}
            className="appearance-none border-0 bg-transparent p-0"
          >
            {button}
          </button>
        ) : element.action === "none" ? (
          <span aria-label={element.label}>{button}</span>
        ) : (
          <a
            href={element.target ?? "#"}
            aria-label={element.label}
            {...(element.action === "route"
              ? {}
              : { target: "_blank", rel: "noopener noreferrer" })}
          >
            {button}
          </a>
        )}
      </div>
    </div>
  );
}

export function FloatingElements({ scope = "home" }: { scope?: FloatingElement["scope"] }) {
  const elements = useFloating();

  const visible = useMemo(
    () =>
      elements
        .filter((e) => e.scope === "all" || e.scope === scope)
        // Section 11. Lowest priority number owns its corner; anything behind
        // it in the same corner is not drawn on top of it.
        .sort((a, b) => a.priority - b.priority)
        .filter((e, i, all) => all.findIndex((o) => o.position === e.position) === i),
    [elements, scope],
  );

  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((e) => (
        <FloatingButton key={e.key} element={e} />
      ))}
    </>
  );
}

export default FloatingElements;
