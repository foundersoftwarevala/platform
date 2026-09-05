import { useState } from "react";
import {
  Cloud,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  ExternalLink,
  Key,
  Settings,
  Mail,
  MessageCircle,
  Database,
  Shield,
} from "lucide-react";
import { PageHeader, GlassCard, StatCard, StatusBadge } from "../primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function CloudConnectorsScreen() {
  const [connectors, setConnectors] = useState<any[]>([
    {
      id: 1,
      name: "Google Cloud",
      status: "connected",
      project: "vala-ai-prod",
      lastSync: "5 minutes ago",
    },
    {
      id: 2,
      name: "SendGrid",
      status: "connected",
      account: "vala-marketing",
      lastSync: "2 hours ago",
    },
    {
      id: 3,
      name: "Stripe",
      status: "connected",
      account: "vala-payments",
      lastSync: "1 hour ago",
    },
  ]);

  const stats = [
    { label: "Connected Services", value: 8, tone: "primary" },
    { label: "API Keys", value: 24, tone: "cyan" },
    { label: "Data Synced (GB)", value: "2.4", tone: "green" },
    { label: "Errors (24h)", value: 2, tone: "amber" },
  ];

  return (
    <>
      <PageHeader
        title="Cloud & Integrations"
        description="Connect to Google, AWS, Azure, SendGrid, Twilio, and more"
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
                  <Cloud className="h-4 w-4" />,
                  <Key className="h-4 w-4" />,
                  <Database className="h-4 w-4" />,
                  <Shield className="h-4 w-4" />,
                ][i]
              }
            />
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">
              <Cloud className="mr-2 h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="google">
              <Cloud className="mr-2 h-4 w-4" /> Google Cloud
            </TabsTrigger>
            <TabsTrigger value="aws">
              <Cloud className="mr-2 h-4 w-4" /> AWS
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="mr-2 h-4 w-4" /> Email Services
            </TabsTrigger>
            <TabsTrigger value="messaging">
              <MessageCircle className="mr-2 h-4 w-4" /> SMS
            </TabsTrigger>
            <TabsTrigger value="keys">
              <Key className="mr-2 h-4 w-4" /> API Keys
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <GlassCard title="Connected Services">
              <div className="space-y-4">
                {connectors.map((conn) => (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4"
                  >
                    <div>
                      <p className="font-medium">{conn.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {conn.project || conn.account} • {conn.lastSync}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge value={conn.status} />
                      <div className="flex gap-2">
                        <button className="text-muted-foreground hover:text-foreground">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button className="text-muted-foreground hover:text-foreground">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </TabsContent>

          {/* Google Cloud Tab */}
          <TabsContent value="google">
            <GlassCard title="Google Cloud Setup">
              <div className="space-y-4">
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm font-medium">✓ Connected</p>
                  <p className="text-sm text-muted-foreground">Project: vala-ai-prod</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Services Enabled</label>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-status-success" />
                        <span className="text-sm">Vision API</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-status-success" />
                        <span className="text-sm">Cloud Storage</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-status-success" />
                        <span className="text-sm">BigQuery</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="w-full">
                  <ExternalLink className="mr-2 h-4 w-4" /> Go to Google Cloud Console
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* AWS Tab */}
          <TabsContent value="aws">
            <GlassCard title="AWS Integration">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">AWS Access Key ID</label>
                  <Input placeholder="AKIA..." />
                </div>
                <div>
                  <label className="text-sm font-medium">AWS Secret Access Key</label>
                  <Input type="password" placeholder="••••••••" />
                </div>
                <div>
                  <label className="text-sm font-medium">Region</label>
                  <select className="w-full rounded-lg border border-input bg-background px-3 py-2">
                    <option>us-east-1</option>
                    <option>us-west-2</option>
                    <option>eu-west-1</option>
                    <option>ap-south-1</option>
                  </select>
                </div>
                <Button className="w-full">Connect AWS Account</Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Email Services Tab */}
          <TabsContent value="email">
            <GlassCard title="Email Service Providers">
              <div className="space-y-4">
                {/* SendGrid */}
                <div className="rounded-lg border border-border p-4">
                  <p className="font-medium">SendGrid</p>
                  <p className="text-sm text-muted-foreground">✓ Connected</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline">
                      Reconnect
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive">
                      Disconnect
                    </Button>
                  </div>
                </div>

                {/* Mailgun */}
                <div className="rounded-lg border border-border p-4">
                  <p className="font-medium">Mailgun</p>
                  <p className="text-sm text-muted-foreground">Not Connected</p>
                  <div>
                    <label className="mt-3 block text-sm font-medium">API Key</label>
                    <Input placeholder="key-xxx" />
                  </div>
                  <Button size="sm" className="mt-3">
                    Connect Mailgun
                  </Button>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Messaging Tab */}
          <TabsContent value="messaging">
            <GlassCard title="SMS & Messaging">
              <div className="space-y-4">
                {/* Twilio */}
                <div className="rounded-lg border border-border p-4">
                  <p className="font-medium">Twilio SMS</p>
                  <p className="text-sm text-muted-foreground">✓ Connected</p>
                  <div className="mt-3">
                    <p className="text-sm">Account SID: ACxxxxxx</p>
                    <p className="text-sm">From Number: +1 (555) 000-0000</p>
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="rounded-lg border border-border p-4">
                  <p className="font-medium">WhatsApp Business API</p>
                  <p className="text-sm text-muted-foreground">Not Connected</p>
                  <Button size="sm" className="mt-3">
                    Connect WhatsApp
                  </Button>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="keys">
            <GlassCard
              title="API Keys Management"
              actions={
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Generate Key
                </Button>
              }
            >
              <div className="space-y-3">
                {[
                  { name: "Production API", key: "sk_prod_xxx", created: "30 days ago", active: true },
                  {
                    name: "Development API",
                    key: "sk_dev_xxx",
                    created: "45 days ago",
                    active: true,
                  },
                  {
                    name: "Testing API (Revoked)",
                    key: "sk_test_xxx",
                    created: "90 days ago",
                    active: false,
                  },
                ].map((key, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border p-4"
                  >
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{key.key}</p>
                      <p className="text-xs text-muted-foreground">Created {key.created}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {key.active ? (
                        <Badge variant="outline" className="border-status-success/40 text-status-success">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-status-error/40 text-status-error">
                          Revoked
                        </Badge>
                      )}
                      <button className="text-muted-foreground hover:text-foreground">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
