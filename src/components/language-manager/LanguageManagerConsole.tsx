import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { pluralCategories } from "@/lib/i18n/format";
import { allMessages } from "@/lib/i18n/messages";
import { SUPPORTED_LANGUAGE_COUNT } from "@/lib/i18n/registry";

/**
 * Language Manager.
 *
 * Reads and drives /api/i18n/admin: the state of the translation engine, what
 * translation memory holds for each of the 140 languages, the review queue for
 * machine output that failed validation, the glossary, and the background
 * translation queue.
 */

type Coverage = {
  verified: number;
  machine: number;
  needs_review: number;
  rejected: number;
  legacy: number;
} | null;

type LanguageRow = {
  code: string;
  name: string;
  nativeName: string;
  script: string;
  direction: string;
  translationStatus: string;
  enabled: boolean;
  translatable: boolean;
  dictionaryEntries: number;
  memory: Coverage;
};

type Overview = {
  engine: Record<string, unknown>;
  catalogueSize: number;
  glossaryTerms: number | null;
  languages: LanguageRow[];
  jobs: { status: string; target_language: string; jobs: number }[];
  errors: string[];
};

type ReviewRow = {
  id: string;
  source_text: string;
  translated_text: string;
  target_language: string;
  namespace: string;
  context: string | null;
  status: string;
  quality_score: number | null;
  quality_flags: string[];
  engine: string | null;
  version: number;
};

/** Where a translation came from: a reviewer, the platform's engine, or older data. */
function originOf(row: ReviewRow): string {
  if (row.engine === "human") return "reviewer";
  if (!row.engine) return row.status === "legacy" ? "legacy" : "unknown";
  return `engine (${row.engine})`;
}

/** Keyed messages carry a note for reviewers (src/lib/i18n/messages). */
const DESCRIPTIONS = new Map(
  allMessages()
    .filter((m) => m.description)
    .map((m) => [`${m.context}|${m.text}`, m.description] as const),
);

function descriptionOf(row: ReviewRow): string | undefined {
  return DESCRIPTIONS.get(`${row.context ?? ""}|${row.source_text}`);
}

