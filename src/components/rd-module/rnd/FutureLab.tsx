import { useState } from "react";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Lightbulb,
  Plus,
  ThumbsUp,
  Link2,
  Sparkles,
  Loader2,
  CheckCircle2,
  FlaskConical,
} from "lucide-react";
import { Card } from "@/components/rd-module/ui/card";
import { Button } from "@/components/rd-module/ui/button";
import { Input } from "@/components/rd-module/ui/input";
import { Textarea } from "@/components/rd-module/ui/textarea";
import { Badge } from "@/components/rd-module/ui/badge";
import { Progress } from "@/components/rd-module/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/rd-module/ui/select";
import { Skeleton } from "@/components/rd-module/ui/skeleton";
import { useIdeasPaged, useInvalidateRnD, rndKeys } from "@/hooks/rd-module/useRnDData";
import { useRnDAI } from "@/hooks/rd-module/useRnDAI";
import { createIdea, voteIdea, updateIdeaStatus } from "@/lib/rd-module/rnd-data.functions";
import { cn } from "@/lib/rd-module/utils";

const categories = [
  { id: "all", label: "All Ideas" },
  { id: "ai", label: "AI & ML" },
  { id: "uiux", label: "UI/UX" },
  { id: "devtools", label: "Dev Tools" },
  { id: "client", label: "Client Experience" },
  { id: "automation", label: "Automation" },
];

const priorityTone: Record<string, string> = {
  critical: "border-danger/40 text-danger",
  high: "border-warning/40 text-warning",
  medium: "border-info/40 text-info",
  low: "border-border text-muted-foreground",
};

const statusTone: Record<string, string> = {
  approved: "border-success/40 text-success",
  in_prototype: "border-brand-2/40 text-brand-2",
  evaluating: "border-warning/40 text-warning",
  rejected: "border-danger/40 text-danger",
};

export const FutureLab = ({ search }: { search: string }) => {
  const invalidate = useInvalidateRnD();
  const { evaluateIdea, isLoading: aiLoading } = useRnDAI();

  const submitIdea = useServerFn(createIdea);
  const vote = useServerFn(voteIdea);
  const setStatus = useServerFn(updateIdeaStatus);

  const [filter, setFilter] = useState("all");
  const { ideas, total, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useIdeasPaged(filter);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "ai",
    priority: "medium",
    author: "vala(rnd)0000",
  });
  const [evaluation, setEvaluation] = useState<{ id: string; text: string } | null>(null);

  const visible = ideas.filter((idea) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      idea.title.toLowerCase().includes(term) ||
      idea.description.toLowerCase().includes(term);
    return matchesSearch;
  });

  const handleSubmit = async () => {
    if (form.title.trim().length < 3 || form.description.trim().length < 5) {
      toast.error("Add a title and a short description first");
      return;
    }
    setSaving(true);
    try {
      await submitIdea({
        data: {
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category as "ai",
          priority: form.priority as "medium",
          author: form.author.trim() || "vala(rnd)0000",
          feasibility: 0,
        },
      });
      toast.success("Idea submitted to Future Lab");
      setForm({
        title: "",
        description: "",
        category: "ai",
        priority: "medium",
        author: form.author,
      });
      setOpen(false);
      await invalidate(rndKeys.ideas);
      await invalidate(rndKeys.notifications);
    } catch (error) {
      toast.error("Could not submit idea", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVote = async (id: string) => {
    try {
      await vote({ data: { id, delta: 1 } });
      await invalidate(rndKeys.ideas);
    } catch (error) {
      toast.error("Vote failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleStatus = async (id: string, status: "approved" | "in_prototype" | "rejected") => {
    try {
      await setStatus({ data: { id, status } });
      toast.success(`Idea marked ${status.replace("_", " ")}`);
      await invalidate(rndKeys.ideas);
    } catch (error) {
      toast.error("Update failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleEvaluate = async (
    id: string,
    title: string,
    description: string,
    category: string,
    author: string,
  ) => {
    const result = await evaluateIdea(title, description, category, author);
    if (result) setEvaluation({ id, text: result });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="brand-soft rounded-2xl border border-border p-3">
            <Lightbulb className="h-6 w-6 text-brand" />
          </span>
          <div>
            <h2 className="brand-gradient-text font-display text-2xl font-bold">Future Lab</h2>
            <p className="text-sm text-muted-foreground">
              Idea intake, scoring and promotion pipeline
            </p>
          </div>
        </div>
        <Button onClick={() => setOpen((value) => !value)}>
          <Plus className="mr-2 h-4 w-4" /> New Idea
        </Button>
      </div>

      {open && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="panel space-y-4 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                placeholder="Idea title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
              <Input
                placeholder="Author code (e.g. vala(rnd)2341)"
                value={form.author}
                onChange={(event) => setForm({ ...form, author: event.target.value })}
              />
            </div>
            <Textarea
              placeholder="Describe the idea, the problem it solves and the expected outcome"
              rows={4}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                value={form.category}
                onValueChange={(value) => setForm({ ...form, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.slice(1).map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={form.priority}
                onValueChange={(value) => setForm({ ...form, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  {["low", "medium", "high", "critical"].map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {priority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit idea
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setFilter(category.id)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm transition-colors",
              filter === category.id
                ? "border-border brand-soft text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card className="panel p-10 text-center text-muted-foreground">
          No ideas match this filter yet.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((idea, index) => (
            <motion.div
              key={idea.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Card className="panel flex h-full flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    {idea.title}
                  </h3>
                  <Badge variant="outline" className={priorityTone[idea.priority] ?? ""}>
                    {idea.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{idea.description}</p>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Feasibility</span>
                    <span>{idea.feasibility}%</span>
                  </div>
                  <Progress value={idea.feasibility} />
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>{idea.author}</span>
                  <span className="flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> {idea.research_links} sources
                  </span>
                  <Badge variant="outline" className={statusTone[idea.status] ?? ""}>
                    {idea.status.replace("_", " ")}
                  </Badge>
                </div>

                <div className="mt-auto flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => handleVote(idea.id)}>
                    <ThumbsUp className="mr-2 h-3.5 w-3.5" /> {idea.votes}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={aiLoading}
                    onClick={() =>
                      handleEvaluate(
                        idea.id,
                        idea.title,
                        idea.description,
                        idea.category,
                        idea.author,
                      )
                    }
                  >
                    {aiLoading ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-3.5 w-3.5" />
                    )}
                    AI evaluate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleStatus(idea.id, "approved")}
                  >
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleStatus(idea.id, "in_prototype")}
                  >
                    <FlaskConical className="mr-2 h-3.5 w-3.5" /> Prototype
                  </Button>
                </div>

                {evaluation?.id === idea.id && (
                  <div className="scroll-slim max-h-64 overflow-y-auto rounded-lg border border-border bg-surface-2 p-4 text-sm whitespace-pre-wrap text-foreground">
                    {evaluation.text}
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && ideas.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Showing {ideas.length} of {total} ideas
          </p>
          {hasNextPage && (
            <Button
              variant="outline"
              size="sm"
              disabled={isFetchingNextPage}
              onClick={fetchNextPage}
            >
              {isFetchingNextPage && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />} Load
              more
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
