import { createFileRoute } from "@tanstack/react-router";
import { CanonicalLogin } from "@/components/auth/CanonicalLogin";
import { Toaster } from "@/components/ui/sonner";
import { MAX_VISIBLE_TOASTS } from "@/lib/portal/config";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

/**
 * Somebody sent here from a page they were trying to use - a demo, most often -
 * should land back on that page once they are signed in, not on the home page.
 * Only a path on this site is accepted, so the parameter cannot be used to
 * bounce a visitor somewhere else.
 *
 * The test was `startsWith("/") && !startsWith("//")`, which `/\evil.com`
 * passes and a browser then follows off-site. It now resolves the address
 * against this origin and keeps it only if it stays here (safe-redirect.ts).
 */
function destination(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const asked = new URLSearchParams(window.location.search).get("redirect") ?? "";
  return safeRedirectPath(asked);
}

/**
 * The sign-in page needs somewhere for its notifications to appear.
 *
 * `CanonicalLogin` has always raised its refusals through `toast` — a wrong
 * password, an OAuth provider error, the outcome of "Forgot password?" — but no
 * `<Toaster />` was ever mounted anywhere above it, and Sonner renders nothing
 * without one. Every one of those messages was being composed and thrown away.
 * Pressing "Forgot password?" was the worst of them: the reset mail was sent,
 * or refused, and the page said nothing either way, so the only reasonable
 * reading was that the button did not work.
 *
 * This is the same `Toaster` the operator consoles already mount — the existing
 * notification system, not a second one. It is capped at two at a time, so a
 * visitor holding Enter cannot bury the form under a column of them.
 */
export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Software Vala™" }] }),
  component: () => (
    <>
      <CanonicalLogin redirectTo={destination()} />
      <Toaster visibleToasts={MAX_VISIBLE_TOASTS} />
    </>
  ),
});