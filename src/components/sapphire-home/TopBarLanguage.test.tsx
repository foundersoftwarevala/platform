// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/components/chat/ChatAppButton", () => ({ ChatAppButton: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/topbar/utility.functions", () => ({
  askStorefrontAi: vi.fn(),
  getExchangeRates: vi.fn(),
  getHolidays: vi.fn(),
  getWeather: vi.fn(),
  translateTexts: vi.fn(),
}));

import { LanguageDock, LanguageSelector } from "@/components/i18n/LanguageSelector";
import { LanguageProvider, useLanguage } from "@/lib/language-catalog";
import { LANGUAGE_COOKIE } from "@/lib/i18n/language-service";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n/registry";
import { LanguagePicker } from "./TopUtilityBar";

const unexpectedRequests: string[] = [];
const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
const identity = (text: string) => text;

function InlinePicker() {
  const { lang, setLanguage } = useLanguage();
  return <LanguagePicker lang={lang.toLowerCase()} apply={setLanguage} busy={false} t={identity} />;
}

function CurrentLanguage() {
  const { lang } = useLanguage();
  return <output aria-label="Current language">{lang}</output>;
}

function Header({ visible = true, mounted = true, canonical = false }) {
  return (
    <LanguageProvider>
      <header hidden={!visible}>
        {mounted && <InlinePicker />}
        {canonical && <LanguageSelector />}
      </header>
      <CurrentLanguage />
      <LanguageDock />
    </LanguageProvider>
  );
}

function clientRects(visible: boolean): DOMRectList {
  const rectangles = visible ? [new DOMRect(0, 0, 140, 40)] : [];
  return Object.assign(rectangles, { item: (index: number) => rectangles[index] ?? null });
}

beforeEach(() => {
  unexpectedRequests.length = 0;
  document.cookie = `${LANGUAGE_COOKIE}=en; Path=/`;
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (
    this: HTMLElement,
  ) {
    return clientRects(!this.closest("[hidden]"));
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
        "http://localhost",
      );
      if (url.pathname === "/api/i18n/session")
        return Response.json({ authenticated: false, tier: "anonymous" });
      if (url.pathname === "/api/i18n/languages") return Response.json({ disabled: [] });
      if (url.pathname === "/api/i18n/pack")
        return Response.json({ entries: {}, withheld: [], locked: [] });
      if (url.pathname === "/api/marketplace/translate" && init?.method === "POST") {
        const request = z
          .object({ texts: z.array(z.string()), target: z.string() })
          .parse(JSON.parse(String(init.body)));
        return Response.json({
          translations: Object.fromEntries(
            request.texts.map((text) => [text, `[fixture ${request.target}] ${text}`]),
          ),
        });
      }
      unexpectedRequests.push(url.pathname);
      throw Error("Unexpected network request in isolated language test: " + url.pathname);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (scrollDescriptor)
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  expect(unexpectedRequests).toEqual([]);
});

async function expectOnlyTopBar() {
  await waitFor(() => {
    expect(document.querySelector("[data-language-dock]")).toBeNull();
    expect(document.querySelectorAll("[data-language-selector]")).toHaveLength(1);
  });
}

describe("one storefront language control", () => {
  it("tests the header actually used by the canonical homepage", () => {
    const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
    expect(source("src/routes/index.tsx")).toContain("@/components/sapphire-home/HomeIndex");
    expect(source("src/components/sapphire-home/HomeIndex.tsx")).toContain(
      "@/components/sapphire-home/UtilityStrip",
    );
    expect(source("src/components/sapphire-home/UtilityStrip.tsx")).toContain(
      "@/components/sapphire-home/TopUtilityBar",
    );
  });
  it("uses the visible top-bar button without a floating duplicate", async () => {
    render(<Header />);
    await expectOnlyTopBar();
    expect(screen.getByRole("button", { name: "Language" })).toBeTruthy();
  });

  it("restores the floating fallback on a page without a header selector", async () => {
    const view = render(<Header />);
    await expectOnlyTopBar();
    view.rerender(<Header mounted={false} />);
    await waitFor(() => expect(document.querySelector("[data-language-dock]")).not.toBeNull());
    expect(document.querySelectorAll("[data-language-selector]")).toHaveLength(1);
  });

  it("keeps language access when a header is hidden and removes the duplicate when revealed", async () => {
    const view = render(<Header visible={false} />);
    await waitFor(() => expect(document.querySelector("[data-language-dock]")).not.toBeNull());
    view.rerender(<Header visible />);
    await expectOnlyTopBar();
  });

  it("does not show the fallback while another canonical inline selector remains", async () => {
    const view = render(<Header canonical />);
    await waitFor(() => expect(document.querySelector("[data-language-dock]")).toBeNull());
    view.rerender(<Header mounted={false} canonical />);
    await expectOnlyTopBar();
    view.rerender(<Header mounted={false} />);
    await waitFor(() => expect(document.querySelector("[data-language-dock]")).not.toBeNull());
  });

  it("offers and switches every one of the 140 canonical languages with real provider cookie persistence and direction", async () => {
    render(<Header />);
    await expectOnlyTopBar();
    fireEvent.click(screen.getByRole("button", { name: "Language" }));
    const panel = screen.getByRole("dialog");
    expect(SUPPORTED_LANGUAGES).toHaveLength(140);
    expect(within(panel).getAllByRole("button")).toHaveLength(140);
    for (const language of SUPPORTED_LANGUAGES) {
      const option = within(panel).getByText(language.code, { exact: true }).closest("button");
      if (!option) throw Error("Missing language option: " + language.code);
      fireEvent.click(option);
      expect(screen.getByLabelText("Current language").textContent).toBe(language.code);
      expect(document.cookie).toContain(`${LANGUAGE_COOKIE}=${language.code}`);
      expect(document.documentElement.lang).toBe(language.code);
      expect(document.documentElement.dir).toBe(language.direction);
      expect(document.querySelector("[data-language-dock]")).toBeNull();
    }
  }, 60_000);

  it("searches a regional/script language without case loss", async () => {
    render(<Header />);
    await expectOnlyTopBar();
    fireEvent.click(screen.getByRole("button", { name: "Language" }));
    const panel = screen.getByRole("dialog");
    fireEvent.change(within(panel).getByRole("textbox", { name: "Language" }), {
      target: { value: "ZH-hAnT" },
    });
    expect(within(panel).getAllByRole("button")).toHaveLength(1);
    fireEvent.click(within(panel).getByRole("button"));
    expect(screen.getByLabelText("Current language").textContent).toBe("zh-Hant");
  });

  it("retains the selected right-to-left language after the provider remounts", async () => {
    const view = render(<Header />);
    await expectOnlyTopBar();
    fireEvent.click(screen.getByRole("button", { name: "Language" }));
    const option = within(screen.getByRole("dialog"))
      .getByText("ar", { exact: true })
      .closest("button");
    if (!option) throw Error("Arabic option missing");
    fireEvent.click(option);
    view.unmount();
    render(<Header />);
    await expectOnlyTopBar();
    expect(screen.getByLabelText("Current language").textContent).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
  });
});
