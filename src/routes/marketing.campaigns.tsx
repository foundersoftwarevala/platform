import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  IndianRupee,
  Layers,
  Megaphone,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";

import {
  ProgressBar,
  QueryState,
  ScreenHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/marketing/kit";
import {
  CAMPAIGN_CHANNELS,
  CAMPAIGN_STATUSES,
  CampaignForm,
  campaignToForm,
  emptyCampaign,
  type CampaignFormValues,
} from "@/components/marketing/campaign-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  recordAudit,
  tableQuery,
  useCreateRow,
  useDeleteRow,
  useUpdateRow,
  type Row,
} from "@/lib/marketing/api";
import { csvFilename, downloadCsv } from "@/lib/marketing/csv";

import { compactInr, compactNum, ctr, inr, num, pct, roas, shortDate } from "@/lib/marketing/format";

export const Route = createFileRoute("/marketing/campaigns")({
  head: () => ({
    meta: [
      { title: "Campaigns — Software Vala Marketing Manager" },
      {
        name: "description",
        content:
          "Create, edit, pause and analyse every Software Vala marketing campaign with live spend, leads, ROAS and linked ad groups.",
      },
      { property: "og:title", content: "Campaigns — Software Vala Marketing Manager" },
      {
        property: "og:description",
        content: "Full campaign lifecycle management with live budget pacing and performance joins.",
      },
    ],
  }),
  component: CampaignsScreen,
});

type Campaign = Row<"marketing_campaigns">;

