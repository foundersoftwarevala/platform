import { useState, type ComponentType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/serverFn";
import { toast } from "sonner";
import {
  Package,
  FileText,
  Image as ImageIcon,
  MonitorPlay,
  Newspaper,
  DollarSign,
  KeyRound,
  Download,
  Users,
  ShoppingBag,
  PenTool,
  Store,
  Handshake,
  Link2,
  Megaphone,
  QrCode,
  LifeBuoy,
  FolderOpen,
  Cpu,
  BarChart3,
  Mail,
  Zap,
  ShieldCheck,
  Server,
  Plug,
  Bookmark,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { Card, EmptyHint, LoadFailure, PageHeader, PillButton, StatCard, SubNav } from "../ui";
import { TableToolbar, RowActions, BulkActionBar } from "../actions";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  listProductContent,
  saveProductContent,
  type ProductContentRow,
} from "@/lib/marketplace-manager/catalog-data.functions";

// ---------- Reusable module scaffold ----------
type Stat = {
  label: string;
  value?: string;
  tone?: "default" | "success" | "warning" | "premium" | "destructive";
};
type Feat = { label: string; hint?: string };

function ModulePage({
  eyebrow,
  title,
  description,
  Icon,
  tabs,
  stats,
  features,
  count,
}: {
  eyebrow: string;
  title: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
  tabs: string[];
  stats: Stat[];
  features: Feat[];
  count?: number;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState(tabs[0] ?? "");
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <>
            <PillButton variant="ghost" disabled title={t("manager.module.outline_no_export")}>
              Export
            </PillButton>
            <PillButton variant="primary" disabled title={t("manager.module.outline_no_new")}>
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New
              </span>
            </PillButton>
          </>
        }
      />
      <SubNav items={tabs} active={active} onChange={setActive} />

      <TableToolbar title={title ?? ""} count={count} extraActions={["publish"]} />
      <BulkActionBar selectedCount={0} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value ?? "—"}
            tone={s.tone ?? "default"}
          />
        ))}
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
          <Icon className="h-3.5 w-3.5" /> {title} · Feature Matrix
        </div>
        <EmptyHint text="Awaiting live data — configure each capability below" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <Card key={f.label}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background/60 text-accent">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </span>
                  {f.label}
                </div>
                {f.hint && <div className="mt-1 text-[11px] text-muted-foreground">{f.hint}</div>}
              </div>
              <RowActions ids={["view", "edit", "duplicate", "archive"]} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- Modules ----------
// DB-backed Products admin lives in MarketplaceCatalogAdmin.tsx
export { ProductsAdmin as ProductsSection } from "./MarketplaceCatalogAdmin";

