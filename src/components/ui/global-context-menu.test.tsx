// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GlobalContextMenu } from "@/components/ui/global-context-menu";

afterEach(cleanup);

describe("GlobalContextMenu", () => {
  it("opens the shared page actions on right click", () => {
    render(
      <GlobalContextMenu>
        <main>Dashboard</main>
      </GlobalContextMenu>,
    );

    fireEvent.contextMenu(screen.getByRole("main"), { clientX: 24, clientY: 36 });

    expect(screen.getByRole("menuitem", { name: "Go back" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Go forward" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Reload page" })).toBeTruthy();
  });

  it("keeps native right-click behavior in editable controls", () => {
    render(
      <GlobalContextMenu>
        <div>
          <input aria-label="Name" />
          <textarea aria-label="Notes" />
        </div>
      </GlobalContextMenu>,
    );

    for (const control of [
      screen.getByRole("textbox", { name: "Name" }),
      screen.getByRole("textbox", { name: "Notes" }),
    ]) {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      control.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("runs the selected browser action", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    render(
      <GlobalContextMenu>
        <main>Dashboard</main>
      </GlobalContextMenu>,
    );

    fireEvent.contextMenu(screen.getByRole("main"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Go back" }));

    expect(back).toHaveBeenCalledOnce();
  });
});
