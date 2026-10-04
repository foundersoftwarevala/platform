import { Link } from "@tanstack/react-router";
import {
  Cloud,
  Trash2,
  Edit,
  Check,
  X,
  ExternalLink,
  Key,
  Mail,
  MessageCircle,
  Database,
  Shield,
} from "lucide-react";
import {
  PageHeader,
  GlassCard,
  StatCard,
  StatusBadge,
  EmptyState,
  ErrorState,
  LoadingBlock,
  formatDate,
  num,
} from "../primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useManyRecords, type Row } from "@/lib/manager-queries";

/**
 * Cloud & Integrations reads the real API registry (api_services), the
 * registered integrations (api_integrations) and the stored key metadata
 * (api_keys; secrets never leave the server). A provider is shown as connected
 * only when the registry says it is active; everything else reads
 * "Not connected". Credentials are configured through the Registry, so the
 * connect/delete controls here point there or are disabled with that reason.
 */

const CONFIGURE_REASON =
  "Provider credentials are configured on the server through the API Registry.";
const DELETE_REASON = "Registered services are disabled in the API Registry, not deleted.";

function isConnected(service: Row | undefined): boolean {
  return (
    Boolean(service) && (service?.["status"] === "active" || service?.["status"] === "healthy")
  );
}

function findService(services: Row[], pattern: RegExp): Row | undefined {
  return services.find(
    (s) => pattern.test(String(s["name"] ?? "")) || pattern.test(String(s["slug"] ?? "")),
  );
}

function ConnectionLine({ service }: { service: Row | undefined }) {
  if (!service)
    return <p className="text-sm text-muted-foreground">Not connected — not registered</p>;
  return (
    <p className="text-sm text-muted-foreground">
      {isConnected(service) ? "✓ Connected" : "Not connected"} · registry status:{" "}
      {String(service["status"] ?? "unknown")}
    </p>
  );
}

function RegistryButton({ label }: { label: string }) {
  return (
    <Button size="sm" variant="outline" asChild title={CONFIGURE_REASON}>
      <Link to="/manager/$section" params={{ section: "registry" }}>
        {label}
      </Link>
    </Button>
  );
}

