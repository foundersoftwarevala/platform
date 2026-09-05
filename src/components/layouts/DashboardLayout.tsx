import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  roleOverride?: string;
  className?: string;
}

const DashboardLayout = memo(
  ({ children, title, subtitle, className }: DashboardLayoutProps) => (
    <div className={cn("mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6", className)}>
      {(title || subtitle) && (
        <header>
          {title && <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>}
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </header>
      )}
      {children}
    </div>
  ),
);

DashboardLayout.displayName = "DashboardLayout";

export default DashboardLayout;