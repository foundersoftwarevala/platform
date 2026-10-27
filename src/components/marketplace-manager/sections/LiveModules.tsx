import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/serverFn";
import { toast } from "sonner";
import {
  BarChart3, Download, Image as ImageIcon, KeyRound, MonitorPlay, Newspaper,
  PenTool, QrCode, Store, Users, Link2, Handshake,
} from "lucide-react";

import { getLicenseOverview, listMarketplaceLicenses, revokeMarketplaceLicense } from "@/lib/marketplace-manager/license.functions";
import {
  listProductMedia,
  saveProductMedia,
  type ProductMediaRow,
} from "@/lib/marketplace-manager/catalog-data.functions";
import { Card, EmptyHint, LoadFailure, PageHeader, PillButton, StatCard } from "../ui";
import { LiveModule } from "./LiveModule";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * The module screens that were waiting for data, now reading it.
 *
 * Each keeps the shell it was designed as - the same eyebrow, title,
 * description, tabs in their order and counters with their labels - and fills
 * it from the real table. The originals are still exported from
 * CatalogSections; these are what the registry renders.
 *
 * Where a tab names something this platform does not hold - a mirror for a
 * download, a UTM store, a bio-link table - the tab says so. Showing an empty
 * grid there would read as "none", which is a different claim from "there is
 * nowhere for this to be kept".
 */

const ENDPOINT =
  "Every tab above reads its real table through /api/manager/resource, which only lets a screen change the columns it is allowed to.";

