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
import { useTranslation } from "@/lib/i18n/use-translation";
import { useDenyConsent, useGrantConsent, usePendingConsents } from "@/lib/assist-manager/hooks";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createConsentHash(sessionId: string, unavailableMessage: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error(unavailableMessage);
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const material = new TextEncoder().encode(
    `${sessionId}:${new Date().toISOString()}:${toHex(nonce)}:assist-screen-capture-consent-v1`,
  );
  return toHex(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", material)));
}

export function ClientConsent() {
  const { t } = useTranslation();
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
      const consentHash = await createConsentHash(
        session.id,
        t("common.secure_consent_unavailable"),
      );
      await grantConsent.mutateAsync({ sessionId: session.id, consentHash });
    } catch (consentError) {
      setError(
        consentError instanceof Error ? consentError.message : t("common.consent_record_failed"),
      );
    }
  };

  const deny = async () => {
    if (!session) return;
    setError(null);
    try {
      await denyConsent.mutateAsync({
        sessionId: session.id,
        // i18n-ignore: persisted canonical audit reason, kept language-stable across operators.
        reason: "The target declined the Assist request.",
      });
    } catch (consentError) {
      setError(
        consentError instanceof Error ? consentError.message : t("common.consent_deny_failed"),
      );
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
          <DialogTitle>{t("common.assist_consent_title")}</DialogTitle>
          <DialogDescription>
            {t("common.assist_consent_description")}
          </DialogDescription>
        </DialogHeader>
        {session && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{session.session_code}</p>
            <p className="mt-1 text-muted-foreground">{session.purpose ?? session.assist_type}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("common.assist_consent_start_notice")}
            </p>
          </div>
        )}
        {pending.length > 1 && (
          <p className="text-xs text-muted-foreground">
            {t("common.assist_consent_pending_count", { count: pending.length - 1 })}
          </p>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => void deny()}>
            {t("common.assist_consent_deny")}
          </Button>
          <Button disabled={busy} onClick={() => void allow()}>
            {busy ? t("common.assist_consent_saving") : t("common.assist_consent_allow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ClientConsent;
