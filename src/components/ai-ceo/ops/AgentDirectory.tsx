import { Link } from "@tanstack/react-router";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Bot, CheckCircle2, Cpu, Wrench } from "lucide-react";

import {
  DegradedNotice,
  EmptyState,
  ErrorState,
  LoadingState,
  PageBanner,
  PageShell,
} from "@/components/ai-ceo/PageShell";
import { Badge } from "@/components/ui/badge";
import { useCEOOps } from "@/hooks/useCEOOps";

import { Figure, OpsTable, OpsTile, SourceNote, ToneBadge } from "./shared";

/**
 * Every AI agent the platform has registered.
 *
 * The imported module shipped this screen with a catalogue of eight agents
 * written into the file — names, owners, risk tiers, permission matrices —
 * under a comment saying none of them was deployed and a runtime API would
 * arrive later. That is a directory of things that do not exist, and an
 * executive reading it would have had no way to tell.
 *
 * This reads `ai_agents`. The table is the platform's own register of agents,
 * with the model each one runs on, the tools it may call and the success rate
 * recorded against its runs. Where the table is empty the screen says the
 * table is empty and names it, because "no agents are registered" is a fact an
 * operator can act on and an invented list is not.
 */
export function AgentDirectory() {
  const { t } = useTranslation();
  const { agents, summary, sources, degraded, isLoading, failed, refetch } = useCEOOps();

  if (isLoading) {
    return (
      <PageShell>
        <PageBanner
          eyebrow="AI CEO · Operations"
          title={t("ceo.agents")}
          subtitle="Every AI agent registered on the platform, with the model it runs on and the work it has done."
          icon={Bot}
        />
        <LoadingState label={t("ceo.agents_loading")} />
      </PageShell>
    );
  }

  if (failed) {
    return (
      <PageShell>
        <PageBanner eyebrow="AI CEO · Operations" title={t("ceo.agents")} icon={Bot} />
        <ErrorState
          title={t("ceo.agents_failed")}
          description="ai_agents could not be read, so this screen cannot say whether any agents are registered."
          onRetry={() => void refetch()}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageBanner
        eyebrow="AI CEO · Operations"
        title={t("ceo.agents")}
        subtitle="Every AI agent registered on the platform, with the model it runs on and the work it has done."
        icon={Bot}
        status={summary.agents === null ? "Not measured" : `${summary.agents} registered`}
      />

      {degraded.length > 0 && <DegradedNotice sources={degraded} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OpsTile
          label={t("ceo.registered")}
          value={summary.agents}
          icon={Bot}
          hint={sources.agents}
        />
        <OpsTile
          label={t("ceo.active")}
          value={summary.agentsActive}
          icon={CheckCircle2}
          tone="success"
        />
        <OpsTile
          label={t("ceo.runs_30d")}
          value={agents.reduce<number | null>(
            (total, a) => (a.runs30d === null ? total : (total ?? 0) + a.runs30d),
            null,
          )}
          icon={Cpu}
        />
        <OpsTile
          label={t("ceo.tools_wired")}
          value={new Set(agents.flatMap((a) => a.tools)).size || null}
          icon={Wrench}
        />
      </div>

      <SourceNote source={sources.agents} count={agents.length} />

      <OpsTable
        head={["Agent", "Status", t("ceo.model"), "Runs 30d", "Success", t("ceo.tools")]}
        rows={agents.map((agent) => [
          <Link
            key="n"
            to="/ai-ceo/agents/$agentId"
            params={{ agentId: agent.id }}
            className="font-medium text-primary hover:underline"
          >
            {agent.name}
          </Link>,
          <ToneBadge key="s" value={agent.status} />,
          <span key="m" className="font-mono text-xs">
            {agent.modelId ?? "—"}
          </span>,
          <Figure key="r" value={agent.runs30d} />,
          <Figure key="p" value={agent.successRate} suffix="%" />,
          <span key="t" className="flex flex-wrap gap-1">
            {agent.tools.length === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              agent.tools.slice(0, 3).map((tool) => (
                <Badge key={tool} variant="outline" className="text-[10px]">
                  {tool}
                </Badge>
              ))
            )}
          </span>,
        ])}
        empty={
          <EmptyState
            icon={Bot}
            title={t("ceo.agents_empty")}
            description="ai_agents holds no rows. This screen lists whatever that table contains — nothing here is simulated, so it stays empty until an agent is registered."
          />
        }
      />
    </PageShell>
  );
}

/** One agent, with everything the register records about it. */
export function AgentDetail({ agentId }: { agentId: string }) {
  const { t } = useTranslation();
  const { agents, isLoading, failed, refetch } = useCEOOps();
  const agent = agents.find((a) => a.id === agentId);

  if (isLoading) {
    return (
      <PageShell>
        <LoadingState label={t("ceo.agents_loading")} rows={1} />
      </PageShell>
    );
  }

  if (failed) {
    return (
      <PageShell>
        <ErrorState
          title={t("ceo.agents_failed")}
          description="ai_agents could not be read."
          onRetry={() => void refetch()}
        />
      </PageShell>
    );
  }

  if (!agent) {
    return (
      <PageShell>
        <PageBanner eyebrow="AI CEO · Operations" title={t("ceo.agent_not_found")} icon={Bot} />
        <EmptyState
          icon={Bot}
          title={t("ceo.agent_no_id")}
          description="ai_agents holds no row with this id. It may have been removed, or the link may be stale."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageBanner
        eyebrow="AI CEO · Operations"
        title={agent.name}
        subtitle={agent.purpose ?? "No purpose is recorded for this agent."}
        icon={Bot}
        status={agent.status}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OpsTile label={t("ceo.runs_30d")} value={agent.runs30d} icon={Cpu} />
        <OpsTile
          label={t("ceo.success_rate")}
          value={agent.successRate === null ? null : `${agent.successRate}%`}
          icon={CheckCircle2}
          tone="success"
        />
        <OpsTile label={t("ceo.max_tokens")} value={agent.maxTokens} icon={Cpu} />
        <OpsTile label={t("ceo.tools")} value={agent.tools.length || null} icon={Wrench} />
      </div>

      <div className="bento-card p-5">
        <h3 className="text-sm font-semibold">{t("ceo.agent_model_and_tools")}</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t("ceo.model")}
            </dt>
            <dd className="mt-1 font-mono text-xs">{agent.modelId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t("ceo.registered")}
            </dt>
            <dd className="mt-1 font-mono text-xs">
              {agent.createdAt ? agent.createdAt.slice(0, 10) : "—"}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {agent.tools.length === 0 ? (
            <span className="text-sm text-muted-foreground">{t("ceo.agent_no_tools")}</span>
          ) : (
            agent.tools.map((tool) => (
              <Badge key={tool} variant="outline">
                {tool}
              </Badge>
            ))
          )}
        </div>
      </div>
    </PageShell>
  );
}
