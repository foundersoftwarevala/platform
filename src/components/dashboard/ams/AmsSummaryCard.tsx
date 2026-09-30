import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, ChevronRight, IdCard, Sparkles, Trophy } from "lucide-react";

import { getRoleChain, type RoleChain } from "@/lib/ams/chain.functions";
import { amsRoleForDashboard } from "@/lib/ams/dashboard-role";

/**
 * The dashboard's AMS summary: where this person stands in this role's
 * journey, read from ams_role_chain - the same record AMS Manager sees.
 *
 * Current stage, rank and XP; progress to the next stage; the stage's
 * achievement; the next milestone; the latest trophy earned; the passport.
 * Everything is this role's only. With no activity yet it says so and shows no
 * figure, and "Open AMS" leads to the role's full AMS experience.
 */
export function AmsSummaryCard({ dashboardRole, onOpen }: { dashboardRole: string; onOpen: () => void }) {
  const amsRole = amsRoleForDashboard(dashboardRole);
  const fetchChain = useServerFn(getRoleChain);
  const query = useQuery({
    queryKey: ["ams", "role-chain", amsRole],
    queryFn: () => fetchChain({ data: { role: amsRole as string } }),
    enabled: Boolean(amsRole),
    staleTime: 60_000,
  });
  if (!amsRole) return null;

  const chain = query.data as RoleChain | null | undefined;
  const stages = chain?.stages ?? [];
  const stageNo = Number(chain?.current_stage ?? 0);
  const current = stages.find((s) => s.stage === stageNo) ?? null;
  const next = stages.find((s) => s.stage === stageNo + 1) ?? null;
  const earned = (state?: string | null) => state === "earned" || state === "claimed";
  const latestTrophy = [...stages].reverse().find((s) => earned(s.trophy?.state))?.trophy ?? null;
  const xp = Number(chain?.total_xp ?? 0);
  const toNext = next ? Math.max(0, Number(next.min_xp) - xp) : 0;
  const started = stageNo > 0;

  return (
    <section
      aria-label="AMS summary"
      className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-card"
      data-ams-summary={amsRole}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-brand text-brand-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AMS · {amsRole} journey</div>
            <div className="truncate text-base font-semibold">
              {query.isLoading
                ? "Loading…"
                : query.isError
                  ? "Your AMS standing could not be read."
                  : started
                    ? `Stage ${stageNo} of 10 · ${current?.title ?? ""}`
                    : "No AMS activity yet"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="press-3d inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-surface-2"
        >
          Open AMS <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {!query.isLoading && !query.isError && (
        started ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-surface p-3">
              <div className="text-[11px] text-muted-foreground">Rank · XP</div>
              <div className="mt-1 text-sm font-semibold">{current?.standing?.rank ?? "—"} · {xp.toLocaleString()} XP</div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-brand" style={{ width: `${Number(current?.progress_pct ?? 0)}%` }} />
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{Number(current?.progress_pct ?? 0)}% of this stage</div>
            </div>
            <div className="rounded-xl bg-surface p-3">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Award className="h-3 w-3" /> Current achievement</div>
              <div className="mt-1 text-sm font-semibold">{current?.achievement?.name ?? "—"}</div>
              <div className="text-[11px] capitalize text-muted-foreground">{(current?.achievement?.state ?? "").replace(/_/g, " ")}</div>
            </div>
            <div className="rounded-xl bg-surface p-3">
              <div className="text-[11px] text-muted-foreground">Next milestone</div>
              <div className="mt-1 text-sm font-semibold">{next ? `Stage ${next.stage} · ${next.title}` : "Every stage reached"}</div>
              <div className="text-[11px] text-muted-foreground">{next ? `${toNext.toLocaleString()} XP to go` : "Legacy"}</div>
            </div>
            <div className="rounded-xl bg-surface p-3">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Trophy className="h-3 w-3" /> Latest trophy</div>
              <div className="mt-1 text-sm font-semibold">{latestTrophy?.name ?? "None yet"}</div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <IdCard className="h-3 w-3" /> {chain?.passport?.passport_no ?? "Passport not issued yet"}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Your {amsRole} journey starts with your first recognised {amsRole} activity on the platform. Nothing is shown until then.
          </p>
        )
      )}
    </section>
  );
}
