import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Accessibility behaviour for hand-rolled (non-Radix) modals:
 * Escape to close, initial focus, Tab / Shift+Tab focus cycle inside the
 * dialog, and focus restoration to the previously focused element on unmount.
 */
export function useDialogA11y<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const dialogRef = useRef<T | null>(null);

  useEffect(() => {
    const restoreTo = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;

    const focusables = () =>
      Array.from(node?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Initial focus: first focusable element inside the dialog.
    const id = window.setTimeout(() => {
      const list = focusables();
      (list[0] ?? node)?.focus();
    }, 20);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (current === first || !node?.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", onKeyDown, true);
      restoreTo?.focus?.();
    };
  }, [onClose]);

  return dialogRef;
}
