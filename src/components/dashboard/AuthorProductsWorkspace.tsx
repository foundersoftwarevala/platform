import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Download,
  FileText,
  Pencil,
  Plus,
  Send,
  Undo2,
  Upload,
} from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { authHeaders } from "@/lib/auth/operator-fetch";
import type { RoleConfig } from "@/lib/roles";
import { getAuthorProductActions } from "@/lib/marketplace/author-product-lifecycle";

type Product = Record<string, unknown> & {
  id: string;
  name: string;
  slug: string;
  category_id: string | null;
  price_label: string | null;
  moderation_status: string;
  content_status: string;
  updated_at: string;
};

type Category = { id: string; name: string };
type ProductsResponse = { products: Product[]; categories: Category[] };
type ProductFile = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  created_at: string;
};
type Draft = Record<string, string>;
type FieldKind = "text" | "textarea" | "list" | "json" | "url";
type FieldSpec = { key: string; label: string; kind?: FieldKind; required?: boolean };

const BASIC_FIELDS: FieldSpec[] = [
  { key: "name", label: "Product name", required: true },
  { key: "slug", label: "URL slug" },
  { key: "description", label: "Description", kind: "textarea" },
  { key: "industry_label", label: "Industry" },
  { key: "subcategory", label: "Subcategory" },
  { key: "category_id", label: "Category" },
  { key: "software_type", label: "Software type" },
  { key: "version", label: "Version" },
  { key: "target_audience", label: "Target audience", kind: "textarea" },
];

const PRICING_FIELDS: FieldSpec[] = [
  { key: "price_label", label: "Price" },
  { key: "price_period", label: "Price period" },
  { key: "currency", label: "Currency code" },
  { key: "license", label: "License" },
];

const MEDIA_FIELDS: FieldSpec[] = [
  { key: "thumbnail_url", label: "Thumbnail URL", kind: "url" },
  { key: "cover_image", label: "Cover image URL", kind: "url" },
  { key: "logo", label: "Logo URL", kind: "url" },
  { key: "icon", label: "Icon URL or name" },
  { key: "favicon", label: "Favicon URL", kind: "url" },
  { key: "demo_url", label: "Demo URL", kind: "url" },
  { key: "public_repo_url", label: "Public repository URL", kind: "url" },
];

const TECH_FIELDS: FieldSpec[] = [
  { key: "technology", label: "Technology", kind: "textarea" },
  { key: "frontend", label: "Frontend" },
  { key: "backend", label: "Backend" },
  { key: "database", label: "Database" },
  { key: "mobile", label: "Mobile support" },
  { key: "cloud", label: "Cloud support" },
  { key: "languages", label: "Languages" },
  { key: "integrations", label: "Integrations", kind: "textarea" },
  { key: "modules", label: "Modules", kind: "textarea" },
  { key: "benefits", label: "Benefits", kind: "textarea" },
  { key: "roles", label: "Roles", kind: "textarea" },
];

const LIST_FIELDS: FieldSpec[] = [
  { key: "tags", label: "Tags", kind: "list" },
  { key: "tech_stack", label: "Technology stack", kind: "list" },
  { key: "search_keywords", label: "Search keywords", kind: "list" },
];

const ALL_FIELDS = [
  ...BASIC_FIELDS,
  ...PRICING_FIELDS,
  ...MEDIA_FIELDS,
  ...TECH_FIELDS,
  ...LIST_FIELDS,
  { key: "features", label: "Features (JSON)", kind: "json" as const },
];

async function requestProducts(): Promise<ProductsResponse> {
  const response = await fetch("/api/author/products", { headers: await authHeaders() });
  const body = (await response.json()) as ProductsResponse & { error?: string };
  if (!response.ok) throw new Error(body.error || `Could not load products (${response.status})`);
  return body;
}

function valueFor(product: Product | null, field: FieldSpec): string {
  const value = product?.[field.key];
  if (value == null) return "";
  if (field.kind === "json") return JSON.stringify(value, null, 2);
  if (field.kind === "list" && Array.isArray(value)) return value.map(String).join(", ");
  return String(value);
}

function makeDraft(product: Product | null): Draft {
  return Object.fromEntries(ALL_FIELDS.map((field) => [field.key, valueFor(product, field)]));
}

function makePayload(draft: Draft): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of ALL_FIELDS) {
    const value = draft[field.key] ?? "";
    if (field.kind === "list") {
      payload[field.key] = value
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
    } else if (field.kind === "json") {
      payload[field.key] = value.trim() ? JSON.parse(value) : [];
    } else if (field.key === "price_label") {
      payload[field.key] = value.trim();
    } else if (field.key === "slug" && !value.trim()) {
      continue;
    } else {
      payload[field.key] = value.trim() || null;
    }
  }
  return payload;
}

