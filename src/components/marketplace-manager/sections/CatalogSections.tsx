import { useState, type ComponentType } from "react";
import {
  Package, FileText, Image as ImageIcon, MonitorPlay, Newspaper, DollarSign, KeyRound,
  Download, Users, ShoppingBag, PenTool, Store, Handshake, Link2, Megaphone,
  QrCode, LifeBuoy, FolderOpen, Cpu, BarChart3, Mail, Zap, ShieldCheck, Server,
  Plug, Bookmark, CheckCircle2, Plus,
} from "lucide-react";
import { Card, EmptyHint, PageHeader, PillButton, StatCard, SubNav } from "../ui";
import { TableToolbar, RowActions, BulkActionBar } from "../actions";

// ---------- Reusable module scaffold ----------
type Stat = { label: string; value?: string; tone?: "default" | "success" | "warning" | "premium" | "destructive" };
type Feat = { label: string; hint?: string };

function ModulePage({
  eyebrow, title, description, Icon, tabs, stats, features, count,
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
  const [active, setActive] = useState(tabs[0]);
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <>
            <PillButton variant="ghost">Export</PillButton>
            <PillButton variant="primary">
              <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> New</span>
            </PillButton>
          </>
        }
      />
      <SubNav items={tabs} active={active} onChange={setActive} />

      <TableToolbar title={title ?? ""} count={count ?? features.length} extraActions={["publish"]} />
      <BulkActionBar selectedCount={0} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value ?? "—"} tone={s.tone ?? "default"} />
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
                {f.hint && (
                  <div className="mt-1 text-[11px] text-muted-foreground">{f.hint}</div>
                )}
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
  return (
    <ModulePage
      eyebrow="Product Content" title="Product Content"
      description="Rich content blocks: overview, specs, docs, FAQs, roadmap, cross-sell, bundles."
      Icon={FileText}
      tabs={["Overview", "Descriptions", "Specs", "Docs", "Support", "Related"]}
      stats={[{ label: "Blocks" }, { label: "AI Drafts" }, { label: "Complete", tone: "success" }, { label: "Missing", tone: "warning" }]}
      features={[
        { label: "Overview" }, { label: "Short Description" }, { label: "Long Description" },
        { label: "Features" }, { label: "Benefits" }, { label: "Specifications" },
        { label: "Requirements" }, { label: "Installation Guide" }, { label: "Documentation" },
        { label: "Release Notes" }, { label: "Roadmap" }, { label: "FAQs" },
        { label: "Known Issues" }, { label: "Support Info" }, { label: "License Details" },
        { label: "Compatibility" }, { label: "Dependencies" }, { label: "Alternative Products" },
        { label: "Related Products" }, { label: "Cross Sell" }, { label: "Upsell" },
        { label: "Frequently Bought Together" }, { label: "Bundles" },
      ]}
    />
  );
}

export function ProductMediaSection() {
  return (
    <ModulePage
      eyebrow="Product Media" title="Product Media"
      description="All thumbnails, galleries, videos, and downloadable asset files with CDN control."
      Icon={ImageIcon}
      tabs={["Thumbnails", "Gallery", "Video", "Files"]}
      stats={[{ label: "Assets" }, { label: "Video", tone: "premium" }, { label: "Missing Alt", tone: "warning" }, { label: "CDN Hits", tone: "success" }]}
      features={[
        { label: "Thumbnail" }, { label: "3D Thumbnail" }, { label: "Gallery" },
        { label: "Screenshots" }, { label: "Hero Image" }, { label: "Banner" },
        { label: "Logo" }, { label: "Icons" }, { label: "Video" },
        { label: "YouTube URL" }, { label: "Vimeo URL" }, { label: "Preview Images" },
        { label: "Preview Video" }, { label: "Demo GIF" }, { label: "PDF" },
        { label: "ZIP" }, { label: "APK" }, { label: "EXE" },
        { label: "Source Code" }, { label: "Documentation Files" },
      ]}
    />
  );
}

