import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";

export function EmptyState({
  title = "No data yet",
  description = "Once the backend is connected, results will appear here.",
  icon,
  action,
  className,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("surface-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center", className)}>
      <div className="grid h-14 w-14 place-items-center rounded-full bg-trophy/10 text-trophy">
        {icon ?? <Trophy className="h-6 w-6" />}
      </div>
      <div>
        <div className="text-base font-semibold">{title}</div>
        <p className="mt-1 text-sm text-muted-foreground max-w-md">{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
