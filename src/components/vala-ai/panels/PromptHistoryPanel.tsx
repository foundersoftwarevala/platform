import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Search } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { promptsQuery } from "../queries";
import { EmptyState, PanelHeader, PanelSkeleton, relativeTime } from "../shared";

export function PromptHistoryPanel() {
  const { translate: t } = useLanguage();
  const { data, isPending } = useQuery(promptsQuery);
  const [query, setQuery] = useState("");
  if (isPending || !data) return <PanelSkeleton />;

  const prompts = data.data ?? [];
  const filtered = useMemo(() => prompts.filter((p: any) => [p.content, p.role, p.model, p.projectTitle].some((v) => String(v ?? "").toLowerCase().includes(query.toLowerCase()))), [prompts, query]);

  return (
    <div className="space-y-6">
      <PanelHeader title="Prompt History" description="A searchable record of user and assistant exchanges." icon={History} source={data.source} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Search prompts, projects or languages")} aria-label={t("Search prompt history")} className="pl-9" />
      </div>
      {filtered.length === 0 ? <EmptyState message={t("No prompts match this search.")} /> : (
        <ScrollArea className="h-[60vh] rounded-xl border border-border/60 bg-surface/60">
          <ul className="divide-y divide-border/60">
            {(filtered as any[]).map((prompt) => (
              <li key={prompt.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className={prompt.role === "user" ? "border-primary/50 text-primary" : "border-success/40 text-success"}>{prompt.role}</Badge>
                  <span className="text-muted-foreground">{prompt.model}</span>
                  <span className="text-muted-foreground">{prompt.language}</span>
                  <span className="text-muted-foreground">{prompt.tokens} tokens</span>
                  <span className="text-muted-foreground">{relativeTime(prompt.createdAt)}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{prompt.content}</p>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
