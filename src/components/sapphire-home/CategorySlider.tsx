import { useRef, useEffect } from "react";
import {
  Sparkles, GraduationCap, Stethoscope, Utensils, Hotel, Home, Car, Plane,
  CreditCard, Factory, Users, Truck, Building, Megaphone, Wallet, Briefcase,
  ShoppingBag, Scale, Shield, Server, Headphones, Building2
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
const DRAG_THRESHOLD = 4;

const CategorySlider = () => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const startPointerX = useRef(0);
  const lastPointerX = useRef(0);

  // Native scrolling stays reliable after hydration and keeps touch/trackpad controls fluid.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const timer = window.setInterval(() => {
      if (pausedRef.current || draggingRef.current) return;
      // Distance travelled, with the page's direction as the sign: in a
      // right-to-left language scrollLeft is negative, and read as a plain
      // number the loop clamped at 0 and the strip stood still.
      const sign = getComputedStyle(viewport).direction === "rtl" ? -1 : 1;
      const half = viewport.scrollWidth / 2;
      let travelled = Math.abs(viewport.scrollLeft);
      if (travelled >= half - 2) {
        travelled -= half;
        viewport.scrollLeft = sign * travelled;
      }
      viewport.scrollTo({ left: sign * (travelled + 180), behavior: "auto" });
    }, 2200);
    return () => window.clearInterval(timer);
  }, []);

  // Capture only after an intentional horizontal drag so links remain clickable.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    movedRef.current = false;
    startPointerX.current = e.clientX;
    lastPointerX.current = e.clientX;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastPointerX.current;
    if (!movedRef.current && Math.abs(e.clientX - startPointerX.current) > DRAG_THRESHOLD) {
      movedRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (movedRef.current) e.currentTarget.scrollLeft -= dx;
    lastPointerX.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
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

        <div
          ref={viewportRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="sv-category-viewport overflow-x-auto px-10 py-3 cursor-grab active:cursor-grabbing select-none touch-pan-y"
        >
          <div
            className="flex w-max gap-3"
          >
          {LOOP.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <a
                key={`${cat.name}-${i}`}
                href={cat.link}
                onClick={(e) => {
                  if (movedRef.current) {
                    e.preventDefault();
                    movedRef.current = false;
                  }
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
