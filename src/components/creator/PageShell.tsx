import type { ReactNode } from "react";

/**
 * Shared spacing + typography scale for the Creator Manager pages.
 * container max-width 1600px, padding 16/24/32, vertical rhythm 24/32/40.
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      {children}
    </div>
  );
}
