import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getAttachmentUrl } from "@/lib/rd-module/rd-opportunities.functions";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/rd-module/ui/sheet";
import { Button } from "@/components/rd-module/ui/button";
import { Input } from "@/components/rd-module/ui/input";
import { Textarea } from "@/components/rd-module/ui/textarea";
import { Label } from "@/components/rd-module/ui/label";
import { PMBadge, StatusBadge, formatDate } from "@/components/rd-module/pro-manager/pm-ui";
import { useOpportunityDetail, useRdActions } from "@/hooks/rd-module/useRdManager";
import {
  EVALUATION_AREAS,
  EVALUATION_DECISIONS,
  OPPORTUNITY_STATUSES,
  PARTNERSHIP_STAGES,
  PRIORITIES,
  PROJECT_KINDS,
  TYPE_LABEL,
  type ProjectKind,
} from "@/lib/rd-module/rd-opportunity-types";

const selectCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel space-y-3 p-4">
      <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function prettyKey(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function OpportunityDetail({
  id,
  actor,
  onClose,
}: {
  id: string | null;
  actor: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useOpportunityDetail(id);
  const a = useRdActions();
  const openFile = useServerFn(getAttachmentUrl);
  const [noteKind, setNoteKind] = useState<"note" | "comment" | "info_request">("note");
  const [noteBody, setNoteBody] = useState("");
  const [reason, setReason] = useState("");
  const [assignee, setAssignee] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [decision, setDecision] = useState("");
  const [evalNotes, setEvalNotes] = useState("");
  const [evidence, setEvidence] = useState("");
  const [links, setLinks] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [projKind, setProjKind] = useState<ProjectKind>("RESEARCH");
  const [projName, setProjName] = useState("");
  const [projObjective, setProjObjective] = useState("");
  const [projQuestion, setProjQuestion] = useState("");
  const [projOwner, setProjOwner] = useState("");
  const [projCriteria, setProjCriteria] = useState("");
  const [projTerms, setProjTerms] = useState("");
  const [dupRef, setDupRef] = useState("");

  const o = data?.opportunity;
  useEffect(() => {
    if (!data) return;
    setAssignee(data.opportunity.assigned_to);
    setScores(data.evaluation?.scores ?? {});
    setDecision(data.evaluation?.decision ?? "");
    setEvalNotes(data.evaluation?.notes ?? "");
    setEvidence(data.evaluation?.evidence ?? "");
    setLinks((data.evaluation?.research_links ?? []).join("\n"));
    setDecisionReason(data.evaluation?.decision_reason ?? "");
    setProjName(data.opportunity.title);
    setDupRef(data.opportunity.related_ref);
  }, [data]);

  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl scroll-slim">
        <SheetHeader>
          <SheetTitle className="font-mono text-brand">
            {o?.public_request_id ?? "Loading…"}
          </SheetTitle>
          <SheetDescription>{o ? `${TYPE_LABEL[o.type]} · ${o.title}` : ""}</SheetDescription>
        </SheetHeader>
        {isLoading || !o || !data ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={o.status} />
              <PMBadge
                tone={o.priority === "critical" || o.priority === "high" ? "danger" : "muted"}
              >
                {o.priority}
              </PMBadge>
              {o.category && <PMBadge>{o.category}</PMBadge>}
              {o.country && <PMBadge tone="info">{o.country}</PMBadge>}
            </div>

            <Block title="Submitter">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Name</dt>
                  <dd className="text-foreground">{o.contact_name}</dd>
                </div>
                {o.company && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Company</dt>
                    <dd className="text-foreground">{o.company}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd className="break-all text-foreground">
                    <a className="hover:underline" href={`mailto:${o.contact_email}`}>
                      {o.contact_email}
                    </a>
                  </dd>
                </div>
                {o.contact_phone && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Phone</dt>
                    <dd className="text-foreground">{o.contact_phone}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">Submitted</dt>
                  <dd className="text-foreground">{formatDate(o.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Source</dt>
                  <dd className="text-foreground">{o.source.replace(/_/g, " ")}</dd>
                </div>
              </dl>
            </Block>

            <Block title="Original submission">
              <p className="whitespace-pre-wrap text-sm text-foreground">{o.description}</p>
              <dl className="grid gap-3 text-sm">
                {Object.entries(o.details)
                  .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v !== "" && v != null))
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-muted-foreground">{prettyKey(k)}</dt>
                      <dd className="whitespace-pre-wrap text-foreground">
                        {Array.isArray(v) ? v.join(", ").replace(/_/g, " ") : String(v)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </Block>

            {o.attachments?.length > 0 && (
              <Block title="Attachments">
                <ul className="space-y-2">
                  {o.attachments.map((a) => (
                    <li key={a.path}>
                      <button
                        type="button"
                        className="text-sm text-brand hover:underline"
                        onClick={async () => {
                          const { url } = await openFile({ data: { path: a.path } });
                          window.open(url, "_blank", "noopener");
                        }}
                      >
                        {a.name}
                      </button>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {(a.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            <Block title="Actions">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="d-status">Status</Label>
                  <select
                    id="d-status"
                    className={selectCls}
                    value={o.status}
                    onChange={(e) =>
                      a.update.mutate({ id: o.id, status: e.target.value as never, reason, actor })
                    }
                  >
                    {OPPORTUNITY_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="d-priority">Priority</Label>
                  <select
                    id="d-priority"
                    className={selectCls}
                    value={o.priority}
                    onChange={(e) =>
                      a.update.mutate({ id: o.id, priority: e.target.value as never, actor })
                    }
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="d-reason">Reason for status change (optional)</Label>
                  <Input
                    id="d-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={2000}
                  />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Input
                    aria-label="Assign to"
                    placeholder="Assign to (e.g. vala(rnd)2341)"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    maxLength={80}
                  />
                  <Button
                    variant="outline"
                    onClick={() => a.update.mutate({ id: o.id, assigned_to: assignee, actor })}
                  >
                    Assign
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => a.update.mutate({ id: o.id, status: "APPROVED", reason, actor })}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => a.update.mutate({ id: o.id, status: "REJECTED", reason, actor })}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => a.update.mutate({ id: o.id, status: "ARCHIVED", reason, actor })}
                >
                  Archive
                </Button>
              </div>
            </Block>

            <Block title="Duplicate / existing product check">
              {data.similar.opportunities.length +
                data.similar.products.length +
                data.similar.ideas.length ===
              0 ? (
                <p className="text-sm text-muted-foreground">
                  No similar requests, products or ideas found.
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.similar.opportunities.map((s) => (
                    <li key={s.id} className="text-foreground">
                      Request <span className="font-mono text-brand">{s.public_request_id}</span> —{" "}
                      {s.title} <span className="text-xs text-muted-foreground">({s.status})</span>
                    </li>
                  ))}
                  {data.similar.products.map((p) => (
                    <li key={p.id} className="text-foreground">
                      Product: {p.product} {p.version}{" "}
                      <span className="text-xs text-muted-foreground">({p.user_code})</span>
                    </li>
                  ))}
                  {data.similar.ideas.map((i) => (
                    <li key={i.id} className="text-foreground">
                      Future Lab idea: {i.title}{" "}
                      <span className="text-xs text-muted-foreground">({i.status})</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  aria-label="Related request or product"
                  placeholder="Related request ID or product name"
                  value={dupRef}
                  onChange={(e) => setDupRef(e.target.value)}
                  maxLength={200}
                />
                <Button
                  variant="outline"
                  disabled={!dupRef.trim()}
                  onClick={() =>
                    a.update.mutate({
                      id: o.id,
                      status: "DUPLICATE",
                      related_ref: dupRef,
                      reason: "Confirmed as duplicate / existing product",
                      actor,
                    })
                  }
                >
                  Confirm duplicate
                </Button>
              </div>
            </Block>

            <Block title="Internal evaluation">
              <p className="text-xs text-muted-foreground">
                Internal only — never shown to the submitter. Score 0–10.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {EVALUATION_AREAS.map((area) => (
                  <label
                    key={area}
                    className="flex items-center justify-between gap-3 text-sm text-foreground"
                  >
                    <span>{area}</span>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={scores[area] ?? 0}
                      aria-label={area}
                      onChange={(e) => setScores((s) => ({ ...s, [area]: Number(e.target.value) }))}
                      className="w-28 accent-[var(--brand)]"
                    />
                    <span className="w-6 text-right font-mono text-brand">{scores[area] ?? 0}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-decision">Decision</Label>
                <select
                  id="e-decision"
                  className={selectCls}
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                >
                  <option value="">— Not decided —</option>
                  {EVALUATION_DECISIONS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>
              <Textarea
                aria-label="Internal notes"
                placeholder="Internal notes"
                value={evalNotes}
                onChange={(e) => setEvalNotes(e.target.value)}
                rows={2}
              />
              <Textarea
                aria-label="Evidence"
                placeholder="Evidence"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                rows={2}
              />
              <Textarea
                aria-label="Research links"
                placeholder="Research links (one URL per line)"
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                rows={2}
              />
              <Input
                aria-label="Decision reason"
                placeholder="Decision reason"
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
              />
              <Button
                disabled={a.evaluate.isPending}
                onClick={() =>
                  a.evaluate.mutate({
                    id: o.id,
                    scores: Object.fromEntries(
                      EVALUATION_AREAS.map((k) => [k, scores[k] ?? 0]),
                    ) as never,
                    decision: decision as never,
                    notes: evalNotes,
                    evidence,
                    research_links: links
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean),
                    decision_reason: decisionReason,
                    actor,
                  })
                }
              >
                Save evaluation
              </Button>
            </Block>

            <Block title="Create project / convert">
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  aria-label="Project type"
                  className={selectCls}
                  value={projKind}
                  onChange={(e) => setProjKind(e.target.value as ProjectKind)}
                >
                  {PROJECT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k === "RESEARCH"
                        ? "Research project"
                        : k === "POC"
                          ? "POC / Experiment"
                          : k === "DEVELOPMENT_HANDOFF"
                            ? "Convert to development"
                            : "Convert to partnership"}
                    </option>
                  ))}
                </select>
                <Input
                  aria-label="Project name"
                  placeholder="Project name"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  maxLength={160}
                />
                <Input
                  aria-label="Owner"
                  placeholder="Owner"
                  value={projOwner}
                  onChange={(e) => setProjOwner(e.target.value)}
                  maxLength={80}
                />
                <Input
                  aria-label="Research question"
                  placeholder="Research question"
                  value={projQuestion}
                  onChange={(e) => setProjQuestion(e.target.value)}
                />
              </div>
              <Textarea
                aria-label="Objective"
                placeholder="Objective / business objective"
                value={projObjective}
                onChange={(e) => setProjObjective(e.target.value)}
                rows={2}
              />
              {projKind === "DEVELOPMENT_HANDOFF" && (
                <Textarea
                  aria-label="Acceptance criteria"
                  placeholder="Acceptance criteria"
                  value={projCriteria}
                  onChange={(e) => setProjCriteria(e.target.value)}
                  rows={2}
                />
              )}
              {projKind === "PARTNERSHIP" && (
                <Textarea
                  aria-label="Commercial terms"
                  placeholder="Commercial / revenue-share terms (confidential)"
                  value={projTerms}
                  onChange={(e) => setProjTerms(e.target.value)}
                  rows={2}
                />
              )}
              <Button
                disabled={!projName.trim() || a.project.isPending}
                onClick={() =>
                  a.project.mutate({
                    id: o.id,
                    kind: projKind,
                    name: projName,
                    objective: projObjective,
                    research_question: projQuestion,
                    owner: projOwner,
                    acceptance_criteria: projCriteria,
                    commercial_terms: projTerms,
                    actor,
                  })
                }
              >
                Create
              </Button>
              {data.projects.length > 0 && (
                <ul className="space-y-2 pt-2">
                  {data.projects.map((p) => (
                    <li key={p.id} className="rounded-xl border border-border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-foreground">{p.name}</span>
                        <span className="flex gap-1">
                          <PMBadge tone="info">{p.kind.replace(/_/g, " ")}</PMBadge>
                          <StatusBadge value={p.status} />
                        </span>
                      </div>
                      {p.kind === "PARTNERSHIP" && (
                        <select
                          aria-label="Partnership stage"
                          className={`${selectCls} mt-2`}
                          value={p.stage}
                          onChange={(e) =>
                            a.projectUpdate.mutate({
                              id: p.id,
                              stage: e.target.value as never,
                              actor,
                            })
                          }
                        >
                          {PARTNERSHIP_STAGES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      )}
                      {p.pipeline_item_id && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Linked to Innovation Pipeline
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Block>

            <Block title="Notes, comments & information requests">
              <div className="flex flex-wrap gap-2">
                {(["note", "comment", "info_request"] as const).map((k) => (
                  <Button
                    key={k}
                    size="sm"
                    variant={noteKind === k ? "default" : "outline"}
                    onClick={() => setNoteKind(k)}
                  >
                    {k === "note"
                      ? "Internal note"
                      : k === "comment"
                        ? "Comment"
                        : "Request more info"}
                  </Button>
                ))}
              </div>
              <Textarea
                aria-label="Message"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                rows={3}
                maxLength={4000}
                placeholder={
                  noteKind === "info_request"
                    ? "What information do you need? (sets status to Needs Information)"
                    : "Write…"
                }
              />
              <Button
                disabled={noteBody.trim().length < 2}
                onClick={() =>
                  a.note.mutate(
                    { id: o.id, kind: noteKind, body: noteBody, actor },
                    { onSuccess: () => setNoteBody("") },
                  )
                }
              >
                Add
              </Button>
            </Block>

            <Block title="Activity timeline & status history">
              <ol className="space-y-3 border-l border-border pl-4">
                {data.events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="text-foreground">
                      <span className="capitalize">{e.kind.replace(/_/g, " ")}</span>
                      {(e.from_value || e.to_value) && (
                        <span className="text-muted-foreground">
                          {" "}
                          {e.from_value && `${e.from_value.replace(/_/g, " ")} → `}
                          {e.to_value.replace(/_/g, " ")}
                        </span>
                      )}
                    </p>
                    {e.body && (
                      <p className="whitespace-pre-wrap text-muted-foreground">{e.body}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {e.actor} · {formatDate(e.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            </Block>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
