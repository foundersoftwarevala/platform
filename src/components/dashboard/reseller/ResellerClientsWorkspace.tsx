import { useMemo, useRef, useState } from "react";
import { useTranslation as useI18nSource } from "@/lib/i18n/use-translation";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Search, UserCheck, Mail, Phone, Building2, MapPin, Star,
  ShoppingCart, FileBadge, StickyNote, FileText, CalendarClock, MessageSquare,
  Paperclip, Pencil, Trash2, Activity, Heart, Inbox,
} from "lucide-react";
import type { CrudRecord } from "@/lib/crud-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/serverFn";
import { supabase } from "@/integrations/supabase/client";
import {
  addResellerClientCommunication,
  addResellerClientFollowUp,
  listResellerClientActivity,
  listResellerClientLicences,
  registerResellerClientDocument,
  saveResellerClientNotes,
  setResellerClientFollowUpDone,
} from "@/lib/reseller-dashboard.functions";
import { useResellerCustomers } from "@/lib/useResellerCustomers";

type Tab = "profile" | "purchases" | "licenses" | "notes" | "documents" | "followup" | "timeline";

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "profile",   label: "Profile",     icon: UserCheck },
  { key: "purchases", label: "Purchase History", icon: ShoppingCart },
  { key: "licenses",  label: "License History",  icon: FileBadge },
  { key: "notes",     label: "Notes",       icon: StickyNote },
  { key: "documents", label: "Documents",   icon: FileText },
  { key: "followup",  label: "Follow Up",   icon: CalendarClock },
  { key: "timeline",  label: "Timeline",    icon: MessageSquare },
];

