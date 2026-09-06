import { useState } from "react";
import { ClipboardCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, titleCase } from "@/lib/tm/format";
import { useMembers, useReviews, useSubmitReview, useTasks } from "@/lib/tm/hooks";
import { StatusBadge, TMEmpty, TMLoading, TMPageHeader, TMPanel, TMRow, TaskCode } from "../shared";

export function TMReview({ onOpenTask }: { onOpenTask: (taskId: string) => void }) {
  const { data: reviews, isLoading } = useReviews();
  const { data: tasks } = useTasks();
  const { data: members } = useMembers();
  const submit = useSubmitReview();

  const [taskId, setTaskId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [quality, setQuality] = useState(80);
  const [timeliness, setTimeliness] = useState(80);
  const [verdict, setVerdict] = useState<string>("passed");
  const [remarks, setRemarks] = useState("");

  if (isLoading) return <TMLoading label="Loading reviews" />;

  const reviewable = (tasks ?? []).filter((t) => ["completed", "testing", "ai_review"].includes(t.status));

  return (
    <div className="space-y-6">
      <TMPageHeader title="Task Review" subtitle="Score delivery quality and timeliness on completed work" actions={<Badge variant="outline">{(reviews ?? []).length} reviews</Badge>} />

      <TMPanel title="Submit a review" icon={<ClipboardCheck className="h-4 w-4" />}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Task</Label>
            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger><SelectValue placeholder="Select delivered task" /></SelectTrigger>
              <SelectContent>{reviewable.map((t) => <SelectItem key={t.id} value={t.id}>{t.code} — {t.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reviewer</Label>
            <Select value={reviewerId} onValueChange={setReviewerId}>
              <SelectTrigger><SelectValue placeholder="Select reviewer" /></SelectTrigger>
              <SelectContent>{(members ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name} — {titleCase(m.role)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quality score: {quality}</Label>
            <Slider value={[quality]} max={100} step={5} onValueChange={(v) => setQuality(v[0] ?? 0)} />
          </div>
          <div className="space-y-2">
            <Label>Timeliness score: {timeliness}</Label>
            <Slider value={[timeliness]} max={100} step={5} onValueChange={(v) => setTimeliness(v[0] ?? 0)} />
          </div>
          <div className="space-y-2">
            <Label>Verdict</Label>
            <Select value={verdict} onValueChange={setVerdict}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="rework">Rework</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="What was good, what needs rework" />
          </div>
          <div>
            <Button
              disabled={!taskId || !reviewerId || submit.isPending}
              onClick={() => {
                const reviewer = (members ?? []).find((m) => m.id === reviewerId);
                if (!reviewer) return;
                submit.mutate({
                  task_id: taskId,
                  reviewer_id: reviewer.id,
                  reviewer_name: reviewer.full_name,
                  quality_score: quality,
                  timeliness_score: timeliness,
                  verdict: verdict as "passed" | "failed" | "rework",
                  remarks,
                });
                setRemarks("");
              }}
            >
              Submit review
            </Button>
          </div>
        </div>
      </TMPanel>

      <TMPanel title="Review history">
        <div className="space-y-2">
          {(reviews ?? []).map((review) => (
            <TMRow key={review.id}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <TaskCode code={review.task?.code ?? "—"} />
                  {review.task && <StatusBadge status={review.task.status} />}
                </div>
                <p className="truncate text-sm text-foreground">{review.task?.title ?? "Unknown task"}</p>
                <p className="text-xs text-muted-foreground">
                  {review.reviewer_name} • {titleCase(review.verdict)} • quality {review.quality_score} • timeliness {review.timeliness_score} • {formatDateTime(review.created_at)}
                </p>
                {review.remarks && <p className="text-xs text-muted-foreground">“{review.remarks}”</p>}
              </div>
              {review.task_id && <Button size="sm" variant="outline" onClick={() => onOpenTask(review.task_id)}>Open</Button>}
            </TMRow>
          ))}
          {(reviews ?? []).length === 0 && <TMEmpty message="No reviews recorded" />}
        </div>
      </TMPanel>
    </div>
  );
}
