import {
  BarChart3, Download, Image as ImageIcon, KeyRound, MonitorPlay, Newspaper,
  PenTool, QrCode, Store, Users, Link2, Handshake,
} from "lucide-react";

import { LiveModule } from "./LiveModule";

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
  return (
    <LiveModule
      eyebrow="Product Media" title="Product Media"
      description="Thumbnails, gallery, video and downloadable files."
      Icon={ImageIcon}
      tabs={[
        { label: "Thumbnails", resource: "media_library" },
        { label: "Gallery", resource: "media_library" },
        { label: "Video", resource: "vala_tv_videos" },
        { label: "Files", resource: "downloads" },
      ]}
      counters={[
        { label: "Assets", resource: "media_library" },
        { label: "Video", resource: "vala_tv_videos" },
        { label: "Files", resource: "downloads" },
        { label: "Missing Alt", absent: "Alt text is not recorded against an asset on this platform." },
      ]}
      footnote={ENDPOINT}
    />
  );
}

export function DemoSystemLive() {
  return (
    <LiveModule
      eyebrow="Demo System" title="Demo System"
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
  return (
    <LiveModule
      eyebrow="Blog & Content" title="Blog"
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
  return (
    <LiveModule
      eyebrow="Licensing" title="License"
      description="Every licence the platform has issued, and whether it still works."
      Icon={KeyRound}
      tabs={[
        { label: "Keys", resource: "licences" },
        { label: "Active", resource: "licences", filter: { status: "active" } },
        { label: "Revoked", resource: "licences", filter: { status: "revoked" } },
      ]}
      counters={[
        { label: "Licences", resource: "licences" },
        { label: "Active", resource: "licences", filter: { status: "active" }, tone: "success" },
        { label: "Revoked", resource: "licences", filter: { status: "revoked" }, tone: "warning" },
        { label: "Entitlements", absent: "Entitlements are granted by the purchase, not managed here." },
      ]}
      footnote={ENDPOINT}
    />
  );
}

export function DownloadsLive() {
  return (
    <LiveModule
      eyebrow="Download Center" title="Downloads"
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
  return (
    <LiveModule
      eyebrow="Author Network" title="Authors"
      description="Everyone who publishes on the marketplace, and where they stand."
      Icon={PenTool}
      tabs={[
        { label: "All", resource: "authors" },
        { label: "Verified", resource: "authors", filter: { status: "verified" } },
        { label: "Products", resource: "products" },
        { label: "Earnings", resource: "partner_commissions" },
        { label: "Payouts", resource: "partner_payouts" },
      ]}
      counters={[
        { label: "Authors", resource: "authors" },
        { label: "Verified", resource: "authors", filter: { status: "verified" }, tone: "success" },
        { label: "Products", resource: "products" },
        { label: "Payouts", resource: "partner_payouts" },
      ]}
      footnote={ENDPOINT}
    />
  );
}

export function VendorsLive() {
  return (
    <LiveModule
      eyebrow="Vendor Network" title="Vendors"
      description="Vendors and authors share one seller record."
      Icon={Store}
      tabs={[
        { label: "All", resource: "vendors" },
        { label: "Verified", resource: "vendors", filter: { status: "verified" } },
        { label: "Commission", resource: "partner_commissions" },
        { label: "Payouts", resource: "partner_payouts" },
      ]}
      counters={[
        { label: "Vendors", resource: "vendors" },
        { label: "Verified", resource: "vendors", filter: { status: "verified" }, tone: "success" },
        { label: "Commission", resource: "partner_commissions" },
        { label: "Payouts", resource: "partner_payouts" },
      ]}
      footnote={ENDPOINT}
    />
  );
}

export function ResellersLive() {
  return (
    <LiveModule
      eyebrow="Reseller Network" title="Resellers"
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
  return (
    <LiveModule
      eyebrow="Affiliate Program" title="Affiliate"
      description="Partners, the links they share and what those links brought in."
      Icon={Link2}
      tabs={[
        { label: "Partners", resource: "affiliate" },
        { label: "Clicks", resource: "affiliate_clicks" },
        { label: "Commission", resource: "partner_commissions" },
        { label: "Payouts", resource: "partner_payouts" },
        { label: "QR", resource: "qr_system" },
      ]}
      counters={[
        { label: "Affiliates", resource: "affiliate" },
        { label: "Clicks", resource: "affiliate_clicks" },
        { label: "Commission", resource: "partner_commissions" },
        { label: "Payouts", resource: "partner_payouts" },
      ]}
      footnote={ENDPOINT}
    />
  );
}

export function InfluencerLive() {
  return (
    <LiveModule
      eyebrow="Creator & Influencer" title="Influencer"
      description="Creators, and the work they have been given."
      Icon={Users}
      tabs={[
        { label: "Creators", resource: "influencer" },
        { label: "Approved", resource: "influencer", filter: { status: "approved" } },
      ]}
      counters={[
        { label: "Creators", resource: "influencer" },
        { label: "Approved", resource: "influencer", filter: { status: "approved" }, tone: "success" },
        { label: "Campaigns", absent: "There is no campaigns table on this platform yet." },
        { label: "Payouts", absent: "Creator payouts are held in the Influencer Manager, not here." },
      ]}
      footnote={ENDPOINT}
    />
  );
}

export function QrLive() {
  return (
    <LiveModule
      eyebrow="QR System" title="QR System"
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
  return (
    <LiveModule
      eyebrow="Reports Center" title="Reports"
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