export function DemoSection() {
  return (
    <ModulePage
      eyebrow="Demo System" title="Demo System"
      description="Live/sandbox demos, credentials, one-click login, auto-reset and expiry control."
      Icon={MonitorPlay}
      tabs={["All Demos", "Live", "Sandbox", "Mobile", "Offline"]}
      stats={[{ label: "Active Demos" }, { label: "Auto-Reset", tone: "success" }, { label: "Expiring", tone: "warning" }, { label: "Uptime", tone: "premium" }]}
      features={[
        { label: "Live Demo URL" }, { label: "Frontend Demo URL" }, { label: "Backend Demo URL" },
        { label: "Admin Demo URL" }, { label: "Customer Demo URL" }, { label: "Vendor Demo URL" },
        { label: "Author Demo URL" }, { label: "Mobile Demo" }, { label: "APK Demo" },
        { label: "Desktop Demo" }, { label: "Offline Demo" }, { label: "Sandbox Demo" },
        { label: "Demo Reset" }, { label: "Auto Demo Reset" }, { label: "Demo Credentials" },
        { label: "One-Click Login" }, { label: "Demo Expiry" }, { label: "Demo Status" },
      ]}
    />
  );
}

export function BlogSection() {
  return (
    <ModulePage
      eyebrow="Blog & Content" title="Blog"
      description="Editorial engine with AI writer, scheduling, categories, tags and related products."
      Icon={Newspaper}
      tabs={["Posts", "Categories", "Tags", "Authors", "AI Writer"]}
      stats={[{ label: "Posts" }, { label: "Scheduled", tone: "warning" }, { label: "Published", tone: "success" }, { label: "AI Drafts", tone: "premium" }]}
      features={[
        { label: "Blog" }, { label: "Blog Categories" }, { label: "Blog Tags" },
        { label: "Blog Authors" }, { label: "Related Products" }, { label: "Related Blogs" },
        { label: "Featured Blog" }, { label: "Reading Time" }, { label: "Table of Contents" },
        { label: "Comments" }, { label: "Newsletter" }, { label: "AI Blog Writer" },
        { label: "AI Featured Image" }, { label: "Scheduled Publishing" },
      ]}
    />
  );
}

export function PricingSection() {
  return (
    <ModulePage
      eyebrow="Pricing & Plans" title="Pricing"
      description="Free/paid tiers, subscriptions, trials, regional pricing, tax and coupons."
      Icon={DollarSign}
      tabs={["Plans", "Trials", "Coupons", "Tax", "Currency"]}
      stats={[{ label: "Active Plans" }, { label: "Trials", tone: "warning" }, { label: "Discounts", tone: "success" }, { label: "Currencies", tone: "premium" }]}
      features={[
        { label: "Free" }, { label: "Paid" }, { label: "Monthly" }, { label: "Yearly" },
        { label: "Lifetime" }, { label: "Custom Pricing" }, { label: "Trial" },
        { label: "Discount" }, { label: "Coupons" }, { label: "Offers" },
        { label: "Tax" }, { label: "Currency" }, { label: "Regional Pricing" },
      ]}
    />
  );
}

export function LicenseSection() {
  return (
    <ModulePage
      eyebrow="Licensing" title="License"
      description="Keys, activation limits, offline/online verification, renewals and audit logs."
      Icon={KeyRound}
      tabs={["Keys", "Activations", "Expiry", "Logs"]}
      stats={[{ label: "Active Keys" }, { label: "Expiring", tone: "warning" }, { label: "Renewed", tone: "success" }, { label: "Verified", tone: "premium" }]}
      features={[
        { label: "License Keys" }, { label: "Activation" }, { label: "Deactivation" },
        { label: "Device Limit" }, { label: "Offline License" }, { label: "Online License" },
        { label: "License Logs" }, { label: "Expiry" }, { label: "Renewal" },
        { label: "License Verification" },
      ]}
    />
  );
}

export function DownloadsSection() {
  return (
    <ModulePage
      eyebrow="Download Center" title="Downloads"
      description="Secure downloads, mirrors, integrity hashes and per-version analytics."
      Icon={Download}
      tabs={["Files", "Mirrors", "Analytics", "Integrity"]}
      stats={[{ label: "Downloads" }, { label: "Mirrors", tone: "premium" }, { label: "Failed", tone: "destructive" }, { label: "Integrity OK", tone: "success" }]}
      features={[
        { label: "Download Manager" }, { label: "Download Analytics" }, { label: "Secure Download" },
        { label: "Download Mirrors" }, { label: "Version Downloads" }, { label: "File Integrity" },
        { label: "Checksum" },
      ]}
    />
  );
}

