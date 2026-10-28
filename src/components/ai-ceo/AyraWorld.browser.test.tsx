// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrowserPanel } from "./AyraWorld";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AYRA workspace browser shortcuts", () => {
  it("loads shortcuts inside the panel and offers explicit external fallback", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<BrowserPanel onRun={vi.fn()} reply="" busy={false} />);

    fireEvent.click(screen.getByRole("button", { name: /YouTube/ }));
    const frame = screen.getByTitle("External page www.youtube.com") as HTMLIFrameElement;
    expect(frame.src).toBe("https://www.youtube.com/");
    expect(
      screen.getByText(
        /Some providers, including Google sign-in and Gmail, block iframe embedding/,
      ),
    ).toBeTruthy();
    expect(open).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open separately" }));
    expect(open).toHaveBeenCalledWith("https://www.youtube.com/", "_blank", "noopener,noreferrer");
  });

  it("keeps navigation in the iframe for Google searches", () => {
    render(<BrowserPanel onRun={vi.fn()} reply="" busy={false} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search Google" }), {
      target: { value: "Software Vala" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Google Search" }));
    const frame = screen.getByTitle("External page www.google.com") as HTMLIFrameElement;
    expect(frame.src).toBe("https://www.google.com/search?q=Software%20Vala");
  });
});
