import type { FloatingElement } from "@/lib/storefront/chrome.functions";

export type FloatingPageScope = FloatingElement["scope"] | "other";

export function getFloatingScope(pathname: string): FloatingPageScope {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/marketplace") return "home";
  if (!path.startsWith("/marketplace/")) return "other";

  const segments = path.slice("/marketplace/".length).split("/");
  if (segments[0] === "product" && segments.length > 1) return "product";
  if (segments[0] === "category" && segments.length > 1) return "category";
  if (segments[0] === "country" && segments.length > 1) return "marketplace";
  if (segments.length === 2 || segments.length >= 3) return "category";
  return "marketplace";
}
