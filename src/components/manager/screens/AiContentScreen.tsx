import { toast } from "sonner";
import {
  Sparkles,
  Copy,
  Download,
  FileText,
  Mail,
  MessageCircle,
  Image as ImageIcon,
  Video,
  Globe,
  Wand2,
} from "lucide-react";
import {
  PageHeader,
  GlassCard,
  StatCard,
  EmptyState,
  ErrorState,
  LoadingBlock,
  StatusBadge,
  formatDate,
  num,
} from "../primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { directDb, must, useDirectRead, type Row } from "@/lib/manager-queries";
import { useTranslation, type Translate } from "@/lib/i18n/use-translation";

/**
 * The AI Content Suite reads the platform's real AI content records
 * (ai_content_items, written by the marketplace content pipeline). This
 * console has no generation endpoint of its own, so every Generate control is
 * disabled with that reason instead of pretending to write.
 */

function itemText(item: Row): string {
  const content = item["content"];
  if (typeof content === "string" && content.trim()) return content;
  const json = item["content_json"];
  return json ? JSON.stringify(json, null, 2) : "";
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

async function copyItem(item: Row, t: Translate) {
  const text = itemText(item);
  try {
    await navigator.clipboard.writeText(text);
    toast.success(t("manager.console.copied"));
  } catch {
    toast.error(t("manager.console.copy_failed"));
  }
}

function downloadItem(item: Row) {
  const url = URL.createObjectURL(new Blob([itemText(item)], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${String(item["content_type"] ?? "content")}-${String(item["id"]).slice(0, 8)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AiContentScreen() {
  const { t } = useTranslation();
  const NO_GENERATOR = t("manager.console.no_generator");
  const notConnected = t("manager.console.not_connected_reason", { reason: NO_GENERATOR });
  const itemsQuery = useDirectRead(
    ["ai-content", "items"],
    async () =>
      (
        await must<Row[]>(
          directDb
            .from("ai_content_items")
            .select("id,content_type,language,status,content,content_json,created_at")
            .order("created_at", { ascending: false })
            .limit(500),
        )
      ).data ?? [],
  );
  const items = itemsQuery.data ?? [];
  const withText = items.filter((i) => itemText(i).length > 0);
  const dash = itemsQuery.isLoading ? "…" : "—";
  const loaded = !itemsQuery.isLoading && !itemsQuery.error;

  return (
    <>
      <PageHeader
        title={t("manager.console.ai_content_title")}
        description={t("manager.console.ai_content_description")}
      />

      <div className="space-y-6">
        {/* Stats Grid */}
        {itemsQuery.error ? (
          <ErrorState error={itemsQuery.error} onRetry={() => itemsQuery.refetch()} />
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t("manager.console.content_generated")}
            value={loaded ? num(withText.length) : dash}
            tone="primary"
            icon={<Sparkles className="h-4 w-4" />}
            change={
              loaded ? t("manager.console.content_records", { count: items.length }) : undefined
            }
          />
          <StatCard
            label={t("manager.console.images_created")}
            value="—"
            tone="cyan"
            icon={<ImageIcon className="h-4 w-4" />}
            change={t("manager.console.not_tracked")}
          />
          <StatCard
            label={t("manager.console.words_written")}
            value={
              loaded ? num(withText.reduce((sum, i) => sum + wordCount(itemText(i)), 0)) : dash
            }
            tone="green"
            icon={<FileText className="h-4 w-4" />}
          />
          <StatCard
            label={t("manager.console.languages")}
            value={
              loaded ? num(new Set(withText.map((i) => String(i["language"] ?? ""))).size) : dash
            }
            tone="amber"
            icon={<Globe className="h-4 w-4" />}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="blog" className="space-y-4">
          <TabsList>
            <TabsTrigger value="blog">
              <FileText className="mr-2 h-4 w-4" /> Blog Posts
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="mr-2 h-4 w-4" /> Email Templates
            </TabsTrigger>
            <TabsTrigger value="social">
              <MessageCircle className="mr-2 h-4 w-4" /> Social Posts
            </TabsTrigger>
            <TabsTrigger value="images">
              <ImageIcon className="mr-2 h-4 w-4" /> Images
            </TabsTrigger>
            <TabsTrigger value="video">
              <Video className="mr-2 h-4 w-4" /> Video Scripts
            </TabsTrigger>
            <TabsTrigger value="translate">
              <Globe className="mr-2 h-4 w-4" /> Translator
            </TabsTrigger>
          </TabsList>

          {/* Blog Posts Tab */}
          <TabsContent value="blog">
            <GlassCard title="AI Blog Post Generator">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Topic/Keyword</label>
                    <Input placeholder="e.g., API management best practices" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Tone</label>
                    <select className="w-full rounded-lg border border-input bg-background px-3 py-2">
                      <option>Professional</option>
                      <option>Casual</option>
                      <option>Technical</option>
                      <option>Humorous</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Word Count</label>
                    <Input placeholder="500-2000" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Language</label>
                    <Input placeholder="English" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">SEO Keywords</label>
                  <Input placeholder="Separate by commas" />
                </div>
                <p className="text-xs text-muted-foreground">{notConnected}</p>
                <Button className="w-full" disabled title={NO_GENERATOR}>
                  <Wand2 className="mr-2 h-4 w-4" /> Generate Blog Post
                </Button>
              </div>
            </GlassCard>

            <GlassCard title="Generated Content" className="mt-6">
              {itemsQuery.isLoading ? (
                <LoadingBlock />
              ) : itemsQuery.error ? (
                <ErrorState error={itemsQuery.error} onRetry={() => itemsQuery.refetch()} />
              ) : items.length === 0 ? (
                <EmptyState message={t("manager.console.no_ai_content")} />
              ) : (
                <div className="space-y-4">
                  {items.map((item) => {
                    const text = itemText(item);
                    return (
                      <div
                        key={String(item["id"])}
                        className="flex items-start justify-between rounded-lg border border-border p-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {String(item["content_type"] ?? "content").replace(/_/g, " ")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t("manager.console.content_meta", {
                              words: num(wordCount(text)),
                              language: String(item["language"] ?? "—"),
                              date: formatDate(item["created_at"] as string | null),
                            })}
                          </p>
                          <div className="mt-1">
                            <StatusBadge value={String(item["status"] ?? "unknown")} />
                          </div>
                        </div>
                        <div className="ml-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void copyItem(item, t)}
                            disabled={!text}
                            title={
                              text
                                ? t("manager.console.copy_content")
                                : t("manager.console.nothing_to_copy")
                            }
                            aria-label={t("manager.console.copy_content")}
                            className="text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadItem(item)}
                            disabled={!text}
                            title={
                              text
                                ? t("manager.console.download_content")
                                : t("manager.console.nothing_to_download")
                            }
                            aria-label={t("manager.console.download_content")}
                            className="text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          </TabsContent>

          {/* Email Templates Tab */}
          <TabsContent value="email">
            <GlassCard title="AI Email Generator">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Email Type</label>
                  <select className="w-full rounded-lg border border-input bg-background px-3 py-2">
                    <option>Welcome Email</option>
                    <option>Follow-up</option>
                    <option>Sales Pitch</option>
                    <option>Newsletter</option>
                    <option>Re-engagement</option>
                  </select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Recipient Type</label>
                    <Input placeholder="e.g., B2B founders" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Tone</label>
                    <select className="w-full rounded-lg border border-input bg-background px-3 py-2">
                      <option>Professional</option>
                      <option>Friendly</option>
                      <option>Urgent</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Key Message</label>
                  <Input placeholder="What's the main point?" />
                </div>
                <p className="text-xs text-muted-foreground">{notConnected}</p>
                <Button className="w-full" disabled title={NO_GENERATOR}>
                  <Wand2 className="mr-2 h-4 w-4" /> Generate Email
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Social Posts Tab */}
          <TabsContent value="social">
            <GlassCard title="AI Social Media Generator">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Platform</label>
                    <select className="w-full rounded-lg border border-input bg-background px-3 py-2">
                      <option>Twitter/X</option>
                      <option>LinkedIn</option>
                      <option>Instagram</option>
                      <option>Facebook</option>
                      <option>TikTok</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Content Type</label>
                    <select className="w-full rounded-lg border border-input bg-background px-3 py-2">
                      <option>Announcement</option>
                      <option>Engagement</option>
                      <option>Educational</option>
                      <option>Promotional</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Topic</label>
                  <Input placeholder="What to post about?" />
                </div>
                <p className="text-xs text-muted-foreground">{notConnected}</p>
                <Button className="w-full" disabled title={NO_GENERATOR}>
                  <Wand2 className="mr-2 h-4 w-4" /> Generate Posts
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Images Tab */}
          <TabsContent value="images">
            <GlassCard title="AI Image Generator">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Image Prompt</label>
                  <textarea
                    placeholder="Describe the image you want to create..."
                    className="min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Style</label>
                    <select className="w-full rounded-lg border border-input bg-background px-3 py-2">
                      <option>Realistic</option>
                      <option>Illustration</option>
                      <option>Abstract</option>
                      <option>3D</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Size</label>
                    <select className="w-full rounded-lg border border-input bg-background px-3 py-2">
                      <option>512x512</option>
                      <option>1024x1024</option>
                      <option>1920x1080</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{notConnected}</p>
                <Button className="w-full" disabled title={NO_GENERATOR}>
                  <Wand2 className="mr-2 h-4 w-4" /> Generate Image
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Video Scripts Tab */}
          <TabsContent value="video">
            <GlassCard title="Video Script Generator">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Video Topic</label>
                  <Input placeholder="e.g., Introduction to our API platform" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Duration</label>
                    <select className="w-full rounded-lg border border-input bg-background px-3 py-2">
                      <option>30 seconds</option>
                      <option>1 minute</option>
                      <option>2 minutes</option>
                      <option>5 minutes</option>
                      <option>10 minutes</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Style</label>
                    <select className="w-full rounded-lg border border-input bg-background px-3 py-2">
                      <option>Educational</option>
                      <option>Promotional</option>
                      <option>Tutorial</option>
                      <option>Testimonial</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{notConnected}</p>
                <Button className="w-full" disabled title={NO_GENERATOR}>
                  <Wand2 className="mr-2 h-4 w-4" /> Generate Script
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Translator Tab */}
          <TabsContent value="translate">
            <GlassCard title="Multi-Language Translator">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Content to Translate</label>
                  <textarea
                    placeholder="Paste your content here..."
                    className="min-h-[150px] w-full rounded-lg border border-input bg-background px-3 py-2"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">From Language</label>
                    <select className="w-full rounded-lg border border-input bg-background px-3 py-2">
                      <option>English</option>
                      <option>Spanish</option>
                      <option>French</option>
                      <option>German</option>
                      <option>Hindi</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">To Languages (select multiple)</label>
                    <Input placeholder="Spanish, French, Hindi..." />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{notConnected}</p>
                <Button className="w-full" disabled title={NO_GENERATOR}>
                  <Globe className="mr-2 h-4 w-4" /> Translate Now
                </Button>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
