import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
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

type ChatConsentDialogProps = {
  onAccept: () => Promise<void>;
  onLeave: () => void;
};

export function ChatConsentDialog({ onAccept, onLeave }: ChatConsentDialogProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setSaving(true);
    setError(null);
    try {
      await onAccept();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("chat.consent.save_error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-1 grid size-11 place-items-center rounded-full bg-primary/10 text-primary sm:mx-0">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle>{t("chat.consent.title")}</DialogTitle>
          <DialogDescription>{t("chat.consent.description")}</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>{t("chat.consent.storage")}</li>
          <li>{t("chat.consent.ai_review")}</li>
        </ul>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={onLeave}>
            {t("chat.consent.leave")}
          </Button>
          <Button type="button" disabled={saving} onClick={() => void accept()}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {t("chat.consent.accept")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
