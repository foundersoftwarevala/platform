// @vitest-environment jsdom

import { createElement, type ComponentType } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import type { SectionEntry } from "@/components/manager-suite/ManagerWorkspace";
import { franchiseGroups, franchisePrimary } from "../navigation";
import { franchiseRegistry, franchiseStatuses } from "../sectionRegistry";

const navigationKeys = [
  ...franchisePrimary.map((item) => item.label),
  ...franchiseGroups.flatMap((group) => group.items.map((item) => item.label)),
];
const uniqueNavigationKeys = [...new Set(navigationKeys)];

describe("Franchise Manager section registry", () => {
  it("assigns every sidebar key a status and a registry entry unless removed", () => {
    expect(franchiseGroups.flatMap((group) => group.items)).toHaveLength(49);

    for (const key of uniqueNavigationKeys) {
      const status = franchiseStatuses[key];
      expect(status, `${key} needs an explicit status`).toBeDefined();
      if (status === "removed") {
        expect(franchiseRegistry[key]).toBeUndefined();
      } else {
        expect(franchiseRegistry[key], `${key} needs a registry entry`).toBeDefined();
      }
    }

    expect(Object.values(franchiseStatuses).filter((status) => status !== "removed")).toHaveLength(
      uniqueNavigationKeys.length,
    );
  });

  it("renders a coming-soon placeholder instead of a data wall", () => {
    const entry: SectionEntry | undefined = franchiseRegistry.Renewals;
    expect(typeof entry).toBe("function");
    if (typeof entry !== "function") throw new Error("Renewals must render a placeholder");

    const onNavigate = vi.fn();
    render(
      createElement(entry as ComponentType<{ onNavigate?: (id: string) => void }>, { onNavigate }),
    );

    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to dashboard" }));
    expect(onNavigate).toHaveBeenCalledWith("Dashboard");
  });
});
