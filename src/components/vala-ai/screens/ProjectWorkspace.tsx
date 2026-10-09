import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { FolderGit2, Lock, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { cn } from "@/lib/utils";
import {
  api,
  download,
  parseList,
  useAction,
  useApi,
  type AcceptanceCheck,
  type Approval,
  type ProjectDetail,
  type Requirement,
  type Task,
} from "../api";
import { useCan } from "../session";
import { Badge, Card, Empty, ErrorBox, Field, inputClass, Loading, Page, PageHeader } from "../ui";
import { relativeTime, shortSha } from "../format";
import { TaskList } from "./CommandCenter";

type Tab = "requirements" | "tasks" | "files" | "versions";

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const { translate: t } = useLanguage();
  const [tab, setTab] = useState<Tab>("requirements");
  const detail = useApi<ProjectDetail>(["project", projectId], `/projects/${projectId}`, {
    refetchInterval: 8_000,
  });
  const canEdit = useCan("operator");
  const retry = useAction(() => api(`/projects/${projectId}/workspace/retry`, { method: "POST" }));

  if (detail.isPending) return <Loading />;
  if (detail.error)
    return (
      <Page>
        <ErrorBox error={detail.error} />
      </Page>
    );
  const d = detail.data;
  const ws = d.workspace;

  return (
    <div>
      <PageHeader
        title={d.project.name}
        description={d.project.description || "No description."}
        icon={FolderGit2}
      />
      <Page>
        <Card>
          <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">{t("Project ID (permanent)")}</dt>
              <dd className="font-mono text-sm">{d.project.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("Source")}</dt>
              <dd className="break-all">
                {d.project.source_kind === "git" ? d.project.source_path : t("Empty workspace")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("Workspace")}</dt>
              <dd className="flex flex-wrap items-center gap-1.5">
                {ws ? <Badge value={ws.status} /> : "—"}
                <span className="break-all">{ws?.path}</span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("Base commit")}</dt>
              <dd className="font-mono">{shortSha(ws?.base_commit)}</dd>
            </div>
          </dl>
          {ws?.status === "failed" ? (
            <div className="mt-3 space-y-2">
              <ErrorBox error={{ message: ws.error ?? "Workspace creation failed." }} />
              {canEdit ? (
                <button
                  onClick={() => retry.mutate(undefined)}
                  disabled={retry.isPending}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm"
                >
                  {t("Retry workspace creation")}
                </button>
              ) : null}
              <ErrorBox error={retry.error} />
            </div>
          ) : null}
          {d.uncommitted.length > 0 ? (
            <p className="mt-3 text-xs text-warning">
              {d.uncommitted.length} {t("uncommitted change(s) in the workspace")}
            </p>
          ) : null}
        </Card>

        <div className="flex flex-wrap gap-1 border-b border-border" role="tablist">
          {(["requirements", "tasks", "files", "versions"] as Tab[]).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm",
                tab === k
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(
                {
                  requirements: "Requirements",
                  tasks: "Tasks",
                  files: "Files & Preview",
                  versions: "Versions & Rollback",
                }[k],
              )}
            </button>
          ))}
        </div>

        {tab === "requirements" ? <RequirementsTab d={d} /> : null}
        {tab === "tasks" ? <TasksTab d={d} /> : null}
        {tab === "files" ? (
          ws?.status === "ready" ? (
            <FilesTab projectId={projectId} base={ws.base_commit} />
          ) : (
            <Empty>{t("The workspace is not ready.")}</Empty>
          )
        ) : null}
        {tab === "versions" ? (
          ws?.status === "ready" ? (
            <VersionsTab d={d} />
          ) : (
            <Empty>{t("The workspace is not ready.")}</Empty>
          )
        ) : null}
      </Page>
    </div>
  );
}

// ---- requirements -----------------------------------------------------------

