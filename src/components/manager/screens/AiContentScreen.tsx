import { useState } from "react";
import {
  Sparkles,
  Plus,
  Copy,
  Download,
  RefreshCw,
  Send,
  FileText,
  Mail,
  MessageCircle,
  Image as ImageIcon,
  Video,
  Globe,
  Wand2,
  Zap,
} from "lucide-react";
import { PageHeader, GlassCard, StatCard } from "../primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function AiContentScreen() {
  const [content, setContent] = useState<any[]>([
    {
      id: 1,
      title: "How to Optimize API Costs",
      type: "blog",
      length: 2140,
      tone: "professional",
      created: "2 days ago",
    },
    {
      id: 2,
      title: "Welcome to Our Platform",
      type: "email",
      length: 320,
      tone: "friendly",
      created: "1 week ago",
    },
  ]);

  const stats = [
    { label: "Content Generated", value: 342, tone: "primary" },
    { label: "Images Created", value: 128, tone: "cyan" },
    { label: "Words Written", value: "145K", tone: "green" },
    { label: "Languages", value: 28, tone: "amber" },
  ];

  return (
    <>
      <PageHeader
        title="AI Content Suite"
        description="Generate blog posts, emails, social media, images, and videos with AI"
      />

      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <StatCard
              key={i}
              label={s.label}
              value={s.value}
              tone={s.tone as any}
              icon={
                [
                  <Sparkles className="h-4 w-4" />,
                  <ImageIcon className="h-4 w-4" />,
                  <FileText className="h-4 w-4" />,
                  <Globe className="h-4 w-4" />,
                ][i]
              }
            />
          ))}
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
                <Button className="w-full">
                  <Wand2 className="mr-2 h-4 w-4" /> Generate Blog Post
                </Button>
              </div>
            </GlassCard>

            <GlassCard title="Generated Content" className="mt-6">
              <div className="space-y-4">
                {content
                  .filter((c) => c.type === "blog")
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between rounded-lg border border-border p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.length} words • {item.created}
                        </p>
                      </div>
                      <div className="ml-4 flex gap-2">
                        <button className="text-muted-foreground hover:text-foreground">
                          <Copy className="h-4 w-4" />
                        </button>
                        <button className="text-muted-foreground hover:text-foreground">
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
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
                <Button className="w-full">
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
                <Button className="w-full">
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
                <Button className="w-full">
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
                <Button className="w-full">
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
                <Button className="w-full">
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
