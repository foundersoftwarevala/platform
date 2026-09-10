import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  cardGatewaySettingsFn,
  saveCardGatewayCredentialsFn,
} from "@/lib/finance/finance.functions";
import { PanelCard, QueryState } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

/**
 * Where an operator puts a card gateway's keys.
 *
 * Without this the credentials could only be set by editing a server
 * environment file and redeploying, which is what made every provider a
 * blocker. They are written to the same place PayU's merchant key and salt
 * live — the rail's configuration_state.secrets — and the server strips that
 * before any row is sent to a browser.
 *
 * A key that has been saved is shown as "Saved" and never returned. The fields
 * stay blank on every visit: filling one replaces that key, leaving it blank
 * leaves the stored key alone. That is deliberately not the same as showing a
 * masked value, because a masked value invites somebody to save the mask.
 */

type Settings = {
  code: string;
  displayName: string;
  enabled: boolean;
  hasSecretKey: boolean;
  hasPublicKey: boolean;
  hasWebhookSecret: boolean;
  apiBaseUrl: string;
  appBaseUrl: string;
  webhookUrl: string;
  supportedCurrencies: string[];
  supportedCountries: string[];
};

function StoredBadge({ present }: { present: boolean }) {
  return present ? (
    <Badge variant="outline" className="border-status-success/40 text-status-success text-xs">
      Saved
    </Badge>
  ) : (
    <Badge variant="outline" className="border-status-warning/40 text-status-warning text-xs">
      Not set
    </Badge>
  );
}

export default function CardGatewayCredentials({ code }: { code: string }) {
  const queryClient = useQueryClient();
  const settingsFn = useServerFn(cardGatewaySettingsFn);
  const saveFn = useServerFn(saveCardGatewayCredentialsFn);

  const state = useQuery({
    queryKey: ["finance", "card-gateway-settings"],
    queryFn: () => settingsFn() as Promise<Settings[]>,
    staleTime: 30_000,
  });
  const settings = state.data?.find((row) => row.code === code);

  const [secretKey, setSecretKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [copied, setCopied] = useState(false);

  const save = useMutation({
    mutationFn: (input: Record<string, unknown>) => saveFn({ data: { code, ...input } } as never),
    onSuccess: () => {
      // The values are gone from this form the moment they are stored.
      setSecretKey("");
      setPublicKey("");
      setWebhookSecret("");
      queryClient.invalidateQueries({ queryKey: ["finance", "card-gateway-settings"] });
      queryClient.invalidateQueries({ queryKey: ["finance", "gateway-readiness"] });
      toast.success("Saved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const copyWebhook = async () => {
    if (!settings) return;
    try {
      await navigator.clipboard.writeText(settings.webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select the address and copy it by hand.");
    }
  };

  const canEnable = Boolean(
    settings && (settings.hasSecretKey || secretKey) && (settings.hasWebhookSecret || webhookSecret),
  );

  return (
    <PanelCard
      title="Provider Credentials"
      actions={
        settings ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {settings.enabled ? "Rail enabled" : "Rail disabled"}
            </span>
            <Switch
              checked={settings.enabled}
              disabled={save.isPending || (!settings.enabled && !canEnable)}
              onCheckedChange={(checked) => save.mutate({ enabled: checked })}
            />
          </div>
        ) : null
      }
    >
      <QueryState
        isLoading={state.isLoading}
        error={state.error}
        isEmpty={!settings}
        emptyLabel="This rail has not been created yet. Run the card payment rails migration."
      >
        {settings ? (
          <div className="space-y-5">
            <p className="text-xs text-muted-foreground">
              Keys are stored on this rail and never sent back to a browser. Leave a field blank to
              keep the key that is already saved. Software Vala never receives a card number or a
              CVV — {settings.displayName} hosts the card page itself.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Secret key</label>
                  <StoredBadge present={settings.hasSecretKey} />
                </div>
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder={settings.hasSecretKey ? "Leave blank to keep" : "Required"}
                  value={secretKey}
                  onChange={(event) => setSecretKey(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">
                    Webhook secret
                    <span className="ml-1 text-[10px] uppercase tracking-wide">required</span>
                  </label>
                  <StoredBadge present={settings.hasWebhookSecret} />
                </div>
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder={settings.hasWebhookSecret ? "Leave blank to keep" : "Required"}
                  value={webhookSecret}
                  onChange={(event) => setWebhookSecret(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Public key (optional)</label>
                  <StoredBadge present={settings.hasPublicKey} />
                </div>
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder={settings.hasPublicKey ? "Leave blank to keep" : "Optional"}
                  value={publicKey}
                  onChange={(event) => setPublicKey(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">API endpoint</label>
                <p className="font-mono text-xs text-foreground">{settings.apiBaseUrl}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                Webhook address — paste this into the {settings.displayName} dashboard
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded border border-border bg-muted/30 px-2 py-1.5 font-mono text-xs text-foreground">
                  {settings.webhookUrl}
                </code>
                <Button type="button" variant="outline" size="sm" onClick={copyWebhook}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-status-success" />
              Settles {settings.supportedCurrencies.join(", ") || "no currency yet"}
              {settings.supportedCountries.length
                ? ` in ${settings.supportedCountries.join(", ")}`
                : ""}
              .
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                disabled={
                  save.isPending || (!secretKey && !publicKey && !webhookSecret)
                }
                onClick={() =>
                  save.mutate({
                    ...(secretKey ? { secretKey } : {}),
                    ...(publicKey ? { publicKey } : {}),
                    ...(webhookSecret ? { webhookSecret } : {}),
                  })
                }
              >
                <KeyRound className="mr-2 h-4 w-4" />
                {save.isPending ? "Saving…" : "Save credentials"}
              </Button>
              {!canEnable ? (
                <span className="text-xs text-status-warning">
                  A secret key and a webhook secret are both needed before this rail can be
                  enabled.
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </QueryState>
    </PanelCard>
  );
}
