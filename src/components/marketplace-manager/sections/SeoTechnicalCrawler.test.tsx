// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SeoTechnicalCrawler } from "./SeoTechnicalCrawler";

const mocks = vi.hoisted(() => ({
  runCrawl: vi.fn(),
  refetchJobs: vi.fn(),
  refetchLinks: vi.fn(),
  jobs: {
    data: [] as Array<Record<string, unknown>>,
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  },
  links: {
    data: [] as Array<Record<string, unknown>>,
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@/lib/use-seo-technical-crawl", () => ({
  useSeoProductCrawlJobs: () => mocks.jobs,
  useSeoProductBrokenLinks: () => mocks.links,
  useRunSeoProductCrawl: () => ({ mutate: mocks.runCrawl, isPending: false }),
}));

describe("Technical SEO crawler UI", () => {
  beforeEach(() => {
    mocks.runCrawl.mockClear();
    mocks.refetchJobs.mockClear();
    mocks.refetchLinks.mockClear();
    mocks.jobs.data = [];
    mocks.jobs.isPending = false;
    mocks.jobs.isFetching = false;
    mocks.jobs.isError = false;
    mocks.jobs.refetch = mocks.refetchJobs;
    mocks.links.data = [];
    mocks.links.isPending = false;
    mocks.links.isFetching = false;
    mocks.links.isError = false;
    mocks.links.refetch = mocks.refetchLinks;
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the clean empty state and triggers the first-50 scan action", () => {
    render(<SeoTechnicalCrawler />);

    expect(screen.getByRole("status").textContent).toContain("No crawl jobs yet");
    fireEvent.click(screen.getByRole("button", { name: "Start Crawl" }));
    expect(mocks.runCrawl).toHaveBeenCalledTimes(1);
  });

  it("shows no broken links until a scan detects one and supports manual refresh", () => {
    render(<SeoTechnicalCrawler />);
    fireEvent.click(screen.getByRole("button", { name: "Broken Links" }));

    expect(screen.getByRole("status").textContent).toContain("No broken links detected.");
    fireEvent.click(screen.getByRole("button", { name: "Refresh Data" }));
    expect(mocks.refetchLinks).toHaveBeenCalledTimes(1);
  });

  it("renders the exact broken URL, source URL, and HTTP status", () => {
    mocks.links.data = [
      {
        id: "link-1",
        domain: "softwarevala.net",
        url: "https://softwarevala.net/marketplace/product/missing-product",
        source_url: "https://softwarevala.net/marketplace/category/education",
        http_status: 404,
        status: "open",
      },
    ];
    render(<SeoTechnicalCrawler />);
    fireEvent.click(screen.getByRole("button", { name: "Broken Links" }));

    expect(screen.getByRole("link", { name: mocks.links.data[0].url as string })).toBeTruthy();
    expect(
      screen.getByText("https://softwarevala.net/marketplace/category/education"),
    ).toBeTruthy();
    expect(screen.getByText("404")).toBeTruthy();
  });

  it("offers Retry when the broken-link query fails", () => {
    mocks.links.isError = true;
    render(<SeoTechnicalCrawler />);
    fireEvent.click(screen.getByRole("button", { name: "Broken Links" }));

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.refetchLinks).toHaveBeenCalledTimes(1);
  });
});
