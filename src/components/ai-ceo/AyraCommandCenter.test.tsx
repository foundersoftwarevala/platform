// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AyraCommandCenter } from "./AyraCommandCenter";

afterEach(() => cleanup());

describe("AYRA Command Center", () => {
  it("requires the demo PIN and keeps local grants when the drawer is reopened", () => {
    const onClose = vi.fn();
    const { rerender } = render(<AyraCommandCenter open onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "AYRA COMMAND CENTER" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Command Center PIN"), {
      target: { value: "0000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(screen.getByRole("alert").textContent).toBe("Incorrect demo PIN.");
    expect(screen.queryByRole("switch")).toBeNull();

    fireEvent.change(screen.getByLabelText("Command Center PIN"), {
      target: { value: "1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    const codingGrant = screen.getAllByRole("switch", {
      name: "Franchise: Allow System Coding (VS Code)",
    })[0];
    if (!codingGrant) throw new Error("Franchise coding grant switch was not rendered.");
    fireEvent.click(codingGrant);
    expect(codingGrant.getAttribute("data-state")).toBe("checked");

    rerender(<AyraCommandCenter open={false} onClose={onClose} />);
    rerender(<AyraCommandCenter open onClose={onClose} />);

    expect(
      screen
        .getAllByRole("switch", { name: "Franchise: Allow System Coding (VS Code)" })[0]
        .getAttribute("data-state"),
    ).toBe("checked");
    expect(
      screen.getByText(/do not change VPS permissions or grant access to tools/i),
    ).toBeTruthy();
  });

  it("closes from the close button and Escape key", () => {
    const onClose = vi.fn();
    const { rerender } = render(<AyraCommandCenter open onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();

    rerender(<AyraCommandCenter open onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
