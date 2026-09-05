import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Image as ImageIcon, Layers, Megaphone } from "lucide-react";

import { QueryState, ScreenHeader, SectionCard, StatCard, StatusBadge } from "@/components/marketing/kit";
import { Button } from "@/components/ui/button";
import { tableQuery } from "@/lib/marketing/api";
import { compactInr, compactNum, ctr, num, pct } from "@/lib/marketing/format";

export const Route = createFileRoute("/marketing/hierarchy")({
  head: () => ({
    meta: [
      { title: "Campaign Hierarchy — Software Vala Marketing Manager" },
      {
        name: "description",
        content:
          "Drill from campaign to ad group to creative with live spend, clicks and conversions at every level.",
      },
      { property: "og:title", content: "Campaign Hierarchy — Software Vala" },
      {
        property: "og:description",
        content: "Campaign → ad group → creative tree with live performance at each level.",
      },
    ],
  }),
  component: HierarchyScreen,
});

function HierarchyScreen() {
  const campaigns = useQuery(tableQuery("marketing_campaigns", { column: "spend" }));
  const adGroups = useQuery(tableQuery("marketing_ad_groups", { column: "spend" }));
  const creatives = useQuery(tableQuery("marketing_creatives", { column: "performance_score" }));
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const groupsByCampaign = useMemo(() => {
    const map = new Map<string, typeof adGroups.data extends undefined ? never : NonNullable<typeof adGroups.data>>();
    for (const g of adGroups.data ?? []) {
      const key = g.campaign_id ?? "unassigned";
      map.set(key, [...(map.get(key) ?? []), g]);
    }
    return map;
  }, [adGroups.data]);

  const creativesByCampaign = useMemo(() => {
    const map = new Map<string, NonNullable<typeof creatives.data>>();
    for (const c of creatives.data ?? []) {
      const key = c.campaign_id ?? "unassigned";
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return map;
  }, [creatives.data]);

  const rows = campaigns.data ?? [];

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Campaign Hierarchy"
        description="Campaign → ad group → creative, with live spend and performance at each level."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Campaigns" value={num(rows.length)} icon={Megaphone} tone="violet" index={0} />
        <StatCard
          label="Ad groups"
          value={num((adGroups.data ?? []).length)}
          icon={Layers}
          tone="blue"
          index={1}
        />
        <StatCard
          label="Creatives"
          value={num((creatives.data ?? []).length)}
          icon={ImageIcon}
          tone="teal"
          index={2}
        />
        <StatCard
          label="Hierarchy spend"
          value={compactInr(rows.reduce((s, c) => s + Number(c.spend ?? 0), 0))}
          icon={Megaphone}
          tone="gold"
          index={3}
        />
      </div>

      <SectionCard title="Structure" description="Expand a campaign to see its ad groups and creatives.">
        <QueryState
          isLoading={campaigns.isLoading}
          error={campaigns.error}
          data={rows}
          emptyMessage="No campaigns yet."
        >
          {(list) => (
            <div className="space-y-2">
              {list.map((c) => {
                const isOpen = !!open[c.id];
                const groups = groupsByCampaign.get(c.id) ?? [];
                const assets = creativesByCampaign.get(c.id) ?? [];
                return (
                  <div key={c.id} className="rounded-lg border border-border/50">
                    <button
                      type="button"
                      onClick={() => setOpen((p) => ({ ...p, [c.id]: !p[c.id] }))}
                      className="flex w-full items-center justify-between gap-3 p-3 text-left"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <Megaphone className="h-4 w-4 shrink-0 text-aurora-violet" />
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        <StatusBadge value={c.status} />
                      </span>
                      <span className="hidden shrink-0 gap-6 text-xs text-muted-foreground sm:flex">
                        <span>{groups.length} ad groups</span>
                        <span>{assets.length} creatives</span>
                        <span>{compactInr(c.spend)} spend</span>
                        <span>
                          CTR {pct(ctr(Number(c.clicks ?? 0), Number(c.impressions ?? 0)), 2)}
                        </span>
                      </span>
                    </button>

                    {isOpen ? (
                      <div className="space-y-3 border-t border-border/50 p-3">
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Ad groups
                          </p>
                          {groups.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No ad groups linked.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {groups.map((g) => (
                                <div
                                  key={g.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-secondary/40 px-3 py-2 text-sm"
                                >
                                  <span className="flex items-center gap-2">
                                    <Layers className="h-3.5 w-3.5 text-aurora-blue" />
                                    {g.name}
                                    <StatusBadge value={g.status} />
                                  </span>
                                  <span className="flex gap-4 text-xs text-muted-foreground">
                                    <span>{g.platform}</span>
                                    <span>{compactInr(g.spend)} / {compactInr(g.budget)}</span>
                                    <span>{compactNum(g.clicks)} clicks</span>
                                    <span>{num(g.conversions)} conv.</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Creatives
                          </p>
                          {assets.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No creatives linked.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {assets.map((a) => (
                                <div
                                  key={a.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-secondary/40 px-3 py-2 text-sm"
                                >
                                  <span className="flex items-center gap-2">
                                    <ImageIcon className="h-3.5 w-3.5 text-aurora-teal" />
                                    {a.name}
                                    <StatusBadge value={a.status} />
                                  </span>
                                  <span className="flex gap-4 text-xs text-muted-foreground">
                                    <span>{a.format}</span>
                                    <span>score {Number(a.performance_score ?? 0).toFixed(1)}</span>
                                    <span>{num(a.usage_count)} uses</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <Button variant="outline" size="sm" asChild>
                          <a href="/marketing/campaign-builder">Edit in Campaign Builder</a>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </QueryState>
      </SectionCard>
    </div>
  );
}
