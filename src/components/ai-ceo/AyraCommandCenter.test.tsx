// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { askAyra, getAyraCommandSettings, saveAyraCommandSettings } from "@/lib/ayra/functions";
import { DEFAULT_AYRA_COMMAND_SETTINGS } from "@/lib/ayra/command-settings";
import { AyraCommandCenter } from "./AyraCommandCenter";

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (handler: unknown) => handler,
}));

vi.mock("@/lib/ayra/functions", () => ({
  askAyra: vi.fn(),
  getAyraLiveFeed: vi.fn(),
  getAyraCommandSettings: vi.fn(),
  saveAyraCommandSettings: vi.fn(),
}));

vi.mock("@/lib/i18n/use-translation", () => ({
  Msg: ({ k }: { k: string }) => k,
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) => {
      const messages: Record<string, string> = {
        "ceo.ayra_command_search_google": "Search Google",
        "ceo.ayra_command_google_search": "Google Search",
        "ceo.ayra_command_open_settings": "Open AYRA Command Center settings",
        "ceo.ayra_command_retry_settings": "Retry settings",
        "ceo.ayra_command_live_reactions": "Human live reactions",
        "ceo.ayra_command_settings_saved": "Settings saved.",
        "ceo.ayra_command_prompt_label": "Ask AYRA",
        "ceo.ayra_command_send": "Send command",
        "ceo.ayra_command_inspected": "Read-only platform inspection · {tools}",
      };

      return (messages[key] ?? key).replace(
        /\{(\w+)\}/g,
        (_match, name: string) => values?.[name] ?? "",
      );
    },
  }),
}));

function renderCommandCenter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AyraCommandCenter />
    </QueryClientProvider>,
  );
}

describe("AyraCommandCenter", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAyraCommandSettings).mockResolvedValue(DEFAULT_AYRA_COMMAND_SETTINGS);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("opens a real Google search in a new tab", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);

    renderCommandCenter();

    const search = await screen.findByRole("textbox", { name: "Search Google" });
    fireEvent.change(search, { target: { value: "Software Vala AYRA" } });
    fireEvent.click(screen.getByRole("button", { name: "Google Search" }));

    expect(open).toHaveBeenCalledWith(
      "https://www.google.com/search?q=Software%20Vala%20AYRA",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("changes the scene to a selected reference look and plays its matching motion clip", async () => {
    const { container } = renderCommandCenter();

    fireEvent.click(await screen.findByRole("button", { name: "Bridal Veil" }));

    await waitFor(() => {
      expect(container.querySelector('video[src*="scene-veil"]')).toBeTruthy();
    });
    expect(screen.getAllByText("Bridal Veil")).toHaveLength(2);
  });

  it("saves Command Center toggles to the server-backed settings key", async () => {
    vi.mocked(saveAyraCommandSettings).mockResolvedValue({
      ...DEFAULT_AYRA_COMMAND_SETTINGS,
      liveReactions: true,
    });

    renderCommandCenter();

    fireEvent.click(
      await screen.findByRole("button", { name: "Open AYRA Command Center settings" }),
    );
    fireEvent.click(await screen.findByRole("switch", { name: "Human live reactions" }));

    await waitFor(() => {
      expect(saveAyraCommandSettings).toHaveBeenCalledWith({
        data: {
          ...DEFAULT_AYRA_COMMAND_SETTINGS,
          liveReactions: true,
        },
      });
    });
    expect(await screen.findByText("Settings saved.")).toBeTruthy();
  });

  it("reports settings read failures and lets the operator retry", async () => {
    vi.mocked(getAyraCommandSettings)
      .mockRejectedValueOnce(new Error("Settings service unavailable"))
      .mockResolvedValue(DEFAULT_AYRA_COMMAND_SETTINGS);

    renderCommandCenter();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Settings service unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry settings" }));

    await waitFor(() => {
      expect(getAyraCommandSettings).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  it("sends commands through the read-only AYRA service and plays its real response gesture", async () => {
    vi.mocked(getAyraCommandSettings).mockResolvedValue({
      ...DEFAULT_AYRA_COMMAND_SETTINGS,
      liveReactions: true,
    });
    vi.mocked(askAyra).mockResolvedValue({
      answer: "Platform health is available.",
      toolsUsed: ["getPlatformHealth"],
    });

    const { container } = renderCommandCenter();
    const input = await screen.findByRole("textbox", { name: "Ask AYRA" });
    fireEvent.change(input, { target: { value: "Check platform health" } });
    fireEvent.click(screen.getByRole("button", { name: "Send command" }));

    expect(await screen.findByText("Platform health is available.")).toBeTruthy();
    expect(askAyra).toHaveBeenCalledWith({
      data: { prompt: "Check platform health" },
    });
    await waitFor(() => {
      expect(container.querySelector('video[aria-label="AYRA Wave animation"]')).toBeTruthy();
    });
  });
});