export function CustomersSection() {
  return (
    <ModulePage
      eyebrow="Customers" title="Customers"
      description="Profiles, wishlists, orders, tickets and lifetime activity timeline."
      Icon={Users}
      tabs={["All", "Active", "VIP", "Wishlist", "Tickets"]}
      stats={[{ label: "Customers" }, { label: "Active", tone: "success" }, { label: "VIP", tone: "premium" }, { label: "Open Tickets", tone: "warning" }]}
      features={[
        { label: "Customers" }, { label: "Customer Profile" }, { label: "Wishlist" },
        { label: "Orders" }, { label: "Downloads" }, { label: "Subscriptions" },
        { label: "Reviews" }, { label: "Support Tickets" }, { label: "Purchase History" },
        { label: "Activity Timeline" },
      ]}
    />
  );
}

export function OrdersSection() {
  return (
    <ModulePage
      eyebrow="Orders & Payments" title="Orders"
      description="Invoices, payments, refunds, returns and status timeline."
      Icon={ShoppingBag}
      tabs={["All Orders", "Invoices", "Payments", "Refunds", "Returns"]}
      stats={[{ label: "Orders" }, { label: "Paid", tone: "success" }, { label: "Refunded", tone: "warning" }, { label: "Disputes", tone: "destructive" }]}
      features={[
        { label: "Orders" }, { label: "Invoices" }, { label: "Payments" },
        { label: "Refunds" }, { label: "Returns" }, { label: "Order Timeline" },
        { label: "Payment Status" },
      ]}
    />
  );
}

export function AuthorsSection() {
  return (
    <ModulePage
      eyebrow="Author Network" title="Authors"
      description="Author verification, catalog, earnings and payout control."
      Icon={PenTool}
      tabs={["All", "Verified", "Payouts", "Analytics"]}
      stats={[{ label: "Authors" }, { label: "Verified", tone: "success" }, { label: "Earnings", tone: "premium" }, { label: "Payouts", tone: "warning" }]}
      features={[
        { label: "Author Dashboard" }, { label: "Author Verification" }, { label: "Author Products" },
        { label: "Author Earnings" }, { label: "Author Analytics" }, { label: "Author Payouts" },
      ]}
    />
  );
}

export function VendorsSection() {
  return (
    <ModulePage
      eyebrow="Vendor Network" title="Vendors"
      description="Vendor onboarding, commission tiers, product catalog and payout schedules."
      Icon={Store}
      tabs={["All", "Verified", "Commission", "Payouts", "Analytics"]}
      stats={[{ label: "Vendors" }, { label: "Verified", tone: "success" }, { label: "Commission", tone: "premium" }, { label: "Payouts", tone: "warning" }]}
      features={[
        { label: "Vendor Dashboard" }, { label: "Vendor Verification" }, { label: "Vendor Products" },
        { label: "Vendor Earnings" }, { label: "Vendor Analytics" }, { label: "Vendor Commission" },
        { label: "Vendor Payout" },
      ]}
    />
  );
}

export function ResellersSection() {
  return (
    <ModulePage
      eyebrow="Reseller Network" title="Resellers"
      description="Reseller programs, commission, referral tracking and performance."
      Icon={Handshake}
      tabs={["All", "Active", "Commission", "Payouts"]}
      stats={[{ label: "Resellers" }, { label: "Active", tone: "success" }, { label: "Commission", tone: "premium" }, { label: "Payouts", tone: "warning" }]}
      features={[
        { label: "Reseller Dashboard" }, { label: "Reseller Products" }, { label: "Commission" },
        { label: "Referral" }, { label: "Payout" }, { label: "Performance" },
      ]}
    />
  );
}

