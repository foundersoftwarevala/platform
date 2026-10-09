import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, FlaskConical, ShieldCheck, Tag } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { cn } from "@/lib/utils";
import {
  api,
  download,
  useAction,
  useApi,
  type Approval,
  type AuditEntry,
  type Evidence,
  type Release,
} from "../api";
import { useCan } from "../session";
import {
  Badge,
  Card,
  Empty,
  ErrorBox,
  inputClass,
  Loading,
  Page,
  PageHeader,
  SandboxChip,
} from "../ui";
import { relativeTime, shortSha } from "../format";
import { EvidenceOutput } from "./TaskDetail";

// ---- QA & Verification --------------------------------------------------------

export function QA() {
  const { translate: t } = useLanguage();
  const evidence = useApi<Evidence[]>(["evidence"], "/evidence", { refetchInterval: 10_000 });
  const [producer, setProducer] = useState<"" | "agent" | "verifier">("");
  const [verdict, setVerdict] = useState<"" | "pass" | "fail" | "unknown">("");
  const [open, setOpen] = useState<string | null>(null);
  const rows = (evidence.data ?? []).filter(
    (e) => (!producer || e.producer === producer) && (!verdict || e.verdict === verdict),
  );

  return (
    <div>
      <PageHeader
        title={t("QA & Verification")}
        description={t(
          "Every acceptance check that has run, by the agent and by the independent verifier, with its stored output and hash.",
        )}
        icon={FlaskConical}
      />
      <Page>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label={t("Producer")}
            value={producer}
            onChange={(e) => setProducer(e.target.value as typeof producer)}
            className={cn(inputClass, "w-44")}
          >
            <option value="">{t("Agent and verifier")}</option>
            <option value="agent">{t("Agent runs")}</option>
            <option value="verifier">{t("Verifier runs")}</option>
          </select>
          <select
            aria-label={t("Verdict")}
            value={verdict}
            onChange={(e) => setVerdict(e.target.value as typeof verdict)}
            className={cn(inputClass, "w-40")}
          >
            <option value="">{t("Any verdict")}</option>
            <option value="pass">{t("pass")}</option>
            <option value="fail">{t("fail")}</option>
            <option value="unknown">{t("unknown")}</option>
          </select>
        </div>
        <ErrorBox error={evidence.error} />
        {evidence.isPending ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>{t("No checks have run.")}</Empty>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {rows.map((ev) => (
              <li key={ev.id} className="px-3 py-2">
                <button
                  onClick={() => setOpen(open === ev.id ? null : ev.id)}
                  className="flex w-full flex-wrap items-center gap-2 text-left text-sm"
                >
                  <Badge value={ev.verdict} />
                  <span className="rounded border border-border px-1.5 text-[11px] uppercase">
                    {t(ev.producer)}
                  </span>
                  <SandboxChip sandbox={ev.sandbox} />
                  <span>{ev.label}</span>
                  <code className="text-xs text-muted-foreground">{ev.command}</code>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {ev.task_id} · {shortSha(ev.commit_sha)} · {relativeTime(ev.created_at)}
                  </span>
                </button>
                {open === ev.id ? (
                  <div>
                    {ev.task_id ? (
                      <Link
                        to="/vala-ai/tasks/$taskId"
                        params={{ taskId: ev.task_id }}
                        className="text-xs underline"
                      >
                        {t("Open task")}
                      </Link>
                    ) : null}
                    <EvidenceOutput ev={ev} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Page>
    </div>
  );
}

// ---- Releases -----------------------------------------------------------------

export function Releases() {
  const { translate: t } = useLanguage();
  const releases = useApi<Release[]>(["releases"], "/releases");
  const [err, setErr] = useState<Error | null>(null);
  return (
    <div>
      <PageHeader
        title={t("Versions & Releases")}
        description={t(
          "Immutable release records: the verified commit, the patch against the previous release, its SHA-256 and the evidence behind it.",
        )}
        icon={Tag}
      />
      <Page>
        <ErrorBox error={releases.error ?? err} />
        {releases.isPending ? (
          <Loading />
        ) : (releases.data ?? []).length === 0 ? (
          <Empty>
            {t(
              "No releases yet. A release is requested from a COMPLETE, verified task and approved by an owner.",
            )}
          </Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-surface/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">{t("Release")}</th>
                  <th className="px-3 py-2">{t("Project")}</th>
                  <th className="px-3 py-2">{t("Commit")}</th>
                  <th className="px-3 py-2">{t("Patch SHA-256")}</th>
                  <th className="px-3 py-2">{t("Created")}</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">{t("Patch download")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {releases.data!.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <span className="font-semibold">{r.label}</span>{" "}
                      <span className="font-mono text-xs text-muted-foreground">{r.id}</span>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to="/vala-ai/projects/$projectId"
                        params={{ projectId: r.project_id }}
                        className="underline"
                      >
                        {r.project_id}
                      </Link>{" "}
                      ·{" "}
                      <Link
                        to="/vala-ai/tasks/$taskId"
                        params={{ taskId: r.task_id }}
                        className="underline"
                      >
                        {r.task_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {shortSha(r.base_commit)} → {shortSha(r.commit_sha)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.patch_sha256.slice(0, 16)}…</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {relativeTime(r.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => {
                          setErr(null);
                          void download(`/releases/${r.id}/patch`, `${r.id}.patch`).catch(
                            (e: Error) => setErr(e),
                          );
                        }}
                        className="text-xs underline"
                      >
                        {t("Download patch")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {t(
            "A downloaded patch is checked against its recorded hash before it is served. Applying it to the master source is a separate, manual and authorised step.",
          )}
        </p>
      </Page>
    </div>
  );
}

// ---- Approvals ----------------------------------------------------------------

export function Approvals() {
  const { translate: t } = useLanguage();
  const isOwner = useCan("owner");
  const approvals = useApi<Approval[]>(["approvals"], "/approvals", { refetchInterval: 10_000 });
  const decide = useAction(
    (v: { id: string; approve: boolean; note: string; evidenceReviewed: string[] }) =>
      api<Approval>(`/approvals/${v.id}/decide`, { method: "POST", body: v }),
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const pending = (approvals.data ?? []).filter((a) => a.status === "pending");
  const decided = (approvals.data ?? []).filter((a) => a.status !== "pending");

  const describe = (a: Approval) => {
    const scope = JSON.parse(a.scope_json) as Record<string, unknown>;
    return a.kind === "workspace.rollback"
      ? `${t("Roll workspace")} ${String(scope.projectId)} ${t("back from")} ${shortSha(String(scope.from))} ${t("to")} ${shortSha(String(scope.commit))} — ${String(scope.reason ?? "")}`
      : `${t("Release")} "${String(scope.label)}" ${t("of task")} ${String(scope.taskId)} ${t("at")} ${shortSha(String(scope.commit))}`;
  };
  const evidenceOf = (a: Approval): string[] => {
    const scope = JSON.parse(a.scope_json) as { evidence?: string[] };
    return (scope.evidence ?? []).filter(Boolean);
  };

  return (
    <div>
      <PageHeader
        title={t("Approvals")}
        description={t(
          "Restricted actions wait here for an owner. The record keeps who asked, who decided, the exact scope, the evidence shown, and what actually happened.",
        )}
        icon={ShieldCheck}
      />
      <Page>
        <ErrorBox error={approvals.error ?? decide.error} />
        <Card title={t("Waiting for a decision")}>
          {approvals.isPending ? (
            <Loading />
          ) : pending.length === 0 ? (
            <Empty>{t("Nothing is waiting.")}</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {pending.map((a) => (
                <li key={a.id} className="space-y-2 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge value={a.status} />
                    <span className="font-mono text-xs">{a.id}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(a.kind)} · {t("requested by")} {a.requested_by_label ?? a.requested_by} ·{" "}
                      {relativeTime(a.requested_at)}
                    </span>
                  </div>
                  <p>{describe(a)}</p>
                  {a.kind === "release.create" ? (
                    <p className="text-xs text-muted-foreground">
                      {t("Evidence")}: {evidenceOf(a).join(", ") || "—"} ·{" "}
                      <Link
                        to="/vala-ai/tasks/$taskId"
                        params={{ taskId: a.target_id }}
                        className="underline"
                      >
                        {t("review the task")}
                      </Link>
                    </p>
                  ) : null}
                  {isOwner ? (
                    <div className="flex flex-wrap gap-2">
                      <input
                        placeholder={t("Decision note")}
                        value={notes[a.id] ?? ""}
                        onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })}
                        className={cn(inputClass, "min-w-[200px] flex-1")}
                      />
                      <button
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate({
                            id: a.id,
                            approve: true,
                            note: notes[a.id] ?? "",
                            evidenceReviewed: evidenceOf(a),
                          })
                        }
                        className="rounded-lg border va-border-success px-3 py-1.5 text-xs va-text-success"
                      >
                        {t("Approve & execute")}
                      </button>
                      <button
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate({
                            id: a.id,
                            approve: false,
                            note: notes[a.id] ?? "",
                            evidenceReviewed: [],
                          })
                        }
                        className="rounded-lg border va-border-danger px-3 py-1.5 text-xs va-text-danger"
                      >
                        {t("Reject")}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("An owner decides this.")}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={t("Decided")}>
          {decided.length === 0 ? (
            <Empty>{t("No decisions yet.")}</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {decided.map((a) => (
                <li key={a.id} className="space-y-1 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge value={a.status} />
                    <span className="font-mono text-xs">{a.id}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("decided by")} {a.decided_by_label ?? a.decided_by} ·{" "}
                      {relativeTime(a.decided_at)}
                    </span>
                  </div>
                  <p>{describe(a)}</p>
                  {a.decision_note ? (
                    <p className="text-xs text-muted-foreground">
                      {t("Note")}: {a.decision_note}
                    </p>
                  ) : null}
                  {a.outcome ? (
                    <p
                      className={cn(
                        "text-xs",
                        a.status === "failed" ? "va-text-danger" : "va-text-success",
                      )}
                    >
                      {t("Outcome")}: {a.outcome}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Page>
    </div>
  );
}

// ---- Activity & Audit ---------------------------------------------------------

export function ActivityLog() {
  const { translate: t } = useLanguage();
  const [before, setBefore] = useState<number | undefined>(undefined);
  const audit = useApi<{
    entries: AuditEntry[];
    chain: { ok: boolean; entries: number; brokenAt: number | null };
  }>(["audit", before], `/audit${before ? `?before=${before}` : ""}`);
  const entries = audit.data?.entries ?? [];
  return (
    <div>
      <PageHeader
        title={t("Activity & Audit")}
        description={t(
          "Append-only, hash-chained record of every action. Any edit made outside the application breaks the chain and is reported here.",
        )}
        icon={Activity}
      />
      <Page>
        <ErrorBox error={audit.error} />
        {audit.data ? (
          <p
            className={cn(
              "text-sm font-medium",
              audit.data.chain.ok ? "va-text-success" : "va-text-danger",
            )}
          >
            {audit.data.chain.ok
              ? `${t("Chain intact")}: ${audit.data.chain.entries} ${t("entries verified")}`
              : `${t("Chain broken at entry")} #${audit.data.chain.brokenAt}`}
          </p>
        ) : null}
        {audit.isPending ? (
          <Loading />
        ) : entries.length === 0 ? (
          <Empty>{t("No activity yet.")}</Empty>
        ) : (
          <div
            className="overflow-x-auto rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            tabIndex={0}
            role="region"
            aria-label={t("Audit log entries")}
          >
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-surface/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">{t("When")}</th>
                  <th className="px-3 py-2">{t("Who")}</th>
                  <th className="px-3 py-2">{t("Action")}</th>
                  <th className="px-3 py-2">{t("Target")}</th>
                  <th className="px-3 py-2">{t("Detail")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((e) => (
                  <tr key={e.seq} className="align-top">
                    <td className="px-3 py-2 font-mono text-xs">{e.seq}</td>
                    <td className="px-3 py-2 text-xs">{new Date(e.at).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs">{e.actor_label ?? e.actor}</td>
                    <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                    <td className="px-3 py-2 text-xs">
                      {e.target_type ? `${e.target_type} ${e.target_id ?? ""}` : "—"}
                    </td>
                    <td className="max-w-md px-3 py-2">
                      <code className="break-all text-[11px] text-muted-foreground">
                        {e.detail_json}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex gap-2">
          {before ? (
            <button
              onClick={() => setBefore(undefined)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs"
            >
              {t("Newest")}
            </button>
          ) : null}
          {entries.length >= 200 ? (
            <button
              onClick={() => setBefore(entries[entries.length - 1].seq)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs"
            >
              {t("Older")}
            </button>
          ) : null}
        </div>
      </Page>
    </div>
  );
}
