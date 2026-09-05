import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { createFakeSupabase, withQueryClient } from "@/test/utils";

const leadRows = [
  {
    id: "l1",
    reference: "LD-001",
    company: "Acme Corp",
    contact_name: "Ann Rao",
    email: "ann@acme.test",
    phone: "+1000",
    category: "ERP",
    source: "website",
    urgency: "hot",
    stage: "new",
    value: 12000,
    ai_win_probability: 80,
    qualified: false,
    assigned_to: "m1",
    created_at: new Date().toISOString(),
  },
  {
    id: "l2",
    reference: "LD-002",
    company: "Globex",
    contact_name: "Bo Singh",
    email: null,
    phone: null,
    category: null,
    source: "referral",
    urgency: "hot",
    stage: "contacted",
    value: 4000,
    ai_win_probability: 60,
    qualified: true,
    assigned_to: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "l3",
    reference: "LD-003",
    company: "Initech",
    contact_name: "Cy Kim",
    email: null,
    phone: null,
    category: null,
    source: "ads",
    urgency: "warm",
    stage: "won",
    value: 8000,
    ai_win_probability: 40,
    qualified: true,
    assigned_to: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "l4",
    reference: "LD-004",
    company: "Umbrella",
    contact_name: "Di Roy",
    email: null,
    phone: null,
    category: null,
    source: "cold-call",
    urgency: "cold",
    stage: "qualified",
    value: 2000,
    ai_win_probability: 20,
    qualified: true,
    assigned_to: null,
    created_at: new Date().toISOString(),
  },
  // Closed-lost lead: must be excluded from the Hot/Warm/Cold queue badges.
  {
    id: "l5",
    reference: "LD-005",
    company: "Stark",
    contact_name: "Ed Vaz",
    email: null,
    phone: null,
    category: null,
    source: "website",
    urgency: "hot",
    stage: "lost",
    value: 1000,
    ai_win_probability: 0,
    qualified: false,
    assigned_to: null,
    created_at: new Date().toISOString(),
  },
];

const memberRows = [{ id: "m1", full_name: "Priya Nair", department: "sales" }];

// vi.mock factories are hoisted, so the fake client is reached through a
// hoisted holder that is populated once this module evaluates.
const holder = vi.hoisted(() => ({ from: (() => {}) as (table: string) => any }));

const fake = createFakeSupabase({ sales_leads: leadRows, team_members: memberRows });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => holder.from(table) },
}));

holder.from = fake.client.from;

import LeadInbox from "@/components/sales-support/LeadInbox";

/** Reads the number rendered directly above a KPI/badge caption. */
function tileValue(label: string) {
  const captions = screen
    .getAllByText(label)
    .filter((el) => el.classList.contains("text-xs"));
  const value = captions[0]?.parentElement?.querySelector("div.text-2xl");
  return value?.textContent?.trim() ?? "";
}

describe("LeadInbox renders from live queries", () => {
  beforeEach(() => {
    fake.calls.length = 0;
  });
  afterEach(cleanup);

  it("queries the leads table instead of using in-component data", async () => {
    render(withQueryClient(<LeadInbox />));
    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    expect(fake.calls).toContain("sales_leads");
  });

  it("renders one row per lead returned by the query", async () => {
    render(withQueryClient(<LeadInbox />));
    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    for (const lead of leadRows) {
      expect(screen.getByText(lead.reference)).toBeInTheDocument();
      expect(screen.getByText(lead.company)).toBeInTheDocument();
    }
  });

  it("derives Hot/Warm/Cold badges from the fetched leads (open leads only)", async () => {
    render(withQueryClient(<LeadInbox />));
    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());

    const open = leadRows.filter((l) => l.stage !== "won" && l.stage !== "lost");
    const count = (urgency: string) => open.filter((l) => l.urgency === urgency).length;

    expect(screen.getByText(`${count("hot")} Hot`)).toBeInTheDocument();
    expect(screen.getByText(`${count("warm")} Warm`)).toBeInTheDocument();
    expect(screen.getByText(`${count("cold")} Cold`)).toBeInTheDocument();
    // guards against the old hardcoded "5 Hot / 8 Warm / 12 Cold" trio
    expect(screen.queryByText("5 Hot")).not.toBeInTheDocument();
  });

  it("computes the summary KPIs from the same dataset as the badges", async () => {
    render(withQueryClient(<LeadInbox />));
    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());

    const qualified = leadRows.filter((l) => l.qualified).length;
    const avgWin = Math.round(
      leadRows.reduce((s, l) => s + l.ai_win_probability, 0) / leadRows.length,
    );
    const conversion = Math.round(
      (leadRows.filter((l) => l.stage === "won").length / leadRows.length) * 100,
    );

    expect(tileValue("Total Leads")).toBe(String(leadRows.length));
    expect(tileValue("Qualified")).toBe(String(qualified));
    expect(tileValue("Avg Win Probability")).toBe(`${avgWin}%`);
    expect(tileValue("Conversion Rate")).toBe(`${conversion}%`);
  });

  it("shows the assigned owner resolved from the team members query", async () => {
    render(withQueryClient(<LeadInbox />));
    await waitFor(() => expect(screen.getByText("Owner: Priya Nair")).toBeInTheDocument());
    expect(fake.calls).toContain("team_members");
  });

  it("renders an empty state rather than placeholder rows when there are no leads", async () => {
    const empty = createFakeSupabase({ sales_leads: [], team_members: [] });
    const original = holder.from;
    holder.from = empty.client.from;
    try {
      render(withQueryClient(<LeadInbox />));
      await waitFor(() =>
        expect(screen.getByText("No leads in the queue yet.")).toBeInTheDocument(),
      );
      expect(screen.getByText("0 Hot")).toBeInTheDocument();
      expect(tileValue("Total Leads")).toBe("0");
    } finally {
      holder.from = original;
    }
  });
});
