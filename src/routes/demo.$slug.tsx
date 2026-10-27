import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Loader, RefreshCw } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { pageHead } from "@/lib/seo-head";
import { DEMO_BRAND, SOFTWARE_VALA_CONTACT } from "@/lib/demo/brand";

const BRANDING_CONFIG = {
  title: "Software Vala™ — The Name of Trust",
  favicon: DEMO_BRAND.favicon,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/demo/$slug")({
  head: pageHead("Live Demo", "A working demo of the product, running on real software."),
  component: () => (
    <>
      <DemoBrandedGatewayPage />
      <Toaster />
    </>
  ),
});

function DemoBrandedGatewayPage() {
  const [slug, setSlug] = useState("");
  const [demoUrl, setDemoUrl] = useState<string | null>(null);
  const [demoName, setDemoName] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [frameLoading, setFrameLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const demoFrame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/demo\/([^/]+)/);
    setSlug(match?.[1] ?? "");
  }, []);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setChecking(true);
    setError(null);
    setDemoUrl(null);
    setFrameLoading(true);

    void (async () => {
      try {
        let visitorSessionId =
          retry === 0
            ? new URLSearchParams(window.location.search).get("visitor_session_id")
            : null;
        if (!visitorSessionId || !UUID.test(visitorSessionId)) {
          const created = await fetch("/api/demo/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug }),
          });
          const sessionResult = (await created.json().catch(() => ({}))) as {
            sessionId?: string;
            error?: string;
          };
          if (!created.ok || !sessionResult.sessionId || !UUID.test(sessionResult.sessionId)) {
            throw new Error(sessionResult.error || "Could not start this demo.");
          }
          visitorSessionId = sessionResult.sessionId;
        }

        const response = await fetch("/api/demo/ticket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, visitor_session_id: visitorSessionId }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          ticket?: string;
          sessionId?: string;
          demoName?: string;
          error?: string;
        };
        if (!response.ok || !payload.ticket || !payload.sessionId) {
          if (response.status === 404 && retry === 0) {
            const created = await fetch("/api/demo/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug }),
            });
            const sessionResult = (await created.json().catch(() => ({}))) as {
              sessionId?: string;
              error?: string;
            };
            if (!created.ok || !sessionResult.sessionId) {
              throw new Error(sessionResult.error || payload.error || "This demo is unavailable.");
            }
            const fresh = await fetch("/api/demo/ticket", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug, visitor_session_id: sessionResult.sessionId }),
            });
            const freshPayload = (await fresh.json().catch(() => ({}))) as typeof payload;
            if (!fresh.ok || !freshPayload.ticket || !freshPayload.sessionId) {
              throw new Error(freshPayload.error || "This demo is unavailable.");
            }
            payload.ticket = freshPayload.ticket;
            payload.sessionId = freshPayload.sessionId;
            payload.demoName = freshPayload.demoName;
          } else {
            throw new Error(payload.error || "This demo is unavailable.");
          }
        }

        if (cancelled) return;
        setSessionId(payload.sessionId);
        setTicket(payload.ticket);
        setDemoName(payload.demoName || "Live Demo");
        const path =
          `/api/proxy/demo/${encodeURIComponent(slug)}/${encodeURIComponent(payload.sessionId)}` +
          `?t=${encodeURIComponent(payload.ticket)}`;
        setDemoUrl(path);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "This demo is currently unavailable.");
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [retry, slug]);

  useEffect(() => {
    if (!sessionId || !ticket) return;
    const endSession = (event: PageTransitionEvent) => {
      if (event.persisted) return;
      const body = JSON.stringify({ action: "end", sessionId, ticket });
      const queued = navigator.sendBeacon(
        "/api/demo/session",
        new Blob([body], { type: "application/json" }),
      );
      if (!queued) {
        void fetch("/api/demo/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      }
    };
    window.addEventListener("pagehide", endSession, { once: true });
    return () => window.removeEventListener("pagehide", endSession);
  }, [sessionId, ticket]);

  useEffect(() => {
    document.title = BRANDING_CONFIG.title;
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) favicon.href = BRANDING_CONFIG.favicon;
  }, []);

  const unavailable = (message: string) => (
    <div className="flex h-screen flex-col bg-linear-to-b from-slate-950 to-slate-900">
      <div className="border-b border-slate-700 bg-slate-900 px-6 py-4">
        <a
          href="/"
          className="flex w-fit items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Marketplace
        </a>
      </div>
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-md space-y-5 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Demo currently unavailable</h1>
          <p className="text-slate-400">{message}</p>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="inline-flex items-center gap-2 rounded-md bg-cyan-500 px-5 py-2.5 text-sm font-medium text-slate-950 hover:bg-cyan-400"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    </div>
  );

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-linear-to-b from-slate-950 to-slate-900">
        <div className="space-y-4 text-center">
          <Loader className="mx-auto h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-slate-400">Loading demo...</p>
        </div>
      </div>
    );
  }

  if (error || !demoUrl) return unavailable(error || "This demo could not be loaded.");

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      <div className="flex h-16 items-center gap-3 border-b border-slate-700 bg-linear-to-r from-slate-900 to-slate-800 px-6 shadow-lg">
        <img src={BRANDING_CONFIG.favicon} alt="Software Vala™" className="h-7 w-7" />
        <div className="flex flex-1 items-center gap-2">
          <span className="text-sm font-semibold text-white">Software Vala™</span>
          <span className="text-xs text-slate-500">Demo</span>
          <span className="text-xs text-slate-400">—</span>
          <span className="text-xs text-slate-400">{demoName}</span>
        </div>
        <a
          href="/"
          className="ml-auto inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          title="Back to Marketplace"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </a>
      </div>
      <div className="relative flex-1 overflow-hidden">
        {frameLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950">
            <Loader className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
        )}
        <iframe
          ref={demoFrame}
          src={demoUrl}
          title={`Software Vala™ — ${demoName}`}
          className="h-full w-full border-0"
          onLoad={() => {
            setFrameLoading(false);
            try {
              if (demoFrame.current?.contentDocument?.documentElement.dataset.demoUnavailable) {
                setError("The demo provider is not responding. Please try again later.");
                setDemoUrl(null);
              }
            } catch (cause) {
              console.warn("[demo gateway] Could not inspect proxy response status.", cause);
            }
          }}
          onError={() => {
            setFrameLoading(false);
            setError("The demo could not be loaded. Please try again later.");
            setDemoUrl(null);
          }}
        />
      </div>
      <DemoContactFooter />
    </div>
  );
}

function DemoContactFooter() {
  return (
    <footer className="flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-300">
      <a href={SOFTWARE_VALA_CONTACT.website}>Software Vala™</a>
      <a href={`tel:${SOFTWARE_VALA_CONTACT.phone.replace(/\s/g, "")}`}>
        {SOFTWARE_VALA_CONTACT.phone}
      </a>
      <a href={SOFTWARE_VALA_CONTACT.whatsapp} target="_blank" rel="noopener noreferrer">
        WhatsApp
      </a>
      <a href={`mailto:${SOFTWARE_VALA_CONTACT.email}`}>{SOFTWARE_VALA_CONTACT.email}</a>
    </footer>
  );
}