function ChecksEditor({
  checks,
  onChange,
}: {
  checks: AcceptanceCheck[];
  onChange: (c: AcceptanceCheck[]) => void;
}) {
  const { translate: t } = useLanguage();
  return (
    <div className="space-y-2">
      {checks.map((c, i) => (
        <div key={i} className="flex flex-wrap gap-2">
          <input
            aria-label={t("Check label")}
            placeholder={t("What it proves")}
            value={c.label}
            onChange={(e) =>
              onChange(checks.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
            }
            className={cn(inputClass, "min-w-[160px] flex-1")}
          />
          <input
            aria-label={t("Check command")}
            placeholder="npm test" // i18n-ignore: sample command
            value={c.command}
            onChange={(e) =>
              onChange(checks.map((x, j) => (j === i ? { ...x, command: e.target.value } : x)))
            }
            className={cn(inputClass, "min-w-[160px] flex-1 font-mono")}
          />
          <button
            type="button"
            onClick={() => onChange(checks.filter((_, j) => j !== i))}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground"
            aria-label={t("Remove check")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...checks, { id: "", label: "", command: "" }])}
        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("Add acceptance check")}
      </button>
      <p className="text-[11px] text-muted-foreground">
        {t(
          "Allowed: npm test | ci | install | run <script>, npx tsc | vitest | eslint | prettier | jest | mocha, node --test, node <file>.js. No shell syntax.",
        )}
      </p>
    </div>
  );
}

function RequirementsTab({ d }: { d: ProjectDetail }) {
  const { translate: t } = useLanguage();
  const canEdit = useCan("operator");
  const isOwner = useCan("owner");
  const approved = d.requirements.find((r) => r.status === "approved");
  const draft = d.requirements.find((r) => r.status === "draft");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [checks, setChecks] = useState<AcceptanceCheck[]>([]);
  const [crOpen, setCrOpen] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const src: Requirement | undefined = draft ?? approved;
    setTitle(src?.title ?? "");
    setBody(src?.body ?? "");
    setChecks(
      src
        ? parseList<AcceptanceCheck>(src.acceptance_checks)
        : [{ id: "", label: "", command: "" }],
    );
    // Reset the form only when a different draft/approved record arrives, not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, approved?.id]);

  const save = useAction((v: object) =>
    api(`/projects/${d.project.id}/requirements`, { method: "POST", body: v }),
  );
  const approve = useAction((id: string) => api(`/requirements/${id}/approve`, { method: "POST" }));
  const raise = useAction((v: object) =>
    api(`/projects/${d.project.id}/change-requests`, { method: "POST", body: v }),
  );
  const decide = useAction((v: { id: string; approve: boolean }) =>
    api(`/change-requests/${v.id}/decide`, { method: "POST", body: { approve: v.approve } }),
  );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title={t("Approved requirement (the build contract)")}>
        {approved ? (
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <Lock className="h-4 w-4 text-success" />v{approved.version} · {approved.title}
            </p>
            <p className="whitespace-pre-wrap text-muted-foreground">{approved.body}</p>
            <ul className="space-y-1">
              {parseList<AcceptanceCheck>(approved.acceptance_checks).map((c) => (
                <li key={c.id} className="text-xs">
                  <span className="font-semibold">{c.id}</span> {c.label} —{" "}
                  <code className="rounded bg-background px-1">{c.command}</code>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {t("Approved")} {relativeTime(approved.approved_at)}.{" "}
              {t("Locked: changes go through a change request.")}
            </p>
            {canEdit && !crOpen ? (
              <button
                onClick={() => setCrOpen(true)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                {t("Raise change request")}
              </button>
            ) : null}
          </div>
        ) : (
          <Empty>
            {t("Nothing approved yet. Tasks can only be created against an approved requirement.")}
          </Empty>
        )}
      </Card>

      {canEdit && (!approved || draft || crOpen) ? (
        <Card
          title={
            crOpen ? "Change request" : draft ? `Draft v${draft.version}` : "New requirement draft"
          }
        >
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (crOpen)
                raise.mutate(
                  { reason, title, body, checks },
                  {
                    onSuccess: () => {
                      setCrOpen(false);
                      setReason("");
                    },
                  },
                );
              else save.mutate({ requirementId: draft?.id, title, body, checks });
            }}
          >
            {crOpen ? (
              <Field label={t("Why the approved scope must change")}>
                <textarea
                  required
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={inputClass}
                />
              </Field>
            ) : null}
            <Field label={t("Title")}>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t("Requirement")}>
              <textarea
                required
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t("Acceptance checks")}>
              <ChecksEditor checks={checks} onChange={setChecks} />
            </Field>
            <ErrorBox error={save.error ?? raise.error ?? approve.error} />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={save.isPending || raise.isPending}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {crOpen ? t("Submit change request") : t("Save draft")}
              </button>
              {crOpen ? (
                <button
                  type="button"
                  onClick={() => setCrOpen(false)}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  {t("Cancel")}
                </button>
              ) : null}
              {!crOpen && draft && isOwner ? (
                <button
                  type="button"
                  disabled={approve.isPending}
                  onClick={() => approve.mutate(draft.id)}
                  className="rounded-lg border border-success/60 px-3 py-2 text-sm text-success"
                >
                  {t("Approve & lock")}
                </button>
              ) : null}
              {!crOpen && draft && !isOwner ? (
                <span className="self-center text-xs text-muted-foreground">
                  {t("An owner must approve this draft.")}
                </span>
              ) : null}
            </div>
          </form>
        </Card>
      ) : null}

      <Card title={t("Change requests")} className="xl:col-span-2">
        {d.changeRequests.length === 0 ? (
          <Empty>{t("No change requests.")}</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {d.changeRequests.map((cr) => (
              <li key={cr.id} className="space-y-1 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge value={cr.status} />
                  <span className="font-mono text-xs text-muted-foreground">{cr.id}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("raised by")} {cr.raised_by} · {relativeTime(cr.created_at)}
                  </span>
                </div>
                <p>{cr.reason}</p>
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">{t("Proposed requirement")}</summary>
                  <p className="mt-1 whitespace-pre-wrap">
                    {cr.proposed_title}
                    {"\n"}
                    {cr.proposed_body}
                  </p>
                  <ul>
                    {parseList<AcceptanceCheck>(cr.proposed_checks).map((c) => (
                      <li key={c.id}>
                        {c.label}: <code>{c.command}</code>
                      </li>
                    ))}
                  </ul>
                </details>
                {cr.status === "open" && isOwner ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => decide.mutate({ id: cr.id, approve: true })}
                      className="rounded-lg border border-success/60 px-2.5 py-1 text-xs text-success"
                    >
                      {t("Approve (new version)")}
                    </button>
                    <button
                      onClick={() => decide.mutate({ id: cr.id, approve: false })}
                      className="rounded-lg border border-destructive/60 px-2.5 py-1 text-xs text-destructive"
                    >
                      {t("Reject")}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <ErrorBox error={decide.error} />
      </Card>
    </div>
  );
}

// ---- tasks ------------------------------------------------------------------

function TasksTab({ d }: { d: ProjectDetail }) {
  const { translate: t } = useLanguage();
  const canEdit = useCan("operator");
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const create = useAction((v: object) =>
    api<Task>(`/projects/${d.project.id}/tasks`, { method: "POST", body: v }),
  );
  const approved = d.requirements.find((r) => r.status === "approved");

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {canEdit ? (
        <Card title={t("New task")}>
          {!approved ? (
            <Empty>{t("Approve a requirement first.")}</Empty>
          ) : d.workspace?.status !== "ready" ? (
            <Empty>{t("The workspace is not ready.")}</Empty>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate(
                  { title, instruction },
                  {
                    onSuccess: (task) =>
                      void navigate({ to: "/vala-ai/tasks/$taskId", params: { taskId: task.id } }),
                  },
                );
              }}
            >
              <p className="text-xs text-muted-foreground">
                {t("Built against requirement")} v{approved.version}.{" "}
                {t("It completes only if every acceptance check passes on the verifier's re-run.")}
              </p>
              <Field label={t("Title")}>
                <input
                  required
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label={t("Instruction")}>
                <textarea
                  required
                  rows={5}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <ErrorBox error={create.error} />
              <button
                type="submit"
                disabled={create.isPending}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {t("Queue task")}
              </button>
            </form>
          )}
        </Card>
      ) : null}
      <Card title={t("Tasks")}>
        {d.tasks.length === 0 ? (
          <Empty>{t("No tasks yet.")}</Empty>
        ) : (
          <TaskList tasks={d.tasks} showReason />
        )}
      </Card>
    </div>
  );
}

// ---- files & preview ----------------------------------------------------------

function FilesTab({ projectId, base }: { projectId: string; base: string | null }) {
  const { translate: t } = useLanguage();
  const files = useApi<string[]>(["files", projectId], `/projects/${projectId}/files`);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const file = useApi<{ path: string; content: string; bytes: number; truncated: boolean }>(
    ["file", projectId, selected],
    selected ? `/projects/${projectId}/file?path=${encodeURIComponent(selected)}` : null,
  );
  const diff = useApi<{ diff: string; truncated: boolean; stat: string }>(
    ["diff", projectId, base],
    base ? `/projects/${projectId}/diff?from=${base}` : null,
  );
  const shown = useMemo(
    () =>
      (files.data ?? [])
        .filter((f) => f.toLowerCase().includes(filter.toLowerCase()))
        .slice(0, 500),
    [files.data, filter],
  );

  return (
    <div className="space-y-4">
      <Card title={t("Preview: everything changed since the workspace was created")}>
        <p className="mb-2 text-xs text-muted-foreground">
          {t(
            "This is the committed difference from the original source. A live running preview of the app is not built.",
          )}
        </p>
        <ErrorBox error={diff.error} />
        {diff.isPending ? (
          <Loading />
        ) : !diff.data?.diff ? (
          <Empty>{t("No changes yet.")}</Empty>
        ) : (
          <>
            <pre className="mb-2 overflow-x-auto text-xs text-muted-foreground">
              {diff.data.stat}
            </pre>
            <DiffView text={diff.data.diff} />
            {diff.data.truncated ? (
              <p className="mt-1 text-xs text-warning">{t("Diff truncated.")}</p>
            ) : null}
          </>
        )}
      </Card>
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card title={t("Files")}>
          <input
            placeholder={t("Filter files")}
            aria-label={t("Filter files")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={cn(inputClass, "mb-2")}
          />
          <ErrorBox error={files.error} />
          <ul className="max-h-[480px] overflow-y-auto text-xs">
            {shown.map((f) => (
              <li key={f}>
                <button
                  onClick={() => setSelected(f)}
                  className={cn(
                    "w-full truncate rounded px-2 py-1 text-left font-mono hover:bg-surface",
                    selected === f && "bg-primary/15",
                  )}
                >
                  {f}
                </button>
              </li>
            ))}
          </ul>
          {(files.data ?? []).length > shown.length ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("Showing")} {shown.length} {t("of")} {files.data!.length}
            </p>
          ) : null}
        </Card>
        <Card title={selected ?? "File"}>
          {!selected ? (
            <Empty>{t("Choose a file.")}</Empty>
          ) : file.isPending ? (
            <Loading />
          ) : file.error ? (
            <ErrorBox error={file.error} />
          ) : (
            <>
              <pre className="max-h-[560px] overflow-auto rounded-lg bg-background p-3 text-xs">
                {file.data!.content}
              </pre>
              {file.data!.truncated ? (
                <p className="mt-1 text-xs text-warning">
                  {t("File truncated for display")} {`(${file.data!.bytes} B)`}
                </p>
              ) : null}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export function DiffView({ text }: { text: string }) {
  return (
    <pre className="max-h-[520px] overflow-auto rounded-lg bg-background p-3 text-xs leading-relaxed">
      {text.split("\n").map((line, i) => (
        <div
          key={i}
          className={cn(
            line.startsWith("+") && !line.startsWith("+++") && "bg-success/10 text-success",
            line.startsWith("-") && !line.startsWith("---") && "bg-destructive/10 text-destructive",
            line.startsWith("@@") && "text-info",
          )}
        >
          {line || " "}
        </div>
      ))}
    </pre>
  );
}

// ---- versions -----------------------------------------------------------------

function VersionsTab({ d }: { d: ProjectDetail }) {
  const { translate: t } = useLanguage();
  const canEdit = useCan("operator");
  const log = useApi<{ sha: string; at: string; subject: string }[]>(
    ["log", d.project.id],
    `/projects/${d.project.id}/log`,
  );
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const rollback = useAction((v: object) =>
    api<Approval>(`/projects/${d.project.id}/rollback`, { method: "POST", body: v }),
  );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title={t("Workspace history")}>
        <ErrorBox error={log.error ?? rollback.error} />
        {rollback.isSuccess ? (
          <p className="mb-2 text-xs text-success">
            {t("Rollback requested")} ({rollback.data?.id}).{" "}
            {t("An owner decides it under Approvals.")}{" "}
            <Link to="/vala-ai/approvals" className="underline">
              {t("Open approvals")}
            </Link>
          </p>
        ) : null}
        {log.isPending ? (
          <Loading />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {(log.data ?? []).map((c, i) => (
              <li key={c.sha} className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{shortSha(c.sha)}</span>
                  <span className="min-w-0 flex-1 truncate">{c.subject}</span>
                  <span className="text-xs text-muted-foreground">{relativeTime(c.at)}</span>
                  {i > 0 && canEdit ? (
                    <button
                      onClick={() => setTarget(c.sha)}
                      className="rounded border border-border px-2 py-0.5 text-xs"
                    >
                      {t("Roll back to here")}
                    </button>
                  ) : null}
                  {i === 0 ? <Badge value="HEAD" /> : null}
                </div>
                {target === c.sha ? (
                  <form
                    className="mt-2 flex flex-wrap gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      rollback.mutate(
                        { commit: c.sha, reason },
                        {
                          onSuccess: () => {
                            setTarget(null);
                            setReason("");
                          },
                        },
                      );
                    }}
                  >
                    <input
                      required
                      placeholder={t("Reason")}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className={cn(inputClass, "flex-1")}
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-warning/60 px-3 py-1.5 text-xs text-warning"
                    >
                      {t("Request rollback approval")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTarget(null)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs"
                    >
                      {t("Cancel")}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={t("Releases")}>
        {d.releases.length === 0 ? (
          <Empty>{t("No releases. A release is cut from a COMPLETE, verified task.")}</Empty>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {d.releases.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-semibold">{r.label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {shortSha(r.commit_sha)}
                </span>
                <span className="text-xs text-muted-foreground">{relativeTime(r.created_at)}</span>
                <button
                  onClick={() =>
                    void download(`/releases/${r.id}/patch`, `${r.id}.patch`).catch((e: Error) =>
                      window.alert(e.message),
                    )
                  }
                  className="ml-auto text-xs underline"
                >
                  {t("Download patch")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
