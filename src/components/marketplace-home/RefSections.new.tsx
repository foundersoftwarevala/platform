import { useEffect, useState } from "react";
import { useMarketplaceContent } from "@/lib/marketplace-manager/store";
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  Brain,
  Building2,
  ChevronRight,
  Factory,
  Globe2,
  GraduationCap,
  Handshake,
  HelpCircle,
  Hotel,
  Hospital,
  Play,
  Quote,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Trophy,
  Wrench,
  Zap,
  Download,
  Search as SearchIcon,
} from "lucide-react";

import { useLanguage } from "@/lib/language-catalog";

const sectionTitle = (
  title: string,
  href?: string,
  subtitle?: string,
  t?: (s: string) => string,
) => (
  <div className="mb-5 flex items-end justify-between px-6">
    <div>
      <h2 className="flex items-center gap-3 text-xl font-bold tracking-tight text-white lg:text-2xl">
        <span className="h-5 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-fuchsia-500 shadow-[0_0_14px_rgba(34,211,238,0.7)]" />
        <span className="bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent">
          {t ? t(title) : title}
        </span>
      </h2>
      {subtitle ? (
        <p className="mt-1 pl-4 text-xs text-white/60">{t ? t(subtitle) : subtitle}</p>
      ) : null}
    </div>
    {href ? (
      <a
        href={href}
        className="group flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
      >
        {t ? t("View all") : "View all"}
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </a>
    ) : null}
  </div>
);

const INDUSTRIES = [
  {
    name: "Education",
    href: "#Education",
    icon: GraduationCap,
    color: "from-cyan-500/20 to-blue-500/10",
    text: "text-cyan-300",
    count: 24,
  },
  {
    name: "Healthcare",
    href: "#Healthcare",
    icon: Hospital,
    color: "from-rose-500/20 to-pink-500/10",
    text: "text-rose-300",
    count: 18,
  },
  {
    name: "Hospitality",
    href: "#Hospitality%20(Hotel,%20Restaurant,%20Travel)",
    icon: Hotel,
    color: "from-amber-500/20 to-orange-500/10",
    text: "text-amber-300",
    count: 12,
  },
  {
    name: "E-commerce",
    href: "#E-commerce%20%26%20Online%20Marketplaces",
    icon: ShoppingBag,
    color: "from-fuchsia-500/20 to-purple-500/10",
    text: "text-fuchsia-300",
    count: 15,
  },
  {
    name: "Services",
    href: "#Customer%20Support%20%26%20Helpdesk",
    icon: Wrench,
    color: "from-emerald-500/20 to-teal-500/10",
    text: "text-emerald-300",
    count: 22,
  },
  {
    name: "Manufacturing",
    href: "#Manufacturing",
    icon: Factory,
    color: "from-violet-500/20 to-indigo-500/10",
    text: "text-violet-300",
    count: 14,
  },
];

