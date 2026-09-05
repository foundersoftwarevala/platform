import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarClock,
  FileText,
  Heart,
  Mail,
  PenLine,
  Send,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";

import { DataScreen } from "@/components/marketing/data-screen";
import { ScreenHeader, StatusBadge } from "@/components/marketing/kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { compactInr, compactNum, dateTime, num, pct, titleCase } from "@/lib/marketing/format";

export const Route = createFileRoute("/marketing/content")({
  head: () => ({
    meta: [
      { title: "Content Library — Software Vala Marketing Manager" },
      {
        name: "description",
        content:
          "Plan blogs, social posts, email templates, broadcast messages and influencer collaborations in one live content hub.",
      },
      { property: "og:title", content: "Content Library — Software Vala" },
      {
        property: "og:description",
        content: "Editorial calendar, social publishing, templates, messaging and influencers.",
      },
    ],
  }),
  component: ContentScreen,
});

const CONTENT_TYPES = [
  "blog",
  "landing_page",
  "email",
  "social_post",
  "case_study",
  "whitepaper",
  "video_script",
  "ad_copy",
] as const;
const CHANNELS = [
  "Website",
  "Blog",
  "Email",
  "Instagram",
  "LinkedIn",
  "YouTube",
  "WhatsApp",
  "SMS",
] as const;
const CONTENT_STATUS = [
  "idea",
  "draft",
  "in_review",
  "approved",
  "scheduled",
  "published",
  "archived",
] as const;
const PLATFORMS = ["Instagram", "LinkedIn", "Facebook", "X", "YouTube", "Threads"] as const;
const POST_STATUS = ["draft", "scheduled", "published", "failed", "archived"] as const;
const TEMPLATE_STATUS = ["draft", "active", "archived"] as const;
const MESSAGE_STATUS = ["draft", "scheduled", "sending", "sent", "failed"] as const;
const INFLUENCER_STATUS = ["prospect", "in_review", "active", "paused", "completed"] as const;

