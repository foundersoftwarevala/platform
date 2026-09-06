/**
 * HOST CONNECT — this Developer Manager console is a child module. It has no
 * login of its own; the host platform is the trust boundary. This panel is the
 * connect scope: one button that performs a postMessage handshake with the host
 * app (parent window / opener), records the host actor for the audit trail and
 * exposes the mount route the host should embed.
 */
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "dev-manager:host-connection";
export const MOUNT_ROUTE = "/dev-manager";

export interface HostConnection {
  actor: string;
  hostOrigin: string;
  connectedAt: string;
}

export function getHostConnection(): HostConnection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HostConnection) : null;
  } catch {
    return null;
  }
}

/** Actor label sent with every audited mutation. */
export function hostActor(): string | undefined {
  return getHostConnection()?.actor;
}

export function HostConnectButton() {
  const [open, setOpen] = useState(false);
  const [connection, setConnection] = useState<HostConnection | null>(null);
  const [actor, setActor] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const existing = getHostConnection();
    setConnection(existing);
    setActor(existing?.actor ?? "");
  }, []);

  const embedUrl =
    typeof window === "undefined" ? MOUNT_ROUTE : `${window.location.origin}${MOUNT_ROUTE}`;

  const handleConnect = useCallback(() => {
    setBusy(true);
    const host = window.parent !== window ? window.parent : window.opener;
    const next: HostConnection = {
      actor: actor.trim() || "host-app",
      hostOrigin: document.referrer ? new URL(document.referrer).origin : "standalone",
      connectedAt: new Date().toISOString(),
    };
    try {
      host?.postMessage(
        { type: "devManager:connected", module: "developer-manager", route: MOUNT_ROUTE, actor: next.actor },
        "*",
      );
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setConnection(next);
      toast({
        title: "Module connected",
        description: `Actions will be audited as “${next.actor}”.`,
        variant: "success",
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: "Connect failed",
        description: error instanceof Error ? error.message : "Could not reach the host app.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }, [actor]);

  const handleDisconnect = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setConnection(null);
    toast({ title: "Module disconnected" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={connection ? "outline" : "default"} className="gap-2">
          <PlugZap className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{connection ? "Connected" : "Connect"}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect to host project</DialogTitle>
          <DialogDescription>
            This console is a child module — no separate login. Mount this route inside your running
            project and connect once so actions are attributed in the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Mount route</Label>
            <div className="flex items-center gap-2">
              <Input readOnly value={embedUrl} aria-label="Module mount route" className="font-mono text-xs" />
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Copy mount route"
                onClick={() => {
                  void navigator.clipboard.writeText(embedUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Embed as an iframe or link from the host navigation. The host handles authentication.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="host-actor">Host actor label</Label>
            <Input
              id="host-actor"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              placeholder="e.g. host-app / manager@company.com"
            />
          </div>

          {connection && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
              <div className="flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 text-primary" />
                <Badge variant="outline" className="font-mono text-[10px]">
                  {connection.hostOrigin}
                </Badge>
              </div>
              <p className="mt-2 text-muted-foreground">
                Connected {new Date(connection.connectedAt).toLocaleString()} as{" "}
                <span className="font-mono">{connection.actor}</span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {connection ? (
            <Button variant="ghost" onClick={handleDisconnect}>
              Disconnect
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={handleConnect} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {connection ? "Re-connect" : "Connect module"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default HostConnectButton;
