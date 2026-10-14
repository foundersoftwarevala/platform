import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Paperclip, X } from "lucide-react";
import { supabase } from "@/lib/rd-module/supabase/client";
import { Button } from "@/components/rd-module/ui/button";
import { Input } from "@/components/rd-module/ui/input";
import { Textarea } from "@/components/rd-module/ui/textarea";
import { Label } from "@/components/rd-module/ui/label";
import {
  createAttachmentUploads,
  submitOpportunity,
} from "@/lib/rd-module/rd-opportunities.functions";
import {
  IDEA_CATEGORIES,
  PLATFORMS,
  SAAS_BRINGS,
  SAAS_NEEDS,
  SAAS_STAGES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  type OpportunityType,
} from "@/lib/rd-module/rd-opportunity-types";
import { cn } from "@/lib/rd-module/utils";

type Field =
  | {
      name: string;
      label: string;
      kind: "text" | "email" | "tel" | "url";
      required?: boolean;
      placeholder?: string;
      max?: number;
    }
  | {
      name: string;
      label: string;
      kind: "textarea";
      required?: boolean;
      placeholder?: string;
      max?: number;
    }
  | { name: string; label: string; kind: "select"; options: readonly string[]; required?: boolean }
  | { name: string; label: string; kind: "multi"; options: readonly string[] };

type Group = { title: string; fields: Field[] };

const contactGroup = (company = false): Group => ({
  title: "Your contact details",
  fields: [
    { name: "name", label: "Name", kind: "text", required: true, max: 120 },
    ...(company ? [{ name: "company", label: "Company", kind: "text" as const, max: 160 }] : []),
    { name: "email", label: "Email", kind: "email", required: true, max: 255 },
    { name: "phone", label: "WhatsApp / Phone", kind: "tel", max: 40 },
    { name: "country", label: "Country", kind: "text", required: true, max: 80 },
  ],
});

const FORMS: Record<OpportunityType, Group[]> = {
  SOFTWARE_ON_DEMAND: [
    {
      title: "What do you need?",
      fields: [
        {
          name: "title",
          label: "Request title",
          kind: "text",
          required: true,
          max: 160,
          placeholder: "e.g. School transport management",
        },
        {
          name: "need",
          label: "What software do you need?",
          kind: "textarea",
          required: true,
          max: 3000,
        },
        { name: "business_type", label: "Business type", kind: "text", max: 200 },
        { name: "category", label: "Industry / category", kind: "text", max: 120 },
        { name: "problem", label: "Problem description", kind: "textarea", max: 5000 },
        {
          name: "features",
          label: "Required features",
          kind: "textarea",
          max: 5000,
          placeholder: "One per line",
        },
      ],
    },
    {
      title: "Users & market",
      fields: [
        { name: "expected_users", label: "Expected users", kind: "text", max: 200 },
        { name: "target_country", label: "Target country", kind: "text", max: 200 },
        { name: "target_market", label: "Target market", kind: "text", max: 200 },
        { name: "existing_software", label: "Existing software used", kind: "text", max: 500 },
        { name: "platforms", label: "Preferred platform", kind: "multi", options: PLATFORMS },
        { name: "budget", label: "Budget (optional)", kind: "text", max: 120 },
        { name: "timeline", label: "Timeline (optional)", kind: "text", max: 120 },
        { name: "additional", label: "Additional requirements", kind: "textarea", max: 5000 },
      ],
    },
    contactGroup(),
  ],
  SAAS_PARTNERSHIP: [
    {
      title: "Your SaaS",
      fields: [
        { name: "title", label: "SaaS / product name", kind: "text", required: true, max: 160 },
        {
          name: "description_text",
          label: "Product description",
          kind: "textarea",
          required: true,
          max: 3000,
        },
        { name: "problem", label: "Problem being solved", kind: "textarea", max: 5000 },
        { name: "target_customers", label: "Target customers", kind: "text", max: 500 },
        { name: "category", label: "Industry", kind: "text", max: 120 },
        { name: "features", label: "Main features", kind: "textarea", max: 5000 },
        {
          name: "stage",
          label: "Current stage",
          kind: "select",
          options: SAAS_STAGES,
          required: true,
        },
      ],
    },
    {
      title: "Partnership",
      fields: [
        { name: "brings", label: "What do you bring?", kind: "multi", options: SAAS_BRINGS },
        {
          name: "needs",
          label: "What do you need from Software Vala?",
          kind: "multi",
          options: SAAS_NEEDS,
        },
        { name: "current_users", label: "Current users", kind: "text", max: 200 },
        { name: "current_revenue", label: "Current revenue (optional)", kind: "text", max: 200 },
        { name: "target_market", label: "Target market", kind: "text", max: 200 },
        { name: "competitors", label: "Competitors", kind: "text", max: 500 },
        { name: "business_model", label: "Business model", kind: "text", max: 500 },
        {
          name: "expected_partnership",
          label: "Expected partnership",
          kind: "textarea",
          max: 5000,
        },
        {
          name: "website",
          label: "Website (optional)",
          kind: "url",
          max: 300,
          placeholder: "https://",
        },
        { name: "additional", label: "Additional information", kind: "textarea", max: 5000 },
      ],
    },
    contactGroup(true),
  ],
  BUILD_WITH_US: [
    {
      title: "Your idea",
      fields: [
        { name: "title", label: "Idea title", kind: "text", required: true, max: 160 },
        {
          name: "category",
          label: "Idea category",
          kind: "select",
          options: IDEA_CATEGORIES,
          required: true,
        },
        { name: "problem", label: "Problem", kind: "textarea", required: true, max: 3000 },
        { name: "solution", label: "Proposed solution", kind: "textarea", max: 5000 },
        { name: "target_users", label: "Target users", kind: "text", max: 500 },
        { name: "benefit", label: "Expected benefit", kind: "textarea", max: 2000 },
        { name: "features", label: "Main features", kind: "textarea", max: 5000 },
        { name: "why", label: "Why this idea matters", kind: "textarea", max: 2000 },
        { name: "contribute", label: "What you can contribute", kind: "textarea", max: 2000 },
        { name: "help_needed", label: "What help you need", kind: "textarea", max: 2000 },
      ],
    },
    contactGroup(),
  ],
};

