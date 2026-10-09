import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { GitBranch } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { cn } from "@/lib/utils";
import {
  ACTIVE_STATES,
  api,
  useAction,
  useApi,
  type Approval,
  type Evidence,
  type TaskDetail as Detail,
  type TaskState,
} from "../api";
import { useCan } from "../session";
import { Badge, Card, Empty, ErrorBox, inputClass, Loading, Page, PageHeader } from "../ui";
import { relativeTime, shortSha } from "../format";

const FLOW: TaskState[] = [
  "PENDING",
  "ANALYZING",
  "BUILDING",
  "TESTING",
  "FIXING",
  "RETESTING",
  "VERIFIED",
  "COMPLETE",
];

export function TaskDetail({ taskId }: { taskId: string }) {
  const { translate: t } = useLanguage();
  const canEdit = useCan("operator");
  const detail = useApi<Detail>(["task", taskId], `/tasks/${taskId}`, {
    refetchInterval: (q) =>
      q.state.data && ACTIVE_STATES.includes(q.state.data.task.state) ? 3_000 : 15_000,
  });
  const cancel = useAction(() => api(`/tasks/${taskId}/cancel`, { method: "POST" }));
  const resume = useAction(() => api(`/tasks/${taskId}/resume`, { method: "POST" }));
  const release = useAction((label: string) =>
    api<Approval>(`/tasks/${taskId}/release`, { method: "POST", body: { label } }),
  );
  const [label, setLabel] = useState("");
  const [openEvidence, setOpenEvidence] = useState<string | null>(null);

  if (detail.isPending) return <Loading />;
  if (detail.error)
    return (
      <div>
        <PageHeader
          title={detail.error.status === 404 ? t("Task not found") : t("Task could not be loaded")}
          description={t("Check the link, or go back to the list.")}
          icon={GitBranch}
        />
        <Page>
          <ErrorBox error={detail.error} />
        </Page>
      </div>
    );
  const { task, project, events, evidence, verification } = detail.data;
  const reached = new Set(events.map((e) => e.to_state).filter(Boolean));
  const plan = task.plan_json
    ? (JSON.parse(task.plan_json) as { summary: string; steps: string[]; files_to_read: string[] })
    : null;
  const active = ACTIVE_STATES.includes(task.state);

  return (
    <div>
      <PageHeader
        title={task.title}
        description={`${task.id} · ${project.name} (${project.id})`}
        icon={GitBranch}
        actions={
          <>
            <Badge value={task.state} className="text-xs" />
            {canEdit && active ? (
              <button
                onClick={() => cancel.mutate(undefined)}
                disabled={cancel.isPending || Boolean(task.cancel_requested)}
                className="rounded-lg border va-border-danger px-3 py-1.5 text-sm va-text-danger disabled:opacity-50"
              >
                {task.cancel_requested ? t("Cancelling…") : t("Cancel")}
              </button>
            ) : null}
            {canEdit && task.state === "BLOCKED" ? (
              <button
                onClick={() => resume.mutate(undefined)}
                disabled={resume.isPending}
                className="rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                {t("Resume")}
              </button>
            ) : null}
          </>
        }
      />
      <Page>
        <ErrorBox error={cancel.error ?? resume.error} />
        <Card title={t("Progress")}>
          <ol className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {FLOW.map((s, i) => (
              <li key={s} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "rounded-md border px-2 py-1 font-semibold",
                    task.state === s
                      ? "border-primary bg-primary/20 text-foreground"
                      : reached.has(s)
                        ? "va-border-success va-text-success"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {t(s)}
                </span>
                {i < FLOW.length - 1 ? <span className="text-muted-foreground">→</span> : null}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("Fix loops")} {task.fix_loops}/{task.max_fix_loops} · {t("bytes written")}{" "}
            {task.bytes_written} · {t("created")} {relativeTime(task.created_at)}
            {task.finished_at ? ` · ${t("finished")} ${relativeTime(task.finished_at)}` : ""}
          </p>
          {task.blocked_reason ? (
            <p className="mt-2 text-sm va-text-warning">
              {t("Blocked")}: {task.blocked_reason}
            </p>
          ) : null}
          {task.error ? (
            <p className="mt-2 text-sm va-text-danger">
              {t("Error")}: {task.error}
            </p>
          ) : null}
          {task.result_summary ? (
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-background p-3 text-xs">
              {task.result_summary}
            </pre>
          ) : null}
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card title={t("Instruction & plan")}>
            <p className="whitespace-pre-wrap text-sm">{task.instruction}</p>
            {plan ? (
              <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                <p className="font-medium">{plan.summary}</p>
                <ol className="list-decimal space-y-0.5 pl-5 text-muted-foreground">
                  {plan.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <p className="text-xs text-muted-foreground">
                  {t("Files")}: {plan.files_to_read.join(", ") || "—"}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">{t("No plan yet.")}</p>
            )}
          </Card>

          <Card title={t("Verification")}>
            <p className="mb-2 flex items-center gap-2 text-sm">
              <Badge value={verification.status} /> {t("at commit")}{" "}
              <span className="font-mono text-xs">{shortSha(verification.commit)}</span>
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              {t(
                "VERIFIED only when the verifier's own re-run of every acceptance check passed on a clean, committed tree. Otherwise UNKNOWN or FAILED.",
              )}
            </p>
            <ul className="space-y-1 text-sm">
              {verification.checks.map(({ check, evidence: ev }) => (
                <li key={check.id} className="flex flex-wrap items-center gap-2">
                  <Badge value={ev?.verdict ?? "unknown"} />
                  <span>{check.label}</span>
                  <code className="rounded bg-background px-1 text-xs">{check.command}</code>
                </li>
              ))}
            </ul>
            {task.state === "COMPLETE" && verification.status === "VERIFIED" && canEdit ? (
              <form
                className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  release.mutate(label);
                }}
              >
                <input
                  required
                  maxLength={60}
                  placeholder={t("Release label, e.g. v1.0.0")}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className={cn(inputClass, "flex-1")}
                />
                <button
                  type="submit"
                  disabled={release.isPending}
                  className="rounded-lg va-btn-primary px-3 py-2 text-sm font-medium"
                >
                  {t("Request release")}
                </button>
              </form>
            ) : null}
            <ErrorBox error={release.error} />
            {release.isSuccess ? (
              <p className="mt-2 text-xs va-text-success">
                {t("Release requested")} ({release.data.id}).{" "}
                <Link to="/vala-ai/approvals" className="underline">
                  {t("An owner approves it under Approvals.")}
                </Link>
              </p>
            ) : null}
          </Card>
        </div>

        <Card title={t("Evidence")}>
          {evidence.length === 0 ? (
            <Empty>{t("No checks have run yet.")}</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {evidence.map((ev) => (
                <li key={ev.id} className="py-2">
                  <button
                    onClick={() => setOpenEvidence(openEvidence === ev.id ? null : ev.id)}
                    className="flex w-full flex-wrap items-center gap-2 text-left text-sm"
                  >
                    <Badge value={ev.verdict} />
                    <span className="rounded border border-border px-1.5 text-[11px] uppercase">
                      {t(ev.producer)}
                    </span>
                    <span>{ev.label}</span>
                    <code className="text-xs text-muted-foreground">{ev.command}</code>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {`exit ${ev.exit_code ?? "—"}`}
                      {ev.timed_out ? ` · ${t("timed out")}` : ""}
                      {` · ${(ev.duration_ms / 1000).toFixed(1)}s · ${shortSha(ev.commit_sha)}`}
                    </span>
                  </button>
                  {openEvidence === ev.id ? <EvidenceOutput ev={ev} /> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("Event history")}>
          <ol className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 text-sm">
                <span className="w-20 shrink-0 text-xs text-muted-foreground">
                  {new Date(e.at).toLocaleTimeString()}
                </span>
                <span className="w-24 shrink-0 text-xs uppercase text-muted-foreground">
                  {t(e.kind)}
                </span>
                <span className="min-w-0 flex-1 break-words">
                  {e.from_state || e.to_state ? (
                    <span className="mr-1 font-mono text-xs">
                      {e.from_state ?? "∅"}→{e.to_state}
                    </span>
                  ) : null}
                  {e.message}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </Page>
    </div>
  );
}

export function EvidenceOutput({ ev }: { ev: Evidence }) {
  const { translate: t } = useLanguage();
  const out = useApi<{ content: string | null; sha256Matches: boolean; missing: boolean }>(
    ["evidence", ev.id],
    `/evidence/${ev.id}/output`,
  );
  if (out.isPending) return <Loading />;
  if (out.error) return <ErrorBox error={out.error} />;
  return (
    <div className="mt-2 space-y-1">
      <p className={cn("text-xs", out.data.sha256Matches ? "va-text-success" : "va-text-danger")}>
        {out.data.missing
          ? t("Output file is missing from disk.")
          : out.data.sha256Matches
            ? `${t("Stored output matches its recorded SHA-256")} ${ev.output_sha256.slice(0, 16)}…`
            : t("Stored output does NOT match its recorded SHA-256.")}
      </p>
      {out.data.content ? (
        <pre className="max-h-[420px] overflow-auto rounded-lg bg-background p-3 text-xs">
          {out.data.content}
        </pre>
      ) : null}
    </div>
  );
}
