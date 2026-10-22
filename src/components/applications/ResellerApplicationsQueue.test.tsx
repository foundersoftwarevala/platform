// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("@/lib/auth/operator-fetch", () => ({
  authHeaders: async () => ({ Authorization: "Bearer fixture-token" }),
}));
vi.mock("@/lib/i18n/use-translation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-permissions", () => ({
  useSessionRole: () => ({ role: "reseller_manager", ready: true }),
}));
vi.mock("@/lib/applications/use-application-updates", () => ({
  useApplicationUpdates: () => undefined,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { ResellerApplicationsQueue } from "./RoleApplicationsQueue";

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  auth.fetch.mockResolvedValue(
    Response.json({
      total: 1,
      byRole: [{ kind: "reseller", count: 1 }],
      emailProviderConfigured: false,
      rows: [
        {
          kind: "reseller",
          id: "pending-id",
          number: "RS-PENDING",
          name: "Pending Applicant",
          email: "pending@example.invalid",
          status: "pending",
          reason: null,
          submitted: "2026-10-01T00:00:00Z",
          actions: [],
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", auth.fetch);
});

afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
});

describe("Reseller Manager application queue", () => {
  it("requests the restricted reseller summary list without decision or detail controls", async () => {
    const { container } = render(createElement(ResellerApplicationsQueue), { wrapper });

    expect(await screen.findByText("Pending Applicant")).toBeTruthy();
    expect(auth.fetch.mock.calls.some(([input]) => String(input).includes("counts=true"))).toBe(
      false,
    );
    await waitFor(() =>
      expect(auth.fetch).toHaveBeenCalledWith(
        expect.stringContaining("kind=reseller&filter=reseller-manager"),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer fixture-token" }),
        }),
      ),
    );
    expect(container.querySelector("[data-approve]")).toBeNull();
    expect(container.querySelector("[data-reject]")).toBeNull();
    expect(container.querySelector("[data-details]")).toBeNull();
    expect(container.querySelector("select")).toBeNull();
  });
});
