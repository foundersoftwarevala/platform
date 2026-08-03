import { useEffect, useState } from "react";
import {
  Sparkles, GraduationCap, Hospital, Hotel, ShoppingBag, Wrench, Factory,
  Trophy, Award, BookOpen, Handshake, ChevronRight, Star,
  Activity, Download, ShoppingCart, Brain, Bot, Search as SearchIcon,
  Zap, ShieldCheck, Globe2, Building2, ArrowRight, Quote, Play, HelpCircle,
} from "lucide-react";

const sectionTitle = (title: string, href?: string, subtitle?: string) => (
  <div className="mb-5 flex items-end justify-between px-6">
    <div>
      <h2 className="flex items-center gap-3 text-xl font-bold tracking-tight text-white lg:text-2xl">
        <span className="h-5 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-fuchsia-500 shadow-[0_0_14px_rgba(34,211,238,0.7)]" />
        <span className="bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent">{title}</span>
      </h2>
      {subtitle && <p className="mt-1 pl-4 text-xs text-white/60">{subtitle}</p>}
    </div>
    {href && (
      <a href={href} className="group flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
        View all <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </a>
    )}
  </div>
);

// Shop by Industry
const INDUSTRIES = [
  { name: "Education", href: "#Education", icon: GraduationCap, color: "from-cyan-500/20 to-blue-500/10", text: "text-cyan-300", count: 24 },
  { name: "Healthcare", href: "#Healthcare", icon: Hospital, color: "from-rose-500/20 to-pink-500/10", text: "text-rose-300", count: 18 },
  { name: "Hospitality", href: "#Hospitality%20(Hotel,%20Restaurant,%20Travel)", icon: Hotel, color: "from-amber-500/20 to-orange-500/10", text: "text-amber-300", count: 12 },
  { name: "E-commerce", href: "#E-commerce%20%26%20Online%20Marketplaces", icon: ShoppingBag, color: "from-fuchsia-500/20 to-purple-500/10", text: "text-fuchsia-300", count: 15 },
  { name: "Services", href: "#Customer%20Support%20%26%20Helpdesk", icon: Wrench, color: "from-emerald-500/20 to-teal-500/10", text: "text-emerald-300", count: 22 },
  { name: "Manufacturing", href: "#Manufacturing", icon: Factory, color: "from-violet-500/20 to-indigo-500/10", text: "text-violet-300", count: 14 },
];

export const IndustryGrid = () => (
  <section className="pt-2 pb-6">
    {sectionTitle("Shop by Industry", "#All", "Pre-built suites for every sector")}
    <div className="grid grid-cols-2 gap-4 px-6 sm:grid-cols-3 lg:grid-cols-6">
      {INDUSTRIES.map((i) => (
        <a key={i.name} href={i.href} className={`group relative overflow-hidden rounded-xl border border-white/[0.07] bg-gradient-to-br ${i.color} p-4 transition-all hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-[0_18px_40px_-18px_rgba(34,211,238,0.5)]`}>
          <i.icon className={`h-7 w-7 ${i.text}`} />
          <div className="mt-3 text-sm font-bold text-white">{i.name}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-white/60">{i.count}+ products</div>
        </a>
      ))}
    </div>
  </section>
);

// AI Zone
const AI_TOOLS = [
  { name: "AI Product Finder", desc: "Describe your need, get the perfect stack.", icon: SearchIcon, accent: "text-fuchsia-300", ring: "border-fuchsia-400/30" },
  { name: "AI Recommendation", desc: "Personalised picks from 200+ products.", icon: Sparkles, accent: "text-cyan-300", ring: "border-cyan-400/30" },
  { name: "AI Compare", desc: "Side-by-side feature & price intelligence.", icon: Brain, accent: "text-violet-300", ring: "border-violet-400/30" },
  { name: "AI Sales Assistant", desc: "24/7 chat copilot for buyers & vendors.", icon: Bot, accent: "text-emerald-300", ring: "border-emerald-400/30" },
];