function toCsv(rows: Campaign[]) {
  const headers = [
    "code",
    "name",
    "channel",
    "objective",
    "status",
    "start_date",
    "end_date",
    "budget",
    "spend",
    "impressions",
    "clicks",
    "conversions",
    "leads",
    "revenue",
    "region",
    "owner",
  ] as const;
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

function CampaignsScreen() {
  const campaigns = useQuery(tableQuery("marketing_campaigns", { column: "created_at" }));
  const adGroups = useQuery(tableQuery("marketing_ad_groups", { column: "spend" }));
  const creatives = useQuery(tableQuery("marketing_creatives", { column: "performance_score" }));
  const budgets = useQuery(tableQuery("marketing_budgets", { column: "allocated" }));
  const schedules = useQuery(tableQuery("marketing_schedules", { column: "scheduled_at" }));
  const snapshots = useQuery(
    tableQuery("marketing_kpi_snapshots", { column: "metric_date", ascending: true }),
  );

  const create = useCreateRow("marketing_campaigns");
  const update = useUpdateRow("marketing_campaigns");
  const remove = useDeleteRow("marketing_campaigns");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState<CampaignFormValues | null>(null);
  const [detail, setDetail] = useState<Campaign | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Campaign | null>(null);

  const rows = campaigns.data ?? [];

  const filtered = useMemo(
    () =>
      rows.filter((c) => {
        const q = search.trim().toLowerCase();
        const matchesQuery =
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (c.owner ?? "").toLowerCase().includes(q) ||
          (c.region ?? "").toLowerCase().includes(q);
        return (
          matchesQuery &&
          (status === "all" || c.status === status) &&
          (channel === "all" || c.channel === channel)
        );
      }),
    [rows, search, status, channel],
  );

  const totals = filtered.reduce(
    (acc, c) => ({
      budget: acc.budget + Number(c.budget),
      spend: acc.spend + Number(c.spend),
      revenue: acc.revenue + Number(c.revenue),
      leads: acc.leads + Number(c.leads),
      conversions: acc.conversions + Number(c.conversions),
    }),
    { budget: 0, spend: 0, revenue: 0, leads: 0, conversions: 0 },
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyCampaign());
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setForm(campaignToForm(c));
  };

  const submitForm = () => {
    if (!form) return;
    const values = {
      code: form.code.trim(),
      name: form.name.trim(),
      channel: form.channel,
      objective: form.objective,
      status: form.status,
      start_date: form.start_date,
      end_date: form.end_date,
      budget: form.budget,
      kpi_target: form.kpi_target.trim() || null,
      region: form.region || null,
      owner: form.owner.trim() || null,
    };

    if (editing) {
      update.mutate(
        { id: editing.id, values: { ...values, updated_at: new Date().toISOString() } },
        {
          onSuccess: (saved) => {
            void recordAudit({
              actor: "marketing_manager",
              action: "update",
              entity_type: "campaign",
              entity_id: saved.id,
              entity_name: saved.name,
              module: "campaigns",
              details: `Campaign updated (${saved.status})`,
            });
            toast.success(`Updated “${saved.name}”`);
            setForm(null);
            setEditing(null);
          },
          onError: (e: Error) => toast.error(e.message),
        },
      );
      return;
    }

    create.mutate(values, {
      onSuccess: (saved) => {
        void recordAudit({
          actor: "marketing_manager",
          action: "create",
          entity_type: "campaign",
          entity_id: saved.id,
          entity_name: saved.name,
          module: "campaigns",
          details: `Campaign created on ${saved.channel}`,
        });
        toast.success(`Created “${saved.name}”`);
        setForm(null);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const changeStatus = (c: Campaign, next: string) => {
    update.mutate(
      { id: c.id, values: { status: next, updated_at: new Date().toISOString() } },
      {
        onSuccess: () => {
          void recordAudit({
            actor: "marketing_manager",
            action: next,
            entity_type: "campaign",
            entity_id: c.id,
            entity_name: c.name,
            module: "campaigns",
            details: `Status changed ${c.status} → ${next}`,
          });
          toast.success(`“${c.name}” is now ${next}`);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    remove.mutate(target.id, {
      onSuccess: () => {
        void recordAudit({
          actor: "marketing_manager",
          action: "delete",
          entity_type: "campaign",
          entity_id: target.id,
          entity_name: target.name,
          module: "campaigns",
          details: "Campaign deleted",
        });
        toast.success(`Deleted “${target.name}”`);
        setPendingDelete(null);
        if (detail?.id === target.id) setDetail(null);
      },
      onError: (e: Error) => {
        toast.error(e.message);
        setPendingDelete(null);
      },
    });
  };

  const exportCsv = async () => {
    // Audit first: the download click can cancel in-flight requests in some browsers.
    await recordAudit({
      actor: "marketing_manager",
      action: "export",
      entity_type: "campaign",
      module: "campaigns",
      details: `Exported ${filtered.length} campaigns to CSV`,
    });
    downloadCsv(csvFilename("software-vala-campaigns"), toCsv(filtered));
    toast.success(`Exported ${filtered.length} campaigns`);
  };


  const refreshAll = () => {
    void Promise.all([
      campaigns.refetch(),
      adGroups.refetch(),
      creatives.refetch(),
      budgets.refetch(),
      schedules.refetch(),
      snapshots.refetch(),
    ]);
    toast.success("Campaign data refreshed");
  };

  const detailAdGroups = (adGroups.data ?? []).filter((g) => g.campaign_id === detail?.id);
  const detailCreatives = (creatives.data ?? []).filter((c) => c.campaign_id === detail?.id);
  const detailSchedules = (schedules.data ?? []).filter((s) => s.campaign_id === detail?.id);
  const detailBudgets = (budgets.data ?? []).filter((b) => b.channel === detail?.channel);
  const detailSnapshots = detail
    ? (snapshots.data ?? []).filter(
        (s) => s.metric_date >= detail.start_date && s.metric_date <= detail.end_date,
      )
    : [];

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Campaign Management"
        description="Every live, scheduled and archived campaign with budget pacing, delivery and return."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={campaigns.isFetching}>
              <RefreshCw className={`h-4 w-4 ${campaigns.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void exportCsv()}
              disabled={filtered.length === 0}
            >

              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New campaign
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          index={0}
          label="Budget"
          value={compactInr(totals.budget)}
          sublabel={`${filtered.length} campaigns in view`}
          icon={IndianRupee}
          tone="violet"
        />
        <StatCard
          index={1}
          label="Spend"
          value={compactInr(totals.spend)}
          sublabel={`${pct(totals.budget > 0 ? (totals.spend / totals.budget) * 100 : 0)} of budget`}
          icon={Target}
          tone="blue"
        />
        <StatCard
          index={2}
          label="Revenue"
          value={compactInr(totals.revenue)}
          sublabel={`${roas(totals.revenue, totals.spend).toFixed(2)}x ROAS`}
          icon={TrendingUp}
          tone="green"
        />
        <StatCard
          index={3}
          label="Leads"
          value={compactNum(totals.leads)}
          sublabel={`${compactNum(totals.conversions)} conversions`}
          icon={Megaphone}
          tone="gold"
        />
      </div>

      <SectionCard
        title="All campaigns"
        description="Search, filter and manage the full campaign portfolio."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, code, owner"
                className="h-9 w-56 pl-8"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {CAMPAIGN_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {Array.from(new Set([...CAMPAIGN_CHANNELS, ...rows.map((r) => r.channel)])).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        <QueryState
          isLoading={campaigns.isLoading}
          error={campaigns.error}
          data={filtered}
          emptyMessage="No campaigns match these filters."
        >
          {(data) => (
            <div className="overflow-x-auto">
              <Table className="min-w-[1180px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Flight</TableHead>
                    <TableHead className="w-40">Budget pacing</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((c) => {
                    const groups = (adGroups.data ?? []).filter((g) => g.campaign_id === c.id).length;
                    return (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer"
                        onClick={() => setDetail(c)}
                      >
                        <TableCell>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.code} · {c.objective.replace(/_/g, " ")} · {groups} ad groups
                          </p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.channel}</TableCell>
                        <TableCell>
                          <StatusBadge value={c.status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {shortDate(c.start_date)} → {shortDate(c.end_date)}
                        </TableCell>
                        <TableCell>
                          <ProgressBar
                            value={Number(c.spend)}
                            max={Number(c.budget)}
                            tone={Number(c.spend) / Math.max(Number(c.budget), 1) > 0.9 ? "rose" : "teal"}
                          />
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {compactInr(Number(c.spend))} / {compactInr(Number(c.budget))}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">{num(Number(c.leads))}</TableCell>
                        <TableCell className="text-right">
                          {pct(ctr(Number(c.clicks), Number(c.impressions)), 2)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-status-success">
                          {roas(Number(c.revenue), Number(c.spend)).toFixed(2)}x
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {c.status === "active" ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Pause campaign"
                                onClick={() => changeStatus(c, "paused")}
                              >
                                <Pause className="h-4 w-4 text-status-warning" />
                              </Button>
                            ) : c.status === "paused" || c.status === "draft" ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Activate campaign"
                                onClick={() => changeStatus(c, "active")}
                              >
                                <Play className="h-4 w-4 text-status-success" />
                              </Button>
                            ) : null}
                            <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Delete"
                              onClick={() => setPendingDelete(c)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </QueryState>
      </SectionCard>

      {/* create / edit */}
      <Dialog
        open={form !== null}
        onOpenChange={(open) => {
          if (!open) {
            setForm(null);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit campaign" : "Create campaign"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update targeting, flight dates, budget and lifecycle status."
                : "Campaigns start with zero delivery; performance fills in as the channel reports."}
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <CampaignForm
              value={form}
              onChange={setForm}
              onSubmit={submitForm}
              onCancel={() => {
                setForm(null);
                setEditing(null);
              }}
              submitLabel={editing ? "Save changes" : "Create campaign"}
              isPending={create.isPending || update.isPending}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* delete */}
      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the campaign and unlinks its ad groups, creatives and
              schedules. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete campaign</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* detail */}
      <Sheet open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {detail ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {detail.name}
                  <StatusBadge value={detail.status} />
                </SheetTitle>
                <SheetDescription>
                  {detail.code} · {detail.channel} · {detail.region ?? "—"} · owner{" "}
                  {detail.owner ?? "unassigned"}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 px-4 pb-8">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Budget" value={inr(Number(detail.budget))} />
                  <Metric label="Spend" value={inr(Number(detail.spend))} />
                  <Metric label="Revenue" value={inr(Number(detail.revenue))} />
                  <Metric
                    label="ROAS"
                    value={`${roas(Number(detail.revenue), Number(detail.spend)).toFixed(2)}x`}
                  />
                  <Metric label="Impressions" value={num(Number(detail.impressions))} />
                  <Metric label="Clicks" value={num(Number(detail.clicks))} />
                  <Metric label="Leads" value={num(Number(detail.leads))} />
                  <Metric label="Conversions" value={num(Number(detail.conversions))} />
                  <Metric label="KPI target" value={detail.kpi_target ?? "—"} />
                  <Metric
                    label="Flight"
                    value={`${shortDate(detail.start_date)} → ${shortDate(detail.end_date)}`}
                  />
                </div>

                <DetailList
                  title="Ad groups"
                  icon={<Layers className="h-4 w-4" />}
                  empty="No ad groups linked yet — add them in Campaign Builder."
                  items={detailAdGroups.map((g) => ({
                    id: g.id,
                    primary: g.name,
                    secondary: `${g.platform} · ${g.level} · ${num(Number(g.clicks))} clicks`,
                    trailing: compactInr(Number(g.spend)),
                    status: g.status,
                  }))}
                />

                <DetailList
                  title="Creatives"
                  icon={<Megaphone className="h-4 w-4" />}
                  empty="No creatives linked to this campaign."
                  items={detailCreatives.map((c) => ({
                    id: c.id,
                    primary: c.name,
                    secondary: `${c.asset_type} · ${c.format}${c.dimensions ? ` · ${c.dimensions}` : ""}`,
                    trailing: `${Number(c.performance_score).toFixed(1)} score`,
                    status: c.status,
                  }))}
                />

                <DetailList
                  title="Schedules"
                  icon={<RefreshCw className="h-4 w-4" />}
                  empty="No schedules configured."
                  items={detailSchedules.map((s) => ({
                    id: s.id,
                    primary: s.title,
                    secondary: `${s.channel} · ${s.recurrence} · ${shortDate(s.scheduled_at)}`,
                    trailing: s.owner ?? "—",
                    status: s.status,
                  }))}
                />

                <DetailList
                  title={`Budgets on ${detail.channel}`}
                  icon={<IndianRupee className="h-4 w-4" />}
                  empty="No channel budget lines."
                  items={detailBudgets.map((b) => ({
                    id: b.id,
                    primary: b.name,
                    secondary: `${b.period} · committed ${compactInr(Number(b.committed))}`,
                    trailing: `${compactInr(Number(b.spent))} / ${compactInr(Number(b.allocated))}`,
                    status: b.status,
                  }))}
                />

                <div>
                  <p className="mb-2 text-sm font-semibold">Performance during flight</p>
                  {detailSnapshots.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No daily KPI snapshots inside this flight window yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <Metric
                        label="Spend"
                        value={compactInr(
                          detailSnapshots.reduce((s, r) => s + Number(r.spend), 0),
                        )}
                      />
                      <Metric
                        label="Leads"
                        value={num(detailSnapshots.reduce((s, r) => s + r.leads, 0))}
                      />
                      <Metric
                        label="Revenue"
                        value={compactInr(
                          detailSnapshots.reduce((s, r) => s + Number(r.revenue), 0),
                        )}
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => openEdit(detail)}>
                    <Pencil className="h-4 w-4" /> Edit campaign
                  </Button>
                  {detail.status === "active" ? (
                    <Button size="sm" variant="outline" onClick={() => changeStatus(detail, "paused")}>
                      <Pause className="h-4 w-4" /> Pause
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => changeStatus(detail, "active")}>
                      <Play className="h-4 w-4" /> Activate
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeStatus(detail, "completed")}
                  >
                    Mark completed
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-secondary/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function DetailList({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  items: Array<{
    id: string;
    primary: string;
    secondary: string;
    trailing: string;
    status: string;
  }>;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
        <span className="text-xs font-normal text-muted-foreground">({items.length})</span>
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li
              key={i.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-secondary/30 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{i.primary}</p>
                <p className="truncate text-xs text-muted-foreground">{i.secondary}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium">{i.trailing}</p>
                <StatusBadge value={i.status} className="mt-1 text-[10px]" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
