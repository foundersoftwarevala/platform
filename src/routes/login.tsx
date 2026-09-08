import { createFileRoute } from "@tanstack/react-router";
import { CanonicalLogin } from "@/components/auth/CanonicalLogin";

/**
 * Somebody sent here from a page they were trying to use - a demo, most often -
 * should land back on that page once they are signed in, not on the home page.
 * Only a path on this site is accepted, so the parameter cannot be used to
 * bounce a visitor somewhere else.
 */
function destination(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const asked = new URLSearchParams(window.location.search).get("redirect") ?? "";
  return asked.startsWith("/") && !asked.startsWith("//") ? asked : undefined;
}

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Software Vala™" }] }),
  component: () => <CanonicalLogin redirectTo={destination()} />,
});