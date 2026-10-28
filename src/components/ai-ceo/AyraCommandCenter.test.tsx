// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AyraCommandCenter } from "./AyraCommandCenter";

afterEach(() => cleanup());

describe("AYRA Command Center", () => {
  it("explains that Control Panel roles govern access and exposes no local grant controls", () => {
    render(<AyraCommandCenter open onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "AYRA COMMAND CENTER" })).toBeTruthy();
    expect(
      screen.getByText(
        "Actual Control Panel roles and server authorization govern these settings.",
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Command Center PIN")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Select role" })).toBeNull();
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
