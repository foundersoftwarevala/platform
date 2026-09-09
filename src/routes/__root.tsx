import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { RouteAccessGate } from "@/components/auth/RouteAccessGate";
import { LanguageProvider } from "@/lib/language-catalog";
import { useRealtimeAuth } from "@/integrations/supabase/realtime-auth";
import { ReferralCapture } from "@/components/affiliate/ReferralCapture";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { installClientErrorMonitor, reportBoundaryError } from "../lib/client-error-monitor";
import { TooltipProvider } from "../components/ui/tooltip";
import { CelebrationProvider } from "../components/ams/effects/Celebration";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    // Same failure, recorded into error_events so AI API Manager -> Alerts -> Error Monitor sees it.
    reportBoundaryError(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Software Vala™ — The Name of Trust" },
      { name: "description", content: "Software Vala™ — The Name of Trust. A global marketplace of ready-to-deploy software with live demos, full source code and lifetime access." },
      { name: "author", content: "Software Vala" },
      { property: "og:title", content: "Software Vala™ — The Name of Trust" },
      { property: "og:description", content: "Software Vala™ — The Name of Trust. A global marketplace of ready-to-deploy software with live demos, full source code and lifetime access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:site_name", content: "Software Vala™" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  // Without this the realtime socket carries only the publishable key, and
  // every row-level-secured table silently delivers nothing.
  useRealtimeAuth();

  // Browser errors, unhandled rejections and console.error calls are forwarded
  // to error_events, which is what AI API Manager -> Alerts -> Error Monitor reads.
  useEffect(() => {
    installClientErrorMonitor();
  }, []);

  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/*
        The language the visitor chose. This provider was defined and never
        mounted, so every useLanguage() in the app read the default context and
        translate() handed the key straight back - the selector changed the
        document direction and no text at all.
      */}
      <LanguageProvider>
      <TooltipProvider>
        <CelebrationProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          {/* Operator consoles are gated centrally by path; public pages pass straight through. */}
          {/* Notices a ?ref= arrival on any page and tells the server once. */}
          <ReferralCapture />
          <RouteAccessGate>
            <Outlet />
          </RouteAccessGate>
        </CelebrationProvider>
      </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
