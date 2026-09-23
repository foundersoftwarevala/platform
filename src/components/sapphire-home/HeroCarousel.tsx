import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Play, ChevronLeft, ChevronRight, ShoppingCart, Sparkles,
  Boxes, Crown, Rocket, Zap, ShieldCheck, Clock, BadgeCheck, Lock, Globe2,
  Utensils, GraduationCap, Stethoscope, Store, Users,
  type LucideIcon,
} from "lucide-react";
import { heroPublicQuery } from "@/lib/marketplace-content/heroQueries";

const ICONS: Record<string, LucideIcon> = {
  Boxes, Crown, Rocket, Sparkles, Utensils, GraduationCap, Stethoscope, Store, Users,
  ShoppingCart, Play, ShieldCheck, Clock, BadgeCheck, Lock, Globe2, Zap,
};

const HeroCarousel = () => {
  const { data: slides } = useSuspenseQuery(heroPublicQuery());
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);

  const total = slides.length;
  const next = useCallback(() => {
    setDirection(1);
    setCurrent((prev) => (total ? (prev + 1) % total : 0));
  }, [total]);
  const prev = useCallback(() => {
    setDirection(-1);
    setCurrent((p) => (total ? (p - 1 + total) % total : 0));
  }, [total]);

  useEffect(() => {
    if (paused || total <= 1) return;
    const t = setInterval(next, 5500);
    return () => clearInterval(t);
  }, [next, paused, total]);

  useEffect(() => {
    if (current >= total) setCurrent(0);
  }, [current, total]);

  if (!total) return null;
  const product = slides[Math.min(current, total - 1)]!;
  const Icon = ICONS[product.icon_name] ?? Boxes;

  return (
    <section
      className="relative w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >



        <div
          key={product.id}
          className={`hero-premium relative isolate w-full bg-gradient-to-br ${product.gradient} py-16 sm:py-20 lg:py-24 animate-[hero-reveal_.55s_cubic-bezier(.22,1,.36,1)]`}
        >


          <div className="hero-content relative z-10 max-w-6xl mx-auto px-4 text-center">
            <motion.div
              initial={false}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 220 }}
              className="mx-auto mb-5 inline-flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md border border-white/40 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.35)]"
            >
              <Icon className={`h-8 w-8 sm:h-10 sm:w-10 ${product.accent} drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]`} />
            </motion.div>

            <motion.div
              initial={false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/30 mb-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
            >
              <Sparkles className="w-4 h-4 text-yellow-200 drop-shadow" />
              <span className="text-white text-xs font-bold tracking-[0.2em] uppercase drop-shadow">{product.kicker}</span>
            </motion.div>
            <motion.h2
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)] [text-shadow:0_2px_0_rgba(0,0,0,0.2)]"
            >
              {product.title}
            </motion.h2>
            <motion.p
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="text-white/95 text-base sm:text-lg max-w-2xl mx-auto mb-8 drop-shadow-lg"
            >
              {product.subtitle}
            </motion.p>
            <motion.div
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <a
                href={product.cta_link}
                className="sv-btn sv-btn-hero-light group !h-14 !rounded-2xl !px-8 !text-base"
              >
                <Play className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                {product.cta_primary}
              </a>
              <a
                href="/demos"
                className="sv-btn sv-btn-hero-glass !h-14 !rounded-2xl !px-8 !text-base"
              >
                <ShoppingCart className="w-5 h-5" />
                {product.cta_secondary}
              </a>
            </motion.div>
          </div>
        </div>

      <button data-no-3d aria-label="Previous slide" onClick={prev} className="sv-icon-btn absolute left-4 top-1/2 -translate-y-1/2 z-20 !h-12 !w-12">
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button data-no-3d aria-label="Next slide" onClick={next} className="sv-icon-btn absolute right-4 top-1/2 -translate-y-1/2 z-20 !h-12 !w-12">
        <ChevronRight className="w-6 h-6" />
      </button>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            data-no-3d
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
            className={`h-2.5 rounded-full transition-all duration-300 shadow-lg ${i === current ? "bg-white w-8" : "bg-white/40 w-2.5 hover:bg-white/70"}`}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroCarousel;
