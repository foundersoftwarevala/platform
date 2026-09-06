import { useState } from "react";
import { Paperclip, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { titleCase } from "@/lib/tm/format";
import { useCreateTask, useMembers, useSettings } from "@/lib/tm/hooks";
import { TM_CATEGORIES, TM_DIFFICULTIES, TM_PRIORITIES } from "@/lib/tm/types";
import { TMPageHeader, TMPanel } from "../shared";

export function TMTaskCreation({ onCreated }: { onCreated: (taskId: string) => void }) {
  const { data: members } = useMembers();
  const { data: settings } = useSettings();
  const createTask = useCreateTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("development");
  const [module, setModule] = useState("");
  const [client, setClient] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [assignee, setAssignee] = useState<string>("unassigned");
  const [estimated, setEstimated] = useState("4");
  const [slaHours, setSlaHours] = useState(String(settings?.default_sla_hours ?? 24));
  const [billable, setBillable] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checklistDraft, setChecklistDraft] = useState("");
  const [approverId, setApproverId] = useState<string>("manager_queue");
  const [approvalStage, setApprovalStage] = useState<string>("manager");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const next: Record<string, string> = {};
    if (!title.trim()) next["title"] = "Title is required.";
    else if (title.trim().length > 160) next["title"] = "Keep the title under 160 characters.";
    if (description.length > 4000) next["description"] = "Description must be under 4000 characters.";
    const est = Number(estimated);
    if (!estimated.trim() || !Number.isFinite(est)) next["estimated"] = "Enter estimated hours as a number.";
    else if (est <= 0) next["estimated"] = "Estimated hours must be greater than 0.";
    else if (est > 500) next["estimated"] = "Estimated hours must be 500 or less.";
    const sla = Number(slaHours);
    if (!slaHours.trim() || !Number.isFinite(sla)) next["slaHours"] = "Enter SLA hours as a number.";
    else if (sla < 1) next["slaHours"] = "SLA must be at least 1 hour.";
    else if (sla > 2000) next["slaHours"] = "SLA must be 2000 hours or less.";
    if (requireApproval && approverId === "manager_queue" && !approvalStage.trim()) next["approval"] = "Choose an approval stage.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    const hours = Number(slaHours);
    const approver = (members ?? []).find((m) => m.id === approverId);
    const deadline = new Date(Date.now() + hours * 3600_000).toISOString();
    const task = await createTask.mutateAsync({
      title: title.trim(),
      description: description.trim(),
      category,
      module: module.trim() || null,
      client_name: client.trim() || null,
      priority,
      difficulty,
      assigned_to: assignee === "unassigned" ? null : assignee,
      status: assignee === "unassigned" ? "new" : "assigned",
      estimated_hours: Number(estimated),
      sla_hours: hours,
      promised_at: deadline,
      deadline,
      billable,
      approval_status: requireApproval ? "pending" : "not_required",
      tags,
      subtasks: checklist,
      approvers: requireApproval
        ? [{ approver_id: approver?.id ?? null, approver_name: approver?.full_name ?? "Task Manager", stage: approvalStage }]
        : undefined,
      files: files.length ? files : undefined,
    });
    setTitle("");
    setDescription("");
    setTags([]);
    setChecklist([]);
    setFiles([]);
    setErrors({});
    onCreated(task.id);
  };

  return (
    <div className="space-y-6">
      <TMPageHeader title="Task Creation" subtitle="Create a task with SLA, ownership, checklist and approval routing" />

      <div className="grid gap-6 lg:grid-cols-3">
        <TMPanel title="Task details" className="lg:col-span-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tm-title">Title</Label>
              <Input
                id="tm-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Fix payment webhook retry loop"
                aria-invalid={Boolean(errors["title"])}
                aria-describedby={errors["title"] ? "tm-title-error" : undefined}
              />
              {errors["title"] && <p id="tm-title-error" role="alert" className="text-xs text-destructive">{errors["title"]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tm-description">Description</Label>
              <Textarea
                id="tm-description"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scope, acceptance criteria, links"
                aria-invalid={Boolean(errors["description"])}
                aria-describedby={errors["description"] ? "tm-description-error" : undefined}
              />
              {errors["description"] && <p id="tm-description-error" role="alert" className="text-xs text-destructive">{errors["description"]}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tm-category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="tm-category" aria-label="Category"><SelectValue /></SelectTrigger>
                  <SelectContent>{TM_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{titleCase(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tm-module">Module</Label>
                <Input id="tm-module" value={module} onChange={(e) => setModule(e.target.value)} placeholder="Billing, CRM, Portal…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tm-client">Client</Label>
                <Input id="tm-client" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client / internal" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tm-assignee">Assign to</Label>
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger id="tm-assignee" aria-label="Assign to"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Leave in new queue</SelectItem>
                    {(members ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name} — {titleCase(m.role)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tm-checklist">Checklist</Label>
              <div className="flex gap-2">
                <Input
                  id="tm-checklist"
                  value={checklistDraft}
                  onChange={(e) => setChecklistDraft(e.target.value)}
                  placeholder="Add a checklist item"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Add checklist item"
                  onClick={() => {
                    if (!checklistDraft.trim()) return;
                    setChecklist([...checklist, checklistDraft.trim()]);
                    setChecklistDraft("");
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1">
                {checklist.map((item, index) => (
                  <div key={`${item}-${index}`} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                    {item}
                    <button
                      type="button"
                      aria-label={`Remove checklist item ${item}`}
                      onClick={() => setChecklist(checklist.filter((_, i) => i !== index))}
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tm-files">Attachments</Label>
              <Input
                id="tm-files"
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                aria-describedby="tm-files-hint"
              />
              <p id="tm-files-hint" className="text-xs text-muted-foreground">
                Files upload to secure task storage when the task is created.
              </p>
              <div className="space-y-1">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 truncate">
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                      {file.name} · {Math.max(1, Math.round(file.size / 1024))} KB
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove attachment ${file.name}`}
                      onClick={() => setFiles(files.filter((_, i) => i !== index))}
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TMPanel>

        <TMPanel title="Delivery controls">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tm-priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="tm-priority" aria-label="Priority"><SelectValue /></SelectTrigger>
                <SelectContent>{TM_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{titleCase(p)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tm-difficulty">Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger id="tm-difficulty" aria-label="Difficulty"><SelectValue /></SelectTrigger>
                <SelectContent>{TM_DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{titleCase(d)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tm-estimated">Estimated hours</Label>
              <Input
                id="tm-estimated"
                type="number"
                min="0.5"
                step="0.5"
                value={estimated}
                onChange={(e) => setEstimated(e.target.value)}
                aria-invalid={Boolean(errors["estimated"])}
                aria-describedby={errors["estimated"] ? "tm-estimated-error" : undefined}
              />
              {errors["estimated"] && <p id="tm-estimated-error" role="alert" className="text-xs text-destructive">{errors["estimated"]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tm-sla">SLA hours</Label>
              <Input
                id="tm-sla"
                type="number"
                min="1"
                value={slaHours}
                onChange={(e) => setSlaHours(e.target.value)}
                aria-invalid={Boolean(errors["slaHours"])}
                aria-describedby={errors["slaHours"] ? "tm-sla-error" : undefined}
              />
              {errors["slaHours"] && <p id="tm-sla-error" role="alert" className="text-xs text-destructive">{errors["slaHours"]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tm-tags">Tags</Label>
              <div className="flex gap-2">
                <Input id="tm-tags" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="Add tag" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Add tag"
                  onClick={() => {
                    if (!tagDraft.trim()) return;
                    setTags([...tags, tagDraft.trim()]);
                    setTagDraft("");
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <button
                    key={`${tag}-${index}`}
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() => setTags(tags.filter((_, i) => i !== index))}
                    className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag} ×
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="tm-billable">Billable</Label>
              <Switch id="tm-billable" checked={billable} onCheckedChange={setBillable} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="tm-approval">Require approval</Label>
              <Switch id="tm-approval" checked={requireApproval} onCheckedChange={setRequireApproval} />
            </div>
            {requireApproval && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                <div className="space-y-2">
                  <Label htmlFor="tm-approval-stage">Approval stage</Label>
                  <Select value={approvalStage} onValueChange={setApprovalStage}>
                    <SelectTrigger id="tm-approval-stage" aria-label="Approval stage"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["manager", "tech_lead", "qa", "client", "finance"].map((stage) => (
                        <SelectItem key={stage} value={stage}>{titleCase(stage)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tm-approver">Approver</Label>
                  <Select value={approverId} onValueChange={setApproverId}>
                    <SelectTrigger id="tm-approver" aria-label="Approver"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager_queue">Task Manager queue</SelectItem>
                      {(members ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name} — {titleCase(m.role)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors["approval"] && <p role="alert" className="text-xs text-destructive">{errors["approval"]}</p>}
                </div>
              </div>
            )}
            <Button className="w-full" onClick={submit} disabled={createTask.isPending}>
              {createTask.isPending ? "Creating…" : "Create task"}
            </Button>
          </div>
        </TMPanel>
      </div>
    </div>
  );
}
