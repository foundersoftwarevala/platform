import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  createDeal,
  createQuote,
  getSalesWorkspace,
  linkTeamMember,
  updateDealStage,
} from "@/lib/sales-support/core.functions";

type SalesTab = "dashboard" | "leads" | "deals" | "quotes" | "team";
const DEAL_STAGES = ["discovery", "qualification", "proposal", "negotiation", "won", "lost"];
type DealStage = (typeof DEAL_STAGES)[number];

function isDealStage(value: string): value is DealStage {
  return (
    value === "discovery" ||
    value === "qualification" ||
    value === "proposal" ||
    value === "negotiation" ||
    value === "won" ||
    value === "lost"
  );
}

function amount(value: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Number(value),
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed.";
}

export function SalesWorkspace() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const load = useServerFn(getSalesWorkspace);
  const createDealFn = useServerFn(createDeal);
  const createQuoteFn = useServerFn(createQuote);
  const updateStageFn = useServerFn(updateDealStage);
  const linkMemberFn = useServerFn(linkTeamMember);
  const [tab, setTab] = useState<SalesTab>("dashboard");
  const query = useQuery({
    queryKey: ["sales-support-workspace", "sales"],
    queryFn: () => load({ data: undefined }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["sales-support-workspace"] });
  const dealMutation = useMutation({
    mutationFn: (data: {
      title: string;
      leadId: string | null;
      amount: string;
      ownerUserId?: string;
    }) => createDealFn({ data }),
    onSuccess: refresh,
  });
  const quoteMutation = useMutation({
    mutationFn: (data: { dealId: string; title: string; amount: string }) =>
      createQuoteFn({ data }),
    onSuccess: refresh,
  });
  const stageMutation = useMutation({
    mutationFn: (data: { dealId: string; stage: (typeof DEAL_STAGES)[number] }) =>
      updateStageFn({ data }),
    onSuccess: refresh,
  });
  const linkMutation = useMutation({
    mutationFn: (data: { teamMemberId: string; userId: string }) => linkMemberFn({ data }),
    onSuccess: refresh,
  });

  function submitDeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const ownerUserId = String(form.get("ownerUserId") ?? "");
    dealMutation.mutate(
      {
        title: String(form.get("title") ?? ""),
        leadId: String(form.get("leadId") ?? "") || null,
        amount: String(form.get("amount") ?? ""),
        ...(ownerUserId ? { ownerUserId } : {}),
      },
      { onSuccess: () => formElement.reset() },
    );
  }

  function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    quoteMutation.mutate(
      {
        dealId: String(form.get("dealId") ?? ""),
        title: String(form.get("title") ?? ""),
        amount: String(form.get("amount") ?? ""),
      },
      { onSuccess: () => formElement.reset() },
    );
  }

  if (query.isLoading) {
    return (
      <main className="mx-auto max-w-7xl p-6 text-sm text-muted-foreground" role="status">
        {t("sales_support.sales.loading")}
      </main>
    );
  }
  if (query.error || !query.data) {
    return (
      <main className="mx-auto max-w-7xl p-6 text-sm text-destructive" role="alert">
        {errorMessage(query.error)}
      </main>
    );
  }

  const data = query.data;
  const mappedSales = data.team.filter(
    (member) => member.authUserId && member.department.toLowerCase().includes("sales"),
  );
  const tabs: { id: SalesTab; label: string }[] = [
    { id: "dashboard", label: t("sales_support.sales.dashboard") },
    { id: "leads", label: t("sales_support.sales.leads") },
    { id: "deals", label: t("sales_support.sales.deals") },
    { id: "quotes", label: t("sales_support.sales.quotes") },
    ...(data.isManager
      ? [{ id: "team" as const, label: t("sales_support.sales.team_access") }]
      : []),
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header>
        <p className="text-sm font-medium text-primary">{t("sales_support.sales.workspace")}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {t("sales_support.sales.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("sales_support.sales.subtitle")}
        </p>
        {data.isManager && (
          <nav className="mt-4" aria-label={t("sales_support.sales.workspace_navigation")}>
            <Link
              className="inline-flex rounded-md border px-3 py-2 text-sm hover:bg-muted"
              to="/dashboard/support"
            >
              {t("sales_support.sales.support_workspace_link")}
            </Link>
          </nav>
        )}
      </header>
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          className="flex gap-2 overflow-x-auto border-b pb-3 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4"
          aria-label={t("sales_support.sales.pages")}
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => setTab(item.id)}
              className={`rounded-md px-4 py-2 text-sm ${tab === item.id ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-6">
          {tab === "dashboard" && (
            <section
              className="grid gap-4 sm:grid-cols-3"
              aria-label={t("sales_support.sales.totals")}
            >
              <Metric label={t("sales_support.sales.visible_leads")} value={data.leads.length} />
              <Metric label={t("sales_support.sales.visible_deals")} value={data.deals.length} />
              <Metric label={t("sales_support.sales.visible_quotes")} value={data.quotes.length} />
            </section>
          )}

          {tab === "leads" && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">{t("sales_support.sales.leads")}</h2>
              {data.leads.length === 0 ? (
                <Empty>{t("sales_support.sales.no_assigned_leads")}</Empty>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-muted/60">
                      <tr>
                        <Head>{t("sales_support.sales.reference")}</Head>
                        <Head>{t("sales_support.sales.company")}</Head>
                        <Head>{t("sales_support.sales.contact")}</Head>
                        <Head>{t("sales_support.sales.stage")}</Head>
                        <Head>{t("sales_support.sales.value")}</Head>
                      </tr>
                    </thead>
                    <tbody>
                      {data.leads.map((lead) => (
                        <tr key={lead.id} className="border-t">
                          <Cell>{lead.reference}</Cell>
                          <Cell>{lead.company}</Cell>
                          <Cell>
                            {lead.contactName}
                            {lead.email ? (
                              <span className="block text-xs text-muted-foreground">
                                {lead.email}
                              </span>
                            ) : null}
                          </Cell>
                          <Cell>{lead.stage}</Cell>
                          <Cell>{amount(lead.value)}</Cell>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {tab === "deals" && (
            <section className="space-y-5">
              <h2 className="text-xl font-semibold">{t("sales_support.sales.deals")}</h2>
              <form
                onSubmit={submitDeal}
                className="grid gap-3 rounded-lg border p-4 md:grid-cols-2"
              >
                <label className="grid gap-1 text-sm">
                  {t("sales_support.sales.deal_title")}
                  <input
                    className="h-10 rounded-md border bg-background px-3"
                    name="title"
                    required
                    maxLength={200}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  {t("sales_support.sales.amount_inr")}
                  <input
                    className="h-10 rounded-md border bg-background px-3"
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  {t("sales_support.sales.related_lead")}
                  <select
                    className="h-10 rounded-md border bg-background px-3"
                    name="leadId"
                    defaultValue=""
                  >
                    <option value="">{t("sales_support.sales.no_linked_lead")}</option>
                    {data.leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.reference} — {lead.company}
                      </option>
                    ))}
                  </select>
                </label>
                {data.isManager && (
                  <label className="grid gap-1 text-sm">
                    {t("sales_support.sales.sales_owner")}
                    <select
                      className="h-10 rounded-md border bg-background px-3"
                      name="ownerUserId"
                      required
                      defaultValue=""
                    >
                      <option value="" disabled>
                        {t("sales_support.sales.select_representative")}
                      </option>
                      {mappedSales.map((member) => (
                        <option key={member.id} value={member.authUserId!}>
                          {member.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {!data.isManager && !data.teamMemberId && (
                  <p className="text-sm text-amber-700 md:col-span-2" role="status">
                    {t("sales_support.sales.link_account_first")}
                  </p>
                )}
                <button
                  className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  disabled={
                    dealMutation.isPending ||
                    (data.isManager && mappedSales.length === 0) ||
                    (!data.isManager && !data.teamMemberId)
                  }
                  type="submit"
                >
                  {dealMutation.isPending
                    ? t("sales_support.sales.creating")
                    : t("sales_support.sales.create_deal")}
                </button>
                {dealMutation.error && (
                  <p className="text-sm text-destructive md:col-span-2" role="alert">
                    {errorMessage(dealMutation.error)}
                  </p>
                )}
              </form>
              {data.deals.length === 0 ? (
                <Empty>{t("sales_support.sales.no_visible_deals")}</Empty>
              ) : (
                <div className="space-y-3">
                  {data.deals.map((deal) => (
                    <article
                      key={deal.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-medium">{deal.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {deal.reference} · {amount(deal.value)}
                        </p>
                      </div>
                      <select
                        aria-label={`Stage for ${deal.title}`}
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        value={deal.stage}
                        disabled={stageMutation.isPending}
                        onChange={(event) => {
                          const stage = event.currentTarget.value;
                          if (isDealStage(stage)) {
                            stageMutation.mutate({ dealId: deal.id, stage });
                          }
                        }}
                      >
                        {!isDealStage(deal.stage) && (
                          <option value={deal.stage} disabled>
                            {deal.stage} {t("sales_support.sales.read_only")}
                          </option>
                        )}
                        {DEAL_STAGES.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage}
                          </option>
                        ))}
                      </select>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "quotes" && (
            <section className="space-y-5">
              <h2 className="text-xl font-semibold">{t("sales_support.sales.quotes")}</h2>
              <form
                onSubmit={submitQuote}
                className="grid gap-3 rounded-lg border p-4 md:grid-cols-3"
              >
                <label className="grid gap-1 text-sm">
                  {t("sales_support.sales.deal")}
                  <select
                    className="h-10 rounded-md border bg-background px-3"
                    name="dealId"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      {t("sales_support.sales.select_visible_deal")}
                    </option>
                    {data.deals.map((deal) => (
                      <option key={deal.id} value={deal.id}>
                        {deal.reference} — {deal.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  {t("sales_support.sales.quote_title")}
                  <input
                    className="h-10 rounded-md border bg-background px-3"
                    name="title"
                    required
                    maxLength={200}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  {t("sales_support.sales.amount_inr")}
                  <input
                    className="h-10 rounded-md border bg-background px-3"
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                  />
                </label>
                <button
                  className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  type="submit"
                  disabled={quoteMutation.isPending || data.deals.length === 0}
                >
                  {quoteMutation.isPending
                    ? t("sales_support.sales.creating")
                    : t("sales_support.sales.create_quote")}
                </button>
                {quoteMutation.error && (
                  <p className="text-sm text-destructive md:col-span-3" role="alert">
                    {errorMessage(quoteMutation.error)}
                  </p>
                )}
              </form>
              {data.quotes.length === 0 ? (
                <Empty>{t("sales_support.sales.no_visible_quotes")}</Empty>
              ) : (
                <div className="space-y-3">
                  {data.quotes.map((quote) => (
                    <article key={quote.id} className="rounded-lg border p-4">
                      <p className="font-medium">{quote.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {quote.reference} · {quote.status} · {amount(quote.amount)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "team" && data.isManager && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">
                {t("sales_support.sales.link_records")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("sales_support.sales.unlinked_manager_only")}
              </p>
              {data.team.filter((member) => !member.authUserId).length === 0 ? (
                <Empty>{t("sales_support.sales.all_linked")}</Empty>
              ) : (
                data.team
                  .filter((member) => !member.authUserId)
                  .map((member) => {
                    const requiredRole = member.department.toLowerCase().includes("sales")
                      ? "sales"
                      : "support";
                    const options = data.accounts.filter(
                      (account) => account.role === requiredRole,
                    );
                    return (
                      <form
                        key={member.id}
                        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_1fr_auto]"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const userId = String(
                            new FormData(event.currentTarget).get("userId") ?? "",
                          );
                          if (userId) linkMutation.mutate({ teamMemberId: member.id, userId });
                        }}
                      >
                        <div>
                          <p className="font-medium">{member.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.department} · {member.roleTitle}
                          </p>
                        </div>
                        <select
                          className="h-10 rounded-md border bg-background px-3 text-sm"
                          name="userId"
                          required
                          defaultValue=""
                        >
                          <option value="" disabled>
                            {t("sales_support.sales.select_account")} {requiredRole}{" "}
                            {t("sales_support.sales.account")}
                          </option>
                          {options.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.fullName}
                              {account.email ? ` — ${account.email}` : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="h-10 rounded-md border px-4 text-sm disabled:opacity-50"
                          disabled={linkMutation.isPending || options.length === 0}
                        >
                          {t("sales_support.sales.link_account")}
                        </button>
                      </form>
                    );
                  })
              )}
              {linkMutation.error && (
                <p className="text-sm text-destructive" role="alert">
                  {errorMessage(linkMutation.error)}
                </p>
              )}
            </section>
          )}

          {stageMutation.error && (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage(stageMutation.error)}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </article>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground" role="status">
      {children}
    </p>
  );
}

function Head({ children }: { children: string }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">{children}</th>
  );
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}