export function AffiliateSection() {
  return (
    <ModulePage
      eyebrow="Affiliate Program" title="Affiliate"
      description="Referral links, smart URLs, QR codes, UTM builder and payouts."
      Icon={Link2}
      tabs={["Links", "Codes", "QR", "UTM", "Payouts"]}
      stats={[{ label: "Affiliates" }, { label: "Clicks", tone: "premium" }, { label: "Conversions", tone: "success" }, { label: "Payouts", tone: "warning" }]}
      features={[
        { label: "Affiliate Dashboard" }, { label: "Referral Links" }, { label: "Referral Codes" },
        { label: "Short URL" }, { label: "Smart URL" }, { label: "Dynamic URL" },
        { label: "Deep Links" }, { label: "QR Code" }, { label: "Coupon Codes" },
        { label: "UTM Builder" }, { label: "Commission" }, { label: "Clicks" },
        { label: "Conversions" }, { label: "Payments" },
      ]}
    />
  );
}

export function InfluencerSection() {
  return (
    <ModulePage
      eyebrow="Creator & Influencer" title="Influencer"
      description="Creator profiles, bio links, social share kits, campaigns and payouts."
      Icon={Megaphone}
      tabs={["Creators", "Campaigns", "Bio Links", "Social", "Payouts"]}
      stats={[{ label: "Creators" }, { label: "Campaigns", tone: "premium" }, { label: "Reach", tone: "success" }, { label: "Payouts", tone: "warning" }]}
      features={[
        { label: "Influencer Dashboard" }, { label: "Creator Profile" }, { label: "Bio Link" },
        { label: "Referral Link" }, { label: "Short URL" }, { label: "QR Generator" },
        { label: "Campaign Manager" }, { label: "Social Links" }, { label: "Instagram Share" },
        { label: "Facebook Share" }, { label: "WhatsApp Share" }, { label: "Telegram Share" },
        { label: "LinkedIn Share" }, { label: "X Share" }, { label: "Pinterest Share" },
        { label: "Email Share" }, { label: "Commission" }, { label: "Analytics" },
        { label: "Payouts" },
      ]}
    />
  );
}

export function QrSection() {
  return (
    <ModulePage
      eyebrow="QR System" title="QR System"
      description="Dynamic and static QR codes for products, demos, downloads, events and campaigns."
      Icon={QrCode}
      tabs={["All", "Dynamic", "Static", "Analytics"]}
      stats={[{ label: "QR Codes" }, { label: "Scans", tone: "success" }, { label: "Protected", tone: "premium" }, { label: "Expired", tone: "warning" }]}
      features={[
        { label: "Dynamic QR" }, { label: "Static QR" }, { label: "Product QR" },
        { label: "Demo QR" }, { label: "Download QR" }, { label: "Profile QR" },
        { label: "Event QR" }, { label: "Campaign QR" }, { label: "Analytics" },
        { label: "Password Protection" },
      ]}
    />
  );
}

export function SupportSection() {
  return (
    <ModulePage
      eyebrow="Support Desk" title="Support"
      description="Tickets, live chat, knowledge base, documentation and announcements."
      Icon={LifeBuoy}
      tabs={["Tickets", "Live Chat", "Knowledge Base", "Docs", "FAQs"]}
      stats={[{ label: "Tickets" }, { label: "Open", tone: "warning" }, { label: "Resolved", tone: "success" }, { label: "CSAT", tone: "premium" }]}
      features={[
        { label: "Support Tickets" }, { label: "Live Chat" }, { label: "Knowledge Base" },
        { label: "Documentation" }, { label: "FAQs" }, { label: "Announcements" },
      ]}
    />
  );
}

export function MediaLibrarySection() {
  return (
    <ModulePage
      eyebrow="Media Library" title="Media"
      description="Central asset store: images, icons, videos, documents, ZIPs and PDFs."
      Icon={FolderOpen}
      tabs={["All", "Images", "Videos", "Documents", "Assets"]}
      stats={[{ label: "Assets" }, { label: "Images", tone: "premium" }, { label: "Videos", tone: "success" }, { label: "Storage", tone: "warning" }]}
      features={[
        { label: "Media Library" }, { label: "Images" }, { label: "Icons" },
        { label: "Videos" }, { label: "Documents" }, { label: "ZIP" },
        { label: "PDF" }, { label: "Assets" },
      ]}
    />
  );
}

