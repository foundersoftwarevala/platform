import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function DemoLaunchButton({
  slug,
  className,
  ariaLabel,
  children,
}: {
  slug: string;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const launch = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (pendingRef.current) return;

    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      toast.error("Allow pop-ups to open this demo.");
      return;
    }
    tab.opener = null;
    pendingRef.current = true;
    setPending(true);
    try {
      const response = await fetch("/api/demo/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const result = (await response.json()) as { sessionId?: string; error?: string };
      if (!response.ok || !result.sessionId) {
        throw new Error(result.error || "Could not start this demo.");
      }

      tab.location.replace(
        `/demo/${encodeURIComponent(slug)}?visitor_session_id=${encodeURIComponent(result.sessionId)}`,
      );
    } catch (error) {
      tab.close();
      toast.error(
        error instanceof Error ? error.message : "Could not start this demo. Please try again.",
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      aria-busy={pending}
      aria-label={ariaLabel}
      onClick={launch}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : children}
    </button>
  );
}