export function ResellerClientsWorkspace({ onBack }: { onBack: () => void }) {
    const { t: translateText } = useI18nSource();
  // The clients themselves are rows in crm_customers, which is the table the
  // Reseller Manager's Customers wall reads.
  const crud = useResellerCustomers();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("profile");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return crud.records;
    return crud.records.filter((r) =>
      [r.name, r.owner, String(r.extra.email ?? ""), String(r.extra.company ?? "")]
        .some((s) => s.toLowerCase().includes(q))
    );
  }, [crud.records, query]);

  const active = (selectedId ? crud.records.find((r) => r.id === selectedId) : null) ?? null;
  // Licences this reseller sold to the selected client, from the orders they
  // are credited with (see listResellerClientLicences).
  const listLicences = useServerFn(listResellerClientLicences);
  const licenceQuery = useQuery({
    queryKey: ["reseller", "client-licences", active?.id],
    enabled: !!active,
    queryFn: () => listLicences({ data: { clientId: active!.id } }),
  });
  const clientLicenses: CrudRecord[] = (licenceQuery.data ?? []).map((l) => ({
    id: l.id,
    name: l.product,
    status: l.status === "active" ? "active" : l.status === "revoked" ? "rejected" : "archived",
    owner: "",
    category: l.model ?? "",
    amount: 0,
    date: l.expires_at ?? "",
    notes: "",
    tags: [],
    comments: [],
    audit: [],
    attachments: [],
    extra: { key: l.keyHint, expiry: l.expires_at ? l.expires_at.slice(0, 10) : "Does not expire" },
  }));

  return (
    <div className="space-y-5">
      <Header onBack={onBack} active={active} onClearActive={() => setSelectedId(null)} />

      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        {/* List */}
        <aside className="rounded-2xl border border-border bg-card shadow-card overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={translateText("dashboard.search_clients_e2f2ed")}
                aria-label={translateText("dashboard.search_clients_b50bf5")}
                className="w-full rounded-lg bg-surface border border-border pl-8 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={() => { setAdding(true); setSelectedId(null); }}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow"
            >
              <Plus className="h-3.5 w-3.5" /> {translateText("dashboard.new_client_902994")}</button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                <UserCheck className="mx-auto h-6 w-6 mb-2 opacity-60" />
                {translateText("dashboard.no_clients_yet_create_your_first_to_start_tr_3b2c23")}</div>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setSelectedId(r.id); setAdding(false); setTab("profile"); }}
                  className={`w-full text-left px-3 py-2.5 border-b border-border/60 hover:bg-surface transition flex items-center gap-3 ${selectedId === r.id ? "bg-surface" : ""}`}
                >
                  <div className="h-9 w-9 rounded-lg bg-gradient-brand grid place-items-center text-[11px] font-bold text-brand-foreground shrink-0">
                    {initials(r.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{r.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {String(r.extra.company ?? r.extra.email ?? "—")}
                    </div>
                  </div>
                  <HealthDot score={Number(r.extra.health ?? 0)} />
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Detail */}
        <section className="min-w-0">
          {adding ? (
            <ClientForm
              onCancel={() => setAdding(false)}
              onSubmit={(values) => {
                void crud
                  .create({ name: values.name, extra: values.extra })
                  .then((rec) => {
                    toast.success(translateText("dashboard.client_created_481a66"));
                    setAdding(false);
                    setSelectedId((rec as { id?: string } | undefined)?.id ?? null);
                    setTab("profile");
                  })
                  .catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : "That client was not saved."),
                  );
              }}
            />
          ) : !active ? (
            <EmptyDetail onAdd={() => setAdding(true)} />
          ) : (
            <ClientDetail
              record={active}
              tab={tab}
              setTab={setTab}
              licenses={clientLicenses}
              onPatch={(p) => crud.update(active.id, p)}
              onDelete={() => {
                void crud
                  .remove(active.id)
                  .then(() => { setSelectedId(null); toast.success(translateText("dashboard.client_removed_7ab9a5")); })
                  .catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : "That client was not removed."),
                  );
              }}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function Header({ onBack, active, onClearActive }: { onBack: () => void; active: CrudRecord | null; onClearActive: () => void }) {
    const { t: translateText } = useI18nSource();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={active ? onClearActive : onBack}
        className="inline-flex items-center gap-2 rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2 transition">
        <ArrowLeft className="h-3.5 w-3.5" /> {active ? "Back to clients" : "Back to Dashboard"}
      </button>
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 text-[oklch(0.72_0.2_265)]">
          <UserCheck className="h-4 w-4" />
        </div>
        <div>
          <nav className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span>{translateText("dashboard.reseller_dashboard_516400")}</span><span>/</span><span className="text-foreground">{translateText("dashboard.clients_28e22f")}</span>
            {active && <><span>/</span><span className="text-foreground truncate max-w-[18ch]">{active.name}</span></>}
          </nav>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">{translateText("dashboard.client_management_961013")}</h1>
        </div>
      </div>
    </div>
  );
}

function EmptyDetail({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center shadow-card">
      <UserCheck className="mx-auto h-8 w-8 text-muted-foreground" />
      <div className="mt-3 text-sm font-semibold">Select or create a client</div>
      <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
        Pick a client from the list to see profile, purchase history, licenses, notes, documents,
        follow-up tasks and the full communication timeline.
      </p>
      <button onClick={onAdd} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow">
        <Plus className="h-3.5 w-3.5" /> Create your first client
      </button>
    </div>
  );
}

type Patch = (p: Partial<CrudRecord>) => Promise<unknown>;

