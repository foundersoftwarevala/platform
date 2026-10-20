// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/marketplace-content/heroQueries", () => ({
  heroPublicQuery: () => ({}),
}));
vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: () => ({
    data: [
      {
        id: "fixture-slide",
        icon_name: "Boxes",
        title: "Published slide",
        kicker: "Published kicker",
        subtitle: "Published subtitle",
        cta_link: "/marketplace",
        cta_primary: "Browse software",
        cta_secondary_link: "/vala-tv",
        cta_secondary: "Watch Live Demo",
        gradient: "",
        accent: "",
      },
    ],
  }),
}));
import HeroCarousel from "./HeroCarousel";
afterEach(cleanup);

it("connects the actual homepage to the sapphire hero, not the unused marketplace copy", () => {
  const route = readFileSync(resolve("src", "routes", "index.tsx"), "utf8");
  const home = readFileSync(resolve("src", "components", "sapphire-home", "HomeIndex.tsx"), "utf8");
  expect(route).toContain('from "@/components/sapphire-home/HomeIndex"');
  expect(home).toContain('from "@/components/sapphire-home/HeroCarousel"');
  expect(home).toContain("<HeroCarousel />");
});

it("adds a request link while preserving both published slide actions", () => {
  render(<HeroCarousel />);
  expect(screen.getByRole("link", { name: "Request Your Software" }).getAttribute("href")).toBe(
    "/request-software",
  );
  expect(screen.getByRole("link", { name: "Browse software" }).getAttribute("href")).toBe(
    "/marketplace",
  );
  expect(screen.getByRole("link", { name: "Watch Live Demo" }).getAttribute("href")).toBe(
    "/vala-tv",
  );
});