export default function CloudConnectorsScreen() {
  const many = useManyRecords([
    {
      table: "api_services",
      select: "id,name,slug,category,status,health_status,endpoint_url,last_checked_at",
      orderBy: "name",
      ascending: true,
      limit: 500,
    },
    { table: "api_integrations", select: "id,name,category,status,last_sync_at,error_count" },
    {
      table: "api_keys",
      select: "id,label,environment,key_prefix,last_four,status,created_at,last_used_at",
      orderBy: "created_at",
    },
  ]);
  const [services = [], integrations = [], keys = []] = many.data ?? [];

  if (many.isLoading) {
    return (
      <>
        <PageHeader
          title="Cloud & Integrations"
          description="Connect to Google, AWS, Azure, SendGrid, Twilio, and more"
        />
        <LoadingBlock rows={6} />
      </>
    );
  }
  if (many.error) {
    return (
      <>
        <PageHeader
          title="Cloud & Integrations"
          description="Connect to Google, AWS, Azure, SendGrid, Twilio, and more"
        />
        <ErrorState error={many.error} onRetry={() => many.refetch()} />
      </>
    );
  }

  const connected = services.filter(isConnected);
  const activeKeys = keys.filter((k) => k["status"] === "active");
  const integrationErrors = integrations.reduce((sum, i) => sum + Number(i["error_count"] ?? 0), 0);
  const googleServices = services.filter((s) => /google/i.test(String(s["name"] ?? "")));
  const sendgrid = findService(services, /sendgrid/i);
  const mailgun = findService(services, /mailgun/i);
  const twilio = findService(services, /twilio/i);
  const whatsapp = findService(services, /whatsapp/i);
  const aws = findService(services, /\baws\b|amazon web services/i);

  return (
    <>
      <PageHeader
        title="Cloud & Integrations"
        description="Connect to Google, AWS, Azure, SendGrid, Twilio, and more"
      />

      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Connected Services"
            value={num(connected.length)}
            tone="primary"
            icon={<Cloud className="h-4 w-4" />}
            change={`${num(services.length)} registered`}
          />
          <StatCard
            label="API Keys"
            value={num(activeKeys.length)}
            tone="cyan"
            icon={<Key className="h-4 w-4" />}
            change={`${num(keys.length)} stored`}
          />
          <StatCard
            label="Data Synced (GB)"
            value="—"
            tone="green"
            icon={<Database className="h-4 w-4" />}
            change="Not tracked"
          />
          <StatCard
            label="Integration Errors"
            value={num(integrationErrors)}
            tone="amber"
            icon={<Shield className="h-4 w-4" />}
            change={`${num(integrations.length)} integrations registered`}
          />
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
              {connected.length === 0 ? (
                <EmptyState message="No services are connected. Register and activate providers in the API Registry." />
              ) : (
                <div className="space-y-4">
                  {connected.map((conn) => (
                    <div
                      key={String(conn["id"])}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div>
                        <p className="font-medium">{String(conn["name"] ?? "—")}</p>
                        <p className="text-sm text-muted-foreground">
                          {String(conn["category"] ?? "—")} • last checked{" "}
                          {formatDate(conn["last_checked_at"] as string | null)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge
                          value={String(conn["health_status"] ?? conn["status"] ?? "unknown")}
                        />
                        <div className="flex gap-2">
                          <Link
                            to="/manager/$section"
                            params={{ section: "registry" }}
                            aria-label={`Manage ${String(conn["name"] ?? "service")} in the API Registry`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            disabled
                            title={DELETE_REASON}
                            aria-label={`Delete — ${DELETE_REASON}`}
                            className="cursor-not-allowed text-muted-foreground opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </TabsContent>

          {/* Google Cloud Tab */}
          <TabsContent value="google">
            <GlassCard title="Google Cloud Setup">
              <div className="space-y-4">
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm font-medium">
                    {googleServices.some(isConnected) ? "✓ Connected" : "Not connected"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {num(googleServices.filter(isConnected).length)} of {num(googleServices.length)}{" "}
                    registered Google services active
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Services Enabled</label>
                    <div className="mt-2 space-y-2">
                      {googleServices.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No Google services are registered.
                        </p>
                      ) : (
                        googleServices.map((s) => (
                          <div key={String(s["id"])} className="flex items-center gap-2">
                            {isConnected(s) ? (
                              <Check className="h-4 w-4 text-status-success" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm">{String(s["name"])}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="w-full" asChild>
                  <a
                    href="https://console.cloud.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" /> Go to Google Cloud Console
                  </a>
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* AWS Tab */}
          <TabsContent value="aws">
            <GlassCard title="AWS Integration">
              <div className="space-y-4">
                <ConnectionLine service={aws} />
                <div>
                  <label className="text-sm font-medium">AWS Access Key ID</label>
                  <Input placeholder="AKIA..." disabled title={CONFIGURE_REASON} />
                </div>
                <div>
                  <label className="text-sm font-medium">AWS Secret Access Key</label>
                  <Input type="password" placeholder="••••••••" disabled title={CONFIGURE_REASON} />
                </div>
                <div>
                  <label className="text-sm font-medium">Region</label>
                  <select
                    className="w-full rounded-lg border border-input bg-background px-3 py-2"
                    disabled
                    title={CONFIGURE_REASON}
                  >
                    <option>us-east-1</option>
                    <option>us-west-2</option>
                    <option>eu-west-1</option>
                    <option>ap-south-1</option>
                  </select>
                </div>
                <Button className="w-full" disabled title={CONFIGURE_REASON}>
                  Connect AWS Account
                </Button>
                <p className="text-xs text-muted-foreground">{CONFIGURE_REASON}</p>
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
                  <ConnectionLine service={sendgrid} />
                  <div className="mt-3 flex gap-2">
                    <RegistryButton
                      label={sendgrid ? "Manage in Registry" : "Register in Registry"}
                    />
                  </div>
                </div>

                {/* Mailgun */}
                <div className="rounded-lg border border-border p-4">
                  <p className="font-medium">Mailgun</p>
                  <ConnectionLine service={mailgun} />
                  <div className="mt-3 flex gap-2">
                    <RegistryButton
                      label={mailgun ? "Manage in Registry" : "Register in Registry"}
                    />
                  </div>
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
                  <ConnectionLine service={twilio} />
                  <div className="mt-3 flex gap-2">
                    <RegistryButton
                      label={twilio ? "Manage in Registry" : "Register in Registry"}
                    />
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="rounded-lg border border-border p-4">
                  <p className="font-medium">WhatsApp Business API</p>
                  <ConnectionLine service={whatsapp} />
                  <div className="mt-3 flex gap-2">
                    <RegistryButton
                      label={whatsapp ? "Manage in Registry" : "Register in Registry"}
                    />
                  </div>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="keys">
            <GlassCard title="API Keys Management">
              {keys.length === 0 ? (
                <EmptyState message="No API keys are stored." />
              ) : (
                <div className="space-y-3">
                  {keys.map((key) => {
                    const active = key["status"] === "active";
                    return (
                      <div
                        key={String(key["id"])}
                        className="flex items-center justify-between rounded-lg border border-border p-4"
                      >
                        <div>
                          <p className="font-medium">{String(key["label"] ?? "—")}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {String(key["key_prefix"] ?? "")}…{String(key["last_four"] ?? "")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {String(key["environment"] ?? "—")} · created{" "}
                            {formatDate(key["created_at"] as string | null)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {active ? (
                            <Badge
                              variant="outline"
                              className="border-status-success/40 text-status-success"
                            >
                              Active
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-status-error/40 text-status-error"
                            >
                              {String(key["status"] ?? "Revoked")}
                            </Badge>
                          )}
                          <button
                            type="button"
                            disabled
                            title="Keys are rotated and revoked in the API Registry."
                            aria-label="Delete — keys are rotated and revoked in the API Registry."
                            className="cursor-not-allowed text-muted-foreground opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
