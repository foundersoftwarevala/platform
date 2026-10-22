import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDenyConsent, useGrantConsent, usePendingConsents } from "@/lib/assist-manager/hooks";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createConsentHash(sessionId: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Secure consent recording is not available in this browser.");
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const material = new TextEncoder().encode(
    `${sessionId}:${new Date().toISOString()}:${toHex(nonce)}:assist-screen-capture-consent-v1`,
  );
  return toHex(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", material)));
}

export function ClientConsent() {
  const { data: pending = [] } = usePendingConsents();
  const grantConsent = useGrantConsent();
  const denyConsent = useDenyConsent();
  const [error, setError] = useState<string | null>(null);
  const session = pending[0];
  const busy = grantConsent.isPending || denyConsent.isPending;

  const allow = async () => {
    if (!session) return;
    setError(null);
    try {
      const consentHash = await createConsentHash(session.id);
      await grantConsent.mutateAsync({ sessionId: session.id, consentHash });
    } catch (consentError) {
      setError(consentError instanceof Error ? consentError.message : "Consent could not be recorded.");
    }
  };

  const deny = async () => {
    if (!session) return;
    setError(null);
    try {
      await denyConsent.mutateAsync({
        sessionId: session.id,
        reason: "The target declined the Assist request.",
      });
    } catch (consentError) {
      setError(consentError instanceof Error ? consentError.message : "The request could not be denied.");
    }
  };

  return (
    <Dialog open={Boolean(session)} onOpenChange={() => undefined}>
      <DialogContent
        className="sm:max-w-lg"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Allow Assist screen sharing?</DialogTitle>
          <DialogDescription>
            A support session is requesting access to a selected application window. Your screen is
            sent through a blue privacy mask. Sharing starts only after manager approval and your
            consent have both been recorded.
          </DialogDescription>
        </DialogHeader>
        {session && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{session.session_code}</p>
            <p className="mt-1 text-muted-foreground">{session.purpose ?? session.assist_type}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              No window capture begins until you choose Allow and then explicitly start sharing.
            </p>
          </div>
        )}
        {pending.length > 1 && (
          <p className="text-xs text-muted-foreground">
            {pending.length - 1} additional request{pending.length === 2 ? "" : "s"} will be shown
            after this decision.
          </p>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => void deny()}>
            Deny
          </Button>
          <Button disabled={busy} onClick={() => void allow()}>
            {busy ? "Saving…" : "Allow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ClientConsent;