export type SubmitResult = { requestId: string; status: string; createdAt: string };

export function RequestForm({
  type,
  onDone,
}: {
  type: OpportunityType;
  onDone: (r: SubmitResult) => void;
}) {
  const submit = useServerFn(submitOpportunity);
  const [multi, setMulti] = useState<Record<string, string[]>>({});
  const prepareUploads = useServerFn(createAttachmentUploads);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        setError(`${f.name} is larger than 10 MB`);
        continue;
      }
      if (next.length < MAX_ATTACHMENTS) next.push(f);
    }
    setFiles(next);
  };
  const [error, setError] = useState<string | null>(null);

  const toggle = (name: string, value: string) =>
    setMulti((m) => {
      const cur = m[name] ?? [];
      return {
        ...m,
        [name]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
      };
    });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = { type };
    fd.forEach((v, k) => {
      if (k !== "attachment_picker") payload[k] = typeof v === "string" ? v : "";
    });
    Object.assign(payload, multi);
    setPending(true);
    try {
      if (files.length) {
        const slots = await prepareUploads({
          data: { files: files.map((f) => ({ name: f.name, size: f.size })) },
        });
        await Promise.all(
          slots.map(async (slot, i) => {
            const { error: upErr } = await supabase.storage
              .from("rd-attachments")
              .uploadToSignedUrl(slot.path, slot.token, files[i]!);
            if (upErr) throw new Error(`Could not upload ${files[i]!.name}`);
          }),
        );
        payload["attachments"] = slots.map((slot, i) => ({
          path: slot.path,
          name: files[i]!.name,
          size: files[i]!.size,
          type: files[i]!.type,
        }));
      }
      const res = await submit({ data: payload as never });
      onDone(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      try {
        const parsed = JSON.parse(msg) as Array<{ message: string }>;
        setError(parsed[0]?.message ?? msg);
      } catch {
        setError(msg);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate={false}>
      {/* Honeypot: hidden from humans */}
      <input
        type="text"
        name="website_hp"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      {FORMS[type].map((group) => (
        <fieldset key={group.title} className="panel space-y-4 p-5">
          <legend className="sr-only">{group.title}</legend>
          <h3 className="font-display text-base font-semibold text-foreground">{group.title}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.fields.map((f) => {
              const wide = f.kind === "textarea" || f.kind === "multi";
              return (
                <div key={f.name} className={cn("space-y-1.5", wide && "sm:col-span-2")}>
                  <Label htmlFor={f.kind === "multi" ? undefined : `f-${f.name}`}>
                    {f.label}
                    {"required" in f && f.required && <span className="text-brand"> *</span>}
                  </Label>
                  {f.kind === "textarea" ? (
                    <Textarea
                      id={`f-${f.name}`}
                      name={f.name}
                      required={f.required}
                      maxLength={f.max}
                      placeholder={f.placeholder}
                      rows={3}
                    />
                  ) : f.kind === "select" ? (
                    <select
                      id={`f-${f.name}`}
                      name={f.name}
                      required={f.required}
                      defaultValue=""
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    >
                      <option value="" disabled>
                        Select…
                      </option>
                      {f.options.map((o) => (
                        <option key={o} value={o}>
                          {o.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  ) : f.kind === "multi" ? (
                    <div className="flex flex-wrap gap-2" role="group" aria-label={f.label}>
                      {f.options.map((o) => {
                        const on = (multi[f.name] ?? []).includes(o);
                        return (
                          <button
                            type="button"
                            key={o}
                            aria-pressed={on}
                            onClick={() => toggle(f.name, o)}
                            className={cn(
                              "min-h-9 rounded-full border px-3 text-xs capitalize transition-colors",
                              on
                                ? "border-brand bg-brand/20 text-foreground"
                                : "border-border text-muted-foreground hover:bg-surface-2",
                            )}
                          >
                            {o.replace(/_/g, " ").toLowerCase()}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <Input
                      id={`f-${f.name}`}
                      name={f.name}
                      type={f.kind}
                      required={f.required}
                      maxLength={f.max}
                      placeholder={f.placeholder}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
      <fieldset className="panel space-y-3 p-5">
        <legend className="sr-only">Attachments</legend>
        <h3 className="font-display text-base font-semibold text-foreground">
          Brief &amp; supporting documents
        </h3>
        <p className="text-xs text-muted-foreground">
          Optional. Up to {MAX_ATTACHMENTS} files, 10 MB each (PDF, Word, slides, images, etc.).
        </p>
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 text-sm text-muted-foreground hover:bg-surface-2">
          <Paperclip className="h-4 w-4" aria-hidden="true" /> Choose files
          <input
            type="file"
            name="attachment_picker"
            multiple
            className="sr-only"
            disabled={files.length >= MAX_ATTACHMENTS}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {files.length > 0 && (
          <ul className="space-y-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="truncate text-foreground">{f.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {(f.size / 1024 / 1024).toFixed(1)} MB
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="rounded p-1 hover:bg-surface-2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Submit to R&amp;D
      </Button>
    </form>
  );
}
