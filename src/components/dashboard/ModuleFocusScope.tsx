import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

type Props = {
  /** Unique key of the active module — remounts the scope when it changes. */
  label: string;
  children: ReactNode;
  /** Called on Escape so the user can always leave the scope. */
  onEscape?: () => void;
};

/**
 * Keeps keyboard focus inside a module page and restores focus to whatever
 * triggered it (sidebar item, KPI card, quick action) when it unmounts, so
 * tab / shift+tab never jump back to the top of the document.
 */
export function ModuleFocusScope({ label, children, onEscape }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const owned = useRef(false);

  useEffect(() => {
    const active = document.activeElement;
    restoreTo.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
    owned.current = false;

    // Defer past the browser's own mousedown/click focus so the module region
    // reliably wins focus when it was opened with the pointer.
    const raf = requestAnimationFrame(() => {
      const node = ref.current;
      if (!node) return;
      if (node.contains(document.activeElement)) return;
      const first = node.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? node).focus({ preventScroll: true });
      owned.current = true;
    });

    return () => {
      cancelAnimationFrame(raf);
      const node = ref.current;
      // Only hand focus back if this scope actually holds it — prevents
      // stealing focus on unrelated unmounts (and React StrictMode remounts).
      if (!owned.current) return;
      if (node && !node.contains(document.activeElement)) return;
      const target = restoreTo.current;
      if (target && document.contains(target)) {
        requestAnimationFrame(() => target.focus({ preventScroll: true }));
      }
    };
  }, [label]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    function onKeyDown(e: KeyboardEvent) {
      if (!node) return;
      if (e.key === "Escape" && onEscape) {
        e.stopPropagation();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const current = document.activeElement as HTMLElement | null;
      if (!current || !node.contains(current)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus({ preventScroll: true });
        return;
      }
      if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      } else if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      }
    }

    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  }, [onEscape]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="region"
      aria-label={label}
      className="outline-none"
    >
      {children}
    </div>
  );
}
