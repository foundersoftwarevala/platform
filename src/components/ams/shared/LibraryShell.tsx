import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ams/shared/PageHeader";
import { EmptyState } from "@/components/ams/shared/EmptyState";

/**
 * Shared scaffold for award-rule and library shell pages.
 * Empty until the backend is wired in awards.api.ts.
 */
export function LibraryShell({
  kicker, title, description, helpIcon, children,
}: {
  kicker: string;
  title: string;
  description: string;
  helpIcon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        kicker={kicker}
        title={title}
        description={description}
        actions={
          <Button asChild className="gap-1.5 bg-gradient-to-r from-trophy to-legendary text-background hover:opacity-90">
            <Link to="/awards/new"><Plus className="h-4 w-4" /> New</Link>
          </Button>
        }
      />
      {children ?? (
        <EmptyState
          icon={helpIcon}
          title="Nothing here yet"
          description="Connect this library to the backend and items created in the Award Management Center will appear here."
          action={<Button asChild className="gap-1.5"><Link to="/awards/new"><Plus className="h-4 w-4" /> Create your first</Link></Button>}
        />
      )}
    </div>
  );
}
