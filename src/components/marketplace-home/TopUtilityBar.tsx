import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { listNotifications, markAllRead, subscribe as subscribeApps } from "@/lib/applications/store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@/lib/serverFn";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Bell,
  Bot,
  Calculator as CalculatorIcon,
  CalendarDays,
  Check,
  Clock,
  Coins,
  Delete,
  Heart,
  LogIn,
  LayoutDashboard,

  Globe2,
  Headphones,
  Loader2,
  Lock,
  MapPin,
  Send,
  Sparkles,
  Rocket,
  CloudSun,
} from "lucide-react";
import {
  askStorefrontAi,
  getExchangeRates,
  getHolidays,
  getWeather,
  translateTexts,
} from "@/lib/topbar/utility.functions";

/* ------------------------------------------------------------------ */
/* shared shell                                                        */
/* ------------------------------------------------------------------ */

const TRIGGER = "kr-btn tb-pill group";

const PANEL =
  "kr-panel w-[300px] rounded-2xl border border-white/10 bg-[#0b1a30]/95 p-0 text-white shadow-2xl backdrop-blur-xl";

function PanelHead({ icon: Icon, title, note }: { icon: any; title: string; note?: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-400/25 to-amber-300/20 text-cyan-300">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-bold">{title}</div>
        {note && <div className="truncate text-[10px] text-white/50">{note}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Apply Now                                                        */
/* ------------------------------------------------------------------ */

const APPLY_ROLES: { key: string; label: string; blurb: string }[] = [
  { key: "vendor", label: "Become Vendor", blurb: "List your own software products" },
  { key: "author", label: "Become Author", blurb: "Publish code, docs and templates" },
  { key: "reseller", label: "Become Reseller", blurb: "Sell our catalog, keep the margin" },
  { key: "affiliate", label: "Become Affiliate", blurb: "Earn per referred sale" },
  { key: "franchise", label: "Become Franchise", blurb: "Run Software Vala in your city" },
  { key: "influencer", label: "Become Influencer", blurb: "Collaborate on campaigns" },
  { key: "employee", label: "Become Employee", blurb: "Full-time openings" },
];

function ApplyNow({ t }: { t: (s: string) => string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={TRIGGER}>
        <Rocket className="h-3.5 w-3.5 text-amber-200 transition-transform duration-300 group-hover:-translate-y-0.5" />
        {t("Apply Now")}
        <span className="text-[9px] opacity-70">▼</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="kr-panel w-64 border-white/10 bg-[#0b1a30]/95 text-white backdrop-blur-xl">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-white/50">
          {t("Role applications")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        {APPLY_ROLES.map((r, i) => (
          <DropdownMenuItem
            key={r.key}
            asChild
            className="kr-item cursor-pointer focus:bg-white/10"
            style={{ animationDelay: `${i * 28}ms` }}
          >
            <Link to="/apply/$role" params={{ role: r.key }}>
              <div className="flex w-full flex-col">
                <span className="text-[12.5px] font-semibold">{r.label}</span>
                <span className="text-[10.5px] text-white/50">{r.blurb}</span>
              </div>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Language                                                         */
/* ------------------------------------------------------------------ */

export const LANGS = [
  { code: "en", flag: "🇬🇧", label: "English", name: "English" },
  { code: "hi", flag: "🇮🇳", label: "हिन्दी", name: "Hindi" },
  { code: "ar", flag: "🇸🇦", label: "العربية", name: "Arabic" },
  { code: "es", flag: "🇪🇸", label: "Español", name: "Spanish" },
  { code: "fr", flag: "🇫🇷", label: "Français", name: "French" },
  { code: "de", flag: "🇩🇪", label: "Deutsch", name: "German" },
  { code: "pt", flag: "🇧🇷", label: "Português", name: "Portuguese" },
  { code: "ru", flag: "🇷🇺", label: "Русский", name: "Russian" },
  { code: "zh", flag: "🇨🇳", label: "中文", name: "Chinese (Simplified)" },
  { code: "ja", flag: "🇯🇵", label: "日本語", name: "Japanese" },
  { code: "ko", flag: "🇰🇷", label: "한국어", name: "Korean" },
  { code: "id", flag: "🇮🇩", label: "Indonesia", name: "Indonesian" },
];

/** UI strings translated live by the AI gateway (real translation, cached per language). */
const BAR_STRINGS = [
  "Apply Now",
  "Role applications",
  "Language",
  "Currency",
  "World Clock",
  "Weather",
  "Calendar",
  "Calculator",
  "AI Chat",
  "Notifications",
  "Login",
  "Register",
];

function useBarTranslation() {
  const [lang, setLang] = useState("en");
  const [dict, setDict] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const translate = useServerFn(translateTexts);

  useEffect(() => {
    const saved = localStorage.getItem("sv_lang");
    const detected = (navigator.language || "en").slice(0, 2).toLowerCase();
    const initial = saved || (LANGS.some((l) => l.code === detected) ? detected : "en");
    if (initial !== "en") void apply(initial, !saved);
    else setLang("en");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = useCallback(
    async (code: string, autoDetected = false) => {
      const target = LANGS.find((l) => l.code === code);
      if (!target) return;
      setLang(code);
      localStorage.setItem("sv_lang", code);
      document.documentElement.lang = code;
      document.documentElement.dir = code === "ar" ? "rtl" : "ltr";
      if (code === "en") {
        setDict({});
        return;
      }
      const cacheKey = `sv_lang_dict_${code}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          setDict(JSON.parse(cached));
          return;
        } catch {
          /* refetch below */
        }
      }
      setBusy(true);
      const res = await translate({ data: { texts: BAR_STRINGS, targetLanguage: target.name } });
      setBusy(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const map: Record<string, string> = {};
      BAR_STRINGS.forEach((s, i) => (map[s] = res.texts[i] ?? s));
      setDict(map);
      localStorage.setItem(cacheKey, JSON.stringify(map));
      if (autoDetected) toast.success(`Language auto-detected: ${target.label}`);
    },
    [translate],
  );

  const t = useCallback((s: string) => dict[s] ?? s, [dict]);
  return { lang, t, apply, busy };
}

function LanguagePicker({
  lang,
  apply,
  busy,
  t,
}: {
  lang: string;
  apply: (c: string) => void;
  busy: boolean;
  t: (s: string) => string;
}) {
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];
  return (
    <Popover>
      <PopoverTrigger className={TRIGGER}>
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <span className="text-sm leading-none">{current?.flag}</span>
        )}
        <span className="hidden sm:inline">{t("Language")}</span>
        <Globe2 className="h-3.5 w-3.5 text-cyan-200 transition-transform duration-500 group-hover:rotate-180" />
      </PopoverTrigger>
      <PopoverContent align="end" className={PANEL}>
        <PanelHead icon={Globe2} title={t("Language")} note="Auto-detected from your browser" />
        <ScrollArea className="h-64">
          <div className="p-2">
            {LANGS.map((l, i) => (
              <button
                key={l.code}
                onClick={() => apply(l.code)}
                className="kr-item flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-white/10"
                style={{ animationDelay: `${i * 22}ms` }}
              >
                <span className="text-base leading-none">{l.flag}</span>
                <span className="flex-1 font-medium">{l.label}</span>
                <span className="text-[10px] uppercase text-white/40">{l.code}</span>
                {l.code === lang && <Check className="h-3.5 w-3.5 text-emerald-400" />}
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Currency                                                         */
/* ------------------------------------------------------------------ */

const CURRENCIES = [
  { code: "USD", flag: "🇺🇸" }, { code: "INR", flag: "🇮🇳" }, { code: "EUR", flag: "🇪🇺" },
  { code: "GBP", flag: "🇬🇧" }, { code: "AED", flag: "🇦🇪" }, { code: "SAR", flag: "🇸🇦" },
  { code: "SGD", flag: "🇸🇬" }, { code: "AUD", flag: "🇦🇺" }, { code: "CAD", flag: "🇨🇦" },
  { code: "JPY", flag: "🇯🇵" }, { code: "KRW", flag: "🇰🇷" }, { code: "CNY", flag: "🇨🇳" },
  { code: "ZAR", flag: "🇿🇦" }, { code: "BRL", flag: "🇧🇷" },
];

function CurrencyPicker({ t }: { t: (s: string) => string }) {
  const rates = useServerFn(getExchangeRates);
  const [target, setTarget] = useState("INR");
  const [amount, setAmount] = useState("249");

  useEffect(() => {
    const saved = localStorage.getItem("sv_currency");
    if (saved) setTarget(saved);
  }, []);

  const q = useQuery({
    queryKey: ["fx", "USD"],
    queryFn: () => rates({ data: { base: "USD" } }),
    staleTime: 1000 * 60 * 30,
  });

  const rate = q.data?.rates?.[target];
  const value = Number(amount.replace(/,/g, ""));
  const converted = rate && Number.isFinite(value) ? value * rate : null;

  return (
    <Popover>
      <PopoverTrigger className={TRIGGER}>
        <Coins className="h-3.5 w-3.5 text-amber-200 transition-transform duration-300 group-hover:scale-110" />
        <span className="hidden sm:inline">{t("Currency")}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className={PANEL}>
        <PanelHead
          icon={Coins}
          title={t("Currency")}
          note={q.data?.updated ? `Live rates · ${q.data.updated}` : "Loading live rates…"}
        />
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-[12px] font-bold">USD</span>
            <Input
              value={amount}
              inputMode="decimal"
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 border-white/15 bg-white/5 text-white"
            />
          </div>
          <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 py-2.5">
            {q.isLoading && <span className="text-[12px] text-white/60">Fetching live rates…</span>}
            {q.data?.error && <span className="text-[12px] text-rose-300">{q.data.error}</span>}
            {converted != null && (
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-extrabold text-cyan-200">
                  {converted.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] font-semibold text-white/60">
                  {target} · 1 USD = {rate?.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
              </div>
            )}
          </div>
          <ScrollArea className="h-40">
            <div className="grid grid-cols-2 gap-1.5 pr-2">
              {CURRENCIES.map((c, i) => (
                <button
                  key={c.code}
                  onClick={() => {
                    setTarget(c.code);
                    localStorage.setItem("sv_currency", c.code);
                  }}
                  className={`kr-item flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-semibold hover:bg-white/10 ${
                    c.code === target ? "bg-white/10 ring-1 ring-cyan-400/40" : ""
                  }`}
                  style={{ animationDelay: `${i * 18}ms` }}
                >
                  <span>{c.flag}</span>
                  {c.code}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* 4. World Clock                                                      */
/* ------------------------------------------------------------------ */

const ZONES = [
  { tz: "Asia/Kolkata", city: "Mumbai", flag: "🇮🇳" },
  { tz: "Asia/Dubai", city: "Dubai", flag: "🇦🇪" },
  { tz: "Europe/London", city: "London", flag: "🇬🇧" },
  { tz: "America/New_York", city: "New York", flag: "🇺🇸" },
  { tz: "America/Los_Angeles", city: "San Francisco", flag: "🇺🇸" },
  { tz: "Asia/Singapore", city: "Singapore", flag: "🇸🇬" },
  { tz: "Asia/Seoul", city: "Seoul", flag: "🇰🇷" },
  { tz: "Asia/Tokyo", city: "Tokyo", flag: "🇯🇵" },
  { tz: "Australia/Sydney", city: "Sydney", flag: "🇦🇺" },
];

function WorldClock({ t }: { t: (s: string) => string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const local = now
    ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--:--";

  return (
    <Popover>
      <PopoverTrigger className={TRIGGER}>
        <Clock className="h-3.5 w-3.5 text-cyan-200 transition-transform duration-500 group-hover:rotate-[360deg]" />
        <span className="tabular-nums">{local}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className={PANEL}>
        <PanelHead icon={Clock} title={t("World Clock")} note={Intl.DateTimeFormat().resolvedOptions().timeZone} />
        <div className="p-2">
          {ZONES.map((z, i) => (
            <div
              key={z.tz}
              className="kr-item flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[12.5px] hover:bg-white/5"
              style={{ animationDelay: `${i * 22}ms` }}
            >
              <span className="flex items-center gap-2">
                <span>{z.flag}</span>
                <span className="font-medium">{z.city}</span>
              </span>
              <span className="font-mono tabular-nums text-cyan-200">
                {now
                  ? now.toLocaleTimeString("en-GB", {
                      timeZone: z.tz,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : "--:--:--"}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Weather                                                          */
/* ------------------------------------------------------------------ */

const WX: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain",
  65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers",
  81: "Rain showers", 82: "Violent showers", 95: "Thunderstorm", 96: "Thunderstorm + hail",
};

function Weather({ t }: { t: (s: string) => string }) {
  const wx = useServerFn(getWeather);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [city, setCity] = useState("");
  const [queryCity, setQueryCity] = useState("Mumbai");

  const q = useQuery({
    queryKey: ["wx", coords?.lat ?? queryCity, coords?.lon ?? ""],
    queryFn: () => wx({ data: coords ? { lat: coords.lat, lon: coords.lon } : { city: queryCity } }),
    staleTime: 1000 * 60 * 10,
  });

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => toast.error("Location permission denied — search a city instead."),
    );
  };

  const d = q.data;
  return (
    <Popover>
      <PopoverTrigger className={TRIGGER}>
        <CloudSun className="h-3.5 w-3.5 text-amber-200 transition-transform duration-300 group-hover:-translate-y-0.5" />
        <span className="tabular-nums">{d && !d.error ? `${Math.round(d.tempC)}°` : "—"}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className={PANEL}>
        <PanelHead icon={CloudSun} title={t("Weather")} note="Live conditions · Open-Meteo" />
        <div className="space-y-3 p-4">
          <div className="flex gap-2">
            <Input
              value={city}
              placeholder="Search a city…"
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && city.trim()) {
                  setCoords(null);
                  setQueryCity(city.trim());
                }
              }}
              className="h-9 border-white/15 bg-white/5 text-white"
            />
            <Button size="sm" variant="secondary" onClick={locate} className="h-9 gap-1 px-2">
              <MapPin className="h-3.5 w-3.5" />
            </Button>
          </div>
          {q.isFetching && <div className="text-[12px] text-white/60">Fetching live weather…</div>}
          {d?.error && <div className="text-[12px] text-rose-300">{d.error}</div>}
          {d && !d.error && (
            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-cyan-400/10 to-amber-300/10 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold">{Math.round(d.tempC)}°C</span>
                <span className="text-[12px] font-semibold text-white/70">
                  {d.city}
                  {d.country ? `, ${d.country}` : ""}
                </span>
              </div>
              <div className="mt-1 text-[12px] text-cyan-200">{WX[d.code] ?? "Current conditions"}</div>
              <div className="mt-2 flex gap-4 text-[11px] text-white/60">
                <span>💨 {Math.round(d.windKph)} km/h</span>
                <span>💧 {d.humidity}%</span>
                <span>{d.isDay ? "☀️ Day" : "🌙 Night"}</span>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Calendar                                                         */
/* ------------------------------------------------------------------ */

type Reminder = { id: string; date: string; text: string };

const HOLIDAY_COUNTRIES = [
  { code: "IN", label: "India 🇮🇳" }, { code: "US", label: "USA 🇺🇸" }, { code: "GB", label: "UK 🇬🇧" },
  { code: "AE", label: "UAE 🇦🇪" }, { code: "SG", label: "Singapore 🇸🇬" }, { code: "KR", label: "Korea 🇰🇷" },
];

function CalendarTool({ t }: { t: (s: string) => string }) {
  const hol = useServerFn(getHolidays);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [country, setCountry] = useState("IN");
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    setDate(new Date());
    try {
      setReminders(JSON.parse(localStorage.getItem("sv_reminders") || "[]"));
    } catch {
      setReminders([]);
    }
  }, []);

  const year = date?.getFullYear() ?? new Date().getFullYear();
  const q = useQuery({
    queryKey: ["holidays", country, year],
    queryFn: () => hol({ data: { countryCode: country, year } }),
    staleTime: 1000 * 60 * 60 * 12,
  });

  const iso = date ? date.toISOString().slice(0, 10) : "";
  const dayHolidays = (q.data?.holidays ?? []).filter((h) => h.date === iso);
  const dayReminders = reminders.filter((r) => r.date === iso);
  const upcoming = (q.data?.holidays ?? []).filter((h) => h.date >= new Date().toISOString().slice(0, 10)).slice(0, 4);

  const save = (next: Reminder[]) => {
    setReminders(next);
    localStorage.setItem("sv_reminders", JSON.stringify(next));
  };

  return (
    <Popover>
      <PopoverTrigger className={TRIGGER}>
        <CalendarDays className="h-3.5 w-3.5 text-cyan-200 transition-transform duration-300 group-hover:-translate-y-0.5" />
        <span className="hidden sm:inline">{t("Calendar")}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className={`${PANEL} w-[340px]`}>
        <PanelHead icon={CalendarDays} title={t("Calendar")} note="Holidays · reminders · scheduling" />
        <div className="p-3">
          <div className="mb-2 flex flex-wrap gap-1">
            {HOLIDAY_COUNTRIES.map((c) => (
              <button
                key={c.code}
                onClick={() => setCountry(c.code)}
                className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition-colors ${
                  c.code === country
                    ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200"
                    : "border-white/15 text-white/60 hover:bg-white/10"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-2"
          />
          <div className="mt-3 space-y-2">
            {dayHolidays.map((h) => (
              <div key={h.date + h.name} className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-2.5 py-1.5 text-[11.5px] text-amber-200">
                🎉 {h.localName} <span className="text-white/50">({h.name})</span>
              </div>
            ))}
            {dayReminders.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11.5px]">
                <span>🔔 {r.text}</span>
                <button onClick={() => save(reminders.filter((x) => x.id !== r.id))} className="text-white/40 hover:text-rose-300">
                  <Delete className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={text}
                placeholder="Add a reminder…"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && text.trim() && iso) {
                    save([...reminders, { id: crypto.randomUUID(), date: iso, text: text.trim() }]);
                    setText("");
                  }
                }}
                className="h-8 border-white/15 bg-white/5 text-[12px] text-white"
              />
            </div>
            {upcoming.length > 0 && (
              <div className="pt-1 text-[10.5px] text-white/45">
                Next holidays: {upcoming.map((h) => `${h.date.slice(5)} ${h.localName}`).join(" · ")}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Calculator                                                       */
/* ------------------------------------------------------------------ */

/** Safe expression evaluator (shunting-yard) — no eval, no Function. */
function evaluate(expr: string): number | null {
  const tokens = expr.match(/(\d+\.?\d*|[+\-*/%()])/g);
  if (!tokens) return null;
  const prec: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };
  const out: (number | string)[] = [];
  const ops: string[] = [];
  let prev: string | null = null;
  for (const tk of tokens) {
    if (/^\d/.test(tk)) {
      out.push(parseFloat(tk));
    } else if (tk === "(") {
      ops.push(tk);
    } else if (tk === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop()!);
      if (!ops.length) return null;
      ops.pop();
    } else {
      if ((tk === "-" || tk === "+") && (prev === null || prev === "(" || prec[prev])) out.push(0);
      while (ops.length && (prec[ops[ops.length - 1]!] ?? 0) >= (prec[tk] ?? 0)) out.push(ops.pop()!);
      ops.push(tk);
    }
    prev = tk;
  }
  while (ops.length) {
    const op = ops.pop()!;
    if (op === "(") return null;
    out.push(op);
  }
  const st: number[] = [];
  for (const tk of out) {
    if (typeof tk === "number") st.push(tk);
    else {
      const b = st.pop();
      const a = st.pop();
      if (a === undefined || b === undefined) return null;
      st.push(tk === "+" ? a + b : tk === "-" ? a - b : tk === "*" ? a * b : tk === "/" ? a / b : a % b);
    }
  }
  const r = st.pop();
  return r !== undefined && Number.isFinite(r) ? r : null;
}

const KEYS = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "%", "+"];

function CalculatorTool({ t }: { t: (s: string) => string }) {
  const [expr, setExpr] = useState("");
  const result = expr ? evaluate(expr) : null;
  return (
    <Popover>
      <PopoverTrigger className={TRIGGER}>
        <CalculatorIcon className="h-3.5 w-3.5 text-amber-200 transition-transform duration-300 group-hover:scale-110" />
        <span className="hidden lg:inline">{t("Calculator")}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className={`${PANEL} w-[260px]`}>
        <PanelHead icon={CalculatorIcon} title={t("Calculator")} />
        <div className="p-3">
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-right">
            <div className="min-h-4 truncate font-mono text-[12px] text-white/50">{expr || "0"}</div>
            <div className="truncate font-mono text-xl font-bold text-cyan-200">
              {result != null ? result.toLocaleString(undefined, { maximumFractionDigits: 8 }) : "—"}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            <button onClick={() => setExpr("")} className="kr-key col-span-2 bg-rose-500/20 text-rose-200">AC</button>
            <button onClick={() => setExpr((e) => e.slice(0, -1))} className="kr-key bg-white/10">⌫</button>
            <button onClick={() => setExpr((e) => e + "(")} className="kr-key bg-white/10">(</button>
            {KEYS.map((k) => (
              <button key={k} onClick={() => setExpr((e) => e + k)} className="kr-key bg-white/[0.07]">
                {k}
              </button>
            ))}
            <button onClick={() => setExpr((e) => e + ")")} className="kr-key bg-white/10">)</button>
            <button
              onClick={() => setExpr(result != null ? String(result) : "")}
              className="kr-key col-span-3 bg-gradient-to-r from-cyan-500/40 to-amber-400/30 font-bold"
            >
              =
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* 8. AI Chat + Human live chat                                        */
/* ------------------------------------------------------------------ */

type Msg = { role: "user" | "assistant"; content: string };

function AiChat({ t }: { t: (s: string) => string }) {
  const ask = useServerFn(askStorefrontAi);
  const [mode, setMode] = useState<"ai" | "human">("ai");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    const res = await ask({ data: { messages: next } });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setMsgs([...next, { role: "assistant", content: res.reply }]);
  };

  return (
    <Popover>
      <PopoverTrigger className={TRIGGER}>
        <Bot className="h-3.5 w-3.5 text-cyan-200 transition-transform duration-300 group-hover:-translate-y-0.5" />
        <span className="hidden sm:inline">{t("AI Chat")}</span>
        <span className="kr-dot" />
      </PopoverTrigger>
      <PopoverContent align="end" className={`${PANEL} w-[340px]`}>
        <PanelHead icon={Sparkles} title={t("AI Chat")} note="Vala Assistant · or talk to a human" />
        <div className="flex gap-1 border-b border-white/10 p-2">
          <button
            onClick={() => setMode("ai")}
            className={`flex-1 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold ${mode === "ai" ? "bg-cyan-400/15 text-cyan-200" : "text-white/60 hover:bg-white/5"}`}
          >
            <Bot className="mr-1 inline h-3.5 w-3.5" /> AI Assistant
          </button>
          <button
            onClick={() => setMode("human")}
            className={`flex-1 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold ${mode === "human" ? "bg-amber-300/15 text-amber-200" : "text-white/60 hover:bg-white/5"}`}
          >
            <Headphones className="mr-1 inline h-3.5 w-3.5" /> Human Live Chat
          </button>
        </div>

        {mode === "ai" ? (
          <div className="p-3">
            <ScrollArea className="h-56 pr-2">
              {msgs.length === 0 && (
                <p className="px-1 py-6 text-center text-[12px] text-white/45">
                  Ask about products, pricing, demos or partner programs.
                </p>
              )}
              <div className="space-y-2">
                {msgs.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.role === "user"
                        ? "ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-cyan-500 px-3 py-1.5 text-[12.5px] text-slate-950"
                        : "w-fit max-w-[90%] whitespace-pre-wrap text-[12.5px] text-white/85"
                    }
                  >
                    {m.content}
                  </div>
                ))}
                {busy && <div className="text-[12px] text-white/50">Thinking…</div>}
                <div ref={endRef} />
              </div>
            </ScrollArea>
            <div className="mt-2 flex gap-2">
              <Input
                value={input}
                placeholder="Type a message…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                className="h-9 border-white/15 bg-white/5 text-white"
              />
              <Button size="sm" onClick={send} disabled={busy} className="h-9 px-3">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 p-4 text-[12.5px]">
            <p className="text-white/60">Connect with the Software Vala support team directly:</p>
            <a
              href="https://wa.me/919999999999?text=Hi%20Software%20Vala%2C%20I%20need%20help"
              target="_blank"
              rel="noreferrer"
              className="kr-item flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 font-semibold text-emerald-200 hover:bg-emerald-400/20"
            >
              <Headphones className="h-4 w-4" /> WhatsApp live chat
            </a>
            <a
              href="mailto:support@softwarevala.com?subject=Support%20request"
              className="kr-item flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 font-semibold hover:bg-white/10"
            >
              <Send className="h-4 w-4" /> Email support
            </a>
            <p className="pt-1 text-[11px] text-white/40">Team hours 9:00–21:00 IST · replies within 2 hours.</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* 9. Notifications (live from the backend)                            */
/* ------------------------------------------------------------------ */

type Notification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  link_url: string | null;
  published_at: string;
};

function Notifications({ t }: { t: (s: string) => string }) {
  const [lastSeen, setLastSeen] = useState<string>("");

  useEffect(() => {
    setLastSeen(localStorage.getItem("sv_notif_seen") || "");
  }, []);

  const q = useQuery({
    queryKey: ["site_notifications"],
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await (supabase as any)
        .from("site_notifications")
        .select("id,title,body,kind,link_url,published_at")
        .eq("is_published", true)
        .order("sort_order", { ascending: true });
      if (error) return [];
      return (data ?? []) as Notification[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const [appNotifs, setAppNotifs] = useState(() => listNotifications());
  useEffect(() => {
    const sync = () => setAppNotifs(listNotifications());
    sync();
    return subscribeApps(sync);
  }, []);

  const items = useMemo<Notification[]>(
    () => [
      ...appNotifs.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        kind: n.kind === "application" ? "update" : "promo",
        link_url: "/admin/applications",
        published_at: n.createdAt,
      })),
      ...(q.data ?? []),
    ],
    [appNotifs, q.data],
  );
  const unread =
    appNotifs.filter((n) => !n.read).length +
    (q.data ?? []).filter((n) => !lastSeen || n.published_at > lastSeen).length;

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) markAllRead();
        if (open && items.length) {
          const newest = items.reduce((a, b) => (a > b.published_at ? a : b.published_at), "");
          localStorage.setItem("sv_notif_seen", newest);
          setLastSeen(newest);
        }
      }}
    >
      <PopoverTrigger className={`${TRIGGER} relative`}>
        <Bell className="h-3.5 w-3.5 text-amber-200 transition-transform duration-300 group-hover:animate-[kr-ring_0.6s_ease]" />
        <span className="hidden sm:inline">{t("Notifications")}</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className={`${PANEL} w-[320px]`}>
        <PanelHead icon={Bell} title={t("Notifications")} note={`${items.length} live announcements`} />
        <ScrollArea className="max-h-72">
          <div className="p-2">
            {q.isLoading && <div className="p-3 text-[12px] text-white/50">Loading…</div>}
            {q.isError && <div className="p-3 text-[12px] text-rose-300">Could not load notifications.</div>}
            {!q.isLoading && items.length === 0 && (
              <div className="p-3 text-[12px] text-white/50">No announcements right now.</div>
            )}
            {items.map((n, i) => {
              const Wrapper: any = n.link_url ? "a" : "div";
              return (
                <Wrapper
                  key={n.id}
                  {...(n.link_url ? { href: n.link_url } : {})}
                  className="kr-item block rounded-xl px-3 py-2 hover:bg-white/5"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        n.kind === "promo" ? "bg-amber-300" : n.kind === "update" ? "bg-cyan-300" : "bg-white/40"
                      }`}
                    />
                    <span className="text-[12.5px] font-semibold">{n.title}</span>
                  </div>
                  <p className="mt-0.5 pl-3.5 text-[11.5px] leading-snug text-white/55">{n.body}</p>
                </Wrapper>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* My Favorites                                                        */
/* ------------------------------------------------------------------ */

function Favorites({ count }: { count: number }) {
  return (
    <button
      type="button"
      className={`${TRIGGER} relative`}
      onClick={() => document.getElementById("All")?.scrollIntoView({ behavior: "smooth" })}
    >
      <Heart className="h-3.5 w-3.5 text-rose-300 transition-transform duration-300 group-hover:scale-110" />
      <span className="hidden sm:inline">My Favorites</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
          {count}
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */

function LoginPill({ t }: { t: (s: string) => string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: any) => setUserEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e: any, session: any) =>
      setUserEmail(session?.user.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Signed in");
  };

  return (
    <Popover>
      <PopoverTrigger className={TRIGGER}>
        <LogIn className="h-3.5 w-3.5 text-emerald-300 transition-transform duration-300 group-hover:translate-x-0.5" />
        <span className="hidden sm:inline">{userEmail ? userEmail.split("@")[0] : t("Login")}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className={PANEL}>
        <PanelHead icon={LogIn} title={t("Login")} note={userEmail ?? "Sign in to your account"} />
        <div className="space-y-2 p-3">
          {userEmail ? (
            <Button
              className="w-full"
              variant="secondary"
              onClick={async () => {
                await supabase.auth.signOut();
                toast.success("Signed out");
              }}
            >
              Sign out
            </Button>
          ) : (
            <>
              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 border-white/15 bg-white/5 text-[12.5px] text-white placeholder:text-white/40"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 border-white/15 bg-white/5 text-[12.5px] text-white placeholder:text-white/40"
              />
              <Button className="w-full" disabled={busy || !email || !password} onClick={signIn}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Login")}
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Bar                                                                 */
/* ------------------------------------------------------------------ */

/* Role dashboards — same names as the dashboard consoles they open. */
const DASHBOARD_ROLES: { key: string; label: string; blurb: string }[] = [
  { key: "author", label: "Author Dashboard", blurb: "Products, downloads & royalties" },
  { key: "vendor", label: "Vendor Dashboard", blurb: "Catalog, orders & payouts" },
  { key: "reseller", label: "Reseller Dashboard", blurb: "Clients, licenses & pricing" },
  { key: "affiliate", label: "Affiliate Dashboard", blurb: "Links, clicks & commissions" },
  { key: "influencer", label: "Influencer Dashboard", blurb: "Campaigns & creatives" },
  { key: "franchise", label: "Franchise Dashboard", blurb: "Branches, leads & revenue" },
  { key: "seo", label: "SEO Dashboard", blurb: "Rankings, audits & backlinks" },
  { key: "admin", label: "Admin Dashboard", blurb: "Platform-wide control" },
  { key: "developer", label: "Developer Dashboard", blurb: "Tasks, bugs & releases" },
  { key: "dev-manager", label: "Developer Management", blurb: "Team, sprints & delivery" },
  { key: "promise-tracker", label: "Promise Tracker", blurb: "Commitments & follow-through" },
];

function DashboardsMenu({ t }: { t: (s: string) => string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={TRIGGER}>
        <LayoutDashboard className="h-3.5 w-3.5 text-cyan-300 transition-transform duration-300 group-hover:-translate-y-0.5" />
        {t("Dashboards")}
        <span className="text-[9px] opacity-70">▼</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="kr-panel max-h-[70vh] w-72 overflow-y-auto border-white/10 bg-[#0b1a30]/95 text-white backdrop-blur-xl"
      >
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-white/50">
          {t("Role dashboards")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        {DASHBOARD_ROLES.map((r, i) => (
          <DropdownMenuItem
            key={r.key}
            asChild
            className="kr-item cursor-pointer focus:bg-white/10"
            style={{ animationDelay: `${i * 24}ms` }}
          >
            <Link to="/dashboard/$role" params={{ role: r.key }}>
              <div className="flex w-full flex-col">
                <span className="text-[12.5px] font-semibold">{r.label}</span>
                <span className="text-[10.5px] text-white/50">{r.blurb}</span>
              </div>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopUtilityBar({ favoritesCount = 0 }: { favoritesCount?: number }) {
  const { lang, t, apply, busy } = useBarTranslation();
  const items = useMemo(
    () => [
      <ApplyNow key="apply" t={t} />,
      <LanguagePicker key="lang" lang={lang} apply={apply} busy={busy} t={t} />,
      <CalendarTool key="cal" t={t} />,
      <CalculatorTool key="calc" t={t} />,
      <LoginPill key="login" t={t} />,
      <DashboardsMenu key="dashboards" t={t} />,
      <CurrencyPicker key="cur" t={t} />,
      <Notifications key="notif" t={t} />,
      <Favorites key="fav" count={favoritesCount} />,
      <AiChat key="ai" t={t} />,
    ],
    [lang, t, apply, busy, favoritesCount],
  );

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {items.map((el, i) => (
        <div key={el.key} className="kr-stagger" style={{ animationDelay: `${i * 55}ms` }}>
          {el}
        </div>
      ))}
    </div>
  );
}

export { Lock };