export function ProductMediaLive() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<ProductMediaRow | null>(null);
  const [draft, setDraft] = useState({
    thumbnail_url: "",
    logo: "",
    cover_image: "",
    favicon: "",
  });
  const queryClient = useQueryClient();
  const listFn = useServerFn(listProductMedia);
  const saveFn = useServerFn(saveProductMedia);
  const media = useQuery({
    queryKey: ["marketplace", "product-media", search, page],
    queryFn: () => listFn({ data: { search, limit: 50, offset: page * 50 } }),
  });
  const save = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("Choose a product before saving its media.");
      return saveFn({ data: { id: editing.id, ...draft } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketplace", "product-media"] });
      void queryClient.invalidateQueries({ queryKey: ["mp_products_admin"] });
      void queryClient.invalidateQueries({ queryKey: ["marketplace"] });
      toast.success("Product media URLs saved.");
      setEditing(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Product Media"
        title={t("manager.module.product_media")}
        description="Edit the image URLs stored on marketplace_products. This screen does not upload files or create R2 assets."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(0); }}
          placeholder="Search products by name or slug"
          aria-label="Search product media"
          className="h-9 min-w-56 rounded-md border border-border bg-background px-3 text-sm"
        />
        <span className="text-xs text-muted-foreground">
          {media.isLoading ? "Loading…" : media.isError ? "Unavailable" : `${media.data?.total ?? 0} products`}
        </span>
      </div>
      {media.isError ? (
        <LoadFailure error={media.error} what="product media" onRetry={() => void media.refetch()} />
      ) : media.isLoading ? (
        <Card><div className="text-sm text-muted-foreground">Reading product media…</div></Card>
      ) : (media.data?.rows.length ?? 0) === 0 ? (
        <Card><EmptyHint text="No products match this search." /></Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Thumbnail</th>
                  <th className="px-4 py-3">Logo / cover / favicon</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {media.data?.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      {row.thumbnail_url ? (
                        <div className="flex items-center gap-2">
                          <img src={row.thumbnail_url} alt="" className="h-10 w-14 rounded border border-border object-cover" loading="lazy" />
                          <span className="max-w-40 truncate text-xs text-muted-foreground" title={row.thumbnail_url}>{row.thumbnail_url}</span>
                        </div>
                      ) : <span className="text-xs text-warning">Missing</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {[row.logo && "logo", row.cover_image && "cover", row.favicon && "favicon"].filter(Boolean).join(" · ") || "No other image URLs"}
                    </td>
                    <td className="px-4 py-3">
                      <PillButton onClick={() => {
                        setEditing(row);
                        setDraft({
                          thumbnail_url: row.thumbnail_url ?? "",
                          logo: row.logo ?? "",
                          cover_image: row.cover_image ?? "",
                          favicon: row.favicon ?? "",
                        });
                      }}>Edit URLs</PillButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>Showing {page * 50 + 1}–{Math.min((page + 1) * 50, media.data?.total ?? 0)} of {media.data?.total ?? 0}</span>
            <div className="flex gap-2">
              <PillButton variant="ghost" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</PillButton>
              <PillButton variant="ghost" disabled={(page + 1) * 50 >= (media.data?.total ?? 0)} onClick={() => setPage((value) => value + 1)}>Next</PillButton>
            </div>
          </div>
        </Card>
      )}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <Card className="w-full max-w-2xl">
            <h2 className="mb-1 text-lg font-bold">Product image URLs</h2>
            <p className="mb-4 text-xs text-muted-foreground">{editing.name} · Stored directly on the VPS product record.</p>
            <div className="grid gap-3">
              {([
                ["thumbnail_url", "Thumbnail URL"],
                ["logo", "Logo URL"],
                ["cover_image", "Cover image URL"],
                ["favicon", "Favicon URL"],
              ] as const).map(([field, label]) => (
                <label key={field} className="grid gap-1 text-xs font-semibold">
                  {label}
                  <input
                    value={draft[field]}
                    onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
                    placeholder="https://… or /site-relative-path"
                    className="h-9 rounded-md border border-border bg-background px-3 text-sm font-normal"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <PillButton variant="ghost" onClick={() => setEditing(null)}>Cancel</PillButton>
              <PillButton variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? "Saving…" : "Save URLs"}
              </PillButton>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export function DemoSystemLive() {
  const { t } = useTranslation();
  return (
    <LiveModule
      eyebrow="Demo System" title={t("manager.module.demo_system")}
      description="Every demo the marketplace can open, and the state it was last found in."
      Icon={MonitorPlay}
      tabs={[
        { label: "All Demos", resource: "demos" },
        { label: "Live", resource: "demos", filter: { status: "active" } },
        { label: "Sandbox", resource: "demo_sandbox" },
        { label: "Domains", resource: "demo_domain" },
      ]}
      counters={[
        { label: "Demos", resource: "demos" },
        { label: "Active", resource: "demos", filter: { status: "active" }, tone: "success" },
        { label: "Sandboxes", resource: "demo_sandbox" },
        { label: "Domains", resource: "demo_domain" },
      ]}
      footnote={ENDPOINT}
    />
  );
}

export function BlogLive() {
  const { t } = useTranslation();
  return (
    <LiveModule
      eyebrow="Blog & Content" title={t("manager.module.blog")}
      description="Posts, their state and when each one goes out."
      Icon={Newspaper}
      tabs={[
        { label: "Posts", resource: "blog" },
        { label: "Published", resource: "blog", filter: { status: "published" } },
        { label: "Scheduled", resource: "blog", filter: { status: "scheduled" } },
      ]}
      counters={[
        { label: "Posts", resource: "blog" },
        { label: "Published", resource: "blog", filter: { status: "published" }, tone: "success" },
        { label: "Scheduled", resource: "blog", filter: { status: "scheduled" }, tone: "warning" },
        { label: "AI Drafts", absent: "A post does not record whether it was drafted by AI." },
      ]}
      footnote={ENDPOINT}
    />
  );
}

export function LicenseLive() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "issued" | "active" | "revoked" | "expired">("all");
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();
  const licenseListFn = useServerFn(listMarketplaceLicenses);
  const overviewFn = useServerFn(getLicenseOverview);
  const revokeFn = useServerFn(revokeMarketplaceLicense);
  const overview = useQuery({
    queryKey: ["marketplace", "license-overview"],
    queryFn: () => overviewFn(),
    staleTime: 30_000,
  });
  const licenses = useQuery({
    queryKey: ["marketplace", "licenses", status, search, page],
    queryFn: () => licenseListFn({ data: { search, status, limit: 50, offset: page * 50 } }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketplace", "licenses"] });
      void queryClient.invalidateQueries({ queryKey: ["marketplace", "license-overview"] });
      toast.success("License revoked.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Licensing"
        title={t("manager.module.license")}
        description="Issued license keys and status from marketplace_licenses on VPS Postgres."
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total licenses" value={overview.isLoading ? "…" : String(overview.data?.total ?? "—")} />
        <StatCard label="Active" value={overview.isLoading ? "…" : String(overview.data?.active_keys ?? "—")} tone="success" />
        <StatCard label="Revoked" value={overview.isLoading ? "…" : String(overview.data?.revoked ?? "—")} tone="warning" />
        <StatCard label="Entitlements" value={overview.isLoading ? "…" : String(overview.data?.entitlements ?? "—")} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(0); }}
          placeholder="Search license key or product"
          aria-label="Search licenses"
          className="h-9 min-w-56 rounded-md border border-border bg-background px-3 text-sm"
        />
        <select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(0); }} className="h-9 rounded-md border border-border bg-background px-3 text-sm">
          <option value="all">All statuses</option>
          <option value="issued">Issued</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
          <option value="expired">Expired</option>
        </select>
        <span className="text-xs text-muted-foreground">
          {licenses.isLoading ? "Loading…" : licenses.isError ? "Unavailable" : `${licenses.data?.total ?? 0} licenses`}
        </span>
      </div>
      {licenses.isError ? (
        <LoadFailure error={licenses.error} what="licenses" onRetry={() => void licenses.refetch()} />
      ) : licenses.isLoading ? (
        <Card><div className="text-sm text-muted-foreground">Reading licenses…</div></Card>
      ) : (licenses.data?.rows.length ?? 0) === 0 ? (
        <Card><EmptyHint text="No licenses match this search and status." /></Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">License key</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {licenses.data?.rows.map((license) => (
                  <tr key={license.id}>
                    <td className="px-4 py-3 font-mono text-xs">{license.license_key}</td>
                    <td className="px-4 py-3">{license.product_name}</td>
                    <td className="px-4 py-3">{license.license_model.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">{license.status}</td>
                    <td className="px-4 py-3">{license.expires_at ? new Date(license.expires_at).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">{new Date(license.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {(license.status === "issued" || license.status === "active") ? (
                        <PillButton
                          variant="ghost"
                          disabled={revoke.isPending}
                          onClick={() => {
                            if (window.confirm(`Revoke license ${license.license_key}?`)) revoke.mutate(license.id);
                          }}
                        >
                          Revoke
                        </PillButton>
                      ) : <span className="text-xs text-muted-foreground">No action</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>Showing {page * 50 + 1}–{Math.min((page + 1) * 50, licenses.data?.total ?? 0)} of {licenses.data?.total ?? 0}</span>
            <div className="flex gap-2">
              <PillButton variant="ghost" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</PillButton>
              <PillButton variant="ghost" disabled={(page + 1) * 50 >= (licenses.data?.total ?? 0)} onClick={() => setPage((value) => value + 1)}>Next</PillButton>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export function DownloadsLive() {
  const { t } = useTranslation();
  return (
    <LiveModule
      eyebrow="Download Center" title={t("manager.module.downloads")}
      description="What buyers can download, and what has been taken."
      Icon={Download}
      tabs={[
        { label: "Files", resource: "downloads" },
        { label: "Mirrors", absent: "There is no mirror table on this platform; files are served from one place." },
        { label: "Integrity", absent: "No checksum is recorded against a download yet." },
      ]}
      counters={[
        { label: "Files", resource: "downloads" },
        { label: "Mirrors", absent: "No mirror table." },
        { label: "Failed", absent: "Download failures are not recorded." },
        { label: "Integrity OK", absent: "No checksums are held." },
      ]}
      footnote={ENDPOINT}
    />
  );
}

export function AuthorsLive() {
  const { t } = useTranslation();
  return (
    <LiveModule
      eyebrow="Author Network" title={t("manager.module.authors")}
      description="Everyone who publishes on the marketplace, and where they stand."
      Icon={PenTool}
      tabs={[
        { label: "All", resource: "authors" },
        { label: "Verified", resource: "authors", filter: { status: "approved" } },
        { label: "Products", resource: "products" },
        { label: "Earnings", resource: "partner_commissions", filter: { partner_kind: "author" } },
        { label: "Payouts", resource: "partner_payouts", filter: { partner_kind: "author" } },
      ]}
      counters={[
        { label: "Authors", resource: "authors" },
        { label: "Verified", resource: "authors", filter: { status: "approved" }, tone: "success" },
        { label: "Products", resource: "products" },
        { label: "Payouts", resource: "partner_payouts", filter: { partner_kind: "author" } },
      ]}
      footnote={ENDPOINT}
    />
  );
}

export function VendorsLive() {
  const { t } = useTranslation();
  return (
    <LiveModule
      eyebrow="Vendor Network" title={t("manager.module.vendors")}
      description="Vendors and authors share one seller record."
      Icon={Store}
      tabs={[
        { label: "All", resource: "vendors" },
        { label: "Verified", resource: "vendors", filter: { verified: "true" } },
        { label: "Commission", resource: "partner_commissions", filter: { partner_kind: "vendor" } },
        { label: "Payouts", resource: "partner_payouts", filter: { partner_kind: "vendor" } },
      ]}
      counters={[
        { label: "Vendors", resource: "vendors" },
        { label: "Verified", resource: "vendors", filter: { verified: "true" }, tone: "success" },
        { label: "Commission", resource: "partner_commissions", filter: { partner_kind: "vendor" } },
        { label: "Payouts", resource: "partner_payouts", filter: { partner_kind: "vendor" } },
      ]}
      footnote={ENDPOINT}
    />
  );
}

export function ResellersLive() {
  const { t } = useTranslation();
  return (
    <LiveModule
      eyebrow="Reseller Network" title={t("manager.module.resellers")}
      description="Every partner in the channel, what they are owed and what they have been paid."
      Icon={Handshake}
      tabs={[
        { label: "All", resource: "resellers" },
        { label: "Active", resource: "resellers", filter: { status: "active" } },
        { label: "Commission", resource: "reseller_commissions" },
        { label: "Payouts", resource: "reseller_payouts" },
      ]}
      counters={[
        { label: "Resellers", resource: "resellers" },
        { label: "Active", resource: "resellers", filter: { status: "active" }, tone: "success" },
        { label: "Commission", resource: "reseller_commissions" },
        { label: "Payouts", resource: "reseller_payouts" },
      ]}
      footnote={ENDPOINT}
    />
  );
}

export function AffiliateLive() {
  const { t } = useTranslation();
  return (
    <LiveModule
      eyebrow="Affiliate Program" title={t("manager.module.affiliate")}
      description="Partners, the links they share and what those links brought in."
      Icon={Link2}
      tabs={[
        { label: "Partners", resource: "affiliate" },
        { label: "Clicks", resource: "affiliate_clicks" },
        { label: "Commission", resource: "partner_commissions", filter: { partner_kind: "affiliate" } },
        { label: "Payouts", resource: "partner_payouts", filter: { partner_kind: "affiliate" } },
        { label: "QR", resource: "qr_system" },
      ]}
      counters={[
        { label: "Affiliates", resource: "affiliate" },
        { label: "Clicks", resource: "affiliate_clicks" },
        { label: "Commission", resource: "partner_commissions", filter: { partner_kind: "affiliate" } },
        { label: "Payouts", resource: "partner_payouts", filter: { partner_kind: "affiliate" } },
      ]}
      footnote={ENDPOINT}
    />
  );
}

export function InfluencerLive() {
  const { t } = useTranslation();
  return (
    <LiveModule
      eyebrow="Creator & Influencer" title={t("manager.module.influencer")}
      description="Creators, and the work they have been given."
      Icon={Users}
      tabs={[
        { label: "Creators", resource: "influencer" },
        { label: "Approved", resource: "influencer", filter: { status: "active" } },
      ]}
      counters={[
        { label: "Creators", resource: "influencer" },
        { label: "Approved", resource: "influencer", filter: { status: "active" }, tone: "success" },
        { label: "Campaigns", absent: "There is no campaigns table on this platform yet." },
        { label: "Payouts", absent: "Creator payouts are held in the Influencer Manager, not here." },
      ]}
      footnote={ENDPOINT}
    />
  );
}

export function QrLive() {
  const { t } = useTranslation();
  return (
    <LiveModule
      eyebrow="QR System" title={t("manager.module.qr_system")}
      description="Every code the platform has issued."
      Icon={QrCode}
      tabs={[
        { label: "All", resource: "qr_system" },
        { label: "Scans", resource: "qr_events" },
      ]}
      counters={[
        { label: "QR Codes", resource: "qr_system" },
        { label: "Scans", resource: "qr_events" },
        { label: "Protected", absent: "No protection flag is held against a code." },
        { label: "Expired", absent: "No expiry is held against a code." },
      ]}
      footnote={ENDPOINT}
    />
  );
}

export function ReportsLive() {
  const { t } = useTranslation();
  return (
    <LiveModule
      eyebrow="Reports Center" title={t("manager.module.reports")}
      description="Scheduled exports and the analyses they carry."
      Icon={BarChart3}
      tabs={[{ label: "All", resource: "reports" }]}
      counters={[
        { label: "Reports", resource: "reports" },
        { label: "Scheduled", resource: "reports", filter: { status: "scheduled" }, tone: "warning" },
        { label: "Alerts", absent: "Report alerts are not recorded separately." },
        { label: "Recipients", absent: "Recipients are held on the report itself rather than counted." },
      ]}
      footnote={ENDPOINT}
    />
  );
}