export const AIZone = () => (
  <section className="py-10">
    {sectionTitle("AI Zone", "#All", "Automation copilots built into the marketplace")}
    <div className="grid grid-cols-1 gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4">
      {AI_TOOLS.map((t) => (
        <a key={t.name} href="#AI%20%26%20Automation" className={`group relative overflow-hidden rounded-2xl border ${t.ring} bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5 transition-all hover:-translate-y-1 hover:shadow-[0_24px_60px_-20px_rgba(217,70,239,0.45)]`}>
          <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 ${t.accent}`}>
            <t.icon className="h-5 w-5" />
          </div>
          <div className="text-sm font-bold text-white">{t.name}</div>
          <p className="mt-1 text-xs text-white/60">{t.desc}</p>
          <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-cyan-300">
            Open tool <ArrowRight className="h-3 w-3" />
          </div>
        </a>
      ))}
    </div>
  </section>
);

// Success Stories
const STORIES = [
  { name: "Apollo Clinics", quote: "MediCore 360 cut patient onboarding from 12 min to 90 sec across 42 branches.", author: "Dr. Neha R., CIO", metric: "−87% wait time" },
  { name: "GreenLeaf Schools", quote: "EduFlow Pro replaced 6 tools. Teachers got 9 hours back per week.", author: "Rakesh M., Principal", metric: "9 hrs / week" },
  { name: "Coastal Stays", quote: "HotelNest pushed our direct bookings from 18% to 54% in one quarter.", author: "Anita V., Owner", metric: "+200% direct" },
];

export const SuccessStories = () => (
  <section className="py-10">
    {sectionTitle("Success Stories", "#All")}
    <div className="grid grid-cols-1 gap-4 px-6 lg:grid-cols-3">
      {STORIES.map((s) => (
        <article key={s.name} className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent p-6">
          <Quote className="absolute right-4 top-4 h-8 w-8 text-cyan-400/20" />
          <div className="text-xs font-semibold uppercase tracking-wider text-cyan-300">{s.name}</div>
          <p className="mt-3 text-sm leading-relaxed text-white/85">"{s.quote}"</p>
          <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
            <div className="text-[11px] text-white/60">{s.author}</div>
            <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">{s.metric}</div>
          </div>
        </article>
      ))}
    </div>
  </section>
);

// Awards & Champions
const AWARDS = [
  { title: "Vendor of the Year", who: "MediCore Labs", icon: Trophy, color: "text-amber-300", ring: "border-amber-400/30" },
  { title: "Fastest Growing App", who: "ShopEngine", icon: Zap, color: "text-cyan-300", ring: "border-cyan-400/30" },
  { title: "Editor's Choice", who: "EduFlow Pro", icon: Award, color: "text-fuchsia-300", ring: "border-fuchsia-400/30" },
  { title: "Most Loved by Users", who: "HotelNest", icon: Star, color: "text-rose-300", ring: "border-rose-400/30" },
];

export const AwardsRow = () => (
  <section className="py-10">
    {sectionTitle("Awards & Champions", "#All")}
    <div className="grid grid-cols-2 gap-4 px-6 lg:grid-cols-4">
      {AWARDS.map((a) => (
        <div key={a.title} className={`rounded-2xl border ${a.ring} bg-white/[0.03] p-5`}>
          <a.icon className={`h-7 w-7 ${a.color}`} />
          <div className="mt-3 text-[11px] uppercase tracking-wider text-white/60">{a.title}</div>
          <div className="mt-1 text-base font-bold text-white">{a.who}</div>
        </div>
      ))}
    </div>
  </section>
);

// Live Activity
const seedEvents = () => [
  { icon: ShoppingCart, label: "purchased", text: "ShopEngine — Lifetime", who: "Acme Retail", city: "Mumbai", color: "text-emerald-300" },
  { icon: Download, label: "downloaded", text: "EduFlow Pro v4.2", who: "GreenLeaf Schools", city: "Pune", color: "text-cyan-300" },
  { icon: Star, label: "reviewed", text: "MediCore 360 — 5★", who: "Dr. Neha R.", city: "Bengaluru", color: "text-amber-300" },
  { icon: Sparkles, label: "released", text: "HotelNest v3.0", who: "HotelNest Team", city: "Goa", color: "text-fuchsia-300" },
  { icon: Activity, label: "renewed", text: "FactoryOS Annual", who: "Steel Works Pvt", city: "Chennai", color: "text-violet-300" },
];

export const LiveActivity = () => {
  const [items, setItems] = useState(seedEvents());
  useEffect(() => {
    const t = setInterval(() => {
      setItems((prev) => {
        const next = [...prev];
        next.unshift(next.pop()!);
        return next;
      });
    }, 2500);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="py-10">
      {sectionTitle("Live Marketplace Activity", undefined, "Streaming purchases, downloads, reviews & releases")}
      <div className="mx-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-transparent">
        <ul>
          {items.map((e, i) => (
            <li key={`${e.text}-${i}`} className="flex items-center gap-3 border-b border-white/5 px-5 py-3 text-sm transition-colors hover:bg-white/[0.03] last:border-0 animate-in fade-in slide-in-from-top-1 duration-500">
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 ${e.color}`}>
                <e.icon className="h-4 w-4" />
              </span>
              <span className="text-white/85"><span className="font-semibold text-white">{e.who}</span> {e.label} <span className="font-medium text-white">{e.text}</span></span>
              <span className="ml-auto text-[11px] text-white/60">{e.city} · now</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

// Vala TV
const VIDEOS = [
  { title: "How MediCore 360 powers 42 hospitals", duration: "4:12", views: "12k" },
  { title: "Inside ShopEngine — multi-vendor at scale", duration: "7:48", views: "8.3k" },
  { title: "Build a school OS with EduFlow", duration: "5:21", views: "15k" },
  { title: "FactoryOS predictive maintenance demo", duration: "6:02", views: "4.1k" },
];

export const ValaTV = () => (
  <section className="py-10">
    {sectionTitle("Vala TV", "/demos", "Demos, walkthroughs, customer films")}
    <div className="grid grid-cols-1 gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4">
      {VIDEOS.map((v) => (
        <div key={v.title} className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-gradient-to-br from-[oklch(0.2_0.06_265)] to-[oklch(0.14_0.05_265)] transition-all hover:border-fuchsia-400/40">
          <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-fuchsia-500/20 via-cyan-500/10 to-transparent">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-2xl transition-transform group-hover:scale-110">
                <Play className="h-5 w-5 fill-current" />
              </div>
            </div>
            <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{v.duration}</span>
          </div>
          <div className="p-3">
            <div className="text-sm font-semibold text-white line-clamp-2">{v.title}</div>
            <div className="mt-1 text-[11px] text-white/60">{v.views} views</div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

// Academy
export const Academy = () => {
  const tracks = [
    { title: "Marketplace Foundations", lessons: 24, level: "Beginner", icon: BookOpen },
    { title: "Vendor Mastery", lessons: 38, level: "Intermediate", icon: GraduationCap },
    { title: "Enterprise Implementation", lessons: 52, level: "Advanced", icon: Building2 },
  ];
  return (
    <section className="py-10">
      {sectionTitle("Vala Academy", "#Academy", "Certifications, learning paths, exams")}
      <div className="grid grid-cols-1 gap-4 px-6 lg:grid-cols-3">
        {tracks.map((t) => (
          <a key={t.title} href="#Academy" className="group rounded-2xl border border-white/[0.07] bg-gradient-to-br from-cyan-500/[0.06] to-fuchsia-500/[0.04] p-5 transition-all hover:border-cyan-400/40">
            <t.icon className="h-7 w-7 text-cyan-300" />
            <div className="mt-3 text-base font-bold text-white">{t.title}</div>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-white/60">
              <span>{t.lessons} lessons</span>
              <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-0.5 font-semibold text-fuchsia-300">{t.level}</span>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-cyan-300">Start learning <ArrowRight className="h-3 w-3" /></div>
          </a>
        ))}
      </div>
    </section>
  );
};

// Partner Ecosystem
const PARTNERS = [
  { name: "Reseller", desc: "Up to 40% recurring commission", icon: Handshake, color: "text-orange-300", ring: "border-orange-400/30" },
  { name: "Vendor", desc: "List products, reach 50k+ buyers", icon: ShoppingBag, color: "text-emerald-300", ring: "border-emerald-400/30" },
  { name: "Franchise", desc: "Exclusive territory rights", icon: Building2, color: "text-amber-300", ring: "border-amber-400/30" },
  { name: "Author", desc: "Publish & monetise products", icon: BookOpen, color: "text-cyan-300", ring: "border-cyan-400/30" },
  { name: "Affiliate", desc: "Link, share, earn per sale", icon: Globe2, color: "text-fuchsia-300", ring: "border-fuchsia-400/30" },
  { name: "Implementation", desc: "Deliver projects on the stack", icon: Wrench, color: "text-violet-300", ring: "border-violet-400/30" },
];

export const PartnerEcosystem = () => (
  <section className="py-10">
    {sectionTitle("Partner Ecosystem", "/careers", "Build a business on Software Vala")}
    <div className="grid grid-cols-2 gap-4 px-6 sm:grid-cols-3 lg:grid-cols-6">
      {PARTNERS.map((p) => (
        <a key={p.name} href="/careers" className={`group rounded-2xl border ${p.ring} bg-white/[0.03] p-4 transition-all hover:-translate-y-1`}>
          <p.icon className={`h-6 w-6 ${p.color}`} />
          <div className="mt-3 text-sm font-bold text-white">{p.name}</div>
          <div className="mt-1 text-[11px] text-white/60">{p.desc}</div>
        </a>
      ))}
    </div>
  </section>
);

// FAQ
const FAQS = [
  { q: "How does 2-hour delivery work?", a: "Once payment is confirmed (or demo approved), provisioning triggers and credentials are emailed within 120 minutes." },
  { q: "Can I try before paying?", a: "Yes — every product offers an instant live demo and a 14-day trial with no credit card." },
  { q: "What does the lifetime license include?", a: "One-time payment, unlimited use on a single domain, all major version updates for life, and lifetime support." },
  { q: "Do you offer white-label and reseller rights?", a: "Yes — pick the Reseller or White-Label plan and launch under your own brand within 24 hours." },
  { q: "Is the platform enterprise-ready?", a: "ISO-aligned controls, SOC-ready logging, regional data residency and dedicated success engineers for teams of 100+." },
];

export const FaqSection = () => {
  const [open, setOpen] = useState(0);
  return (
    <section className="py-10">
      {sectionTitle("Frequently Asked Questions")}
      <div className="mx-6 max-w-4xl space-y-2">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <button key={f.q} onClick={() => setOpen(isOpen ? -1 : i)} className={`w-full overflow-hidden rounded-xl border text-left transition-all ${isOpen ? "border-cyan-400/40 bg-cyan-500/[0.04]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/15"}`}>
              <div className="flex items-center gap-3 px-5 py-4">
                <HelpCircle className={`h-4 w-4 flex-shrink-0 ${isOpen ? "text-cyan-300" : "text-white/60"}`} />
                <span className="flex-1 text-sm font-semibold text-white">{f.q}</span>
                <ChevronRight className={`h-4 w-4 text-white/60 transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </div>
              {isOpen && <p className="px-5 pb-4 pl-12 text-xs leading-relaxed text-white/70">{f.a}</p>}
            </button>
          );
        })}
      </div>
    </section>
  );
};

// Enterprise CTA
export const EnterpriseCTA = () => (
  <section className="px-6 py-12">
    <div className="relative overflow-hidden rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-[oklch(0.2_0.08_260)] via-[oklch(0.22_0.1_280)] to-[oklch(0.2_0.09_320)] p-8 lg:p-12">
      <div className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-cyan-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-[120px]" />
      <div className="relative grid items-center gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
            <ShieldCheck className="h-3 w-3" /> Enterprise Grade
          </div>
          <h2 className="mt-4 text-3xl font-bold leading-tight text-white lg:text-4xl">
            Run your entire business on Software Vala™
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-white/80 lg:text-base">
            Dedicated success manager, custom SLAs, SSO, regional data residency, white-glove migration & 24/7 support — built for teams of 100 to 10,000+.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#All" className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-gray-900 shadow-2xl transition-transform hover:scale-[1.03]">
              Talk to Enterprise
            </a>
            <a href="#All" className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/10">
              Trust & Security
            </a>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { k: "50K+", v: "Businesses" },
            { k: "99.99%", v: "Uptime SLA" },
            { k: "120 min", v: "Avg delivery" },
            { k: "24/7", v: "Support" },
          ].map((s) => (
            <div key={s.v} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-md">
              <div className="text-2xl font-bold text-white">{s.k}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-white/60">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);
