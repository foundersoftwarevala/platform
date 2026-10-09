import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { cn } from "@/lib/utils";
import { api, useAction, useApi, type ChatRow, type Project, type Task } from "../api";
import { useCan } from "../session";
import { Empty, ErrorBox, Field, inputClass, Loading, PageHeader } from "../ui";

export function Chat() {
  const { translate: t } = useLanguage();
  const canEdit = useCan("operator");
  const navigate = useNavigate();
  const projects = useApi<Project[]>(["projects"], "/projects");
  const [projectId, setProjectId] = useState("");
  const history = useApi<ChatRow[]>(
    ["chat", projectId],
    `/chat${projectId ? `?projectId=${projectId}` : ""}`,
  );
  const [text, setText] = useState("");
  const [taskDraft, setTaskDraft] = useState<{ title: string; instruction: string } | null>(null);
  const send = useAction(
    (v: { projectId: string; text: string }) =>
      api<{ user: ChatRow; reply: ChatRow }>("/chat", { method: "POST", body: v }),
    [["vala", "chat", projectId]],
  );
  const createTask = useAction((v: { title: string; instruction: string }) =>
    api<Task>(`/projects/${projectId}/tasks`, { method: "POST", body: v }),
  );
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history.data?.length, send.isPending]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || send.isPending) return;
    send.mutate({ projectId, text: value }, { onSuccess: () => setText("") });
  };

  const lastUser = [...(history.data ?? [])].reverse().find((m) => m.role === "user");

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <PageHeader
        title={t("AI Task Chat")}
        description={t(
          "Talk to the local model about a project. Chat never changes files: turn a request into a task to have it built and verified.",
        )}
        icon={MessageSquare}
        actions={
          <select
            aria-label={t("Project")}
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setTaskDraft(null);
            }}
            className={cn(inputClass, "w-64")}
          >
            <option value="">{t("General (no project)")}</option>
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.id}
              </option>
            ))}
          </select>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <ErrorBox error={history.error} />
        {history.isPending ? (
          <Loading />
        ) : (history.data ?? []).length === 0 ? (
          <Empty>{t("No messages yet.")}</Empty>
        ) : (
          <ul className="mx-auto max-w-3xl space-y-3">
            {history.data!.map((m) => (
              <li
                key={m.id}
                className={cn(
                  "rounded-xl border p-3 text-sm",
                  m.role === "user"
                    ? "ml-10 border-primary/30 bg-primary/10"
                    : m.role === "error"
                      ? "mr-10 border-destructive/40 bg-destructive/10 text-destructive"
                      : "mr-10 border-border bg-surface/60",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(m.created_at).toLocaleString()}
                  {m.model ? ` · ${m.model}` : ""}
                  {m.duration_ms ? ` · ${(m.duration_ms / 1000).toFixed(1)}s` : ""}
                  {m.tokens_out ? ` · ${m.tokens_out} ${t("tokens")}` : ""}
                </p>
              </li>
            ))}
            {send.isPending ? (
              <li className="mr-10 flex items-center gap-2 rounded-xl border border-border bg-surface/60 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("The local model is answering. On this machine that can take a minute or more.")}
              </li>
            ) : null}
          </ul>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-border bg-surface/40 px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-2">
          <ErrorBox error={send.error ?? createTask.error} />
          {taskDraft ? (
            <form
              className="space-y-2 rounded-xl border border-border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                createTask.mutate(taskDraft, {
                  onSuccess: (task) =>
                    void navigate({ to: "/vala-ai/tasks/$taskId", params: { taskId: task.id } }),
                });
              }}
            >
              <Field label={t("Task title")}>
                <input
                  required
                  value={taskDraft.title}
                  onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label={t("Instruction")}>
                <textarea
                  required
                  rows={3}
                  value={taskDraft.instruction}
                  onChange={(e) => setTaskDraft({ ...taskDraft, instruction: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={createTask.isPending}
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                >
                  {t("Queue task")}
                </button>
                <button
                  type="button"
                  onClick={() => setTaskDraft(null)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm"
                >
                  {t("Cancel")}
                </button>
              </div>
            </form>
          ) : null}
          {canEdit ? (
            <form onSubmit={submit} className="flex gap-2">
              <textarea
                aria-label={t("Message")}
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) submit(e);
                }}
                placeholder={t("Ask about the project, or describe what you want built…")}
                className={cn(inputClass, "flex-1 resize-none")}
              />
              <button
                type="submit"
                disabled={send.isPending || !text.trim()}
                className="grid w-12 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                aria-label={t("Send")}
              >
                {send.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("Your role can read this conversation but not send messages.")}
            </p>
          )}
          {canEdit && projectId && lastUser && !taskDraft ? (
            <button
              onClick={() =>
                setTaskDraft({
                  title: lastUser.content.split("\n")[0].slice(0, 120),
                  instruction: lastUser.content,
                })
              }
              className="text-xs text-primary underline"
            >
              {t("Turn my last message into a task")}
            </button>
          ) : null}
          {projectId ? (
            <p className="text-[11px] text-muted-foreground">
              <Link to="/vala-ai/projects/$projectId" params={{ projectId }} className="underline">
                {t("Open project")}
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
