import type { ReactNode } from "react";

export function SalesSupportManagerShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