function ProductField({
  field,
  value,
  onChange,
  categories,
}: {
  field: FieldSpec;
  value: string;
  onChange: (value: string) => void;
  categories: Category[];
}) {
  const className =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      {field.label}
      {field.key === "category_id" ? (
        <select
          className={className}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      ) : field.kind === "textarea" || field.kind === "list" || field.kind === "json" ? (
        <textarea
          className={`${className} min-h-20 resize-y`}
          value={value}
          required={field.required}
          onChange={(event) => onChange(event.target.value)}
          rows={field.kind === "json" ? 6 : 3}
          placeholder={
            field.kind === "list"
              ? "Separate values with commas"
              : field.kind === "json"
                ? 'Example: ["Feature one", "Feature two"]'
                : undefined
          }
        />
      ) : (
        <input
          className={className}
          type={field.kind === "url" ? "url" : "text"}
          value={value}
          required={field.required}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function ProductFiles({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const filesQuery = useQuery({
    queryKey: ["author-product-files", productId],
    queryFn: async () => {
      const response = await fetch(
        `/api/author/product-files?product_id=${encodeURIComponent(productId)}`,
        { headers: await authHeaders() },
      );
      const body = (await response.json()) as { files?: ProductFile[]; error?: string };
      if (!response.ok)
        throw new Error(body.error || `Could not load product files (${response.status})`);
      return body.files ?? [];
    },
    retry: 1,
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.set("product_id", productId);
      form.set("file", file);
      const response = await fetch("/api/author/product-files", {
        method: "POST",
        headers: { ...(await authHeaders()), "Idempotency-Key": crypto.randomUUID() },
        body: form,
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || `Upload failed (${response.status})`);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["author-product-files", productId] }),
  });
  const download = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await fetch("/api/author/product-files", {
        method: "POST",
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ action: "download", file_id: fileId }),
      });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url)
        throw new Error(body.error || `Download failed (${response.status})`);
      return body.url;
    },
    onSuccess: (url) => window.location.assign(url),
  });

  const submitUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (file) upload.mutate(file);
  };

  return (
    <details className="rounded-lg border border-border p-4">
      <summary className="cursor-pointer text-sm font-semibold">Private product files</summary>
      <p className="mt-2 text-xs text-muted-foreground">
        Files are private and accessible only to you here. Customer purchase downloads are not
        enabled. Maximum file size: 50 MiB.
      </p>
      <form onSubmit={submitUpload} className="mt-4 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`product-file-${productId}`}>
          Choose a product file
        </label>
        <input
          ref={inputRef}
          id={`product-file-${productId}`}
          type="file"
          accept=".zip,.pdf,.jpg,.jpeg,.png,.webp,.gif,.avif,.mp4,.txt,.csv"
          className="min-w-0 max-w-full text-xs"
          required
        />
        <button
          type="submit"
          disabled={upload.isPending}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" /> {upload.isPending ? "Uploading…" : "Upload file"}
        </button>
      </form>
      {filesQuery.isLoading ? (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          Loading product files…
        </p>
      ) : filesQuery.isError ? (
        <div className="mt-3" role="alert">
          <p className="text-xs text-danger">{filesQuery.error.message}</p>
          <button
            type="button"
            onClick={() => void filesQuery.refetch()}
            className="mt-1 text-xs text-brand"
          >
            Retry
          </button>
        </div>
      ) : filesQuery.data?.length ? (
        <ul className="mt-3 divide-y divide-border">
          {filesQuery.data.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="inline-flex min-w-0 items-center gap-2 text-xs">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{file.file_name}</span>
                <span className="text-muted-foreground">
                  {(file.size_bytes / 1024 / 1024).toFixed(2)} MiB
                </span>
              </span>
              <button
                type="button"
                disabled={download.isPending}
                onClick={() => download.mutate(file.id)}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No files have been uploaded.</p>
      )}
      {(upload.isError || download.isError) && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {upload.error?.message ?? download.error?.message}
        </p>
      )}
    </details>
  );
}

