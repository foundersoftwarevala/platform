import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Shared spacing + typography scale for every Server Manager screen.
 * Mirrors the Software Vala premium page rhythm.
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 space-y-6">
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl sm:text-3xl lg:text-[34px] font-semibold tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-sm sm:text-[15px] text-muted-foreground max-w-2xl">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="bento-card flex flex-col items-center justify-center text-center py-16 sm:py-20 px-6">
      <div className="grid place-items-center h-14 w-14 rounded-2xl bg-primary/15 text-primary mb-5">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