/** The reason a save failed, as the server said it. */
function reason(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

const PURCHASE_MANUAL_UNAVAILABLE =
  "Purchases are recorded when the client buys through you on the marketplace; a purchase cannot be typed in by hand.";
const WEBSITE_UNAVAILABLE = "Not stored yet: the client record has no website field.";

type ClientDocument = {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
};
type ClientCommunication = {
  id: string;
  communication_type: string;
  content: string;
  actor_name: string;
  created_at: string;
};
type ClientActivity = {
  clientCreatedAt: string;
  notes: string;
  documents: ClientDocument[];
  communications: ClientCommunication[];
  purchases: { id: string; number: string; products: string[]; amount: number; currency: string; status: string; date: string }[];
  followUps: { id: string; title: string; due_at: string | null; status: string; created_at: string; updated_at: string }[];
};

function ClientDetail({
  record, tab, setTab, licenses, onPatch, onDelete,
}: {
  record: CrudRecord;
  tab: Tab; setTab: (t: Tab) => void;
  licenses: CrudRecord[];
  onPatch: Patch;
  onDelete: () => void;
}) {
  // The client's purchases (orders credited to this reseller that the client
  // placed) and follow-ups (crm_tasks), read from the server.
  const queryClient = useQueryClient();
  const listActivity = useServerFn(listResellerClientActivity);
  const saveNotes = useServerFn(saveResellerClientNotes);
  const addCommunication = useServerFn(addResellerClientCommunication);
  const registerDocument = useServerFn(registerResellerClientDocument);
  const addFollowUp = useServerFn(addResellerClientFollowUp);
  const setFollowUpDone = useServerFn(setResellerClientFollowUpDone);
  const activityKey = ["reseller", "client-activity", record.id];
  const activity = useQuery({
    queryKey: activityKey,
    queryFn: () => listActivity({ data: { clientId: record.id } }) as Promise<ClientActivity>,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: activityKey });
    void queryClient.invalidateQueries({ queryKey: ["reseller", "customers"] });
  };
  const notesMutation = useMutation({
    mutationFn: (notes: string) => saveNotes({ data: { clientId: record.id, notes } }),
    onSuccess: refresh,
  });
  const communicationMutation = useMutation({
    mutationFn: (input: { content: string; kind: "call" | "email" | "meeting" | "other" }) =>
      addCommunication({ data: { clientId: record.id, ...input } }),
    onSuccess: refresh,
  });
  const documentMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 15 * 1024 * 1024) throw new Error("Documents must be 15 MB or smaller.");
      const allowedTypes = new Set([
        "application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ]);
      if (!allowedTypes.has(file.type)) throw new Error("Choose a PDF, image, text, Word, or Excel document.");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw new Error(userError.message);
      if (!userData.user) throw new Error("Please sign in again before uploading a document.");
      const storagePath = `${userData.user.id}/${record.id}/${crypto.randomUUID()}`;
      const { error: uploadError } = await supabase.storage
        .from("reseller-client-documents")
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      try {
        return await registerDocument({
          data: {
            clientId: record.id,
            storagePath,
            fileName: file.name,
            mimeType: file.type,
            fileSize: file.size,
          },
        });
      } catch (error) {
        const { error: cleanupError } = await supabase.storage
          .from("reseller-client-documents")
          .remove([storagePath]);
        if (cleanupError) console.error("Could not remove an unregistered reseller document", cleanupError);
        throw error;
      }
    },
    onSuccess: refresh,
  });
  const addMutation = useMutation({
    mutationFn: (v: { title: string; due: string }) => addFollowUp({ data: { clientId: record.id, title: v.title, due: v.due } }),
    onSuccess: refresh,
  });
  const toggleMutation = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => setFollowUpDone({ data: v }),
    onSuccess: refresh,
  });
  const loadError = activity.error instanceof Error ? activity.error.message : null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      {/* identity */}
      <div className="p-5 border-b border-border flex items-start gap-4">
        <div className="h-14 w-14 rounded-2xl bg-gradient-brand grid place-items-center text-sm font-bold text-brand-foreground">
          {initials(record.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold truncate">{record.name}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success border border-success/30 px-2 py-0.5 text-[10px] font-semibold">
              <Heart className="h-3 w-3" /> Health {Number(record.extra.health ?? 0)}%
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
            {record.extra.company && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{String(record.extra.company)}</span>}
            {record.extra.email   && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{String(record.extra.email)}</span>}
            {record.extra.phone   && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{String(record.extra.phone)}</span>}
            {record.extra.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{String(record.extra.location)}</span>}
          </div>
        </div>
        <button onClick={onDelete} title="Delete client" aria-label="Delete client" className="grid h-9 w-9 place-items-center rounded-lg bg-surface hover:bg-danger/15 hover:text-danger border border-border transition">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* tabs */}
      <div className="flex items-center gap-1 px-3 pt-3 overflow-x-auto scrollbar-thin border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition ${
              tab === t.key ? "bg-surface text-foreground border border-border border-b-transparent" : "text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "profile"   && <ProfileTab record={record} onPatch={onPatch} />}
        {tab === "purchases" && <PurchasesTab purchases={activity.data?.purchases ?? []} loading={activity.isLoading} loadError={loadError} />}
        {tab === "licenses"  && <LicensesTab licenses={licenses} />}
        {tab === "notes"     && <NotesTab notes={activity.data?.notes ?? ""} onSave={(notes) => notesMutation.mutateAsync(notes)} />}
        {tab === "documents" && <DocsTab
          documents={activity.data?.documents ?? []}
          onUpload={(file) => documentMutation.mutateAsync(file)}
        />}
        {tab === "followup"  && (
          <FollowupTab
            tasks={activity.data?.followUps ?? []}
            loading={activity.isLoading}
            loadError={loadError}
            onAdd={(title, due) => addMutation.mutateAsync({ title, due })}
            onToggle={(id, done) => toggleMutation.mutateAsync({ id, done })}
          />
        )}
        {tab === "timeline"  && <TimelineTab
          activity={activity.data ?? null}
          loadError={loadError}
          onLog={(content, kind) => communicationMutation.mutateAsync({ content, kind })}
        />}
      </div>
    </div>
  );
}

