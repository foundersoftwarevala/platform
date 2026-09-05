import * as React from "react";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/ams/ui-sound";

export type DialogState = "idle" | "loading" | "success" | "error";

export interface EnterpriseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Small label above the title — establishes dialog hierarchy. */
  eyebrow?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  /** Async/feedback state driving the footer + status band. */
  state?: DialogState;
  statusMessage?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  confirmVariant?: React.ComponentProps<typeof Button>["variant"];
  confirmDisabled?: boolean;
  /** Extra footer content rendered on the leading edge. */
  footerLeading?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES: Record<NonNullable<EnterpriseDialogProps["size"]>, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
};

/**
 * The single dialog shell for the AMS Manager.
 * Handles hierarchy (eyebrow → title → description), a scrollable body,
 * a sticky footer with standard action order, and idle/loading/success/error
 * states — plus focus management, Escape-to-close and sound feedback.
 */
export function EnterpriseDialog({
  open, onOpenChange, title, description, eyebrow, icon, children,
  state = "idle", statusMessage, confirmLabel, cancelLabel = "Cancel",
  onConfirm, confirmVariant = "default", confirmDisabled,
  footerLeading, size = "md", className,
}: EnterpriseDialogProps) {
  const loading = state === "loading";

  React.useEffect(() => {
    if (state === "success") playSound("success");
    if (state === "error") playSound("error");
  }, [state]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (loading && !next) return; // never close mid-flight
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={cn("p-0 gap-0 overflow-hidden", SIZES[size], className)}
        onEscapeKeyDown={(e) => { if (loading) e.preventDefault(); }}
        onInteractOutside={(e) => { if (loading) e.preventDefault(); }}
      >
        <DialogHeader className="px-5 pt-5 pb-4 text-left">
          <div className="flex items-start gap-3">
            {icon && (
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted/30 text-trophy">
                {icon}
              </span>
            )}
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {eyebrow}
                </div>
              )}
              <DialogTitle className="truncate text-base font-semibold sm:text-lg">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription className="mt-1 text-xs sm:text-sm">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {children != null && (
          <div className="max-h-[65dvh] overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>
        )}

        {statusMessage && state !== "idle" && (
          <div
            role={state === "error" ? "alert" : "status"}
            aria-live="polite"
            className={cn(
              "mx-5 mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
              state === "error" && "border-destructive/40 bg-destructive/10 text-destructive motion-shake",
              state === "success" && "border-success/40 bg-success/10 text-success",
              state === "loading" && "border-border bg-muted/30 text-muted-foreground",
            )}
          >
            {state === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {state === "success" && <CheckCircle2 className="h-3.5 w-3.5" />}
            {state === "error" && <AlertTriangle className="h-3.5 w-3.5" />}
            <span className="min-w-0">{statusMessage}</span>
          </div>
        )}

        <DialogFooter className="gap-2 border-t border-border bg-muted/20 px-5 py-3 sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            {footerLeading}
          </div>
          <div className="flex items-center justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" size="sm" disabled={loading}>{cancelLabel}</Button>
            </DialogClose>
            {confirmLabel && (
              <Button
                size="sm"
                variant={confirmVariant}
                disabled={confirmDisabled || loading}
                onClick={onConfirm}
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {confirmLabel}
              </Button>
            )}
          </div>
        </DialogFooter>

        <DialogClose
          aria-label="Close dialog"
          disabled={loading}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-ring disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
