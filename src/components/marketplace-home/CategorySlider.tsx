import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { anchorClick, categoryHref, GRID_ANCHOR } from "@/lib/marketplace-home/anchors";
import {
  Sparkles, GraduationCap, Stethoscope, Utensils, Hotel, Home, Car, Plane,
  CreditCard, Factory, Users, Truck, Building, Megaphone, Wallet, Briefcase,
  ShoppingBag, Scale, Shield, Server, Headphones, Building2, ChevronLeft, ChevronRight
} from "lucide-react";

const CATEGORIES = [
  { icon: Sparkles, name: "All", color: "from-cyan-400 to-blue-600", link: "/#all" },
  { icon: GraduationCap, name: "Education", color: "from-blue-500 to-indigo-600", link: "/#Education" },
  { icon: Stethoscope, name: "Healthcare", color: "from-pink-500 to-rose-600", link: "/#Healthcare" },
  { icon: Utensils, name: "Restaurant & POS", color: "from-orange-500 to-red-500", link: "/#Retail%20%26%20POS" },
  { icon: ShoppingBag, name: "Retail & POS", color: "from-amber-500 to-orange-600", link: "/#Retail%20%26%20POS" },
  { icon: Hotel, name: "Hotel & Hospitality", color: "from-fuchsia-500 to-pink-600" , link: "/#Hospitality" },
  { icon: Home, name: "Real Estate", color: "from-amber-500 to-yellow-600", link: "/#Real%20Estate" },
  { icon: Car, name: "Automotive", color: "from-slate-500 to-zinc-700", link: "/#Automotive" },
  { icon: Plane, name: "Travel", color: "from-sky-500 to-cyan-600", link: "/#Travel" },
  { icon: CreditCard, name: "Finance", color: "from-emerald-500 to-teal-600", link: "/#Finance" },
  { icon: Wallet, name: "Accounting", color: "from-lime-500 to-green-600", link: "/#Accounting" },
  { icon: Megaphone, name: "Marketing", color: "from-rose-500 to-red-600", link: "/#Marketing" },
  { icon: Users, name: "Sales & CRM", color: "from-violet-500 to-purple-600", link: "/#Sales%20%26%20CRM" },
  { icon: Briefcase, name: "HR", color: "from-indigo-500 to-blue-600", link: "/#HR" },
  { icon: Truck, name: "Logistics", color: "from-cyan-500 to-teal-600", link: "/#Logistics" },
  { icon: Factory, name: "Manufacturing", color: "from-stone-500 to-neutral-700", link: "/#Manufacturing" },
  { icon: Building, name: "Enterprise", color: "from-blue-600 to-indigo-800", link: "/#Enterprise" },
  { icon: Building2, name: "Government", color: "from-emerald-600 to-green-800", link: "/#Government" },
  { icon: Scale, name: "Legal", color: "from-yellow-600 to-amber-800", link: "/#Legal" },
  { icon: Shield, name: "Security", color: "from-red-600 to-rose-800", link: "/#Security" },
  { icon: Server, name: "IT & SaaS", color: "from-gray-500 to-slate-700", link: "/#IT" },
  { icon: Headphones, name: "Support", color: "from-teal-500 to-cyan-700", link: "/#Support" },
];

// Duplicate the list so the auto-scroll can loop seamlessly.
const LOOP = [...CATEGORIES, ...CATEGORIES];

type Chip = { name: string; link: string; icon: typeof Sparkles; color: string };

/**
 * The rows the marketplace actually has, as chips.
 *
 * Every chip used to point at a fragment - "/#Education", "/#Hospitality" -
 * and the page had no element with any of those ids, so clicking a category
 * did nothing at all. Two of them pointed at the same fragment as each other
 * and one at a name no row ever carried. They point at the real category
 * pages now, taken from the same rows the manager controls, so hiding or
 * renaming a category here changes what the strip offers.
 *
 * The written list stays as the fallback for a server that cannot answer, and
 * lends each row its icon and colour by name.
 */
function useCategoryChips(): Chip[] {
  const [live, setLive] = useState<{ title: string; slug: string }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/marketplace/rows");
        if (!response.ok) return;
        const data = (await response.json()) as {
          rows?: { title: string; slug: string; hidden?: boolean }[];
        };
        const rows = (data.rows ?? []).filter((r) => r.slug && !r.hidden);
        if (!cancelled && rows.length > 0) setLive(rows);
      } catch {
        // Keep the written list; the strip is never left empty.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    if (!live) return CATEGORIES as Chip[];

    const styleFor = (title: string) => {
      const key = title.toLowerCase();
      const match = CATEGORIES.find((c) => c.name.toLowerCase() === key)
        ?? CATEGORIES.find((c) => key.includes(c.name.toLowerCase()) && c.name !== "All");
      return match ?? CATEGORIES[0]!;
    };

    return [
      { ...CATEGORIES[0]!, link: "/marketplace" },
      ...live.map((row) => {
        const style = styleFor(row.title);
        return {
          name: row.title,
          link: `/marketplace/category/${row.slug}`,
          icon: style.icon,
          color: style.color,
        };
      }),
    ];
  }, [live]);
}

