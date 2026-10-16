// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/hooks/useSalesSupportData", () => ({
  useLeads: () => ({
    data: [
      {
        id: "lead-fixture",
        name: "Fixture Lead",
        contact_name: "Fixture Lead",
        company: "Fixture Company",
        stage: null,
        urgency: "warm",
        value: 50,
        ai_win_probability: 0,
      },
    ],
    isLoading: false,
  }),
  useTickets: () => ({
    data: [
      {
        id: "ticket-fixture",
        customer_name: "Fixture Customer",
        subject: "Fixture issue",
        reference: "FIX-001",
        status: null,
        priority: "low",
        created_at: "2026-10-14T00:00:00Z",
      },
    ],
    isLoading: false,
  }),
  useCallLogs: () => ({
    data: [
      {
        id: "call-fixture",
        caller_name: null,
        direction: "inbound",
        status: null,
        started_at: "2026-10-14T00:00:00Z",
        created_at: "2026-10-14T00:00:00Z",
      },
    ],
    isLoading: false,
  }),
  useTeamMembers: () => ({ data: [] }),
  useEmailQueue: () => ({ data: [] }),
  useChatSessions: () => ({ data: [] }),
  useChatMessages: () => ({ data: [] }),
  useUpdateRow: () => ({ mutateAsync: mocks.update, mutate: mocks.update }),
  useInsertRow: () => ({ mutateAsync: vi.fn() }),
  relativeTime: () => "just now",
  memberName: () => null,
}));
import { SSMSupportTickets } from "@/components/sales-support-manager/SSMSupportTickets";
import LeadInbox from "./LeadInbox";
import SalesLeadsModule from "./modules/SalesLeadsModule";
import SupportTicketsModule from "./modules/SupportTicketsModule";
import CallCenterModule from "./modules/CallCenterModule";
import OmniChannelInbox from "@/components/support/OmniChannelInbox";
afterEach(cleanup);

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe("nullable database statuses", () => {
  it.each([SSMSupportTickets, SupportTicketsModule, CallCenterModule, SalesLeadsModule])(
    "renders a neutral Unknown status without string-operation crashes: %s",
    (Component) => {
      render(<Component />, { wrapper });
      expect(screen.getByText("Unknown")).toBeTruthy();
      expect(screen.queryByText("null")).toBeNull();
    },
  );

  it("preserves progression for an unassigned lead stage", async () => {
    render(<LeadInbox />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /advance fixture company/i }));
    await waitFor(() =>
      expect(mocks.update.mock.calls.at(-1)?.[0]).toEqual({
        id: "lead-fixture",
        values: { stage: "new", qualified: false },
      }),
    );
  });

  it("keeps null callers searchable and nullable ticket/call statuses readable", () => {
    render(<OmniChannelInbox />, { wrapper });
    expect(screen.getByText("Unknown caller")).toBeTruthy();
    expect(screen.getByText("inbound call · unknown status")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "Unknown caller" },
    });
    expect(screen.getByText("Unknown caller")).toBeTruthy();
    expect(screen.queryByText("Fixture Customer")).toBeNull();
  });
});
