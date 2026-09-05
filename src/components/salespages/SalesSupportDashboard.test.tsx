import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { createFakeSupabase, withQueryClient } from "@/test/utils";

const now = new Date().toISOString();

const ticketRows = [
  { id: "t1", status: "open", sla_breached: false, sla_minutes_remaining: 120, created_at: now },
  { id: "t2", status: "pending", sla_breached: false, sla_minutes_remaining: 15, created_at: now },
  { id: "t3", status: "resolved", sla_breached: true, sla_minutes_remaining: 0, created_at: now },
];
const escalationRows = [
  { id: "e1", status: "open", level: 2, created_at: now },
  { id: "e2", status: "resolved", level: 3, created_at: now },
  { id: "e3", status: "open", level: 1, created_at: now },
];
const callRows = [
  { id: "c1", status: "missed", started_at: now, created_at: now },
  { id: "c2", status: "completed", started_at: now, created_at: now },
  { id: "c3", status: "missed", started_at: now, created_at: now },
];
const leadRows = [
  { id: "l1", urgency: "hot", stage: "new", created_at: now },
  { id: "l2", urgency: "hot", stage: "contacted", created_at: now },
  { id: "l3", urgency: "hot", stage: "won", created_at: now },
  { id: "l4", urgency: "warm", stage: "new", created_at: now },
];

// vi.mock factories are hoisted, so the fake client is reached through a
// hoisted holder that is populated once this module evaluates.
const holder = vi.hoisted(() => ({ from: (() => {}) as (table: string) => any }));

const fake = createFakeSupabase({
  support_tickets: ticketRows,
  support_escalations: escalationRows,
  call_logs: callRows,
  sales_leads: leadRows,
  team_members: [],
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => holder.from(table) },
}));

holder.from = fake.client.from;

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useSearch: () => ({ section: undefined }),
}));

// Shell + heavy section modules are out of scope for this KPI test.
vi.mock("@/components/sales-support/SalesSupportTopBar", () => ({ default: () => null }));
vi.mock("@/components/sales-support/SalesPerformanceDashboard", () => ({ default: () => null }));
vi.mock("@/components/sales-support/LeadInbox", () => ({
  default: () => <div data-testid="lead-inbox" />,
}));
vi.mock("@/components/sales-support/modules", () => ({
  SupportTeamModule: () => null,
  SalesTeamModule: () => null,
  SupportTicketsModule: () => null,
  SalesLeadsModule: () => null,
  CRMCustomersModule: () => null,
  CallCenterModule: () => null,
  EmailQueueModule: () => null,
  LiveChatModule: () => null,
  EscalationsModule: () => null,
  SLAComplianceModule: () => null,
  AIInsightsModule: () => null,
  SSMSettingsModule: () => null,
}));

import SalesSupportDashboard from "@/components/salespages/SalesSupportDashboard";

function kpiValue(label: string) {
  const button = screen.getByRole("button", { name: new RegExp(`^${label}:`) });
  return button.querySelector("div.text-2xl")?.textContent ?? "";
}

describe("Dashboard KPIs render from live queries", () => {
  afterEach(cleanup);

  it("reads every KPI from its backing table", async () => {
    render(withQueryClient(<SalesSupportDashboard />));
    await waitFor(() => expect(screen.getByTestId("lead-inbox")).toBeInTheDocument());
    for (const table of ["support_tickets", "support_escalations", "call_logs", "sales_leads"]) {
      expect(fake.calls).toContain(table);
    }
  });

  it("computes each KPI value from the fetched rows", async () => {
    render(withQueryClient(<SalesSupportDashboard />));

    const ticketsWaiting = ticketRows.filter(
      (t) => t.status === "open" || t.status === "pending",
    ).length;
    const slaRisk =
      ticketRows.filter((t) => t.sla_breached || t.sla_minutes_remaining <= 30).length +
      escalationRows.filter((e) => e.status !== "resolved" && e.level >= 2).length;
    const missedCalls = callRows.filter((c) => c.status === "missed").length;
    const hotLeads = leadRows.filter(
      (l) => l.urgency === "hot" && l.stage !== "won" && l.stage !== "lost",
    ).length;

    await waitFor(() => expect(kpiValue("Tickets Waiting")).toBe(String(ticketsWaiting)));
    expect(kpiValue("SLA Breach Risk")).toBe(String(slaRisk));
    expect(kpiValue("Missed Calls")).toBe(String(missedCalls));
    expect(kpiValue("Hot Sales Leads")).toBe(String(hotLeads));
  });

  it("exposes KPI tiles as keyboard-reachable buttons that deep-link by section", async () => {
    render(withQueryClient(<SalesSupportDashboard />));
    const tile = await screen.findByRole("button", { name: /^Hot Sales Leads:/ });
    tile.click();
    expect(navigate).toHaveBeenCalledWith({ to: "/", search: { section: "sales-leads" } });
  });

  it("renders zeros instead of placeholder numbers when the tables are empty", async () => {
    const empty = createFakeSupabase({});
    const original = holder.from;
    holder.from = empty.client.from;
    try {
      render(withQueryClient(<SalesSupportDashboard />));
      await waitFor(() => expect(kpiValue("Tickets Waiting")).toBe("0"));
      expect(kpiValue("SLA Breach Risk")).toBe("0");
      expect(kpiValue("Missed Calls")).toBe("0");
      expect(kpiValue("Hot Sales Leads")).toBe("0");
    } finally {
      holder.from = original;
    }
  });
});
