import { useMemo, useState } from "react";
import {
  AlertTriangle, ChevronDown, ChevronUp, Check, History, Info, Loader2,
  Plus, RotateCcw, Trash2, X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, EmptyHint, PageHeader, PillButton, StatCard } from "../ui";
import {
  getChromeDraft, validateChrome, publishChrome, rollbackChrome, listChromeVersions,
  saveFooterLink, removeFooterLink, reorderFooterLinks,
  saveSocial, saveTrustItem, saveFooterSettings, saveFloatingElement,
} from "@/lib/storefront/chrome.functions";

/**
 * Floating Elements and Storefront Footer — the real ones.
 *
 * Both screens used to be static. Floating Elements was four hardcoded titles
 * with a Switch that had no handler. Footer Manager was a hardcoded list of
 * five columns whose "+ Link" called notBuilt(), inputs with no state, and a
 * Publish Footer button with no onClick.
 *
 * They now read and write the storefront chrome tables through sf_* functions,
 * which check operator rights, validate before publishing and record every
 * change through mm_audit. Editing changes a draft; the public site moves only
 * when somebody publishes, and publishing refuses if validation finds an error.
 *
 * A note about the footer's columns. The screen used to list COMPANY,
 * MARKETPLACE, PARTNER, SUPPORT and LEGAL with links like About, Careers,
 * Blog, Press, Status, Documentation and GDPR. Twenty of those twenty-five
 * have no route in this project, so they were never links — they were labels.
 * What this screen shows now is the footer that is actually on the site.
 */

const draftKey = (kind: string) => ["storefront", "draft", kind] as const;
const checkKey = (kind: string) => ["storefront", "validate", kind] as const;
const versionsKey = (kind: string) => ["storefront", "versions", kind] as const;

/* ------------------------------------------------------------- shared bits */

function useChrome(kind: "footer" | "floating") {
  const qc = useQueryClient();

  const draft = useQuery({
    queryKey: draftKey(kind),
    queryFn: () => getChromeDraft({ data: { kind } }),
    staleTime: 15_000,
  });

  const check = useQuery({
    queryKey: checkKey(kind),
    queryFn: () => validateChrome({ data: { kind } }),
    staleTime: 15_000,
  });

  const versions = useQuery({
    queryKey: versionsKey(kind),
    queryFn: () => listChromeVersions({ data: { kind } }),
    staleTime: 30_000,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: draftKey(kind) });
    void qc.invalidateQueries({ queryKey: checkKey(kind) });
  };

  const onError = (e: Error) => toast.error(e.message || "The change was refused.");

  const publish = useMutation({
    mutationFn: (note?: string) => publishChrome({ data: { kind, note } }),
    onSuccess: (r: { version?: number }) => {
      refresh();
      void qc.invalidateQueries({ queryKey: versionsKey(kind) });
      toast.success(`Published version ${r?.version ?? ""}`.trim());
    },
    onError,
  });

  const rollback = useMutation({
    mutationFn: (version: number) => rollbackChrome({ data: { kind, version } }),
    onSuccess: () => {
      refresh();
      void qc.invalidateQueries({ queryKey: versionsKey(kind) });
      toast.success("Rolled back");
    },
    onError,
  });

  return { draft, check, versions, refresh, onError, publish, rollback };
}

type Problem = { severity: string; item: string; message: string };

function ValidationPanel({ check }: { check: { errors?: number; warnings?: number; problems?: Problem[] } | undefined }) {
  if (!check) return null;
  const problems = check.problems ?? [];
  if (problems.length === 0) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
        <Check className="h-4 w-4 flex-none" />
        Nothing blocks publishing.
      </div>
    );
  }
  return (
    <div className="mb-4 space-y-1">
      {problems.map((p, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
            p.severity === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-amber-500/40 bg-amber-500/10 text-amber-600"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <span><b>{p.item}</b> — {p.message}</span>
        </div>
      ))}
    </div>
  );
}