export function AiProvidersSection() {
  return (
    <ModulePage
      eyebrow="AI Providers & Generators" title="AI Providers"
      description="Connect providers and orchestrate generators: product, thumbnail, banner, SEO, docs."
      Icon={Cpu}
      tabs={["Providers", "Generators", "Prompts", "Usage"]}
      stats={[{ label: "Providers" }, { label: "Connected", tone: "success" }, { label: "Tokens", tone: "premium" }, { label: "Errors", tone: "destructive" }]}
      features={[
        { label: "OpenAI" }, { label: "Gemini" }, { label: "Claude" }, { label: "Grok" },
        { label: "DeepSeek" }, { label: "Mistral" }, { label: "OpenRouter" }, { label: "Ollama" },
        { label: "HuggingFace" }, { label: "Replicate" }, { label: "Fal.ai" },
        { label: "Cloudflare AI" }, { label: "Vertex AI" }, { label: "AWS Bedrock" }, { label: "Azure AI" },
        { label: "AI Product Generator" }, { label: "AI Thumbnail Generator" }, { label: "AI Banner Generator" },
        { label: "AI Gallery Generator" }, { label: "AI Description" }, { label: "AI Features" },
        { label: "AI FAQs" }, { label: "AI SEO" }, { label: "AI Blogs" },
        { label: "AI Documentation" }, { label: "AI Changelog" }, { label: "AI Release Notes" },
        { label: "AI Tags" }, { label: "AI Translation" },
      ]}
    />
  );
}

export function ApiSection() {
  return (
    <ModulePage
      eyebrow="Developer API" title="API"
      description="REST, GraphQL, webhooks, OAuth/JWT, rate limits and analytics."
      Icon={Plug}
      tabs={["REST", "GraphQL", "Webhooks", "Auth", "Logs"]}
      stats={[{ label: "Endpoints" }, { label: "Keys", tone: "premium" }, { label: "Rate Limits", tone: "warning" }, { label: "Errors", tone: "destructive" }]}
      features={[
        { label: "REST API" }, { label: "GraphQL" }, { label: "Webhooks" },
        { label: "OAuth" }, { label: "JWT" }, { label: "API Keys" },
        { label: "API Logs" }, { label: "Rate Limiting" }, { label: "API Analytics" },
      ]}
    />
  );
}

export function ReportsSection() {
  return (
    <ModulePage
      eyebrow="Reports Center" title="Reports"
      description="Sales, revenue, downloads, customers, vendors, authors and SEO reports."
      Icon={BarChart3}
      tabs={["Sales", "Revenue", "Downloads", "SEO", "Marketplace"]}
      stats={[{ label: "Reports" }, { label: "Scheduled", tone: "premium" }, { label: "This Month", tone: "success" }, { label: "Alerts", tone: "warning" }]}
      features={[
        { label: "Sales Reports" }, { label: "Revenue Reports" }, { label: "Download Reports" },
        { label: "Customer Reports" }, { label: "Vendor Reports" }, { label: "Author Reports" },
        { label: "SEO Reports" }, { label: "Marketplace Reports" },
      ]}
    />
  );
}

export function MarketingSection() {
  return (
    <ModulePage
      eyebrow="Marketing Suite" title="Marketing"
      description="Email, SMS, push, WhatsApp, Telegram, Discord, campaigns and loyalty."
      Icon={Mail}
      tabs={["Campaigns", "Email", "Messaging", "Social", "Loyalty"]}
      stats={[{ label: "Campaigns" }, { label: "Open Rate", tone: "success" }, { label: "CTR", tone: "premium" }, { label: "Unsub", tone: "warning" }]}
      features={[
        { label: "Email Marketing" }, { label: "SMS" }, { label: "Push Notifications" },
        { label: "WhatsApp" }, { label: "Telegram" }, { label: "Discord" },
        { label: "Social Sharing" }, { label: "Newsletter" }, { label: "Campaigns" },
        { label: "Coupons" }, { label: "Gift Cards" }, { label: "Loyalty Program" },
      ]}
    />
  );
}

export function AutomationSection() {
  return (
    <ModulePage
      eyebrow="Automation Engine" title="Automation"
      description="Scheduled tasks, auto-SEO, auto-blog, auto-thumbnail, auto-translation and more."
      Icon={Zap}
      tabs={["Tasks", "AI Auto", "Backups", "Schedules"]}
      stats={[{ label: "Tasks" }, { label: "Running", tone: "success" }, { label: "Queued", tone: "warning" }, { label: "Failed", tone: "destructive" }]}
      features={[
        { label: "Scheduled Tasks" }, { label: "Auto SEO" }, { label: "Auto Blog" },
        { label: "Auto Tags" }, { label: "Auto Thumbnail" }, { label: "Auto Gallery" },
        { label: "Auto Translation" }, { label: "Auto Documentation" }, { label: "Auto Reports" },
        { label: "Auto Backup" },
      ]}
    />
  );
}