export function AuthorProductsWorkspace({
  role,
  onBack,
}: {
  role: RoleConfig;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [draft, setDraft] = useState<Draft>(() => makeDraft(null));
  const [formError, setFormError] = useState<string | null>(null);
  const productsQuery = useQuery({
    queryKey: ["author-products"],
    queryFn: requestProducts,
    retry: 1,
  });
  const mutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await fetch("/api/author/products", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || `Save failed (${response.status})`);
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["author-products"] });
      setEditing(undefined);
      setFormError(null);
    },
  });

  const products = productsQuery.data?.products ?? [];
  const categories = productsQuery.data?.categories ?? [];
  const beginCreate = () => {
    setDraft(makeDraft(null));
    setFormError(null);
    setEditing(null);
  };
  const beginEdit = (product: Product) => {
    setDraft(makeDraft(product));
    setFormError(null);
    setEditing(product);
  };
  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    try {
      const payload = makePayload(draft);
      mutation.mutate(editing ? { id: editing.id, ...payload } : payload);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Check the product fields and try again.",
      );
    }
  };
  const transition = (product: Product, action: "submit" | "withdraw") => {
    mutation.mutate({ id: product.id, action });
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium transition hover:bg-surface-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">Products</h1>
            <p className="text-xs text-muted-foreground">
              {role.name} product drafts and review status
            </p>
          </div>
        </div>
        {editing === undefined && (
          <button
            type="button"
            onClick={beginCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New Product
          </button>
        )}
      </div>

      {productsQuery.isLoading ? (
        <div
          role="status"
          className="rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground"
        >
          Loading your products…
        </div>
      ) : productsQuery.isError ? (
        <div role="alert" className="rounded-xl border border-danger/30 bg-surface p-5">
          <p className="text-sm font-medium">Products could not be loaded.</p>
          <p className="mt-1 text-xs text-muted-foreground">{productsQuery.error.message}</p>
          <button
            type="button"
            onClick={() => void productsQuery.refetch()}
            className="mt-3 text-sm font-medium text-brand"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          {products.length === 0 ? (
            <div className="p-8 text-center">
              <h2 className="text-base font-semibold">No products yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a draft to start your submission.
              </p>
              <button
                type="button"
                onClick={beginCreate}
                className="mt-4 text-sm font-semibold text-brand"
              >
                Create your first product
              </button>
            </div>
          ) : (
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-border bg-surface-2 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Price
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Updated
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((product) => {
                  const state = product.moderation_status;
                  const actions = getAuthorProductActions(state);
                  return (
                    <tr key={product.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{product.name}</div>
                        <div className="text-xs text-muted-foreground">/{product.slug}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex rounded-full bg-surface-2 px-2 py-1 text-xs capitalize"
                          aria-label={`Product status: ${state.replaceAll("_", " ")}${actions.readOnly ? " (read-only)" : ""}`}
                        >
                          {state.replaceAll("_", " ")}
                          {state === "approved" ? " · read-only" : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">{product.price_label || "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {product.updated_at
                          ? new Date(product.updated_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {actions.canEdit && (
                            <button
                              type="button"
                              onClick={() => beginEdit(product)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-brand"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </button>
                          )}
                          {actions.canSubmit && (
                            <button
                              type="button"
                              disabled={mutation.isPending}
                              onClick={() => transition(product, "submit")}
                              className="inline-flex items-center gap-1 text-xs font-medium text-success disabled:opacity-50"
                            >
                              <Send className="h-3.5 w-3.5" /> Submit
                            </button>
                          )}
                          {actions.canWithdraw && (
                            <button
                              type="button"
                              disabled={mutation.isPending}
                              onClick={() => transition(product, "withdraw")}
                              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground disabled:opacity-50"
                            >
                              <Undo2 className="h-3.5 w-3.5" /> Withdraw
                            </button>
                          )}
                          {actions.canReturnToDraft && (
                            <button
                              type="button"
                              disabled={mutation.isPending}
                              onClick={() => transition(product, "withdraw")}
                              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground disabled:opacity-50"
                            >
                              <Undo2 className="h-3.5 w-3.5" /> Return to draft
                            </button>
                          )}
                          {actions.readOnly && state !== "approved" ? (
                            <span className="text-xs text-muted-foreground">
                              Managed by the marketplace team
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {mutation.isError && (
        <p role="alert" className="text-sm text-danger">
          {mutation.error.message}
        </p>
      )}

      {editing !== undefined && (
        <form
          onSubmit={submitForm}
          className="space-y-5 rounded-xl border border-border bg-surface p-4 md:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {editing ? "Edit product draft" : "Create product draft"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Submissions stay hidden until the marketplace team approves and publishes them.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(undefined)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {BASIC_FIELDS.map((field) => (
              <ProductField
                key={field.key}
                field={field}
                value={draft[field.key] ?? ""}
                categories={categories}
                onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
              />
            ))}
          </div>

          <details className="rounded-lg border border-border p-4">
            <summary className="cursor-pointer text-sm font-semibold">Pricing and license</summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {PRICING_FIELDS.map((field) => (
                <ProductField
                  key={field.key}
                  field={field}
                  value={draft[field.key] ?? ""}
                  categories={categories}
                  onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
                />
              ))}
            </div>
          </details>

          <details className="rounded-lg border border-border p-4">
            <summary className="cursor-pointer text-sm font-semibold">Images and links</summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {MEDIA_FIELDS.map((field) => (
                <ProductField
                  key={field.key}
                  field={field}
                  value={draft[field.key] ?? ""}
                  categories={categories}
                  onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
                />
              ))}
            </div>
          </details>

          <details className="rounded-lg border border-border p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Technology, features, and metadata
            </summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[...TECH_FIELDS, ...LIST_FIELDS, ALL_FIELDS[ALL_FIELDS.length - 1]].map((field) => (
                <ProductField
                  key={field.key}
                  field={field}
                  value={draft[field.key] ?? ""}
                  categories={categories}
                  onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
                />
              ))}
            </div>
          </details>

          {editing && editableStates.has(editing.moderation_status) && (
            <ProductFiles productId={editing.id} />
          )}

          {(formError || mutation.isError) && (
            <p role="alert" className="text-sm text-danger">
              {formError || mutation.error?.message || "Could not save the product."}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> {mutation.isPending ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(undefined)}
              className="rounded-lg border border-border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