function VersionsPanel({
  versions, onRollback, busy,
}: {
  versions: { version: number; is_live: boolean; note: string | null; published_at: string; published_by: string | null }[];
  onRollback: (v: number) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (versions.length === 0) return <EmptyHint text="Nothing has been published yet." />;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <History className="h-3.5 w-3.5" />
        {open ? "Hide" : "Show"} version history ({versions.length})
      </button>
      {open && (
        <div className="space-y-1">
          {versions.map((v) => (
            <div key={v.version} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-1.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  v{v.version}
                  {v.is_live && (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">live</span>
                  )}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {new Date(v.published_at).toLocaleString()}
                  {v.published_by ? ` · ${v.published_by}` : ""}
                  {v.note ? ` · ${v.note}` : ""}
                </div>
              </div>
              {!v.is_live && (
                <PillButton variant="ghost" disabled={busy} onClick={() => onRollback(v.version)}>
                  <span className="inline-flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Restore</span>
                </PillButton>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({
  label, on, onChange, disabled,
}: { label: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
        on ? "border-accent/50 bg-accent/15 text-accent" : "border-border text-muted-foreground"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${on ? "bg-accent" : "bg-muted-foreground/40"}`} />
      {label}
    </button>
  );
}

function Field({
  label, value, onCommit, placeholder, type = "text",
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const [local, setLocal] = useState(value);
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</span>
      <input
        type={type}
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onCommit(local); }}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

function Select({
  label, value, options, onChange,
}: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

/* ================================================== FLOATING ELEMENTS ==== */

type FloatingRow = {
  key: string; name: string; label: string; enabled: boolean;
  desktop_enabled: boolean; tablet_enabled: boolean; mobile_enabled: boolean;
  position: string; offset_x: number; offset_y: number; theme: string;
  trigger_type: string; trigger_value: number;
  action_type: string; action_target: string | null;
  priority: number; audience: string; page_scope: string;
  element_type: string;
};

export function StickySection() {
  const { draft, check, versions, refresh, onError, publish, rollback } = useChrome("floating");
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: (v: { key: string; patch: Record<string, unknown> }) =>
      saveFloatingElement({ data: v }),
    onSuccess: () => { refresh(); toast.success("Saved"); },
    onError,
  });

  const data = draft.data as { ok?: boolean; reason?: string; elements?: FloatingRow[]; live_version?: number } | undefined;
  const elements = data?.elements ?? [];
  const errors = (check.data as { errors?: number } | undefined)?.errors ?? 0;

  const set = (key: string, patch: Record<string, unknown>) => save.mutate({ key, patch });

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Sticky Element Manager"
        title="Floating Elements"
        description="Intercom/Crisp-style floating widgets."
        actions={
          <PillButton
            variant="primary"
            disabled={publish.isPending || errors > 0}
            onClick={() => publish.mutate("Floating elements updated")}
          >
            {publish.isPending ? "Publishing…" : errors > 0 ? "Fix errors to publish" : "Publish"}
          </PillButton>
        }
      />

      {data?.ok === false && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <span>{data.reason === "not_permitted"
            ? "Changing floating elements needs marketplace operator rights."
            : "The configuration could not be read."}</span>
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Elements" value={String(elements.length)} />
        <StatCard label="Enabled" value={String(elements.filter((e) => e.enabled).length)} />
        <StatCard label="Live version" value={data?.live_version ? `v${data.live_version}` : "—"} />
        <StatCard label="Blocking errors" value={String(errors)} tone={errors ? "destructive" : "success"} />
      </div>

      <ValidationPanel check={check.data as never} />

      {draft.isLoading && <EmptyHint text="Reading the configuration…" />}

      <div className="grid gap-4 md:grid-cols-2">
        {elements.map((el) => (
          <Card key={el.key}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{el.name}</div>
                <div className="text-[11px] text-muted-foreground">{el.element_type}</div>
              </div>
              <Toggle
                label={el.enabled ? "On" : "Off"}
                on={el.enabled}
                disabled={save.isPending}
                onChange={(v) => set(el.key, { enabled: v })}
              />
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              <Toggle label="Desktop" on={el.desktop_enabled} onChange={(v) => set(el.key, { desktop_enabled: v })} />
              <Toggle label="Tablet" on={el.tablet_enabled} onChange={(v) => set(el.key, { tablet_enabled: v })} />
              <Toggle label="Mobile" on={el.mobile_enabled} onChange={(v) => set(el.key, { mobile_enabled: v })} />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Label" value={el.label} onCommit={(v) => set(el.key, { label: v })} />
              <Select
                label="Corner"
                value={el.position}
                onChange={(v) => set(el.key, { position: v })}
                options={[
                  ["bottom-right", "Bottom right"], ["bottom-left", "Bottom left"],
                  ["top-right", "Top right"], ["top-left", "Top left"],
                ]}
              />
              <Select
                label="Theme"
                value={el.theme}
                onChange={(v) => set(el.key, { theme: v })}
                options={[["accent","Accent"],["primary","Primary"],["success","Success"],["premium","Premium"],["neutral","Neutral"]]}
              />
              <Field label="Priority (1 wins the corner)" type="number" value={String(el.priority)}
                     onCommit={(v) => set(el.key, { priority: Number(v) })} />
              <Select
                label="Trigger"
                value={el.trigger_type}
                onChange={(v) => set(el.key, { trigger_type: v })}
                options={[["immediate","Immediately"],["delay","After a delay (ms)"],["scroll","After scrolling (%)"],["exit_intent","On exit intent"]]}
              />
              <Field label="Trigger value" type="number" value={String(el.trigger_value)}
                     onCommit={(v) => set(el.key, { trigger_value: Number(v) })} />
              <Select
                label="Action"
                value={el.action_type}
                onChange={(v) => set(el.key, { action_type: v })}
                options={[["route","Internal route"],["external","External URL"],["whatsapp","WhatsApp"],["mailto","Email"],["tel","Phone"],["lead_form","Demo request form"],["none","No action"]]}
              />
              <Field label="Target" value={el.action_target ?? ""} placeholder="/ai/assistant"
                     onCommit={(v) => set(el.key, { action_target: v })} />
              <Select
                label="Audience"
                value={el.audience}
                onChange={(v) => set(el.key, { audience: v })}
                options={[["all","Everyone"],["guest","Signed-out only"],["authenticated","Signed-in only"]]}
              />
              <Select
                label="Pages"
                value={el.page_scope}
                onChange={(v) => set(el.key, { page_scope: v })}
                options={[["all","All pages"],["home","Home only"],["marketplace","Marketplace"],["product","Product pages"],["category","Category pages"]]}
              />
              <Field label="Offset X (px)" type="number" value={String(el.offset_x)}
                     onCommit={(v) => set(el.key, { offset_x: Number(v) })} />
              <Field label="Offset Y (px)" type="number" value={String(el.offset_y)}
                     onCommit={(v) => set(el.key, { offset_y: Number(v) })} />
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <VersionsPanel
          versions={(versions.data as { versions?: never[] } | undefined)?.versions ?? []}
          busy={rollback.isPending}
          onRollback={(v) => rollback.mutate(v)}
        />
      </Card>
    </div>
  );
}

/* ========================================================= FOOTER ======== */

type FooterLinkRow = {
  id: string; label: string; link_type: string; href: string | null;
  resolved_href: string | null; open_in_new: boolean; position: number;
  enabled: boolean; audience: string; legal_policy_type: string | null;
};
type FooterColumnRow = {
  id: string; key: string; heading: string; position: number;
  enabled: boolean; links: FooterLinkRow[];
};

export function FooterSection() {
  const { draft, check, versions, refresh, onError, publish, rollback } = useChrome("footer");
  const [adding, setAdding] = useState<string | null>(null);

  const linkSave = useMutation({
    mutationFn: (patch: Record<string, unknown>) => saveFooterLink({ data: { patch } }),
    onSuccess: () => { refresh(); toast.success("Saved"); setAdding(null); },
    onError,
  });
  const linkRemove = useMutation({
    mutationFn: (v: { id: string; hard?: boolean }) => removeFooterLink({ data: v }),
    onSuccess: () => { refresh(); toast.success("Updated"); },
    onError,
  });
  const linkReorder = useMutation({
    mutationFn: (v: { columnId: string; ids: string[] }) => reorderFooterLinks({ data: v }),
    onSuccess: () => { refresh(); },
    onError,
  });
  const socialSave = useMutation({
    mutationFn: (patch: Record<string, unknown>) => saveSocial({ data: { patch } }),
    onSuccess: () => { refresh(); toast.success("Profile saved"); },
    onError,
  });
  const trustSave = useMutation({
    mutationFn: (patch: Record<string, unknown>) => saveTrustItem({ data: { patch } }),
    onSuccess: () => { refresh(); toast.success("Saved"); },
    onError,
  });
  const settingsSave = useMutation({
    mutationFn: (patch: Record<string, unknown>) => saveFooterSettings({ data: { patch } }),
    onSuccess: () => { refresh(); toast.success("Settings saved"); },
    onError,
  });

  const data = draft.data as {
    ok?: boolean; reason?: string;
    columns?: FooterColumnRow[];
    socials?: { id: string; platform: string; url: string; handle: string | null; enabled: boolean }[];
    trust?: { id: string; kind: string; name: string; alt_text: string; enabled: boolean }[];
    settings?: Record<string, unknown>;
    live_version?: number;
  } | undefined;

  const columns = data?.columns ?? [];
  const socials = data?.socials ?? [];
  const trust = data?.trust ?? [];
  const settings = data?.settings ?? {};
  const errors = (check.data as { errors?: number } | undefined)?.errors ?? 0;
  const linkCount = useMemo(
    () => columns.reduce((n, c) => n + c.links.filter((l) => l.enabled).length, 0),
    [columns],
  );

  const move = (col: FooterColumnRow, index: number, delta: number) => {
    const ids = col.links.map((l) => l.id);
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    linkReorder.mutate({ columnId: col.id, ids });
  };

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Footer Manager"
        title="Storefront Footer"
        description="Columns, links, newsletter, social handles, payment & trust strip — visible on every public page."
        actions={
          <PillButton
            variant="primary"
            disabled={publish.isPending || errors > 0}
            onClick={() => publish.mutate("Footer updated")}
          >
            {publish.isPending ? "Publishing…" : errors > 0 ? "Fix errors to publish" : "Publish Footer"}
          </PillButton>
        }
      />

      {data?.ok === false && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <span>{data.reason === "not_permitted"
            ? "Changing the footer needs marketplace operator rights."
            : "The footer could not be read."}</span>
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Columns" value={String(columns.length)} />
        <StatCard label="Live links" value={String(linkCount)} />
        <StatCard label="Live version" value={data?.live_version ? `v${data.live_version}` : "—"} />
        <StatCard label="Blocking errors" value={String(errors)} tone={errors ? "destructive" : "success"} />
      </div>

      <ValidationPanel check={check.data as never} />

      {draft.isLoading && <EmptyHint text="Reading the footer…" />}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <h3 className="mb-3 text-base font-bold">Link columns</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {columns.map((col) => (
              <div key={col.id} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-accent">
                    {col.heading}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdding(col.id)}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" /> Link
                  </button>
                </div>

                <ul className="space-y-1.5 text-sm">
                  {col.links.map((l, i) => (
                    <li key={l.id} className="rounded-lg border border-border/50 px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`min-w-0 truncate ${l.enabled ? "" : "line-through opacity-50"}`}>
                          {l.label}
                        </span>
                        <div className="flex flex-none items-center gap-0.5">
                          <button title="Move up" onClick={() => move(col, i, -1)}
                                  className="rounded p-0.5 hover:bg-muted disabled:opacity-30" disabled={i === 0}>
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button title="Move down" onClick={() => move(col, i, 1)}
                                  className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                                  disabled={i === col.links.length - 1}>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <Toggle
                            label={l.enabled ? "On" : "Off"}
                            on={l.enabled}
                            onChange={(v) => linkSave.mutate({ id: l.id, enabled: v })}
                          />
                          <button title="Disable and archive" onClick={() => linkRemove.mutate({ id: l.id })}
                                  className="rounded p-0.5 text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 truncate text-[11px] text-muted-foreground">
                        {l.link_type === "legal"
                          ? (l.resolved_href ?? `legal:${l.legal_policy_type} — no published policy`)
                          : l.href}
                      </div>
                    </li>
                  ))}
                  {col.links.length === 0 && <EmptyHint text="No links in this column." />}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h3 className="mb-2 text-sm font-bold">Newsletter</h3>
            {/* Section 22. There is no subscriber system in this database, so
                the form is not offered to customers until one is configured.
                Switching it on without a provider is refused at publish. */}
            {!settings.newsletter_provider && (
              <div className="mb-2 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 text-[11px] text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-none" />
                <span>
                  No subscriber system is connected. Software Vala has no newsletter
                  or subscriber table, so an address collected here would have nowhere
                  to go. The form stays off the storefront until a provider is set.
                </span>
              </div>
            )}
            <div className="space-y-2">
              <Field label="Heading" value={String(settings.newsletter_title ?? "")}
                     onCommit={(v) => settingsSave.mutate({ newsletter_title: v })} />
              <Field label="Provider" value={String(settings.newsletter_provider ?? "")}
                     placeholder="none configured"
                     onCommit={(v) => settingsSave.mutate({ newsletter_provider: v })} />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Show on footer</span>
                <Toggle
                  label={settings.newsletter_enabled ? "On" : "Off"}
                  on={Boolean(settings.newsletter_enabled)}
                  onChange={(v) => settingsSave.mutate({ newsletter_enabled: v })}
                />
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-bold">Social handles</h3>
            <div className="space-y-2">
              {socials.map((s) => (
                <div key={s.id} className="rounded-lg border border-border/50 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold">{s.platform}</span>
                    <Toggle
                      label={s.enabled ? "On" : "Off"}
                      on={s.enabled}
                      onChange={(v) => socialSave.mutate({ platform: s.platform, enabled: v })}
                    />
                  </div>
                  <Field
                    label="Profile URL"
                    value={s.url}
                    onCommit={(v) => socialSave.mutate({ platform: s.platform, url: v })}
                  />
                </div>
              ))}
              {socials.length === 0 && <EmptyHint text="No profiles configured." />}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Only accounts the business actually runs are listed. Twitter and LinkedIn
              are absent because Software Vala has no profile on either.
            </p>
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-bold">Trust strip</h3>
            <div className="space-y-1">
              {trust.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-2 py-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">{t.name}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{t.alt_text}</div>
                  </div>
                  <Toggle
                    label={t.enabled ? "On" : "Off"}
                    on={t.enabled}
                    onChange={(v) => trustSave.mutate({ id: t.id, enabled: v })}
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Only the payment routes Software Vala actually uses. Every item carries
              alt text, because the strip is read by screen readers too.
            </p>
          </Card>

          <Card>
            <VersionsPanel
              versions={(versions.data as { versions?: never[] } | undefined)?.versions ?? []}
              busy={rollback.isPending}
              onRollback={(v) => rollback.mutate(v)}
            />
          </Card>
        </div>
      </div>

      {adding && (
        <AddLinkDialog
          columnId={adding}
          busy={linkSave.isPending}
          onClose={() => setAdding(null)}
          onSave={(patch) => linkSave.mutate(patch)}
        />
      )}
    </div>
  );
}

function AddLinkDialog({
  columnId, onClose, onSave, busy,
}: {
  columnId: string;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState("internal");
  const [href, setHref] = useState("");
  const [policy, setPolicy] = useState("privacy");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 md:p-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-bold">Add a footer link</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Label</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus
                   className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          </label>

          <Select
            label="Type" value={type} onChange={setType}
            options={[["internal","Internal route"],["external","External URL"],["mailto","Email"],["tel","Phone"],["legal","Legal policy"]]}
          />

          {type === "legal" ? (
            <>
              <Select
                label="Policy" value={policy} onChange={setPolicy}
                options={[["privacy","Privacy Policy"],["terms","Terms"],["refund","Refund Policy"],["license","License"],["gdpr","GDPR"]]}
              />
              <p className="text-[11px] text-amber-600">
                No policy is published in the Legal Manager yet, so a legal link cannot
                resolve and publishing will refuse it until one is.
              </p>
            </>
          ) : (
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                Destination
              </span>
              <input
                value={href}
                onChange={(e) => setHref(e.target.value)}
                placeholder={type === "internal" ? "/marketplace" : type === "external" ? "https://…" : type === "mailto" ? "mailto:you@…" : "tel:+91…"}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                Internal links must start with /. External links must be https.
                A “#” placeholder is refused.
              </span>
            </label>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <PillButton variant="ghost" onClick={onClose}>Cancel</PillButton>
          <PillButton
            variant="primary"
            disabled={busy || !label.trim() || (type !== "legal" && !href.trim())}
            onClick={() =>
              onSave({
                column_id: columnId,
                label: label.trim(),
                link_type: type,
                href: type === "legal" ? null : href.trim(),
                legal_policy_type: type === "legal" ? policy : null,
                open_in_new: type === "external",
              })
            }
          >
            {busy ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span> : "Add link"}
          </PillButton>
        </div>
      </div>
    </div>
  );
}
