import { useState } from "react";
import { Eye, EyeOff, HelpCircle, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useServerFn } from "@/lib/marketplace-manager/localFn";
import { generateFaqs } from "@/lib/site-content/faq-ai.functions";
import {
  FAQ_CATEGORIES, faqTable, listFaqs, newFaq, type Faq,
} from "@/lib/site-content/faq";
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
