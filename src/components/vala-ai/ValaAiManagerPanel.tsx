import { useLanguage } from "@/lib/language-catalog";
import { ValaAiAgent } from "./ValaAiAgent";

export function ValaAiManagerPanel() {
  const { translate: t } = useLanguage();
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-foreground">
      <div className="mb-4 text-2xl font-semibold">{t("Vala AI Management")}</div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        {t("The Vala AI management workspace is now integrated into the Control Panel. Use this module to access the AI command center, analytics, execution logs, prompt history, and platform-wide AI controls.")}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border bg-background/70 p-4">
          <h3 className="text-sm font-semibold">{t("Command Center")}</h3>
          <p className="mt-2 text-xs text-muted-foreground">{t("Run structured platform commands and issue AI-powered tasks from the central Vala workspace.")}</p>
        </div>
        <div className="rounded-3xl border border-border bg-background/70 p-4">
          <h3 className="text-sm font-semibold">{t("AI Activity")}</h3>
          <p className="mt-2 text-xs text-muted-foreground">{t("Track history, logs, project state, and model usage while AI operations execute.")}</p>
        </div>
        <div className="rounded-3xl border border-border bg-background/70 p-4 sm:col-span-2">
          <h3 className="text-sm font-semibold">{t("In-app AI Assistant")}</h3>
          <p className="mt-2 text-xs text-muted-foreground">{t("The floating Vala AI assistant is also available here for immediate conversational support.")}</p>
        </div>
      </div>
    </div>
  );
}
