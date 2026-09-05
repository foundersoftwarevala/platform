/**
 * OPS — BRANDING ENGINE + BRANDING VALIDATION + DOMAIN / SSL / DNS / HTTPS
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Palette, RefreshCw, ShieldCheck } from "lucide-react";
import { DataStateNotice } from "@/components/demo-manager/DataStateNotice";
import { useAuth } from "@/hooks/useAuth";
import { CheckList, MonitorGap, OpsSection, StateBadge } from "./OpsPrimitives";
import { useOpsActions, useOpsDemos, useOpsDeployments } from "@/hooks/useDemoOps";
import { brandingChecks, domainChecks, isSharedHost, safeUrl } from "@/lib/demo-ops";
import { cn } from "@/lib/utils";

function DemoPicker({
  demos,
  value,
  onChange,
}: {
  demos: { id: string; title: string }[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-border/50 bg-background/60 px-2 text-xs text-foreground max-w-[260px]"
    >
      {demos.map((d) => (
        <option key={d.id} value={d.id}>
          {d.title}
        </option>
      ))}
    </select>
  );
}

export function OpsBrandingPanel() {
  const { user } = useAuth();
  const demosQuery = useOpsDemos();
  const { runAction } = useOpsActions();
  const demos = demosQuery.data ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const active = demos.find((d) => d.id === selected) ?? demos[0] ?? null;

  const fleet = useMemo(() => {
    let missingName = 0;
    let missingFooter = 0;
    let missingWhiteLabel = 0;
    demos.forEach((d) => {
      if (!d.title?.trim()) missingName += 1;
      if (!d.demo_banner_text?.trim()) missingFooter += 1;
      if (!d.masked_url?.trim()) missingWhiteLabel += 1;
    });
    return { missingName, missingFooter, missingWhiteLabel };
  }, [demos]);

  return (
    <OpsSection
      title="Auto Branding Engine & Validation"
      description="Branding fields resolved from the demo record, with each unmonitored asset labelled instead of guessed."
      icon={Palette}
      actions={
        <div className="flex items-center gap-2">
          {demos.length > 0 && <DemoPicker demos={demos} value={active?.id ?? null} onChange={setSelected} />}
          {active && (
            <Button
              size="sm"
              variant="outline"
              disabled={runAction.isPending}
              onClick={() => runAction.mutate({ demo: active, action: "regenerate-branding" })}
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", runAction.isPending && "animate-spin")} />
              Regenerate branding
            </Button>
          )}
        </div>
      }
    >
      <DataStateNotice
        isLoading={demosQuery.isLoading}
        error={demosQuery.error}
        isEmpty={!demosQuery.isLoading && !demosQuery.error && demos.length === 0}
        hasSession={Boolean(user)}
        resource="demo branding"
        emptyTitle="No demos to validate"
        emptyDescription="Branding validation runs per demo record."
        onRetry={() => void demosQuery.refetch()}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">{active && <CheckList checks={brandingChecks(active)} />}</div>
          <div className="space-y-3">
            <div className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">Fleet branding gaps</p>
              {[
                ["Missing company name", fleet.missingName],
                ["Missing footer / banner", fleet.missingFooter],
                ["No white-label URL", fleet.missingWhiteLabel],
              ].map(([label, count]) => (
                <div key={String(label)} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={cn("font-mono", Number(count) ? "text-amber-400" : "text-emerald-400")}>
                    {String(count)}
                  </span>
                </div>
              ))}
            </div>
            <MonitorGap
              title="Logo · Favicon · Theme colour validation"
              requirement="These need a branding profile per demo plus a crawler that fetches the live page. Add the source and this panel will validate wrong/missing assets automatically."
              fields={["branding profile: logo_url, favicon_url, theme_color", "crawler result: fetched_logo_hash, fetched_favicon_hash"]}
            />
          </div>
        </div>
      </DataStateNotice>
    </OpsSection>
  );
}

export function OpsDomainPanel() {
  const { user } = useAuth();
  const demosQuery = useOpsDemos();
  const deploymentsQuery = useOpsDeployments();
  const demos = demosQuery.data ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const active = demos.find((d) => d.id === selected) ?? demos[0] ?? null;
  const deployment = (deploymentsQuery.data ?? []).find((d) => d.demo_id === active?.id) ?? null;

  const fleet = useMemo(() => {
    let http = 0;
    let shared = 0;
    let unparseable = 0;
    demos.forEach((d) => {
      const url = safeUrl(d.url);
      if (!url) {
        unparseable += 1;
        return;
      }
      if (url.protocol !== "https:") http += 1;
      if (isSharedHost(url.hostname)) shared += 1;
    });
    return { http, shared, unparseable };
  }, [demos]);

  return (
    <OpsSection
      title="Domain Mapping · SSL · DNS · HTTPS"
      description="Derived from the stored demo URL and the approved domain on demo_deployments. TLS and DNS probes are reported as not monitored rather than estimated."
      icon={Globe}
      actions={demos.length > 0 ? <DemoPicker demos={demos} value={active?.id ?? null} onChange={setSelected} /> : undefined}
    >
      <DataStateNotice
        isLoading={demosQuery.isLoading}
        error={demosQuery.error ?? deploymentsQuery.error}
        isEmpty={!demosQuery.isLoading && !demosQuery.error && demos.length === 0}
        hasSession={Boolean(user)}
        resource="domain configuration"
        emptyTitle="No demo URLs to check"
        emptyDescription="Domain checks run against the URL stored on each demo."
        onRetry={() => {
          void demosQuery.refetch();
          void deploymentsQuery.refetch();
        }}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div>{active && <CheckList checks={domainChecks(active, deployment as never)} />}</div>
          <div className="space-y-3">
            <div className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-neon-teal" />
                Fleet transport summary
              </p>
              {[
                ["Non-HTTPS URLs", fleet.http, fleet.http > 0],
                ["On shared host (no custom domain)", fleet.shared, fleet.shared > 0],
                ["Unparseable URLs", fleet.unparseable, fleet.unparseable > 0],
              ].map(([label, count, bad]) => (
                <div key={String(label)} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{String(label)}</span>
                  <span className={cn("font-mono", bad ? "text-red-400" : "text-emerald-400")}>{String(count)}</span>
                </div>
              ))}
            </div>
            {deployment && (
              <div className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Deployment record</p>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className="text-[9px]">
                    {String((deployment as any).deployment_status ?? "—")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Domain locked</span>
                  <StateBadge state={(deployment as any).is_domain_locked ? "pass" : "warn"} />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Blocked attempts</span>
                  <span className="font-mono">{String((deployment as any).blocked_attempts ?? 0)}</span>
                </div>
              </div>
            )}
            <MonitorGap
              title="Certificate expiry & DNS records"
              requirement="A TLS handshake and DNS lookup must be executed server-side per demo host, then stored, before expiry countdowns can be shown."
              fields={["ssl_valid_from, ssl_valid_to, ssl_issuer", "dns_a_record, dns_cname, dns_checked_at"]}
            />
          </div>
        </div>
      </DataStateNotice>
    </OpsSection>
  );
}
