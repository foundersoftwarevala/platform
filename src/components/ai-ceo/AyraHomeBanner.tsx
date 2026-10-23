import { Link } from "@tanstack/react-router";
import { ArrowRight, Eye, Sparkles } from "lucide-react";

import { useTranslation } from "@/lib/i18n/use-translation";

export function AyraHomeBanner() {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="ayra-home-banner-title"
      className="hero-surface relative overflow-hidden rounded-2xl border border-primary/25 p-5 sm:p-6"
    >
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground/80">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>AYRA</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px]">
              <Eye className="h-3 w-3" aria-hidden="true" />
              {t("ceo.ayra_home_read_only")}
            </span>
          </div>
          <h2 id="ayra-home-banner-title" className="text-lg font-semibold text-primary-foreground">
            {t("ceo.ayra_home_title")}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-primary-foreground/80">
            {t("ceo.ayra_home_description")}
          </p>
        </div>
        <Link
          to="/ai-ceo/ayra"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {t("ceo.ayra_home_open")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
