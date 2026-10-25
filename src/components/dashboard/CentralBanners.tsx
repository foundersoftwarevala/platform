import { useQuery } from "@tanstack/react-query";
import { ArrowRight, PartyPopper, ShieldAlert } from "lucide-react";
import { iconFromName } from "@/lib/hero-slides";
import { bannersForRole, fetchCentralBanners, type CentralBannerType } from "@/lib/central-banners";

const DASHBOARD_TYPES: readonly CentralBannerType[] = [
  "dashboard_welcome",
  "festival_wish",
  "officer_notice",
];

export function CentralBanners({ role, fallback }: { role: string; fallback: React.ReactNode }) {
  const query = useQuery({
    queryKey: ["central-banners", role, DASHBOARD_TYPES],
    queryFn: () => fetchCentralBanners(DASHBOARD_TYPES),
    staleTime: 60_000,
  });
  const banners = bannersForRole(query.data ?? [], role);
  const welcome = banners.filter((banner) => banner.banner_type === "dashboard_welcome");
  const notices = banners.filter((banner) => banner.banner_type !== "dashboard_welcome");

  return (
    <div className="space-y-4">
      {query.isError && (
        <p
          role="status"
          className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground"
        >
          Dashboard announcements are temporarily unavailable.
        </p>
      )}
      {welcome.length > 0
        ? welcome.map((banner) => {
            const Icon = iconFromName(banner.icon_name);
            return (
              <section
                key={banner.id}
                className={`relative overflow-hidden rounded-3xl border border-border p-6 text-white shadow-card md:p-10 bg-gradient-to-br ${banner.gradient}`}
              >
                <div className="relative max-w-3xl">
                  {banner.kicker && (
                    <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                      <Icon className="h-4 w-4" />
                      {banner.kicker}
                    </p>
                  )}
                  <h1 className="text-3xl font-black tracking-tight md:text-5xl">{banner.title}</h1>
                  {banner.subtitle && (
                    <p className="mt-3 max-w-2xl text-sm text-white/80 md:text-base">
                      {banner.subtitle}
                    </p>
                  )}
                  {banner.cta_primary && (
                    <a
                      href={banner.cta_link}
                      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
                    >
                      {banner.cta_primary}
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </section>
            );
          })
        : fallback}
      {notices.map((banner) => {
        const Icon = banner.banner_type === "festival_wish" ? PartyPopper : ShieldAlert;
        return (
          <section
            key={banner.id}
            data-banner-type={banner.banner_type}
            className={`flex items-start gap-3 rounded-xl border border-border px-4 py-3 text-foreground bg-gradient-to-r ${banner.gradient}`}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">{banner.title}</p>
              {banner.subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{banner.subtitle}</p>
              )}
              {banner.cta_primary && (
                <a
                  href={banner.cta_link}
                  className="mt-2 inline-flex text-sm font-semibold underline"
                >
                  {banner.cta_primary}
                </a>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
