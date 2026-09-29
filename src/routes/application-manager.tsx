import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ClipboardList } from "lucide-react";

import { RequireRole } from "@/components/auth/RequireRole";
import { AllApplicationsQueue } from "@/components/applications/RoleApplicationsQueue";
import { Toaster } from "@/components/ui/sonner";
import { useTranslation } from "@/lib/i18n/use-translation";
import "@/styles/marketplace-home.css";

/**
 * Application Manager - every application submitted through /apply/<role>,
 * managed from the Control Panel.
 *
 * Resellers, vendors, authors, franchises, influencers and affiliates all land
 * here in one queue: read in full, their documents opened, approved, refused
 * with a reason or suspended. Each role's own Manager still runs the accounts
 * an approval creates; the application itself is decided here. It is the same
 * queue component the Franchise and Influencer Managers show for their own
 * kind, so there is one way of deciding an application, not several.
 *
 * Access follows the database: application_staff() decides who may read and
 * decide, whatever this page shows.
 */
export const Route = createFileRoute("/application-manager")({
  head: () => ({
    meta: [
      { title: "Application Manager — Software Vala Control Panel" },
      {
        name: "description",
        content:
          "Review, approve, refuse and suspend every partner application from the Control Panel.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireRole role={["marketing"]}>
      <ApplicationManager />
    </RequireRole>
  ),
});

function ApplicationManager() {
  const { t } = useTranslation();
  return (
    <main className="dark mpc-home min-h-screen bg-[#0a1628] px-4 py-8 text-white sm:px-8">
      <Toaster />
      <div className="mx-auto max-w-7xl">
        <Link
          to="/control-panel"
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[12px] font-semibold text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("apply.manager.back")}
        </Link>
        <header className="mb-6 flex flex-wrap items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-300">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black">{t("apply.manager.title")}</h1>
            <p className="text-sm text-white/60">{t("apply.manager.subtitle")}</p>
          </div>
        </header>
        <AllApplicationsQueue />
      </div>
    </main>
  );
}
