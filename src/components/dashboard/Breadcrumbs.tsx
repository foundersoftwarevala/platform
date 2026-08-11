import { ChevronRight, Home } from "lucide-react";

export type Crumb = { label: string; onClick?: () => void };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {items.map((c, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="inline-flex items-center gap-1.5">
            {i === 0 && <Home className="h-3.5 w-3.5 opacity-70" />}
            {c.onClick && !isLast ? (
              <button
                onClick={c.onClick}
                className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
              >
                {c.label}
              </button>
            ) : (
              <span className={isLast ? "text-foreground font-medium" : ""}>{c.label}</span>
            )}
            {!isLast && <ChevronRight className="h-3 w-3 opacity-50" />}
          </span>
        );
      })}
    </nav>
  );
}