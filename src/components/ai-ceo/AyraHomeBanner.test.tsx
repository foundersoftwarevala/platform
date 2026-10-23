// @vitest-environment jsdom
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { AyraHomeBanner } from "./AyraHomeBanner";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/i18n/use-translation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("AyraHomeBanner", () => {
  it("advertises the read-only module and links to its existing route", () => {
    render(<AyraHomeBanner />);

    expect(screen.getByRole("heading", { name: "ceo.ayra_home_title" })).toBeTruthy();
    expect(screen.getByText("ceo.ayra_home_read_only")).toBeTruthy();
    expect(screen.getByRole("link", { name: /ceo\.ayra_home_open/ }).getAttribute("href")).toBe(
      "/ai-ceo/ayra",
    );
  });
});
