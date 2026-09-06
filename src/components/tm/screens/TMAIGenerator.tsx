import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateTasks, type AITaskSuggestion } from "@/lib/tm/ai.functions";
import { titleCase } from "@/lib/tm/format";
import { useCreateTask, useMembers } from "@/lib/tm/hooks";
import { TMEmpty, TMPageHeader, TMPanel, TMRow } from "../shared";

export function TMAIGenerator({ onCreated }: { onCreated: (taskId: string) => void }) {
  const { data: members } = useMembers();
  const createTask = useCreateTask();
  const runGenerate = useServerFn(generateTasks);
  const [brief, setBrief] = useState("");
  const [count, setCount] = useState("4");
  const [suggestions, setSuggestions] = useState<AITaskSuggestion[]>([]);
  const [accepted, setAccepted] = useState<string[]>([]);

  const generate = useMutation({
    mutationFn: () =>
      runGenerate({
        data: {
          brief: brief.trim(),
          count: Number(count) || 4,
          context: {
            categories: ["development", "bugfix", "integration", "design", "devops", "qa", "security", "compliance", "automation", "support"],
            members: Array.from(new Set((members ?? []).map((m) => m.role))),
          },
        },
      }),
    onSuccess: (result) => {
      setSuggestions(result);
      setAccepted([]);
      toast.success(`${result.length} task drafts generated`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const accept = async (suggestion: AITaskSuggestion) => {
    const deadline = new Date(Date.now() + suggestion.sla_hours * 3600_000).toISOString();
    const task = await createTask.mutateAsync({
      title: suggestion.title,
      description: suggestion.description,
      category: suggestion.category,
      priority: suggestion.priority,
      difficulty: suggestion.difficulty,
      estimated_hours: suggestion.estimated_hours,
      sla_hours: suggestion.sla_hours,
      promised_at: deadline,
      deadline,
      tags: suggestion.tags,
      ai_generated: true,
      status: "new",
      subtasks: suggestion.subtasks,
    });
    setAccepted((prev) => [...prev, suggestion.title]);
    onCreated(task.id);
  };

  return (
    <div className="space-y-6">
      <TMPageHeader title="AI Task Generator" subtitle="Turn a client brief into structured, SLA-bound tasks" />

      <TMPanel title="Work brief" icon={<Sparkles className="h-4 w-4" />}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Describe the work</Label>
            <Textarea
              rows={5}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="e.g. Client needs a Razorpay subscription flow with invoices, dunning emails and an admin refund screen."
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32 space-y-2">
              <Label>Task count</Label>
              <Input type="number" min="1" max="8" value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
            <Button onClick={() => generate.mutate()} disabled={generate.isPending || brief.trim().length < 10}>
              <Bot className="mr-2 h-4 w-4" />
              {generate.isPending ? "Generating…" : "Generate tasks"}
            </Button>
          </div>
        </div>
      </TMPanel>

      <TMPanel title="Generated drafts" actions={<Badge variant="outline">{suggestions.length} drafts</Badge>}>
        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <TMRow key={suggestion.title}>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground">{suggestion.title}</p>
                <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                <p className="text-xs text-muted-foreground">
                  {titleCase(suggestion.category)} • {titleCase(suggestion.priority)} • {titleCase(suggestion.difficulty)} •{" "}
                  {suggestion.estimated_hours}h est • {suggestion.sla_hours}h SLA • owner {titleCase(suggestion.suggested_owner_role)}
                </p>
                {suggestion.subtasks.length > 0 && (
                  <p className="text-xs text-muted-foreground">Checklist: {suggestion.subtasks.join(" · ")}</p>
                )}
              </div>
              <Button
                size="sm"
                variant={accepted.includes(suggestion.title) ? "secondary" : "default"}
                disabled={accepted.includes(suggestion.title) || createTask.isPending}
                onClick={() => accept(suggestion)}
              >
                {accepted.includes(suggestion.title) ? <Check className="mr-1 h-4 w-4" /> : null}
                {accepted.includes(suggestion.title) ? "Created" : "Accept & create"}
              </Button>
            </TMRow>
          ))}
          {suggestions.length === 0 && <TMEmpty message="Generate drafts from a brief to review them here" />}
        </div>
      </TMPanel>
    </div>
  );
}