export const IndustryGrid = () => {
  const { translate: t } = useLanguage();

  return (
    <section className="pt-2 pb-6">
      {sectionTitle("Shop by Industry", "#All", "Pre-built suites for every sector", t)}
      <div className="grid grid-cols-2 gap-4 px-6 sm:grid-cols-3 lg:grid-cols-6">
        {INDUSTRIES.map((industry) => (
          <a
            key={industry.name}
            href={industry.href}
            className={`group relative overflow-hidden rounded-xl border border-white/[0.07] bg-gradient-to-br ${industry.color} p-4 transition-all hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-[0_18px_40px_-18px_rgba(34,211,238,0.5)]`}
          >
            <industry.icon className={`h-7 w-7 ${industry.text}`} />
            <div className="mt-3 text-sm font-bold text-white">{t(industry.name)}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-white/60">
              {industry.count}+ {t("products")}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
};

const AI_STYLES = [
  { icon: SearchIcon, accent: "text-fuchsia-300", ring: "border-fuchsia-400/30" },
  { icon: Sparkles, accent: "text-cyan-300", ring: "border-cyan-400/30" },
  { icon: Brain, accent: "text-violet-300", ring: "border-violet-400/30" },
  { icon: Bot, accent: "text-emerald-300", ring: "border-emerald-400/30" },
];

export const AIZone = () => {
  const { aiTools } = useMarketplaceContent();
  const { translate: t } = useLanguage();

  return (
    <section className="py-10">
      {sectionTitle("AI Zone", "#All", "Automation copilots built into the marketplace", t)}
      <div className="grid grid-cols-1 gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4">
        {aiTools.map((tool, index) => {
          const style = AI_STYLES[index % AI_STYLES.length]!;
          return (
            <a
              key={tool.id}
              href="#AI%20%26%20Automation"
              className={`group relative overflow-hidden rounded-2xl border ${style.ring} bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5 transition-all hover:-translate-y-1 hover:shadow-[0_24px_60px_-20px_rgba(217,70,239,0.45)]`}
            >
              <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 ${style.accent}`}>
                <style.icon className="h-5 w-5" />
              </div>
              <div className="text-sm font-bold text-white">{tool.name}</div>
              <p className="mt-1 text-xs text-white/60">{tool.desc}</p>
              <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-cyan-300">
                {t("Open tool")}
                <ArrowRight className="h-3 w-3" />
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
};

export const SuccessStories = () => {
  const { stories } = useMarketplaceContent();

  return (
    <section className="py-10">
      {sectionTitle("Success Stories", "#All")}
      <div className="grid grid-cols-1 gap-4 px-6 lg:grid-cols-3">
        {stories.map((story) => (
          <article
            key={story.id}
            className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent p-6"
          >
            <Quote className="absolute right-4 top-4 h-8 w-8 text-cyan-400/20" />
            <div className="text-xs font-semibold uppercase tracking-wider text-cyan-300">{story.name}</div>
            <p className="mt-3 text-sm leading-relaxed text-white/85">"{story.quote}"</p>
            <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
              <div className="text-[11px] text-white/60">{story.author}</div>
              <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                {story.metric}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

const AWARD_STYLES = [
  { icon: Trophy, color: "text-amber-300", ring: "border-amber-400/30" },
  { icon: Zap, color: "text-cyan-300", ring: "border-cyan-400/30" },
  { icon: Award, color: "text-fuchsia-300", ring: "border-fuchsia-400/30" },
  { icon: Star, color: "text-rose-300", ring: "border-rose-400/30" },
];

export const AwardsRow = () => {
  const { awards } = useMarketplaceContent();
  const { translate: t } = useLanguage();

  return (
    <section className="py-10">
      {sectionTitle("Awards & Champions", "#All", undefined, t)}
      <div className="grid grid-cols-2 gap-4 px-6 lg:grid-cols-4">
        {awards.map((award, index) => {
          const style = AWARD_STYLES[index % AWARD_STYLES.length]!;
          return (
            <div key={award.id} className={`rounded-2xl border ${style.ring} bg-white/[0.03] p-5`}>
              <style.icon className={`h-7 w-7 ${style.color}`} />
              <div className="mt-3 text-[11px] uppercase tracking-wider text-white/60">{award.title}</div>
              <div className="mt-1 text-base font-bold text-white">{award.who}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const seedEvents = () => [
  {
    icon: ShoppingCart,
    label: "purchased",
    text: "ShopEngine — Lifetime",
    who: "Acme Retail",
    city: "Mumbai",
    color: "text-emerald-300",
  },
  {
    icon: Download,
    label: "downloaded",
    text: "EduFlow Pro v4.2",
    who: "GreenLeaf Schools",
    city: "Pune",
    color: "text-cyan-300",
  },
  {
    icon: Star,
    label: "reviewed",
    text: "MediCore 360 — 5★",
    who: "Dr. Neha R.",
    city: "Bengaluru",
    color: "text-amber-300",
  },
  {
    icon: Sparkles,
    label: "released",
    text: "HotelNest v3.0",
    who: "HotelNest Team",
    city: "Goa",
    color: "text-fuchsia-300",
  },
  {
    icon: Activity,
    label: "renewed",
    text: "FactoryOS Annual",
    who: "Steel Works Pvt",
    city: "Chennai",
    color: "text-violet-300",
  },
];

export const LiveActivity = () => {
  const { translate: t } = useLanguage();
  const [items, setItems] = useState(seedEvents());

  useEffect(() => {
    const interval = setInterval(() => {
      setItems((prev) => {
        const next = [...prev];
        next.unshift(next.pop()!);
        return next;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-10">
      {sectionTitle(
        "Live Marketplace Activity",
        undefined,
        "Streaming purchases, downloads, reviews & releases",
        t,
      )}
      <div className="mx-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-transparent">
        <ul>
          {items.map((event, index) => (
            <li
              key={`${event.text}-${index}`}
              className="flex items-center gap-3 border-b border-white/5 px-5 py-3 text-sm transition-colors hover:bg-white/[0.03] last:border-0 animate-in fade-in slide-in-from-top-1 duration-500"
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 ${event.color}`}>
                <event.icon className="h-4 w-4" />
              </span>
              <span className="text-white/85">
                <span className="font-semibold text-white">{event.who}</span> {event.label}{" "}
                <span className="font-medium text-white">{event.text}</span>
              </span>
              <span className="ml-auto text-[11px] text-white/60">
                {event.city} · {t("now")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

const embedUrl = (url: string) => {
  const youtube = url.match(/(?:youtu\.be\/|v=|youtube\.com\/embed\/)([\w-]{6,})/);
  if (youtube) {
    return `https://www.youtube.com/embed/${youtube[1]}?autoplay=1`;
  }

  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) {
    return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`;
  }

  return url;
};

export const ValaTV = () => {
  const { translate: t } = useLanguage();
  const { videos } = useMarketplaceContent();
  const [playing, setPlaying] = useState<string | null>(null);

  return (
    <section className="py-10">
      {sectionTitle("Vala TV", "/marketplace-manager", "Demos, walkthroughs, customer films", t)}
      <div className="grid grid-cols-1 gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4">
        {videos.map((video) => {
          const isPlaying = playing === video.id && Boolean(video.url);
          const isFile = /\.(mp4|webm|ogg)(\?|$)/i.test(video.url);

          return (
            <div
              key={video.id}
              className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-gradient-to-br from-[oklch(0.2_0.06_265)] to-[oklch(0.14_0.05_265)] transition-all hover:border-fuchsia-400/40"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-fuchsia-500/20 via-cyan-500/10 to-transparent">
                {isPlaying ? (
                  isFile ? (
                    <video src={video.url} controls autoPlay className="h-full w-full object-cover" />
                  ) : (
                    <iframe
                      src={embedUrl(video.url)}
                      title={video.title}
                      allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      className="h-full w-full"
                    />
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => video.url && setPlaying(video.id)}
                    aria-label={
                      video.url
                        ? `Play ${video.title}`
                        : `${video.title} - video coming soon`
                    }
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-2xl transition-transform group-hover:scale-110">
                      <Play className="h-5 w-5 fill-current" />
                    </span>
                  </button>
                )}
                {!isPlaying && video.duration ? (
                  <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {video.duration}
                  </span>
                ) : null}
              </div>
              <div className="p-3">
                <div className="text-sm font-semibold text-white line-clamp-2">{video.title}</div>
                <div className="mt-1 text-[11px] text-white/60">
                  {video.views ? `${video.views} ${t("views")}` : t("Vala TV")}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export const Academy = () => {
  const { translate: t } = useLanguage();
  const tracks = [
    { title: "Marketplace Foundations", lessons: 24, level: "Beginner", icon: BookOpen },
    { title: "Vendor Mastery", lessons: 38, level: "Intermediate", icon: GraduationCap },
    { title: "Enterprise Implementation", lessons: 52, level: "Advanced", icon: Building2 },
  ];

  return (
    <section className="py-10">
      {sectionTitle("Vala Academy", "#Academy", "Certifications, learning paths, exams", t)}
      <div className="grid grid-cols-1 gap-4 px-6 lg:grid-cols-3">
        {tracks.map((track) => {
          const Icon = track.icon;
          return (
            <a
              key={track.title}
              href="#Academy"
              className="group rounded-2xl border border-white/[0.07] bg-gradient-to-br from-cyan-500/[0.06] to-fuchsia-500/[0.04] p-5 transition-all hover:border-cyan-400/40"
            >
              <Icon className="h-7 w-7 text-cyan-300" />
              <div className="mt-3 text-base font-bold text-white">{track.title}</div>
              <div className="mt-1 flex items-center gap-3 text-[11px] text-white/60">
                <span>{track.lessons} {t("lessons")}</span>
                <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-0.5 font-semibold text-fuchsia-300">
                  {t(track.level)}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-cyan-300">
                {t("Start learning")}
                <ArrowRight className="h-3 w-3" />
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
};

const PARTNERS = [
  {
    name: "Reseller",
    desc: "Up to 40% recurring commission",
    icon: Handshake,
    color: "text-orange-300",
    ring: "border-orange-400/30",
  },
  {
    name: "Vendor",
    desc: "List products, reach 50k+ buyers",
    icon: ShoppingBag,
    color: "text-emerald-300",
    ring: "border-emerald-400/30",
  },
  {
    name: "Franchise",
    desc: "Exclusive territory rights",
    icon: Building2,
    color: "text-amber-300",
    ring: "border-amber-400/30",
  },
  {
    name: "Author",
    desc: "Publish & monetise products",
    icon: BookOpen,
    color: "text-cyan-300",
    ring: "border-cyan-400/30",
  },
  {
    name: "Affiliate",
    desc: "Link, share, earn per sale",
    icon: Globe2,
    color: "text-fuchsia-300",
    ring: "border-fuchsia-400/30",
  },
  {
    name: "Implementation",
    desc: "Deliver projects on the stack",
    icon: Wrench,
    color: "text-violet-300",
    ring: "border-violet-400/30",
  },
];

export const PartnerEcosystem = () => {
  const { translate: t } = useLanguage();

  return (
    <section className="py-10">
      {sectionTitle("Partner Ecosystem", "/careers", "Build a business on Software Vala", t)}
      <div className="grid grid-cols-2 gap-4 px-6 sm:grid-cols-3 lg:grid-cols-6">
        {PARTNERS.map((partner) => {
          const PartnerIcon = partner.icon;
          return (
            <a
              key={partner.name}
              href="/careers"
              className={`group rounded-2xl border ${partner.ring} bg-white/[0.03] p-4 transition-all hover:-translate-y-1`}
            >
              <PartnerIcon className={`h-6 w-6 ${partner.color}`} />
              <div className="mt-3 text-sm font-bold text-white">{t(partner.name)}</div>
              <div className="mt-1 text-[11px] text-white/60">{t(partner.desc)}</div>
            </a>
          );
        })}
      </div>
    </section>
  );
};

export const FaqSection = () => {
  const { translate: t } = useLanguage();
  const { faqs } = useMarketplaceContent();
  const [open, setOpen] = useState(0);

  return (
    <section className="py-10">
      {sectionTitle(
        "Frequently Asked Questions",
        "/marketplace-manager",
        "Everything about pricing, delivery, white label and support",
        t,
      )}
      <div className="mx-6 max-w-4xl space-y-2">
        {faqs.map((faq, index) => {
          const isOpen = open === index;
          return (
            <button
              key={faq.id}
              type="button"
              onClick={() => setOpen(isOpen ? -1 : index)}
              className={`w-full overflow-hidden rounded-xl border text-left transition-all ${
                isOpen
                  ? "border-cyan-400/40 bg-cyan-500/[0.04]"
                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/15"
              }`}
            >
              <div className="flex items-center gap-3 px-5 py-4">
                <HelpCircle
                  className={`h-4 w-4 flex-shrink-0 ${isOpen ? "text-cyan-300" : "text-white/60"}`}
                />
                <span className="flex-1 text-sm font-semibold text-white">{faq.q}</span>
                <ChevronRight
                  className={`h-4 w-4 text-white/60 transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
              </div>
              {isOpen && (
                <p className="px-5 pb-4 pl-12 text-xs leading-relaxed text-white/70">{faq.a}</p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export const EnterpriseCTA = () => {
  const { translate: t } = useLanguage();

  return (
    <section className="px-6 py-12">
      {sectionTitle("Enterprise Grade", undefined, undefined, t)}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-[oklch(0.2_0.08_260)] via-[oklch(0.22_0.1_280)] to-[oklch(0.2_0.09_320)] p-8 lg:p-12">
        <div className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-[120px]" />
        <div className="relative grid items-center gap-6 lg:grid-cols-[2fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
              <ShieldCheck className="h-3 w-3" /> {t("Enterprise Grade")}
            </div>
            <h2 className="mt-4 text-3xl font-bold leading-tight text-white lg:text-4xl">
              {t("Run your entire business on Software Vala™")}
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-white/80 lg:text-base">
              {t(
                "Dedicated success manager, custom SLAs, SSO, regional data residency, white-glove migration & 24/7 support — built for teams of 100 to 10,000+.",
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#All"
                className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-gray-900 shadow-2xl transition-transform hover:scale-[1.03]"
              >
                {t("Talk to Enterprise")}
              </a>
              <a
                href="#All"
                className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/10"
              >
                {t("Trust & Security")}
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: "50K+", v: "Businesses" },
              { k: "99.99%", v: "Uptime SLA" },
              { k: "120 min", v: "Avg delivery" },
              { k: "24/7", v: "Support" },
            ].map((stat) => (
              <div
                key={stat.v}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-md"
              >
                <div className="text-2xl font-bold text-white">{stat.k}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-white/60">{stat.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
