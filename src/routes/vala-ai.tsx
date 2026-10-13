import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { lazy, Suspense } from "react";
import { useLanguage } from "@/lib/language-catalog";

const ValaAIModuleContainer = lazy(() =>
  import("@/components/vala-ai/ValaAIModuleContainer").then((m) => ({
    default: m.ValaAIModuleContainer,
  })),
);

function ValaAIRoute() {
  const { translate: t } = useLanguage();
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          {t("Loading Vala AI…")}
        </div>
      }
    >
      <ValaAIModuleContainer />
    </Suspense>
  );
}

const moduleHead = pageHead(
  "Vala AI",
  "Software Vala's own engineering agent: projects, tasks, verification, approvals and releases.",
);

export const Route = createFileRoute("/vala-ai")({
  head: () => ({
    ...moduleHead(),
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  component: ValaAIRoute,
});

export default Route;