const CategorySlider = () => {
  const chips = useCategoryChips();
  const loop = useMemo(() => [...chips, ...chips], [chips]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const offsetRef = useRef(0);      // current translateX (negative = moved left)
  const velocityRef = useRef(0);    // px / second, from drag + wheel momentum
  const lastPointer = useRef({ x: 0, t: 0 });

  // Single rAF loop drives autoplay, inertia and the GPU transform.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    const AUTO = 28; // px per second

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const half = track.scrollWidth / 2 || 1;

      if (!draggingRef.current) {
        if (Math.abs(velocityRef.current) > 2) {
          offsetRef.current += velocityRef.current * dt;
          velocityRef.current *= Math.pow(0.0025, dt); // smooth exponential decay
        } else {
          velocityRef.current = 0;
          if (!pausedRef.current && !reduce) offsetRef.current -= AUTO * dt;
        }
      }

      // seamless infinite wrap in both directions
      if (offsetRef.current <= -half) offsetRef.current += half;
      if (offsetRef.current > 0) offsetRef.current -= half;

      track.style.transform = `translate3d(${offsetRef.current.toFixed(2)}px,0,0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Horizontal mouse-wheel / trackpad support (non-passive so the page never scrolls with it)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
      if (!dx) return;
      e.preventDefault();
      const norm = dx * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      offsetRef.current -= norm;
      velocityRef.current = -norm * 6;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const nudge = useCallback((dir: number) => {
    velocityRef.current = -dir * 900;
  }, []);

  // Pointer drag (unified mouse + touch) with momentum handoff
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    movedRef.current = false;
    velocityRef.current = 0;
    lastPointer.current = { x: e.clientX, t: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const now = performance.now();
    const dx = e.clientX - lastPointer.current.x;
    const dt = Math.max((now - lastPointer.current.t) / 1000, 0.001);
    if (Math.abs(dx) > 2) movedRef.current = true;
    offsetRef.current += dx;
    velocityRef.current = dx / dt;
    lastPointer.current = { x: e.clientX, t: now };
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <section
      className="relative py-3 bg-gradient-to-b from-[#0a1628] via-[#0d1e36]/70 to-transparent"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div className="max-w-7xl mx-auto px-4 relative">
        <div className="pointer-events-none absolute inset-y-0 left-4 z-10 w-16 bg-gradient-to-r from-[#0a1628] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-4 z-10 w-16 bg-gradient-to-l from-[#0a1628] to-transparent" />
        <button data-no-3d onClick={() => nudge(-1)} aria-label="Scroll left" className="sv-icon-btn absolute left-2 top-1/2 -translate-y-1/2 z-20 !h-10 !w-10">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <button data-no-3d onClick={() => nudge(1)} aria-label="Scroll right" className="sv-icon-btn absolute right-2 top-1/2 -translate-y-1/2 z-20 !h-10 !w-10">
          <ChevronRight className="w-5 h-5 text-white" />
        </button>

        <div
          ref={viewportRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="overflow-hidden px-10 py-3 cursor-grab active:cursor-grabbing select-none touch-pan-y"
        >
          <div
            ref={trackRef}
            className="flex gap-3 will-change-transform"
            style={{ transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" }}
          >
          {loop.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <a
                key={`${cat.name}-${i}`}
                href={cat.name === "All" ? `#${GRID_ANCHOR}` : categoryHref(cat.name)}
                onClick={(e) => {
                  if (movedRef.current) { e.preventDefault(); return; }
                  const target = cat.name === "All" ? `#${GRID_ANCHOR}` : categoryHref(cat.name);
                  anchorClick(target.slice(1))(e);
                }}
                draggable={false}
                className={`group relative flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-br ${cat.color} text-white text-sm font-bold whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_26px_-12px_rgba(0,0,0,0.85)] border border-white/25 transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-1`}
              >
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent via-white/10 to-white/30 pointer-events-none" />
                <span className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-white/25 backdrop-blur-sm shadow-inner border border-white/30">
                  <Icon className="w-4 h-4 drop-shadow-lg" />
                </span>
                <span className="relative drop-shadow">{cat.name}</span>
              </a>
            );
          })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CategorySlider;