export function SecuritySection() {
  return (
    <ModulePage
      eyebrow="Security & Access" title="Security"
      description="Roles, permissions, audit logs, sessions, 2FA and IP allowlists."
      Icon={ShieldCheck}
      tabs={["Roles", "Audit", "Sessions", "2FA", "Access"]}
      stats={[{ label: "Roles" }, { label: "Sessions", tone: "premium" }, { label: "2FA", tone: "success" }, { label: "Blocked", tone: "destructive" }]}
      features={[
        { label: "Roles" }, { label: "Permissions" }, { label: "Audit Logs" },
        { label: "Activity Logs" }, { label: "Session Management" }, { label: "Login History" },
        { label: "Access Control" }, { label: "IP Whitelist" }, { label: "Two Factor Authentication" },
      ]}
    />
  );
}

export function SystemSection() {
  return (
    <ModulePage
      eyebrow="System Health" title="System"
      description="Backups, cache, queues, logs, storage, performance and health monitoring."
      Icon={Server}
      tabs={["Health", "Backup", "Cache", "Queues", "Logs"]}
      stats={[{ label: "Uptime", tone: "success" }, { label: "Queues", tone: "premium" }, { label: "Storage", tone: "warning" }, { label: "Errors", tone: "destructive" }]}
      features={[
        { label: "Backup" }, { label: "Restore" }, { label: "Cache" },
        { label: "Queues" }, { label: "Logs" }, { label: "Server Status" },
        { label: "Storage Usage" }, { label: "Performance Monitor" }, { label: "Health Monitor" },
      ]}
    />
  );
}

export function IntegrationsSection() {
  return (
    <ModulePage
      eyebrow="Integrations Hub" title="Integrations"
      description="Analytics, pixels, payments and finance connectors — connect once, use everywhere."
      Icon={Plug}
      tabs={["Analytics", "Pixels", "Payments", "Finance"]}
      stats={[{ label: "Connectors" }, { label: "Connected", tone: "success" }, { label: "Failing", tone: "destructive" }, { label: "Events", tone: "premium" }]}
      features={[
        { label: "Google Analytics" }, { label: "Google Search Console" }, { label: "Microsoft Clarity" },
        { label: "Meta Pixel" }, { label: "TikTok Pixel" }, { label: "LinkedIn Insight" },
        { label: "Stripe" }, { label: "PayPal" }, { label: "Razorpay" },
        { label: "Flutterwave" }, { label: "Paystack" }, { label: "Wise" },
        { label: "Coinbase Commerce" },
      ]}
    />
  );
}

export function ExtraSection() {
  return (
    <ModulePage
      eyebrow="Extra Capabilities" title="Extra"
      description="Follows, comparisons, roadmap, notes, trash, multi-* controls and insights."
      Icon={Bookmark}
      tabs={["Follows", "Insights", "Multi-*", "Notes", "Trash"]}
      stats={[{ label: "Follows" }, { label: "Compared", tone: "premium" }, { label: "Trashed", tone: "warning" }, { label: "Restored", tone: "success" }]}
      features={[
        { label: "Recently Viewed" }, { label: "Saved Searches" }, { label: "Price Alerts" },
        { label: "Follow Product" }, { label: "Follow Vendor" }, { label: "Follow Author" },
        { label: "Product Comparison" }, { label: "Roadmap" }, { label: "Idea Board" },
        { label: "Internal Notes" }, { label: "Founder Notes" }, { label: "Activity Timeline" },
        { label: "Trash Bin" }, { label: "Archive" }, { label: "Multi Language" },
        { label: "Multi Currency" }, { label: "Multi Country" }, { label: "Multi Branch" },
        { label: "Multi Vendor" }, { label: "Multi Author" }, { label: "Marketplace Statistics" },
        { label: "Business Insights" },
      ]}
    />
  );
}
