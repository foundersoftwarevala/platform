import { describe, expect, it } from "vitest";
import {
  classifySearchEngine,
  isAttributionMeaningful,
  readAttribution,
} from "@/lib/marketplace/attribution";

/**
 * What a lead is allowed to claim about where it came from.
 *
 * Every capture recorded source "marketplace", so a visitor who searched on
 * Google and asked for a demo was filed as a walk-in and the SEO programme
 * could not show a single lead for its work. These are the rules that decide
 * otherwise, and they have to be exactly right: crediting the wrong page is
 * worse than crediting none, because it is believed.
 */

const SITE = "https://softwarevala.net";

describe("classifySearchEngine", () => {
  it("recognises the engines this catalogue is built for", () => {
    const cases: [string, string][] = [
      ["https://www.google.com/search?q=school+erp", "google"],
      ["https://www.google.co.in/search?q=pos", "google"],
      ["https://www.bing.com/search?q=hospital+software", "bing"],
      ["https://yandex.ru/search/?text=crm", "yandex"],
      ["https://search.naver.com/search.naver?query=erp", "naver"],
      ["https://www.baidu.com/s?wd=erp", "baidu"],
      ["https://duckduckgo.com/?q=billing", "duckduckgo"],
      ["https://search.yahoo.co.jp/search?p=erp", "yahoo"],
      ["https://www.ecosia.org/search?q=erp", "ecosia"],
      ["https://search.brave.com/search?q=erp", "brave"],
      ["https://www.seznam.cz/?q=erp", "seznam"],
    ];
    for (const [referrer, engine] of cases) {
      expect(classifySearchEngine(referrer), referrer).toBe(engine);
    }
  });

  it("does not read an engine's name in a path as the engine", () => {
    expect(classifySearchEngine("https://example.com/google-review")).toBeNull();
    expect(classifySearchEngine("https://notgoogle.com/x")).toBeNull();
    expect(classifySearchEngine("https://bing.com.evil.net/x")).toBeNull();
  });

  it("returns nothing for a non-engine, a blank, or a malformed referrer", () => {
    expect(classifySearchEngine("https://news.ycombinator.com/")).toBeNull();
    expect(classifySearchEngine("")).toBeNull();
    expect(classifySearchEngine(null)).toBeNull();
    expect(classifySearchEngine("not a url")).toBeNull();
  });
});

describe("readAttribution", () => {
  it("reads a search arrival on a card slot", () => {
    const a = readAttribution(
      `${SITE}/marketplace/school-erp/india`,
      "https://www.google.com/search?q=school+erp+india",
    );
    expect(a.landing_page).toBe("/marketplace/school-erp/india");
    expect(a.search_engine).toBe("google");
    expect(a.referrer).toContain("google.com");
    expect(isAttributionMeaningful(a)).toBe(true);
  });

  it("reads all five campaign parameters", () => {
    const a = readAttribution(
      `${SITE}/marketplace?utm_source=newsletter&utm_medium=email&utm_campaign=diwali&utm_term=erp&utm_content=hero`,
      null,
    );
    expect(a.utm_source).toBe("newsletter");
    expect(a.utm_medium).toBe("email");
    expect(a.utm_campaign).toBe("diwali");
    expect(a.utm_term).toBe("erp");
    expect(a.utm_content).toBe("hero");
    expect(a.landing_page).toContain("utm_campaign=diwali");
  });

  it("drops an internal referrer, so a lead is never a self-referral", () => {
    const a = readAttribution(`${SITE}/marketplace/product/x`, `${SITE}/marketplace`);
    expect(a.referrer).toBeNull();
    expect(a.search_engine).toBeNull();
    expect(isAttributionMeaningful(a)).toBe(false);
  });

  it("keeps the landing page even for a direct arrival", () => {
    const a = readAttribution(`${SITE}/marketplace/country/india`, null);
    expect(a.landing_page).toBe("/marketplace/country/india");
    expect(isAttributionMeaningful(a)).toBe(false);
  });

  it("invents nothing when there is nothing to read", () => {
    const a = readAttribution("not a url", null);
    expect(a.landing_page).toBeNull();
    expect(a.referrer).toBeNull();
    expect(a.utm_source).toBeNull();
    expect(a.search_engine).toBeNull();
  });

  it("caps a campaign value rather than storing an essay", () => {
    const long = "x".repeat(900);
    const a = readAttribution(`${SITE}/?utm_campaign=${long}`, null);
    expect(a.utm_campaign!.length).toBe(200);
  });

  it("records when it was captured", () => {
    const a = readAttribution(`${SITE}/`, "https://www.bing.com/search?q=a");
    expect(a.captured_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
