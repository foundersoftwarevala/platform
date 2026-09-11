import { useEffect, useState } from "react";
import { Archive, Eye, EyeOff, HelpCircle, Plus, Sparkles, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getValaTvManager, saveValaTvVideo, setValaTvStatus,
  type ManagedVideo, type SaveValaTvInput, type ValaTvCategory,
} from "@/lib/site-content/vala-tv.functions";

import { useServerFn } from "@/lib/marketplace-manager/localFn";
import { generateFaqs } from "@/lib/site-content/faq-ai.functions";
import {
  FAQ_CATEGORIES, faqTable, listFaqs, newFaq, type Faq,
} from "@/lib/site-content/faq";
import { embedUrl } from "@/lib/site-content/videos";
import { Card, PageHeader, PillButton, StatCard, SubNav } from "../ui";

const input =
  "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-accent/60";

/* ------------------------------ FAQ MANAGER ------------------------------ */
export function FaqManagerSection() {
  const [rows, setRows] = useState<Faq[]>(() => listFaqs());
  const [tab, setTab] = useState("All");
  const [busy, setBusy] = useState(false);
  const [topic, setTopic] = useState("");
  const runGenerate = useServerFn(generateFaqs);

  const refresh = () => setRows(listFaqs());
  const patch = (id: string, p: Partial<Faq>) => {
    faqTable.patch(id, p);
    refresh();
  };

  const tabs = ["All", ...FAQ_CATEGORIES];
  const visible = tab === "All" ? rows : rows.filter((r) => r.category === tab);
  const published = rows.filter((r) => r.published).length;

  const add = () => {
    const row = newFaq(tab === "All" ? "General" : tab);
    faqTable.upsert(row);
    refresh();
  };

  const generate = async () => {
    setBusy(true);
    try {
      const res = await runGenerate({
        data: { count: 6, topic: topic || undefined, category: tab === "All" ? undefined : tab },
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      let order = rows.length;
      res.items.forEach((i) => {
        order += 1;
        faqTable.upsert({
          id: `faq-ai-${Date.now()}-${order}`,
          question: i.question,
          answer: i.answer,
          category: i.category,
          published: false,
          order,
        });
      });
      refresh();
      toast.success(`${res.items.length} AI FAQs added as drafts — review and publish.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="FAQ Manager"
        title="Frequently Asked Questions"
        description="Storefront FAQ content — generated with AI from the Software Vala system facts, then edited and published here."
        actions={
          <>
            <PillButton variant="ghost" onClick={add}>
              <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Question</span>
            </PillButton>
            <PillButton variant="primary" onClick={generate}>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> {busy ? "Generating…" : "Generate with AI"}
              </span>
            </PillButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total FAQs" value={String(rows.length)} icon={<HelpCircle className="h-4 w-4" />} />
        <StatCard label="Published" value={String(published)} tone="success" />
        <StatCard label="Drafts" value={String(rows.length - published)} tone="warning" />
        <StatCard label="Categories" value={String(FAQ_CATEGORIES.length)} />
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={input + " md:max-w-md"}
            placeholder="Optional AI topic — e.g. refunds, SaaS multi-tenant, reseller margin"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">
            AI answers stay locked to the fixed $249 lifetime price and 12,000+ / 80+ catalog facts.
          </span>
        </div>
      </Card>

      <SubNav items={tabs} active={tab} onChange={setTab} />

      <div className="grid gap-3">
        {visible.map((f) => (
          <Card key={f.id}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  className={input + " font-semibold"}
                  value={f.question}
                  placeholder="Question"
                  onChange={(e) => patch(f.id, { question: e.target.value })}
                />
                <textarea
                  className={input + " min-h-[72px]"}
                  value={f.answer}
                  placeholder="Answer"
                  onChange={(e) => patch(f.id, { answer: e.target.value })}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={input + " max-w-[220px]"}
                    value={f.category}
                    onChange={(e) => patch(f.id, { category: e.target.value })}
                  >
                    {FAQ_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    className={input + " max-w-[110px]"}
                    type="number"
                    value={f.order}
                    onChange={(e) => patch(f.id, { order: Number(e.target.value) || 0 })}
                  />
                  <span className="text-[11px] text-muted-foreground">Order</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <PillButton
                  variant={f.published ? "primary" : "ghost"}
                  onClick={() => patch(f.id, { published: !f.published })}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {f.published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {f.published ? "Live" : "Draft"}
                  </span>
                </PillButton>
                <PillButton
                  variant="ghost"
                  onClick={() => {
                    faqTable.remove(f.id);
                    refresh();
                    toast.success("FAQ deleted");
                  }}
                >
                  <span className="inline-flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</span>
                </PillButton>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ VALA TV MANAGER ------------------------------ */
/**
 * The Vala TV section on the homepage is served from public.vala_tv_videos by
 * sf_vala_tv(). This screen used to keep its videos in the operator's browser,
 * so nothing saved here reached the page. It now reads and writes that table
 * through mm_vala_tv_save / mm_vala_tv_status, which check operator rights and
 * record every change. Publishing is refused until a video has a title and an
 * address, and views are counted by the database rather than typed in.
 */
export function ValaTvSection() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("All");
  const { data, isLoading, error } = useQuery({
    queryKey: ["vala-tv", "manager"],
    queryFn: () => getValaTvManager(),
  });
  const rows = data?.videos ?? [];
  const categories = data?.categories ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["vala-tv"] });

  const save = useMutation({
    mutationFn: (patch: SaveValaTvInput) => saveValaTvVideo({ data: patch }),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });
  const status = useMutation({
    mutationFn: (v: { id: string; to: ManagedVideo["status"] }) => setValaTvStatus({ data: v }),
    onSuccess: (_r, v) => {
      refresh();
      toast.success(v.to === "published" ? "Published — it is on the homepage now" : `Moved to ${v.to}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "";
  const tabs = ["All", ...categories.map((c) => c.name)];
  const active = rows.filter((r) => r.status !== "archived");
  const visible = tab === "All" ? active : active.filter((r) => categoryName(r.category_id) === tab);
  const published = rows.filter((r) => r.status === "published").length;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Vala TV Manager"
        title="Storefront video wall"
        description="Add, order and publish the videos that appear in the Vala TV section on the marketplace home page."
        actions={
          <PillButton
            variant="primary"
            onClick={() =>
              save.mutate({
                title: "Untitled video",
                category_id: categories[0]?.id ?? null,
                position: (rows.length + 1) * 10,
              })
            }
          >
            <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Video</span>
          </PillButton>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Videos" value={String(active.length)} icon={<Video className="h-4 w-4" />} />
        <StatCard label="Published" value={String(published)} tone="success" />
        <StatCard label="Drafts" value={String(rows.filter((r) => r.status === "draft").length)} tone="warning" />
        <StatCard label="On the homepage now" value={String(data?.liveNow ?? 0)} />
      </div>

      <SubNav items={tabs} active={tab} onChange={setTab} />

      {isLoading && <p className="text-sm text-muted-foreground">Loading videos…</p>}
      {error && <p className="text-sm text-red-400">{(error as Error).message}</p>}
      {!isLoading && !error && active.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No videos yet. The Vala TV section stays off the homepage until one is published.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((v) => (
          <ValaTvCard
            key={v.id}
            video={v}
            categories={categories}
            onSave={(patch) => save.mutate({ id: v.id, ...patch })}
            onStatus={(to) => status.mutate({ id: v.id, to })}
          />
        ))}
      </div>
    </div>
  );
}

type EditableText = "title" | "url" | "thumbnail_url" | "duration";

function ValaTvCard({
  video,
  categories,
  onSave,
  onStatus,
}: {
  video: ManagedVideo;
  categories: ValaTvCategory[];
  onSave: (patch: Partial<Pick<ManagedVideo, EditableText | "category_id" | "position">>) => void;
  onStatus: (to: ManagedVideo["status"]) => void;
}) {
  // Typing edits a local copy; leaving a field saves it, so a title is one
  // write rather than one per keystroke.
  const [draft, setDraft] = useState(video);
  useEffect(() => setDraft(video), [video]);
  const commit = (key: EditableText) => {
    const next = String(draft[key] ?? "");
    if (next !== String(video[key] ?? "")) {
      onSave({ [key]: next || null } as Partial<Pick<ManagedVideo, EditableText>>);
    }
  };
  const live = video.status === "published";

  return (
    <Card>
      <div className="mb-3 aspect-video w-full overflow-hidden rounded-xl border border-border bg-background/60">
        {draft.url ? (
          <iframe src={embedUrl(draft.url)} title={draft.title || "Video preview"} className="h-full w-full" allowFullScreen />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Paste a YouTube, Vimeo or MP4 URL to preview
          </div>
        )}
      </div>
      <div className="space-y-2">
        <input className={input + " font-semibold"} placeholder="Video title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} onBlur={() => commit("title")} />
        <input className={input} placeholder="Video URL (YouTube / Vimeo / MP4)" value={draft.url ?? ""} onChange={(e) => setDraft({ ...draft, url: e.target.value })} onBlur={() => commit("url")} />
        <input className={input} placeholder="Thumbnail image URL (optional)" value={draft.thumbnail_url ?? ""} onChange={(e) => setDraft({ ...draft, thumbnail_url: e.target.value })} onBlur={() => commit("thumbnail_url")} />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <input className={input} placeholder="Duration 4:12" value={draft.duration ?? ""} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} onBlur={() => commit("duration")} />
          <input className={input} value={`${video.views} views`} readOnly title="Counted from real plays, not typed in" />
          <select className={input} value={draft.category_id ?? ""} onChange={(e) => onSave({ category_id: e.target.value || null })}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            className={input}
            type="number"
            placeholder="Order"
            value={draft.position}
            onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) || 0 })}
            onBlur={() => {
              if (draft.position !== video.position) onSave({ position: draft.position });
            }}
          />
        </div>
        <div className="flex gap-2">
          <PillButton variant={live ? "primary" : "ghost"} onClick={() => onStatus(live ? "draft" : "published")}>
            <span className="inline-flex items-center gap-1.5">
              {live ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {live ? "Live" : video.status === "scheduled" ? "Scheduled" : "Draft"}
            </span>
          </PillButton>
          {/* Archived rather than deleted: the row and its view history stay. */}
          <PillButton variant="ghost" onClick={() => onStatus("archived")}>
            <span className="inline-flex items-center gap-1.5"><Archive className="h-3.5 w-3.5" /> Archive</span>
          </PillButton>
        </div>
      </div>
    </Card>
  );
}