export function ProductContentSection() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listProductContent);
  const saveFn = useServerFn(saveProductContent);
  const [search, setSearch] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<ProductContentRow | null>(null);
  const [draft, setDraft] = useState<{
    description: string;
    benefits: string;
    featuresJson: string;
    tags: string;
    techStack: string;
  } | null>(null);

  const products = useQuery({
    queryKey: ["marketplace", "product-content", search, missingOnly, page],
    queryFn: () => listFn({ data: { search, missingOnly, limit: 50, offset: page * 50 } }),
  });
  const save = useMutation({
    mutationFn: () => {
      if (!editing || !draft) throw new Error("Choose a product before saving.");
      return saveFn({
        data: {
          id: editing.id,
          description: draft.description,
          benefits: draft.benefits,
          featuresJson: draft.featuresJson,
          tags: draft.tags.split(/[\n,]/).map((value) => value.trim()).filter(Boolean),
          techStack: draft.techStack.split(/[\n,]/).map((value) => value.trim()).filter(Boolean),
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketplace", "product-content"] });
      void queryClient.invalidateQueries({ queryKey: ["mp_products_admin"] });
      toast.success("Product content saved.");
      setEditing(null);
      setDraft(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const edit = (row: ProductContentRow) => {
    setEditing(row);
    setDraft({
      description: row.description ?? "",
      benefits: row.benefits ?? "",
      featuresJson: JSON.stringify(row.features ?? [], null, 2),
      tags: (row.tags ?? []).join(", "),
      techStack: (row.tech_stack ?? []).join(", "),
    });
  };

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Product Content"
        title="Product Content"
        description="Edit descriptions, benefits, features, tags and technology stack on the canonical marketplace products."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(0); }}
          placeholder="Search products by name or slug"
          aria-label="Search product content"
          className="h-9 min-w-56 rounded-md border border-border bg-background px-3 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={missingOnly}
            onChange={(event) => { setMissingOnly(event.target.checked); setPage(0); }}
          />
          Missing descriptions only
        </label>
        <span className="text-xs text-muted-foreground">
          {products.isLoading ? "Loading…" : products.isError ? "Unavailable" : `${products.data?.total ?? 0} products`}
        </span>
      </div>
      {products.isError ? (
        <LoadFailure error={products.error} what="product content" onRetry={() => void products.refetch()} />
      ) : products.isLoading ? (
        <Card><div className="text-sm text-muted-foreground">Reading product content…</div></Card>
      ) : (products.data?.rows.length ?? 0) === 0 ? (
        <Card><EmptyHint text={missingOnly ? "No products with missing descriptions match this search." : "No products match this search."} /></Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Features</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.data?.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.slug}</div>
                    </td>
                    <td className="max-w-lg px-4 py-3 text-xs text-muted-foreground">
                      {row.description?.trim() || <span className="text-warning">Missing</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {Array.isArray(row.features) ? `${row.features.length} entries` : "Structured"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {new Date(row.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <PillButton onClick={() => edit(row)}>Edit content</PillButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>Showing {page * 50 + 1}–{Math.min((page + 1) * 50, products.data?.total ?? 0)} of {products.data?.total ?? 0}</span>
            <div className="flex gap-2">
              <PillButton variant="ghost" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</PillButton>
              <PillButton variant="ghost" disabled={(page + 1) * 50 >= (products.data?.total ?? 0)} onClick={() => setPage((value) => value + 1)}>Next</PillButton>
            </div>
          </div>
        </Card>
      )}
      {editing && draft && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Edit product content</h2>
                <p className="text-xs text-muted-foreground">{editing.name} · {editing.slug}</p>
              </div>
              <button type="button" onClick={() => { setEditing(null); setDraft(null); }} aria-label="Close editor">×</button>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-1 text-xs font-semibold">Description
                <textarea rows={5} maxLength={20000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="rounded-md border border-border bg-background p-2 text-sm font-normal" />
              </label>
              <label className="grid gap-1 text-xs font-semibold">Benefits
                <textarea rows={3} maxLength={8000} value={draft.benefits} onChange={(event) => setDraft({ ...draft, benefits: event.target.value })} className="rounded-md border border-border bg-background p-2 text-sm font-normal" />
              </label>
              <label className="grid gap-1 text-xs font-semibold">Features (JSON)
                <textarea rows={7} maxLength={20000} value={draft.featuresJson} onChange={(event) => setDraft({ ...draft, featuresJson: event.target.value })} className="rounded-md border border-border bg-background p-2 font-mono text-xs font-normal" />
              </label>
              <label className="grid gap-1 text-xs font-semibold">Tags (comma or newline separated)
                <textarea rows={2} value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} className="rounded-md border border-border bg-background p-2 text-sm font-normal" />
              </label>
              <label className="grid gap-1 text-xs font-semibold">Tech stack (comma or newline separated)
                <textarea rows={2} value={draft.techStack} onChange={(event) => setDraft({ ...draft, techStack: event.target.value })} className="rounded-md border border-border bg-background p-2 text-sm font-normal" />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <PillButton variant="ghost" onClick={() => { setEditing(null); setDraft(null); }}>Cancel</PillButton>
              <PillButton variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? "Saving…" : "Save content"}
              </PillButton>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export function ProductMediaSection() {
  return (
    <ModulePage
      eyebrow="Product Media"
      title="Product Media"
      description="All thumbnails, galleries, videos, and downloadable asset files with CDN control."
      Icon={ImageIcon}
      tabs={["Thumbnails", "Gallery", "Video", "Files"]}
      stats={[
        { label: "Assets" },
        { label: "Video", tone: "premium" },
        { label: "Missing Alt", tone: "warning" },
        { label: "CDN Hits", tone: "success" },
      ]}
      features={[
        { label: "Thumbnail" },
        { label: "3D Thumbnail" },
        { label: "Gallery" },
        { label: "Screenshots" },
        { label: "Hero Image" },
        { label: "Banner" },
        { label: "Logo" },
        { label: "Icons" },
        { label: "Video" },
        { label: "YouTube URL" },
        { label: "Vimeo URL" },
        { label: "Preview Images" },
        { label: "Preview Video" },
        { label: "Demo GIF" },
        { label: "PDF" },
        { label: "ZIP" },
        { label: "APK" },
        { label: "EXE" },
        { label: "Source Code" },
        { label: "Documentation Files" },
      ]}
    />
  );
}

export function DemoSection() {
  return (
    <ModulePage
      eyebrow="Demo System"
      title="Demo System"
      description="Live/sandbox demos, credentials, one-click login, auto-reset and expiry control."
      Icon={MonitorPlay}
      tabs={["All Demos", "Live", "Sandbox", "Mobile", "Offline"]}
      stats={[
        { label: "Active Demos" },
        { label: "Auto-Reset", tone: "success" },
        { label: "Expiring", tone: "warning" },
        { label: "Uptime", tone: "premium" },
      ]}
      features={[
        { label: "Live Demo URL" },
        { label: "Frontend Demo URL" },
        { label: "Backend Demo URL" },
        { label: "Admin Demo URL" },
        { label: "Customer Demo URL" },
        { label: "Vendor Demo URL" },
        { label: "Author Demo URL" },
        { label: "Mobile Demo" },
        { label: "APK Demo" },
        { label: "Desktop Demo" },
        { label: "Offline Demo" },
        { label: "Sandbox Demo" },
        { label: "Demo Reset" },
        { label: "Auto Demo Reset" },
        { label: "Demo Credentials" },
        { label: "One-Click Login" },
        { label: "Demo Expiry" },
        { label: "Demo Status" },
      ]}
    />
  );
}

export function BlogSection() {
  return (
    <ModulePage
      eyebrow="Blog & Content"
      title="Blog"
      description="Editorial engine with AI writer, scheduling, categories, tags and related products."
      Icon={Newspaper}
      tabs={["Posts", "Categories", "Tags", "Authors", "AI Writer"]}
      stats={[
        { label: "Posts" },
        { label: "Scheduled", tone: "warning" },
        { label: "Published", tone: "success" },
        { label: "AI Drafts", tone: "premium" },
      ]}
      features={[
        { label: "Blog" },
        { label: "Blog Categories" },
        { label: "Blog Tags" },
        { label: "Blog Authors" },
        { label: "Related Products" },
        { label: "Related Blogs" },
        { label: "Featured Blog" },
        { label: "Reading Time" },
        { label: "Table of Contents" },
        { label: "Comments" },
        { label: "Newsletter" },
        { label: "AI Blog Writer" },
        { label: "AI Featured Image" },
        { label: "Scheduled Publishing" },
      ]}
    />
  );
}

export function PricingSection() {
  return (
    <ModulePage
      eyebrow="Pricing & Plans"
      title="Pricing"
      description="Free/paid tiers, subscriptions, trials, regional pricing, tax and coupons."
      Icon={DollarSign}
      tabs={["Plans", "Trials", "Coupons", "Tax", "Currency"]}
      stats={[
        { label: "Active Plans" },
        { label: "Trials", tone: "warning" },
        { label: "Discounts", tone: "success" },
        { label: "Currencies", tone: "premium" },
      ]}
      features={[
        { label: "Free" },
        { label: "Paid" },
        { label: "Monthly" },
        { label: "Yearly" },
        { label: "Lifetime" },
        { label: "Custom Pricing" },
        { label: "Trial" },
        { label: "Discount" },
        { label: "Coupons" },
        { label: "Offers" },
        { label: "Tax" },
        { label: "Currency" },
        { label: "Regional Pricing" },
      ]}
    />
  );
}

export function LicenseSection() {
  return (
    <ModulePage
      eyebrow="Licensing"
      title="License"
      description="Keys, activation limits, offline/online verification, renewals and audit logs."
      Icon={KeyRound}
      tabs={["Keys", "Activations", "Expiry", "Logs"]}
      stats={[
        { label: "Active Keys" },
        { label: "Expiring", tone: "warning" },
        { label: "Renewed", tone: "success" },
        { label: "Verified", tone: "premium" },
      ]}
      features={[
        { label: "License Keys" },
        { label: "Activation" },
        { label: "Deactivation" },
        { label: "Device Limit" },
        { label: "Offline License" },
        { label: "Online License" },
        { label: "License Logs" },
        { label: "Expiry" },
        { label: "Renewal" },
        { label: "License Verification" },
      ]}
    />
  );
}

export function DownloadsSection() {
  return (
    <ModulePage
      eyebrow="Download Center"
      title="Downloads"
      description="Secure downloads, mirrors, integrity hashes and per-version analytics."
      Icon={Download}
      tabs={["Files", "Mirrors", "Analytics", "Integrity"]}
      stats={[
        { label: "Downloads" },
        { label: "Mirrors", tone: "premium" },
        { label: "Failed", tone: "destructive" },
        { label: "Integrity OK", tone: "success" },
      ]}
      features={[
        { label: "Download Manager" },
        { label: "Download Analytics" },
        { label: "Secure Download" },
        { label: "Download Mirrors" },
        { label: "Version Downloads" },
        { label: "File Integrity" },
        { label: "Checksum" },
      ]}
    />
  );
}

// The real, database-backed screen lives in ./CustomerManager.tsx and is
// exported under this section's name below. The static version that used to
// stand here is kept as CustomersSectionStatic: ten feature labels over four
// stat cards that carried no values.
export { CustomersSection } from "./CustomerManager";

export function CustomersSectionStatic() {
  return (
    <ModulePage
      eyebrow="Customers"
      title="Customers"
      description="Profiles, wishlists, orders, tickets and lifetime activity timeline."
      Icon={Users}
      tabs={["All", "Active", "VIP", "Wishlist", "Tickets"]}
      stats={[
        { label: "Customers" },
        { label: "Active", tone: "success" },
        { label: "VIP", tone: "premium" },
        { label: "Open Tickets", tone: "warning" },
      ]}
      features={[
        { label: "Customers" },
        { label: "Customer Profile" },
        { label: "Wishlist" },
        { label: "Orders" },
        { label: "Downloads" },
        { label: "Subscriptions" },
        { label: "Reviews" },
        { label: "Support Tickets" },
        { label: "Purchase History" },
        { label: "Activity Timeline" },
      ]}
    />
  );
}

export function OrdersSection() {
  return (
    <ModulePage
      eyebrow="Orders & Payments"
      title="Orders"
      description="Invoices, payments, refunds, returns and status timeline."
      Icon={ShoppingBag}
      tabs={["All Orders", "Invoices", "Payments", "Refunds", "Returns"]}
      stats={[
        { label: "Orders" },
        { label: "Paid", tone: "success" },
        { label: "Refunded", tone: "warning" },
        { label: "Disputes", tone: "destructive" },
      ]}
      features={[
        { label: "Orders" },
        { label: "Invoices" },
        { label: "Payments" },
        { label: "Refunds" },
        { label: "Returns" },
        { label: "Order Timeline" },
        { label: "Payment Status" },
      ]}
    />
  );
}

export function AuthorsSection() {
  return (
    <ModulePage
      eyebrow="Author Network"
      title="Authors"
      description="Author verification, catalog, earnings and payout control."
      Icon={PenTool}
      tabs={["All", "Verified", "Payouts", "Analytics"]}
      stats={[
        { label: "Authors" },
        { label: "Verified", tone: "success" },
        { label: "Earnings", tone: "premium" },
        { label: "Payouts", tone: "warning" },
      ]}
      features={[
        { label: "Author Dashboard" },
        { label: "Author Verification" },
        { label: "Author Products" },
        { label: "Author Earnings" },
        { label: "Author Analytics" },
        { label: "Author Payouts" },
      ]}
    />
  );
}

export function VendorsSection() {
  return (
    <ModulePage
      eyebrow="Vendor Network"
      title="Vendors"
      description="Vendor onboarding, commission tiers, product catalog and payout schedules."
      Icon={Store}
      tabs={["All", "Verified", "Commission", "Payouts", "Analytics"]}
      stats={[
        { label: "Vendors" },
        { label: "Verified", tone: "success" },
        { label: "Commission", tone: "premium" },
        { label: "Payouts", tone: "warning" },
      ]}
      features={[
        { label: "Vendor Dashboard" },
        { label: "Vendor Verification" },
        { label: "Vendor Products" },
        { label: "Vendor Earnings" },
        { label: "Vendor Analytics" },
        { label: "Vendor Commission" },
        { label: "Vendor Payout" },
      ]}
    />
  );
}

export function ResellersSection() {
  return (
    <ModulePage
      eyebrow="Reseller Network"
      title="Resellers"
      description="Reseller programs, commission, referral tracking and performance."
      Icon={Handshake}
      tabs={["All", "Active", "Commission", "Payouts"]}
      stats={[
        { label: "Resellers" },
        { label: "Active", tone: "success" },
        { label: "Commission", tone: "premium" },
        { label: "Payouts", tone: "warning" },
      ]}
      features={[
        { label: "Reseller Dashboard" },
        { label: "Reseller Products" },
        { label: "Commission" },
        { label: "Referral" },
        { label: "Payout" },
        { label: "Performance" },
      ]}
    />
  );
}

export function AffiliateSection() {
  return (
    <ModulePage
      eyebrow="Affiliate Program"
      title="Affiliate"
      description="Referral links, smart URLs, QR codes, UTM builder and payouts."
      Icon={Link2}
      tabs={["Links", "Codes", "QR", "UTM", "Payouts"]}
      stats={[
        { label: "Affiliates" },
        { label: "Clicks", tone: "premium" },
        { label: "Conversions", tone: "success" },
        { label: "Payouts", tone: "warning" },
      ]}
      features={[
        { label: "Affiliate Dashboard" },
        { label: "Referral Links" },
        { label: "Referral Codes" },
        { label: "Short URL" },
        { label: "Smart URL" },
        { label: "Dynamic URL" },
        { label: "Deep Links" },
        { label: "QR Code" },
        { label: "Coupon Codes" },
        { label: "UTM Builder" },
        { label: "Commission" },
        { label: "Clicks" },
        { label: "Conversions" },
        { label: "Payments" },
      ]}
    />
  );
}

export function InfluencerSection() {
  return (
    <ModulePage
      eyebrow="Creator & Influencer"
      title="Influencer"
      description="Creator profiles, bio links, social share kits, campaigns and payouts."
      Icon={Megaphone}
      tabs={["Creators", "Campaigns", "Bio Links", "Social", "Payouts"]}
      stats={[
        { label: "Creators" },
        { label: "Campaigns", tone: "premium" },
        { label: "Reach", tone: "success" },
        { label: "Payouts", tone: "warning" },
      ]}
      features={[
        { label: "Influencer Dashboard" },
        { label: "Creator Profile" },
        { label: "Bio Link" },
        { label: "Referral Link" },
        { label: "Short URL" },
        { label: "QR Generator" },
        { label: "Campaign Manager" },
        { label: "Social Links" },
        { label: "Instagram Share" },
        { label: "Facebook Share" },
        { label: "WhatsApp Share" },
        { label: "Telegram Share" },
        { label: "LinkedIn Share" },
        { label: "X Share" },
        { label: "Pinterest Share" },
        { label: "Email Share" },
        { label: "Commission" },
        { label: "Analytics" },
        { label: "Payouts" },
      ]}
    />
  );
}

export function QrSection() {
  return (
    <ModulePage
      eyebrow="QR System"
      title="QR System"
      description="Dynamic and static QR codes for products, demos, downloads, events and campaigns."
      Icon={QrCode}
      tabs={["All", "Dynamic", "Static", "Analytics"]}
      stats={[
        { label: "QR Codes" },
        { label: "Scans", tone: "success" },
        { label: "Protected", tone: "premium" },
        { label: "Expired", tone: "warning" },
      ]}
      features={[
        { label: "Dynamic QR" },
        { label: "Static QR" },
        { label: "Product QR" },
        { label: "Demo QR" },
        { label: "Download QR" },
        { label: "Profile QR" },
        { label: "Event QR" },
        { label: "Campaign QR" },
        { label: "Analytics" },
        { label: "Password Protection" },
      ]}
    />
  );
}

export function SupportSection() {
  return (
    <ModulePage
      eyebrow="Support Desk"
      title="Support"
      description="Tickets, live chat, knowledge base, documentation and announcements."
      Icon={LifeBuoy}
      tabs={["Tickets", "Live Chat", "Knowledge Base", "Docs", "FAQs"]}
      stats={[
        { label: "Tickets" },
        { label: "Open", tone: "warning" },
        { label: "Resolved", tone: "success" },
        { label: "CSAT", tone: "premium" },
      ]}
      features={[
        { label: "Support Tickets" },
        { label: "Live Chat" },
        { label: "Knowledge Base" },
        { label: "Documentation" },
        { label: "FAQs" },
        { label: "Announcements" },
      ]}
    />
  );
}

export function MediaLibrarySection() {
  return (
    <ModulePage
      eyebrow="Media Library"
      title="Media"
      description="Central asset store: images, icons, videos, documents, ZIPs and PDFs."
      Icon={FolderOpen}
      tabs={["All", "Images", "Videos", "Documents", "Assets"]}
      stats={[
        { label: "Assets" },
        { label: "Images", tone: "premium" },
        { label: "Videos", tone: "success" },
        { label: "Storage", tone: "warning" },
      ]}
      features={[
        { label: "Media Library" },
        { label: "Images" },
        { label: "Icons" },
        { label: "Videos" },
        { label: "Documents" },
        { label: "ZIP" },
        { label: "PDF" },
        { label: "Assets" },
      ]}
    />
  );
}

export function AiProvidersSection() {
  return (
    <ModulePage
      eyebrow="AI Providers & Generators"
      title="AI Providers"
      description="Connect providers and orchestrate generators: product, thumbnail, banner, SEO, docs."
      Icon={Cpu}
      tabs={["Providers", "Generators", "Prompts", "Usage"]}
      stats={[
        { label: "Providers" },
        { label: "Connected", tone: "success" },
        { label: "Tokens", tone: "premium" },
        { label: "Errors", tone: "destructive" },
      ]}
      features={[
        { label: "OpenAI" },
        { label: "Gemini" },
        { label: "Claude" },
        { label: "Grok" },
        { label: "DeepSeek" },
        { label: "Mistral" },
        { label: "OpenRouter" },
        { label: "Ollama" },
        { label: "HuggingFace" },
        { label: "Replicate" },
        { label: "Fal.ai" },
        { label: "Cloudflare AI" },
        { label: "Vertex AI" },
        { label: "AWS Bedrock" },
        { label: "Azure AI" },
        { label: "AI Product Generator" },
        { label: "AI Thumbnail Generator" },
        { label: "AI Banner Generator" },
        { label: "AI Gallery Generator" },
        { label: "AI Description" },
        { label: "AI Features" },
        { label: "AI FAQs" },
        { label: "AI SEO" },
        { label: "AI Blogs" },
        { label: "AI Documentation" },
        { label: "AI Changelog" },
        { label: "AI Release Notes" },
        { label: "AI Tags" },
        { label: "AI Translation" },
      ]}
    />
  );
}

export function ApiSection() {
  return (
    <ModulePage
      eyebrow="Developer API"
      title="API"
      description="REST, GraphQL, webhooks, OAuth/JWT, rate limits and analytics."
      Icon={Plug}
      tabs={["REST", "GraphQL", "Webhooks", "Auth", "Logs"]}
      stats={[
        { label: "Endpoints" },
        { label: "Keys", tone: "premium" },
        { label: "Rate Limits", tone: "warning" },
        { label: "Errors", tone: "destructive" },
      ]}
      features={[
        { label: "REST API" },
        { label: "GraphQL" },
        { label: "Webhooks" },
        { label: "OAuth" },
        { label: "JWT" },
        { label: "API Keys" },
        { label: "API Logs" },
        { label: "Rate Limiting" },
        { label: "API Analytics" },
      ]}
    />
  );
}

export function ReportsSection() {
  return (
    <ModulePage
      eyebrow="Reports Center"
      title="Reports"
      description="Sales, revenue, downloads, customers, vendors, authors and SEO reports."
      Icon={BarChart3}
      tabs={["Sales", "Revenue", "Downloads", "SEO", "Marketplace"]}
      stats={[
        { label: "Reports" },
        { label: "Scheduled", tone: "premium" },
        { label: "This Month", tone: "success" },
        { label: "Alerts", tone: "warning" },
      ]}
      features={[
        { label: "Sales Reports" },
        { label: "Revenue Reports" },
        { label: "Download Reports" },
        { label: "Customer Reports" },
        { label: "Vendor Reports" },
        { label: "Author Reports" },
        { label: "SEO Reports" },
        { label: "Marketplace Reports" },
      ]}
    />
  );
}

// The real screen lives in ./MarketingOverview.tsx and is exported under this
// section's name below. It does not duplicate the Marketing Manager at
// /marketing — it reports the seed/real split and the provider connections,
// and links into the module that already exists. The static version that used
// to stand here is kept as MarketingSectionStatic.
export { MarketingSection } from "./MarketingOverview";

export function MarketingSectionStatic() {
  return (
    <ModulePage
      eyebrow="Marketing Suite"
      title="Marketing"
      description="Email, SMS, push, WhatsApp, Telegram, Discord, campaigns and loyalty."
      Icon={Mail}
      tabs={["Campaigns", "Email", "Messaging", "Social", "Loyalty"]}
      stats={[
        { label: "Campaigns" },
        { label: "Open Rate", tone: "success" },
        { label: "CTR", tone: "premium" },
        { label: "Unsub", tone: "warning" },
      ]}
      features={[
        { label: "Email Marketing" },
        { label: "SMS" },
        { label: "Push Notifications" },
        { label: "WhatsApp" },
        { label: "Telegram" },
        { label: "Discord" },
        { label: "Social Sharing" },
        { label: "Newsletter" },
        { label: "Campaigns" },
        { label: "Coupons" },
        { label: "Gift Cards" },
        { label: "Loyalty Program" },
      ]}
    />
  );
}

export function AutomationSection() {
  return (
    <ModulePage
      eyebrow="Automation Engine"
      title="Automation"
      description="Scheduled tasks, auto-SEO, auto-blog, auto-thumbnail, auto-translation and more."
      Icon={Zap}
      tabs={["Tasks", "AI Auto", "Backups", "Schedules"]}
      stats={[
        { label: "Tasks" },
        { label: "Running", tone: "success" },
        { label: "Queued", tone: "warning" },
        { label: "Failed", tone: "destructive" },
      ]}
      features={[
        { label: "Scheduled Tasks" },
        { label: "Auto SEO" },
        { label: "Auto Blog" },
        { label: "Auto Tags" },
        { label: "Auto Thumbnail" },
        { label: "Auto Gallery" },
        { label: "Auto Translation" },
        { label: "Auto Documentation" },
        { label: "Auto Reports" },
        { label: "Auto Backup" },
      ]}
    />
  );
}

export function SecuritySection() {
  return (
    <ModulePage
      eyebrow="Security & Access"
      title="Security"
      description="Roles, permissions, audit logs, sessions, 2FA and IP allowlists."
      Icon={ShieldCheck}
      tabs={["Roles", "Audit", "Sessions", "2FA", "Access"]}
      stats={[
        { label: "Roles" },
        { label: "Sessions", tone: "premium" },
        { label: "2FA", tone: "success" },
        { label: "Blocked", tone: "destructive" },
      ]}
      features={[
        { label: "Roles" },
        { label: "Permissions" },
        { label: "Audit Logs" },
        { label: "Activity Logs" },
        { label: "Session Management" },
        { label: "Login History" },
        { label: "Access Control" },
        { label: "IP Whitelist" },
        { label: "Two Factor Authentication" },
      ]}
    />
  );
}

export function SystemSection() {
  return (
    <ModulePage
      eyebrow="System Health"
      title="System"
      description="Backups, cache, queues, logs, storage, performance and health monitoring."
      Icon={Server}
      tabs={["Health", "Backup", "Cache", "Queues", "Logs"]}
      stats={[
        { label: "Uptime", tone: "success" },
        { label: "Queues", tone: "premium" },
        { label: "Storage", tone: "warning" },
        { label: "Errors", tone: "destructive" },
      ]}
      features={[
        { label: "Backup" },
        { label: "Restore" },
        { label: "Cache" },
        { label: "Queues" },
        { label: "Logs" },
        { label: "Server Status" },
        { label: "Storage Usage" },
        { label: "Performance Monitor" },
        { label: "Health Monitor" },
      ]}
    />
  );
}

export function IntegrationsSection() {
  return (
    <ModulePage
      eyebrow="Integrations Hub"
      title="Integrations"
      description="Analytics, pixels, payments and finance connectors — connect once, use everywhere."
      Icon={Plug}
      tabs={["Analytics", "Pixels", "Payments", "Finance"]}
      stats={[
        { label: "Connectors" },
        { label: "Connected", tone: "success" },
        { label: "Failing", tone: "destructive" },
        { label: "Events", tone: "premium" },
      ]}
      features={[
        { label: "Google Analytics" },
        { label: "Google Search Console" },
        { label: "Microsoft Clarity" },
        { label: "Meta Pixel" },
        { label: "TikTok Pixel" },
        { label: "LinkedIn Insight" },
        { label: "Stripe" },
        { label: "PayPal" },
        { label: "Razorpay" },
        { label: "Flutterwave" },
        { label: "Paystack" },
        { label: "Wise" },
        { label: "Coinbase Commerce" },
      ]}
    />
  );
}

export function ExtraSection() {
  return (
    <ModulePage
      eyebrow="Extra Capabilities"
      title="Extra"
      description="Follows, comparisons, roadmap, notes, trash, multi-* controls and insights."
      Icon={Bookmark}
      tabs={["Follows", "Insights", "Multi-*", "Notes", "Trash"]}
      stats={[
        { label: "Follows" },
        { label: "Compared", tone: "premium" },
        { label: "Trashed", tone: "warning" },
        { label: "Restored", tone: "success" },
      ]}
      features={[
        { label: "Recently Viewed" },
        { label: "Saved Searches" },
        { label: "Price Alerts" },
        { label: "Follow Product" },
        { label: "Follow Vendor" },
        { label: "Follow Author" },
        { label: "Product Comparison" },
        { label: "Roadmap" },
        { label: "Idea Board" },
        { label: "Internal Notes" },
        { label: "Founder Notes" },
        { label: "Activity Timeline" },
        { label: "Trash Bin" },
        { label: "Archive" },
        { label: "Multi Language" },
        { label: "Multi Currency" },
        { label: "Multi Country" },
        { label: "Multi Branch" },
        { label: "Multi Vendor" },
        { label: "Multi Author" },
        { label: "Marketplace Statistics" },
        { label: "Business Insights" },
      ]}
    />
  );
}
