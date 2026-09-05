import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Terminal, Lock, Unlock, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/lib/language-catalog";
import { projectsQuery, issuesQuery, logsQuery, lockQuery } from "./queries";
import { logAiExecution, saveAiPrompt, updateAiLockState } from "@/lib/ai/ai.functions";
import { PanelHeader, PanelSkeleton, relativeTime } from "./shared";

type Message = { role: "user" | "assistant" | "system"; content: string; timestamp: string; status?: "pending" | "executing" | "success" | "error" };

export function ValaAICommandCenter() {
  const { translate: t } = useLanguage();
  const queryClient = useQueryClient();
  const projects = useQuery(projectsQuery);
  const lock = useQuery(lockQuery);
  const issues = useQuery(issuesQuery);
  const logs = useQuery(logsQuery);

  const [activeProject, setActiveProject] = useState<string>("none");
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Message[]>([ { role: "system", content: t("VALA AI COMMAND CENTER INITIALIZED"), timestamp: new Date().toISOString(), status: "success" } ]);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const lockMutation = useMutation({
    mutationFn: (locked: boolean) => updateAiLockState({ data: { locked } }),
    onSuccess: (res) => {
      queryClient.setQueryData(lockQuery.queryKey, res);
      toast.success(res.data.locked ? t("Lock re-armed") : t("Lock disabled — changes are live"));
    },
    onError: () => toast.error(t("Could not update lock state")),
  });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  if (projects.isPending || lock.isPending) return <PanelSkeleton />;

  const isLocked = lock.data?.data?.locked ?? true;

  const runCommand = async (command: string) => {
    const startedAt = Date.now();
    let status: "success" | "error" = "success";
    let assistantContent = "";
    try {
      const response = await fetch("/api/vala-ai-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: command }], userRole: "system_admin", context: `CMD | Project: ${activeProject}` }) });
      if (!response.ok) throw new Error(t("Command execution failed"));
      assistantContent = await response.text();
    } catch (e) { status = "error"; assistantContent = `ERROR: ${(e as Error).message}`; }

    const durationMs = Date.now() - startedAt;
    try {
      await Promise.all([ logAiExecution({ data: { command: command.slice(0, 120), status, durationMs, projectTitle: activeProject === "none" ? null : activeProject } }), saveAiPrompt({ data: { role: "user", content: command, language: "English", model: "openai/gpt-5.6-sol", tokens: Math.max(1, Math.round(command.length / 4)), projectTitle: activeProject === "none" ? null : activeProject } }) ]);
      queryClient.invalidateQueries({ queryKey: ["ai", "prompts"] });
    } catch { toast.error(t("Execution recorded locally — persistence unavailable")); }
  };

  const handleExecute = async () => { const command = input.trim(); if (!command || isStreaming) return; setInput(""); setIsStreaming(true); setMessages((prev) => [ ...prev, { role: "user", content: command, timestamp: new Date().toISOString(), status: "pending" } ]); await runCommand(command); setIsStreaming(false); };

  return (
    <div className="flex h-full min-h-0 flex-col xl:flex-row">
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3"><Terminal className="size-5 text-primary" /><div><div className="text-sm font-semibold">{t("VALA AI COMMAND CENTER")}</div><div className="text-xs text-muted-foreground">{t("Text-only command engine")}</div></div></div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={lockMutation.isPending} onClick={() => lockMutation.mutate(!isLocked)}>{isLocked ? <Lock className="mr-2 size-4"/> : <Unlock className="mr-2 size-4"/>}{isLocked ? t("LOCKED") : t("UNLOCKED")}</Button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-primary/10 px-4 py-2 sm:px-6">
          <span className="text-xs font-medium text-muted-foreground">{t("ACTIVE PROJECT")}</span>
          <select value={activeProject} onChange={(e) => setActiveProject(e.target.value)} className="h-8 w-56 rounded border bg-transparent px-2 text-sm">
            <option value="none">{t("None selected")}</option>
            {(projects.data?.data ?? []).map((p: any) => <option key={p.id} value={p.title}>{p.title}</option>)}
          </select>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-4 py-4 sm:px-6">
          <div className="space-y-3 font-mono text-sm">
            {messages.map((msg, i) => (
              <div key={`${msg.timestamp}-${i}`} className={"rounded-lg p-3"}>
                <div className="flex items-start gap-2"><div className="flex-1 whitespace-pre-wrap wrap-break-word">{msg.content}</div></div>
                <div className="mt-1 text-[11px] opacity-50">{new Date(msg.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-border bg-surface p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder={t("Enter command… (TEXT ONLY)")} className="w-full flex-1 resize-none rounded-lg border border-border bg-foreground/5 px-4 py-3 font-mono text-sm text-foreground outline-none" />
            <Button onClick={() => void handleExecute()} disabled={isStreaming || !input.trim()} className="sm:h-auto sm:px-6">{isStreaming ? <Loader2 className="size-5 animate-spin"/> : <><Zap className="mr-2 size-5"/>{t("EXECUTE")}</>}</Button>
          </div>
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col border-t border-border bg-surface xl:w-80 xl:border-l xl:border-t-0">
        <section className="border-b border-border p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">{t("Execution Logs")}</h2>
          <div className="space-y-2 pr-2">
            {(logs.data?.data ?? []).slice(0, 10).map((log: any) => (
              <div key={log.id} className="rounded bg-foreground/5 p-2 text-xs">
                <div className="flex items-center gap-2"><div className="truncate">{log.command}</div></div>
                <div className="mt-1 flex justify-between text-muted-foreground"><span>{relativeTime(log.createdAt)}</span><span>{log.durationMs}ms</span></div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

export default ValaAICommandCenter;
