import type { ReactNode } from "react";

/**
 * Shared premium spacing scale for every wall.
 * container max-width 1600px · padding 16/24/32 · vertical rhythm 24/32/40.
 */
export function WallShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      {children}
    </div>
  );
}

export function TwoCol({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-3">{children}</div>;
}