type GlossaryRow = {
  id: string;
  source_term: string;
  target_term: string | null;
  target_language: string | null;
  rule: string;
  status: string;
  namespace: string | null;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

const act = (body: unknown) =>
  call<Record<string, unknown>>("/api/i18n/admin", { method: "POST", body: JSON.stringify(body) });

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

export function LanguageManagerConsole() {
  const queryClient = useQueryClient();
  const [reviewLanguage, setReviewLanguage] = useState("");
  const [reviewStatus, setReviewStatus] = useState("needs_review");
  const [edits, setEdits] = useState<Record<string, string>>({});

  const overview = useQuery({
    queryKey: ["i18n-overview"],
    queryFn: () => call<Overview>("/api/i18n/admin?view=overview"),
    refetchInterval: 30_000,
  });

  const review = useQuery({
    queryKey: ["i18n-review", reviewLanguage, reviewStatus],
    queryFn: () =>
      call<{ rows: ReviewRow[]; total: number }>(
        `/api/i18n/admin?view=review&status=${reviewStatus}${reviewLanguage ? `&language=${reviewLanguage}` : ""}`,
      ),
  });

  const glossary = useQuery({
    queryKey: ["i18n-glossary"],
    queryFn: () => call<{ terms: GlossaryRow[] }>("/api/i18n/admin?view=glossary"),
  });

  const run = useMutation({
    mutationFn: act,
    onSuccess: (data) => {
      toast.success(`Done: ${JSON.stringify(data)}`);
      void queryClient.invalidateQueries({ queryKey: ["i18n-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["i18n-review"] });
      void queryClient.invalidateQueries({ queryKey: ["i18n-glossary"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const engine = (overview.data?.engine ?? {}) as {
    configured?: boolean;
    reachable?: boolean;
    ready?: boolean;
    status?: {
      model?: { version?: string; ready?: boolean };
      libretranslate?: { languages?: number } | null;
      detector?: { labels?: number };
    };
    providers?: { id: string; kind: string; configured: boolean; usable: boolean }[];
  };
  const languages = overview.data?.languages ?? [];
  const jobs = overview.data?.jobs ?? [];
  const jobTotals = jobs.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + Number(row.jobs);
    return acc;
  }, {});
  const withMemory = languages.filter(
    (l) => (l.memory?.verified ?? 0) + (l.memory?.machine ?? 0) > 0,
  ).length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Language Manager</h1>
          <p className="text-sm text-muted-foreground">
            {SUPPORTED_LANGUAGE_COUNT} languages, the platform's own translation engine, memory,
            glossary and review.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => overview.refetch()}
            disabled={overview.isFetching}
          >
            Refresh
          </Button>
          <Button
            onClick={() => run.mutate({ action: "run_jobs", limit: 12 })}
            disabled={run.isPending}
          >
            Run jobs now
          </Button>
        </div>
      </header>

      {overview.error && (
        <Card className="border-destructive p-3 text-sm">{(overview.error as Error).message}</Card>
      )}
      {overview.data?.errors?.length ? (
        <Card className="border-amber-500/50 p-3 text-xs">
          Database reported: {overview.data.errors.join("; ")}
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Languages" value={languages.length} />
        <Stat label="With memory" value={withMemory} />
        <Stat label="Catalogue strings" value={overview.data?.catalogueSize ?? "—"} />
        <Stat label="Glossary terms" value={overview.data?.glossaryTerms ?? "—"} />
        <Stat label="Queued jobs" value={jobTotals.queued ?? 0} />
        <Stat
          label="Engine"
          value={engine.ready ? "ready" : engine.configured ? "not ready" : "not configured"}
          tone={engine.ready ? "text-emerald-500" : "text-amber-500"}
        />
      </div>

      <Tabs defaultValue="languages">
        <TabsList>
          <TabsTrigger value="languages">Languages</TabsTrigger>
          <TabsTrigger value="review">
            Review {review.data?.total ? `(${review.data.total})` : ""}
          </TabsTrigger>
          <TabsTrigger value="glossary">Glossary</TabsTrigger>
          <TabsTrigger value="engine">Engine &amp; jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="languages" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                run.mutate({ action: "enqueue_catalogue", languages: "all", refresh: false })
              }
              disabled={run.isPending}
            >
              Pre-translate the catalogue into every language
            </Button>
          </div>
          <Card className="overflow-hidden">
            <ScrollArea className="h-[60vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 text-left text-xs uppercase tracking-wide">
                  <tr>
                    <th className="p-2">Code</th>
                    <th className="p-2">Language</th>
                    <th className="p-2">Script</th>
                    <th className="p-2">Dir</th>
                    <th className="p-2">Plural</th>
                    <th className="p-2">Status</th>
                    <th className="p-2 text-right">Dictionary</th>
                    <th className="p-2 text-right">Verified</th>
                    <th className="p-2 text-right">Machine</th>
                    <th className="p-2 text-right">Review</th>
                    <th className="p-2">Enabled</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {languages.map((language) => (
                    <tr key={language.code} className="border-t border-border/60">
                      <td className="p-2 font-mono text-xs" data-no-translate>
                        {language.code}
                      </td>
                      <td className="p-2" data-no-translate>
                        {language.name}{" "}
                        <span className="text-muted-foreground">{language.nativeName}</span>
                      </td>
                      <td className="p-2 text-xs">{language.script}</td>
                      <td className="p-2 text-xs uppercase">{language.direction}</td>
                      <td className="p-2 text-xs">{pluralCategories(language.code).join("/")}</td>
                      <td className="p-2">
                        <Badge variant="outline">{language.translationStatus}</Badge>
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {language.dictionaryEntries || "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {language.memory?.verified ?? 0}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {language.memory?.machine ?? 0}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {language.memory?.needs_review ?? 0}
                      </td>
                      <td className="p-2">
                        <Switch
                          checked={language.enabled}
                          disabled={language.code === "en" || run.isPending}
                          onCheckedChange={(enabled) =>
                            run.mutate({
                              action: "set_language_enabled",
                              code: language.code,
                              enabled,
                            })
                          }
                        />
                      </td>
                      <td className="p-2 text-right">
                        {language.translatable && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              run.mutate({
                                action: "enqueue_catalogue",
                                languages: [language.code],
                              })
                            }
                            disabled={run.isPending}
                          >
                            Pre-translate
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Language code (e.g. hi)"
              value={reviewLanguage}
              onChange={(event) => setReviewLanguage(event.target.value.trim())}
              className="w-56"
            />
            {["needs_review", "machine", "verified", "rejected"].map((status) => (
              <Button
                key={status}
                size="sm"
                variant={reviewStatus === status ? "default" : "outline"}
                onClick={() => setReviewStatus(status)}
              >
                {status.replace("_", " ")}
              </Button>
            ))}
          </div>
          {review.error && (
            <Card className="border-destructive p-3 text-sm">
              {(review.error as Error).message}
            </Card>
          )}
          <div className="space-y-3">
            {(review.data?.rows ?? []).map((row) => (
              <Card key={row.id} className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{row.target_language}</Badge>
                  <Badge variant="outline">{row.status}</Badge>
                  <span>quality {row.quality_score ?? "—"}</span>
                  <span>v{row.version}</span>
                  <span>{row.engine ?? "—"}</span>
                  <span>{row.namespace}</span>
                  {row.context && <span>context: {row.context}</span>}
                  <span>origin: {originOf(row)}</span>
                  {row.quality_flags?.length ? (
                    <span className="text-amber-500">{row.quality_flags.join(", ")}</span>
                  ) : null}
                </div>
                <div className="text-sm" data-no-translate>
                  {row.source_text}
                </div>
                {descriptionOf(row) && (
                  <div className="text-xs text-muted-foreground" data-no-translate>
                    {descriptionOf(row)}
                  </div>
                )}
                <Textarea
                  value={edits[row.id] ?? row.translated_text}
                  onChange={(event) =>
                    setEdits((prev) => ({ ...prev, [row.id]: event.target.value }))
                  }
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      run.mutate({
                        action: "review",
                        id: row.id,
                        decision: "verify",
                        ...(edits[row.id] && edits[row.id] !== row.translated_text
                          ? { text: edits[row.id] }
                          : {}),
                      })
                    }
                    disabled={run.isPending}
                  >
                    Verify
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => run.mutate({ action: "review", id: row.id, decision: "reject" })}
                    disabled={run.isPending}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => run.mutate({ action: "review", id: row.id, decision: "reopen" })}
                    disabled={run.isPending}
                  >
                    Reopen
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Mark it stale and translate it again (not for verified rows)"
                    onClick={() =>
                      run.mutate({ action: "review", id: row.id, decision: "retranslate" })
                    }
                    disabled={run.isPending || row.status === "verified"}
                  >
                    Re-translate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Approve and make it this language's required term wherever the English appears"
                    onClick={() =>
                      run.mutate({
                        action: "review",
                        id: row.id,
                        decision: "lock",
                        ...(edits[row.id] && edits[row.id] !== row.translated_text
                          ? { text: edits[row.id] }
                          : {}),
                      })
                    }
                    disabled={run.isPending || row.source_text.length > 200}
                  >
                    Lock
                  </Button>
                </div>
              </Card>
            ))}
            {review.data && review.data.rows.length === 0 && (
              <Card className="p-4 text-sm text-muted-foreground">
                Nothing waiting with this status.
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="glossary" className="space-y-3">
          <GlossaryForm
            onSave={(term) => run.mutate({ action: "glossary_save", term })}
            busy={run.isPending}
          />
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/80 text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="p-2">Term</th>
                  <th className="p-2">Rendering</th>
                  <th className="p-2">Language</th>
                  <th className="p-2">Rule</th>
                  <th className="p-2">Status</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {(glossary.data?.terms ?? []).map((term) => (
                  <tr key={term.id} className="border-t border-border/60">
                    <td className="p-2">{term.source_term}</td>
                    <td className="p-2">
                      {term.target_term ?? (
                        <span className="text-muted-foreground">kept as is</span>
                      )}
                    </td>
                    <td className="p-2 font-mono text-xs">{term.target_language ?? "all"}</td>
                    <td className="p-2">{term.rule}</td>
                    <td className="p-2">
                      <Badge variant="outline">{term.status}</Badge>
                    </td>
                    <td className="p-2 text-right">
                      {term.status !== "approved" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            run.mutate({
                              action: "glossary_save",
                              term: { ...term, status: "approved" },
                            })
                          }
                          disabled={run.isPending}
                        >
                          Approve
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            run.mutate({
                              action: "glossary_save",
                              term: { ...term, status: "deprecated" },
                            })
                          }
                          disabled={run.isPending}
                        >
                          Deprecate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="engine" className="space-y-3">
          <Card className="space-y-2 p-4 text-sm">
            <div className="font-semibold">Providers</div>
            {(engine.providers ?? []).map((provider) => (
              <div key={provider.id} className="flex items-center gap-2">
                <Badge variant={provider.kind === "owned" ? "default" : "outline"}>
                  {provider.kind}
                </Badge>
                <span className="font-mono text-xs">{provider.id}</span>
                <span className="text-muted-foreground">
                  {provider.usable
                    ? "in use"
                    : provider.configured
                      ? "configured, not used"
                      : "not configured"}
                </span>
              </div>
            ))}
            <div className="pt-2 font-semibold">Engine</div>
            <pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs" data-no-translate>
              {JSON.stringify(engine.status ?? engine, null, 1)}
            </pre>
          </Card>
          <Card className="space-y-2 p-4 text-sm">
            <div className="font-semibold">Job queue</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(jobTotals).map(([status, count]) => (
                <Badge key={status} variant="outline">
                  {status}: {count}
                </Badge>
              ))}
              {jobs.length === 0 && (
                <span className="text-muted-foreground">The queue is empty.</span>
              )}
            </div>
            <ScrollArea className="max-h-48">
              <table className="w-full text-xs">
                <tbody>
                  {jobs.map((row) => (
                    <tr
                      key={`${row.status}-${row.target_language}`}
                      className="border-t border-border/60"
                    >
                      <td className="p-1 font-mono">{row.target_language}</td>
                      <td className="p-1">{row.status}</td>
                      <td className="p-1 text-right tabular-nums">{row.jobs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GlossaryForm({
  onSave,
  busy,
}: {
  onSave: (term: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [term, setTerm] = useState({
    source_term: "",
    target_term: "",
    target_language: "",
    rule: "locked",
  });
  return (
    <Card className="flex flex-wrap items-end gap-2 p-3">
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Term</div>
        <Input
          value={term.source_term}
          onChange={(event) => setTerm({ ...term, source_term: event.target.value })}
          placeholder="Software Vala"
          className="w-48"
        />
      </div>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Rendering (optional for locked)</div>
        <Input
          value={term.target_term}
          onChange={(event) => setTerm({ ...term, target_term: event.target.value })}
          placeholder="Finalizar compra"
          className="w-48"
        />
      </div>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Language (blank = all)</div>
        <Input
          value={term.target_language}
          onChange={(event) => setTerm({ ...term, target_language: event.target.value.trim() })}
          placeholder="pt-BR"
          className="w-28"
        />
      </div>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Rule</div>
        <select
          value={term.rule}
          onChange={(event) => setTerm({ ...term, rule: event.target.value })}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="locked">locked (never translated)</option>
          <option value="preferred">preferred (must be used)</option>
          <option value="forbidden">forbidden (must not appear)</option>
        </select>
      </div>
      <Button
        disabled={
          busy || !term.source_term.trim() || (term.rule !== "locked" && !term.target_term.trim())
        }
        onClick={() =>
          onSave({
            source_term: term.source_term.trim(),
            target_term: term.target_term.trim() || null,
            target_language: term.target_language || null,
            rule: term.rule,
            status: "approved",
          })
        }
      >
        Save term
      </Button>
    </Card>
  );
}
