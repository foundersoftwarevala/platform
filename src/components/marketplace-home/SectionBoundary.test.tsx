// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HomeBoundary, SectionBoundary } from "./SectionBoundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("marketplace error boundaries", () => {
  it("renders a healthy section without showing a fallback", () => {
    render(
      <SectionBoundary label="Catalogue">
        <p>Catalogue content</p>
      </SectionBoundary>,
    );

    expect(screen.getByText("Catalogue content")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("logs a section failure, isolates it and retries successfully", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("Section fixture failure");
    let shouldFail = true;
    function Section() {
      if (shouldFail) throw failure;
      return <p>Recovered section</p>;
    }

    render(
      <>
        <p>Unaffected sibling</p>
        <SectionBoundary label="Catalogue">
          <Section />
        </SectionBoundary>
      </>,
    );

    expect(screen.getByText("Catalogue could not be loaded right now.")).toBeTruthy();
    expect(screen.getByText("Unaffected sibling")).toBeTruthy();
    expect(logged).toHaveBeenCalledWith("[marketplace-home] section failed:", "Catalogue", failure);

    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("Recovered section")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("renders a healthy homepage without showing its fallback shell", () => {
    render(
      <HomeBoundary>
        <p>Healthy homepage</p>
      </HomeBoundary>,
    );

    expect(screen.getByText("Healthy homepage")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reload the marketplace" })).toBeNull();
  });

  it("preserves the branded homepage fallback, logging and retry", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("Homepage fixture failure");
    let shouldFail = true;
    function Homepage() {
      if (shouldFail) throw failure;
      return <p>Recovered homepage</p>;
    }

    render(
      <HomeBoundary>
        <Homepage />
      </HomeBoundary>,
    );

    expect(screen.getByRole("heading", { name: "Software Vala" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    expect(logged).toHaveBeenCalledWith(
      "[marketplace-home] homepage crashed:",
      failure,
      expect.objectContaining({ componentStack: expect.any(String) }),
    );

    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "Reload the marketplace" }));

    expect(screen.getByText("Recovered homepage")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Software Vala" })).toBeNull();
  });
});