/* ---------------- Tabs ---------------- */

function ProfileTab({ record, onPatch }: { record: CrudRecord; onPatch: Patch }) {
  const [draft, setDraft] = useState({
    name: record.name,
    company: String(record.extra.company ?? ""),
    email: String(record.extra.email ?? ""),
    phone: String(record.extra.phone ?? ""),
    location: String(record.extra.location ?? ""),
    health: Number(record.extra.health ?? 0),
    industry: String(record.extra.industry ?? ""),
    website: "",
  });
  const [saving, setSaving] = useState(false);
  // Said only once the row is saved; a refusal says why.
  async function save() {
    if (!draft.name.trim()) return void toast.error("A name is required.");
    setSaving(true);
    try {
      await onPatch({ name: draft.name.trim(), extra: { ...record.extra, company: draft.company, email: draft.email, phone: draft.phone, location: draft.location, health: draft.health, industry: draft.industry } });
      toast.success("Profile updated");
    } catch (error) {
      toast.error(reason(error, "The profile was not saved."));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Full name"  value={draft.name}     onChange={(v) => setDraft({ ...draft, name: v })} />
        <Field label="Company"    value={draft.company}  onChange={(v) => setDraft({ ...draft, company: v })} />
        <Field label="Email"      value={draft.email}    onChange={(v) => setDraft({ ...draft, email: v })} type="email" />
        <Field label="Phone"      value={draft.phone}    onChange={(v) => setDraft({ ...draft, phone: v })} />
        <Field label="Industry"   value={draft.industry} onChange={(v) => setDraft({ ...draft, industry: v })} />
        <Field label="Location"   value={draft.location} onChange={(v) => setDraft({ ...draft, location: v })} />
        <Field label="Website"    value={draft.website}  onChange={(v) => setDraft({ ...draft, website: v })} disabled placeholder={WEBSITE_UNAVAILABLE} />
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Customer health</label>
          <input
            type="range" min={0} max={100}
            value={draft.health}
            onChange={(e) => setDraft({ ...draft, health: Number(e.target.value) })}
            className="mt-1 w-full"
          />
          <div className="text-xs text-muted-foreground mt-1">Score: <span className="text-foreground font-semibold">{draft.health}%</span></div>
        </div>
      </div>
      <div className="flex justify-end">
        <button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow disabled:opacity-60">
          <Pencil className="h-3.5 w-3.5" /> Save profile
        </button>
      </div>
    </div>
  );
}

function PurchasesTab({
  purchases, loading, loadError,
}: { purchases: ClientActivity["purchases"]; loading: boolean; loadError: string | null }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{purchases.length} purchase{purchases.length === 1 ? "" : "s"}</div>
        <button disabled title={PURCHASE_MANUAL_UNAVAILABLE} className="inline-flex items-center gap-1 rounded-lg bg-surface border border-border px-2.5 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed">
          <Plus className="h-3.5 w-3.5" /> Add purchase
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">{PURCHASE_MANUAL_UNAVAILABLE}</p>
      {loading ? (
        <Empty icon={ShoppingCart} text="Loading…" />
      ) : loadError ? (
        <Empty icon={ShoppingCart} text={loadError} />
      ) : purchases.length === 0 ? (
        <Empty icon={ShoppingCart} text="No purchases yet" />
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[420px] text-xs">
            <thead className="bg-surface text-muted-foreground">
              <tr><th className="text-left p-2">Product</th><th className="text-left p-2">Date</th><th className="text-right p-2">Amount</th><th className="text-left p-2">Status</th></tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="p-2 font-medium">{p.products.join(", ") || `Order ${p.number}`}</td>
                  <td className="p-2 text-muted-foreground">{new Date(p.date).toLocaleDateString()}</td>
                  <td className="p-2 text-right">{p.currency === "USD" ? "$" : `${p.currency} `}{p.amount.toLocaleString()}</td>
                  <td className="p-2 capitalize">{p.status.replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LicensesTab({ licenses }: { licenses: CrudRecord[] }) {
  if (licenses.length === 0) return <Empty icon={FileBadge} text="No licence has been sold to this client through you yet." />;
  return (
    <div className="rounded-xl border border-border overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[420px] text-xs">
        <thead className="bg-surface text-muted-foreground">
          <tr><th className="text-left p-2">Product</th><th className="text-left p-2">Key</th><th className="text-left p-2">Status</th><th className="text-left p-2">Expires</th></tr>
        </thead>
        <tbody>
          {licenses.map((l) => (
            <tr key={l.id} className="border-t border-border/60">
              <td className="p-2 font-medium">{l.name}</td>
              <td className="p-2 font-mono text-[10px]">{String(l.extra.key ?? "—")}</td>
              <td className="p-2 capitalize">{l.status}</td>
              <td className="p-2 text-muted-foreground">{String(l.extra.expiry ?? "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotesTab({ notes, onSave }: { notes: string; onSave: (notes: string) => Promise<unknown> }) {
  const [text, setText] = useState(notes);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await onSave(text);
      toast.success("Notes saved");
    } catch (error) {
      toast.error(reason(error, "The client notes were not saved."));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="Private notes about this client — pitch context, preferences, blockers…"
        className="w-full rounded-lg bg-surface border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-ring resize-y"
      />
      <div className="flex justify-end">
        <button onClick={() => void save()} disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow disabled:opacity-60">
          <StickyNote className="h-3.5 w-3.5" /> Save notes
        </button>
      </div>
    </div>
  );
}

function DocsTab({ documents, onUpload }: { documents: ClientDocument[]; onUpload: (file: File) => Promise<unknown> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
      toast.success("Document uploaded");
    } catch (error) {
      toast.error(reason(error, "The document was not uploaded."));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  async function openDocument(document: ClientDocument) {
    const { data, error } = await supabase.storage
      .from("reseller-client-documents")
      .createSignedUrl(document.storage_path, 300, { download: document.file_name });
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "The document could not be opened.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{documents.length} document{documents.length === 1 ? "" : "s"}</div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={(event) => void upload(event.currentTarget.files?.[0])}
        />
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          className="inline-flex items-center gap-1 rounded-lg bg-surface border border-border px-2.5 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-50">
          <Paperclip className="h-3.5 w-3.5" /> Upload
        </button>
      </div>
      {documents.length === 0 ? (
        <Empty icon={FileText} text="No documents yet. Attach contracts, invoices, NDAs and onboarding kits." />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {documents.map((document) => (
            <li key={document.id} className="flex items-center gap-3 px-3 py-2 text-xs">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <button onClick={() => void openDocument(document)} className="flex-1 truncate text-left font-medium hover:underline">
                {document.file_name}
              </button>
              <span className="text-muted-foreground">{(document.file_size / 1024).toFixed(1)} KB</span>
              <span className="text-muted-foreground">{new Date(document.created_at).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Follow-ups are crm_tasks rows for this client, owned by the reseller. */
function FollowupTab({
  tasks, loading, loadError, onAdd, onToggle,
}: {
  tasks: ClientActivity["followUps"];
  loading: boolean;
  loadError: string | null;
  onAdd: (title: string, due: string) => Promise<unknown>;
  onToggle: (id: string, done: boolean) => Promise<unknown>;
}) {
  const [title, setTitle] = useState(""); const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onAdd(title.trim(), due || new Date().toISOString().slice(0, 10));
      setTitle(""); setDue("");
      toast.success("Follow-up scheduled");
    } catch (error) {
      toast.error(reason(error, "That follow-up was not saved."));
    } finally {
      setBusy(false);
    }
  }
  function toggle(id: string, done: boolean) {
    onToggle(id, done).catch((error: unknown) => toast.error(reason(error, "That follow-up was not updated.")));
  }
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-surface p-3 grid sm:grid-cols-[1fr_180px_auto] gap-2 items-end">
        <Field label="Follow-up task" value={title} onChange={setTitle} placeholder="e.g. Send renewal quote" />
        <Field label="Due date" value={due} onChange={setDue} type="date" />
        <button onClick={() => void add()} disabled={busy} className="rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow disabled:opacity-60">Schedule</button>
      </div>
      {loading ? <Empty icon={CalendarClock} text="Loading…" />
        : loadError ? <Empty icon={CalendarClock} text={loadError} />
        : tasks.length === 0 ? <Empty icon={CalendarClock} text="No follow-ups scheduled." /> : (
        <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {tasks.map((t) => {
            const done = t.status === "completed";
            return (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                <input type="checkbox" checked={done} onChange={() => toggle(t.id, !done)} />
                <span className={`flex-1 ${done ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                <span className="text-muted-foreground">{t.due_at ? t.due_at.slice(0, 10) : "—"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Recorded client activity, purchases, follow-ups and communications. */
function TimelineTab({
  activity, loadError, onLog,
}: {
  activity: ClientActivity | null;
  loadError: string | null;
  onLog: (content: string, kind: "call" | "email" | "meeting" | "other") => Promise<unknown>;
}) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"call" | "email" | "meeting" | "other">("other");
  const [saving, setSaving] = useState(false);
  async function log() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onLog(text.trim(), kind);
      setText("");
      toast.success("Communication logged");
    } catch (error) {
      toast.error(reason(error, "The communication was not saved."));
    } finally {
      setSaving(false);
    }
  }
  const merged = activity
    ? [
        { kind: "audit" as const, id: "created", date: activity.clientCreatedAt, text: "Client added", by: "you", detail: "" },
        ...activity.followUps.map((t) => ({
          kind: "audit" as const, id: `task-${t.id}`, date: t.created_at,
          text: t.status === "completed" ? "Follow-up completed" : "Follow-up scheduled",
          by: "you", detail: t.title,
        })),
        ...activity.purchases.map((p) => ({
          kind: "audit" as const, id: `order-${p.id}`, date: p.date, text: `Order ${p.number}`,
          by: "marketplace", detail: `${p.products.join(", ") || "Order"} · ${p.status.replace(/_/g, " ")}`,
        })),
        ...activity.communications.map((communication) => ({
          kind: "audit" as const,
          id: `communication-${communication.id}`,
          date: communication.created_at,
          text: `${communication.communication_type[0]?.toUpperCase() ?? ""}${communication.communication_type.slice(1)} logged`,
          by: communication.actor_name,
          detail: communication.content,
        })),
      ].sort((a, b) => b.date.localeCompare(a.date))
    : [];
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Log communication</label>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Called, emailed, met for demo…"
            className="mt-1 w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}
          className="rounded-lg bg-surface border border-border px-2 py-2 text-xs">
          <option value="other">Note</option><option value="call">Call</option>
          <option value="email">Email</option><option value="meeting">Meeting</option>
        </select>
        <button onClick={() => void log()} disabled={saving || !text.trim()}
          className="rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow disabled:opacity-60">Log</button>
      </div>
      {loadError ? <Empty icon={Activity} text={loadError} /> : merged.length === 0 ? <Empty icon={Activity} text="No activity yet." /> : (
        <ol className="relative border-l border-border ml-3 space-y-3">
          {merged.map((e) => (
            <li key={e.id} className="ml-4">
              <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-background bg-muted-foreground/40" />
              <div className="text-xs">
                <span className="font-semibold">{e.text}</span>
                {e.detail ? <span className="text-muted-foreground"> — {e.detail}</span> : null}
              </div>
              <div className="text-[10px] text-muted-foreground">{new Date(e.date).toLocaleString()} · {e.by}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ---------------- New client form ---------------- */

function ClientForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (v: { name: string; extra: Record<string, string | number> }) => void }) {
  const [v, setV] = useState({ name: "", company: "", email: "", phone: "", location: "", industry: "", health: 80 });
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card p-5 space-y-4">
      <h2 className="text-lg font-bold">New client</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Full name *" value={v.name}     onChange={(x) => setV({ ...v, name: x })} />
        <Field label="Company"     value={v.company}  onChange={(x) => setV({ ...v, company: x })} />
        <Field label="Email"       value={v.email}    onChange={(x) => setV({ ...v, email: x })} type="email" />
        <Field label="Phone"       value={v.phone}    onChange={(x) => setV({ ...v, phone: x })} />
        <Field label="Industry"    value={v.industry} onChange={(x) => setV({ ...v, industry: x })} />
        <Field label="Location"    value={v.location} onChange={(x) => setV({ ...v, location: x })} />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2">Cancel</button>
        <button
          disabled={!v.name.trim()}
          onClick={() => onSubmit({ name: v.name.trim(), extra: { company: v.company, email: v.email, phone: v.phone, location: v.location, industry: v.industry, health: v.health } })}
          className="rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
        >Create client</button>
      </div>
    </div>
  );
}

/* ---------------- Utils ---------------- */

function Field({ label, value, onChange, type = "text", placeholder, disabled }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; disabled?: boolean }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        title={disabled ? placeholder : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
      />
    </div>
  );
}
function Empty({ icon: I, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/40 p-8 text-center">
      <I className="mx-auto h-6 w-6 text-muted-foreground" />
      <div className="mt-2 text-xs text-muted-foreground">{text}</div>
    </div>
  );
}
function HealthDot({ score }: { score: number }) {
  const tone = score >= 75 ? "bg-success" : score >= 40 ? "bg-warning" : score === 0 ? "bg-muted-foreground/30" : "bg-danger";
  return <span title={score ? `Health ${score}%` : "No health score"} className={`h-2 w-2 rounded-full ${tone}`} />;
}
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
}
// silence
void Inbox; void Star;
