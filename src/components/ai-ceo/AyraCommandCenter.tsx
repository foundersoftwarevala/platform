import { useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AyraCommandCenter({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="aw-command-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <aside
        className="aw-command-drawer"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ayra-command-title"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2
            id="ayra-command-title"
            className="aw-display text-lg tracking-widest text-[color:var(--aw-cyan)]"
          >
            AYRA COMMAND CENTER
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-full border border-[color:var(--aw-line)] p-2 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-md border border-[color:var(--aw-line)] bg-white/[0.04] p-4 text-sm">
          <h3 className="mb-2 font-display text-xs tracking-widest text-[color:var(--aw-cyan)]">
            ACCESS &amp; PERMISSIONS
          </h3>
          <p className="text-[color:var(--aw-soft)]">
            Actual Control Panel roles and server authorization govern these settings.
          </p>
        </div>
      </aside>
    </div>
  );
}