function ContentScreen() {
  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Content Library"
        description="Editorial pipeline, social publishing, templates, broadcast messaging and influencer partnerships."
      />
      <Tabs defaultValue="content" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="social">Social posts</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="influencers">Influencers</TabsTrigger>
        </TabsList>

        <TabsContent value="content">
          <DataScreen
            headless
            table="marketing_content_items"
            title="Content"
            description="Editorial pipeline"
            module="Content"
            entityLabel="Content item"
            order={{ column: "created_at" }}
            searchKeys={["title", "content_type", "channel", "author"]}
            filterKey="status"
            filterOptions={CONTENT_STATUS}
            minWidth={1080}
            stats={[
              { label: "Total pieces", icon: FileText, tone: "violet", value: (r) => num(r.length) },
              {
                label: "Published",
                icon: Send,
                tone: "green",
                value: (r) => num(r.filter((x) => x.status === "published").length),
              },
              {
                label: "Scheduled",
                icon: CalendarClock,
                tone: "blue",
                value: (r) => num(r.filter((x) => x.status === "scheduled").length),
              },
              {
                label: "Words written",
                icon: PenLine,
                tone: "gold",
                value: (r) => num(r.reduce((s, x) => s + Number(x.word_count ?? 0), 0)),
              },
            ]}
            columns={[
              {
                key: "title",
                header: "Title",
                render: (r) => <span className="font-medium">{r.title}</span>,
              },
              { key: "content_type", header: "Type", render: (r) => titleCase(r.content_type) },
              { key: "channel", header: "Channel", render: (r) => r.channel },
              { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
              { key: "author", header: "Author", render: (r) => r.author ?? "—" },
              { key: "word_count", header: "Words", align: "right", render: (r) => num(r.word_count) },
              {
                key: "tags",
                header: "Tags",
                render: (r) => (r.tags?.length ? r.tags.join(", ") : "—"),
              },
              { key: "scheduled_for", header: "Scheduled", render: (r) => dateTime(r.scheduled_for) },
            ]}
            fields={[
              { key: "title", label: "Title", kind: "text", required: true, full: true },
              { key: "content_type", label: "Content type", kind: "select", options: CONTENT_TYPES },
              { key: "channel", label: "Channel", kind: "select", options: CHANNELS },
              { key: "status", label: "Status", kind: "select", options: CONTENT_STATUS },
              { key: "author", label: "Author", kind: "text" },
              { key: "word_count", label: "Word count", kind: "number" },
              { key: "scheduled_for", label: "Scheduled for", kind: "datetime" },
              { key: "tags", label: "Tags", kind: "tags", full: true },
              { key: "body", label: "Body", kind: "textarea", full: true },
            ]}
          />
        </TabsContent>

        <TabsContent value="social">
          <DataScreen
            headless
            table="marketing_social_posts"
            title="Social posts"
            description="Organic social publishing"
            module="Social"
            entityLabel="Social post"
            order={{ column: "scheduled_at" }}
            searchKeys={["content", "platform", "status"]}
            filterKey="status"
            filterOptions={POST_STATUS}
            minWidth={1080}
            stats={[
              { label: "Posts", icon: Share2, tone: "violet", value: (r) => num(r.length) },
              {
                label: "Published",
                icon: Send,
                tone: "green",
                value: (r) => num(r.filter((x) => x.status === "published").length),
              },
              {
                label: "Total reach",
                icon: Users,
                tone: "blue",
                value: (r) => compactNum(r.reduce((s, x) => s + Number(x.reach ?? 0), 0)),
              },
              {
                label: "Engagements",
                icon: Heart,
                tone: "rose",
                value: (r) =>
                  compactNum(
                    r.reduce(
                      (s, x) =>
                        s + Number(x.likes ?? 0) + Number(x.comments ?? 0) + Number(x.shares ?? 0),
                      0,
                    ),
                  ),
              },
            ]}
            columns={[
              { key: "platform", header: "Platform", render: (r) => r.platform },
              {
                key: "content",
                header: "Post",
                render: (r) => <span className="line-clamp-2 max-w-md">{r.content}</span>,
              },
              { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
              { key: "scheduled_at", header: "Scheduled", render: (r) => dateTime(r.scheduled_at) },
              { key: "published_at", header: "Published", render: (r) => dateTime(r.published_at) },
              { key: "reach", header: "Reach", align: "right", render: (r) => compactNum(r.reach) },
              { key: "likes", header: "Likes", align: "right", render: (r) => num(r.likes) },
              { key: "comments", header: "Comments", align: "right", render: (r) => num(r.comments) },
              { key: "shares", header: "Shares", align: "right", render: (r) => num(r.shares) },
            ]}
            fields={[
              { key: "platform", label: "Platform", kind: "select", options: PLATFORMS },
              { key: "content", label: "Post content", kind: "textarea", required: true, full: true },
              { key: "status", label: "Status", kind: "select", options: POST_STATUS },
              { key: "scheduled_at", label: "Scheduled at", kind: "datetime" },
              { key: "published_at", label: "Published at", kind: "datetime" },
              { key: "reach", label: "Reach", kind: "number" },
              { key: "likes", label: "Likes", kind: "number" },
              { key: "comments", label: "Comments", kind: "number" },
              { key: "shares", label: "Shares", kind: "number" },
            ]}
          />
        </TabsContent>

        <TabsContent value="templates">
          <DataScreen
            headless
            table="marketing_templates"
            title="Templates"
            description="Reusable message templates"
            module="Templates"
            entityLabel="Template"
            order={{ column: "usage_count" }}
            searchKeys={["name", "channel", "category", "subject"]}
            filterKey="status"
            filterOptions={TEMPLATE_STATUS}
            minWidth={960}
            stats={[
              { label: "Templates", icon: FileText, tone: "violet", value: (r) => num(r.length) },
              {
                label: "Active",
                icon: Sparkles,
                tone: "green",
                value: (r) => num(r.filter((x) => x.status === "active").length),
              },
              {
                label: "Total uses",
                icon: Send,
                tone: "blue",
                value: (r) => num(r.reduce((s, x) => s + Number(x.usage_count ?? 0), 0)),
              },
              {
                label: "Channels",
                icon: Mail,
                tone: "gold",
                value: (r) => num(new Set(r.map((x) => x.channel)).size),
              },
            ]}
            columns={[
              { key: "name", header: "Template", render: (r) => <span className="font-medium">{r.name}</span> },
              { key: "channel", header: "Channel", render: (r) => r.channel },
              { key: "category", header: "Category", render: (r) => titleCase(r.category) },
              { key: "subject", header: "Subject", render: (r) => r.subject ?? "—" },
              { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
              { key: "usage_count", header: "Uses", align: "right", render: (r) => num(r.usage_count) },
            ]}
            fields={[
              { key: "name", label: "Template name", kind: "text", required: true },
              { key: "channel", label: "Channel", kind: "select", options: CHANNELS },
              { key: "category", label: "Category", kind: "text" },
              { key: "status", label: "Status", kind: "select", options: TEMPLATE_STATUS },
              { key: "usage_count", label: "Usage count", kind: "number" },
              { key: "subject", label: "Subject", kind: "text", full: true },
              { key: "body", label: "Body", kind: "textarea", full: true },
            ]}
          />
        </TabsContent>

        <TabsContent value="messages">
          <DataScreen
            headless
            table="marketing_messages"
            title="Messages"
            description="Broadcast sends"
            module="Messages"
            entityLabel="Message"
            order={{ column: "scheduled_at" }}
            searchKeys={["name", "channel", "status"]}
            filterKey="status"
            filterOptions={MESSAGE_STATUS}
            minWidth={1080}
            stats={[
              { label: "Sends", icon: Mail, tone: "violet", value: (r) => num(r.length) },
              {
                label: "Delivered",
                icon: Send,
                tone: "green",
                value: (r) => compactNum(r.reduce((s, x) => s + Number(x.delivered ?? 0), 0)),
              },
              {
                label: "Open rate",
                icon: Heart,
                tone: "blue",
                value: (r) => {
                  const d = r.reduce((s, x) => s + Number(x.delivered ?? 0), 0);
                  const o = r.reduce((s, x) => s + Number(x.opened ?? 0), 0);
                  return pct(d > 0 ? (o / d) * 100 : 0);
                },
              },
              {
                label: "Click rate",
                icon: Share2,
                tone: "gold",
                value: (r) => {
                  const d = r.reduce((s, x) => s + Number(x.delivered ?? 0), 0);
                  const c = r.reduce((s, x) => s + Number(x.clicked ?? 0), 0);
                  return pct(d > 0 ? (c / d) * 100 : 0);
                },
              },
            ]}
            columns={[
              { key: "name", header: "Message", render: (r) => <span className="font-medium">{r.name}</span> },
              { key: "channel", header: "Channel", render: (r) => r.channel },
              { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
              { key: "sent", header: "Sent", align: "right", render: (r) => num(r.sent) },
              { key: "delivered", header: "Delivered", align: "right", render: (r) => num(r.delivered) },
              { key: "opened", header: "Opened", align: "right", render: (r) => num(r.opened) },
              { key: "clicked", header: "Clicked", align: "right", render: (r) => num(r.clicked) },
              { key: "bounced", header: "Bounced", align: "right", render: (r) => num(r.bounced) },
              { key: "scheduled_at", header: "Scheduled", render: (r) => dateTime(r.scheduled_at) },
            ]}
            fields={[
              { key: "name", label: "Message name", kind: "text", required: true, full: true },
              { key: "channel", label: "Channel", kind: "select", options: CHANNELS },
              { key: "status", label: "Status", kind: "select", options: MESSAGE_STATUS },
              { key: "sent", label: "Sent", kind: "number" },
              { key: "delivered", label: "Delivered", kind: "number" },
              { key: "opened", label: "Opened", kind: "number" },
              { key: "clicked", label: "Clicked", kind: "number" },
              { key: "bounced", label: "Bounced", kind: "number" },
              { key: "scheduled_at", label: "Scheduled at", kind: "datetime" },
            ]}
          />
        </TabsContent>

        <TabsContent value="influencers">
          <DataScreen
            headless
            table="marketing_influencers"
            title="Influencers"
            description="Creator partnerships"
            module="Influencers"
            entityLabel="Influencer"
            order={{ column: "followers" }}
            searchKeys={["name", "handle", "platform", "category", "region"]}
            filterKey="status"
            filterOptions={INFLUENCER_STATUS}
            minWidth={1120}
            stats={[
              { label: "Creators", icon: Users, tone: "violet", value: (r) => num(r.length) },
              {
                label: "Combined reach",
                icon: Share2,
                tone: "blue",
                value: (r) => compactNum(r.reduce((s, x) => s + Number(x.followers ?? 0), 0)),
              },
              {
                label: "Avg engagement",
                icon: Heart,
                tone: "rose",
                value: (r) =>
                  pct(
                    r.length
                      ? r.reduce((s, x) => s + Number(x.engagement_rate ?? 0), 0) / r.length
                      : 0,
                    2,
                  ),
              },
              {
                label: "Avg ROI",
                icon: Sparkles,
                tone: "gold",
                value: (r) =>
                  r.length
                    ? `${(r.reduce((s, x) => s + Number(x.roi ?? 0), 0) / r.length).toFixed(2)}x`
                    : "0.00x",
              },
            ]}
            columns={[
              { key: "name", header: "Creator", render: (r) => <span className="font-medium">{r.name}</span> },
              { key: "handle", header: "Handle", render: (r) => r.handle },
              { key: "platform", header: "Platform", render: (r) => r.platform },
              {
                key: "followers",
                header: "Followers",
                align: "right",
                render: (r) => compactNum(r.followers),
              },
              {
                key: "engagement_rate",
                header: "Engagement",
                align: "right",
                render: (r) => pct(r.engagement_rate, 2),
              },
              { key: "category", header: "Category", render: (r) => r.category ?? "—" },
              { key: "region", header: "Region", render: (r) => r.region ?? "—" },
              {
                key: "campaigns_count",
                header: "Campaigns",
                align: "right",
                render: (r) => num(r.campaigns_count),
              },
              {
                key: "cost_per_post",
                header: "Cost / post",
                align: "right",
                render: (r) => compactInr(r.cost_per_post),
              },
              {
                key: "roi",
                header: "ROI",
                align: "right",
                render: (r) => `${Number(r.roi ?? 0).toFixed(2)}x`,
              },
              { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
            ]}
            fields={[
              { key: "name", label: "Creator name", kind: "text", required: true },
              { key: "handle", label: "Handle", kind: "text", required: true },
              { key: "platform", label: "Platform", kind: "select", options: PLATFORMS },
              { key: "status", label: "Status", kind: "select", options: INFLUENCER_STATUS },
              { key: "followers", label: "Followers", kind: "number" },
              { key: "engagement_rate", label: "Engagement rate %", kind: "number" },
              { key: "category", label: "Category", kind: "text" },
              { key: "region", label: "Region", kind: "text" },
              { key: "campaigns_count", label: "Campaigns", kind: "number" },
              { key: "cost_per_post", label: "Cost per post (₹)", kind: "number" },
              { key: "roi", label: "ROI (x)", kind: "number" },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
