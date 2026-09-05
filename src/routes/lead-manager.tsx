import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useSidebarState } from "@/components/lead-manager/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { AlertTriangle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/lead-manager")({
  head: () => ({
    meta: [
      { title: "Lead Manager — Software Vala" },
      { name: "description", content: "Complete lead management system with pipeline, scoring, and analytics." },
    ],
  }),
  component: LeadManagerLayout,
  errorComponent: LeadManagerError,
  notFoundComponent: LeadManagerNotFound,
});

function LeadManagerError({ error, reset }: { error: Error; reset: () => void }) {
  console.error("Lead Manager Error:", error);
  
  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div
        role="alert"
        className="w-full max-w-md rounded-lg border border-destructive/30 bg-surface p-6 text-center"
      >
        <AlertTriangle className="mx-auto mb-3 size-8 text-destructive" aria-hidden="true" />
        <h1 className="font-semibold text-lg">Lead Manager Failed to Load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred while loading the lead manager."}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={reset} size="sm">
            Try again
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.href = "/"}
          >
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}

function LeadManagerNotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="w-full max-w-md text-center">
        <AlertCircle className="mx-auto mb-4 size-8 text-amber-500" aria-hidden="true" />
        <h1 className="font-semibold text-lg">Page Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The lead manager page you're looking for doesn't exist.
        </p>
        <Button
          className="mt-5"
          onClick={() => window.location.href = "/lead-manager"}
          size="sm"
        >
          Back to Lead Manager
        </Button>
      </div>
    </div>
  );
}

function LeadManagerLayout() {
  const { isOpen } = useSidebarState();
  
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Outlet />
      <Toaster />
    </div>
  );
}
