import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { lazy, Suspense } from "react";
import { useLanguage } from "@/lib/language-catalog";

const ValaAIModuleContainer = lazy(() => import("@/components/vala-ai/ValaAIModuleContainer").then((m) => ({ default: m.ValaAIModuleContainer })));

function ValaAIRoute() {
  const { translate: t } = useLanguage();
  return (
    <Suspense fallback={<div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">{t("Loading Vala AI…")}</div>}>
      <ValaAIModuleContainer />
    </Suspense>
  );
}

export const Route = createFileRoute("/vala-ai")({
  head: pageHead("Vala AI", "The platform's own AI workspace — projects, models, prompts and execution logs."),
  component: ValaAIRoute,
});

export default Route;
