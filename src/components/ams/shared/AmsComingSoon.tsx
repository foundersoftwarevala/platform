import { Link } from "@tanstack/react-router";
import { Clock3 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";

export function AmsComingSoon() {
  const { t } = useTranslation();

  return (
    <section className="surface-card mx-auto my-12 max-w-2xl space-y-4 p-8 text-center" role="status">
      <Clock3 className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t("ams.coming_soon")}</p>
        <h1 className="mt-2 text-2xl font-semibold">{t("ams.collection_records_unavailable")}</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("ams.collection_records_notice")}
      </p>
      <Link to="/ams/achievements" className="inline-flex text-sm font-medium text-primary hover:underline">
        {t("ams.view_recorded_achievements")}
      </Link>
    </section>
  );
}
