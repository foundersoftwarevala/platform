import { useEffect, useRef, useState, type ReactNode } from "react";

/** How far the hand travels before the rail reads it as a drag and not a click. */
const DRAG_THRESHOLD = 4;

export function ProductCarouselRow({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const lastX = useRef(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsReady(true);
        observer.disconnect();
      },
      { rootMargin: "700px 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isReady || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      const rail = railRef.current;
      if (!rail || pausedRef.current || draggingRef.current) return;
      const nearEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 12;
      rail.scrollTo({
        left: nearEnd ? 0 : rail.scrollLeft + Math.max(rail.clientWidth * 0.82, 300),
        behavior: "smooth",
      });
    }, 4800);
    return () => window.clearInterval(timer);
  }, [isReady]);

  // Unified pointer drag: finger swipe on touch screens, click-and-drag on desktop.
  //
  // The rail takes the pointer only once the hand has actually travelled. While
  // it holds the capture the browser hands it the click as well, so capturing
  // on the way down would leave every button inside a card unclickable.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return; // native touch scrolling is smoother
    draggingRef.current = true;
    movedRef.current = false;
    lastX.current = event.clientX;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dx = event.clientX - lastX.current;
    if (!movedRef.current && Math.abs(dx) > DRAG_THRESHOLD) {
      movedRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (!movedRef.current) return; // a steady hand is aiming at a button
    event.currentTarget.scrollLeft -= dx;
    lastX.current = event.clientX;
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section
      ref={sectionRef}
      id={title}
      className="sv-product-row scroll-mt-32"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
      onFocusCapture={() => {
        pausedRef.current = true;
      }}
      onBlurCapture={() => {
        pausedRef.current = false;
      }}
    >
      <div className="mb-4 flex min-w-0 items-center gap-3">
        <h3 className="truncate text-xl font-bold text-white sm:text-2xl">{title}</h3>
        <span className="shrink-0 rounded-full border border-cyan-500/30 bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-300">
          {count} Products
        </span>
        <span className="ml-auto hidden shrink-0 text-[11px] font-medium text-cyan-300/70 sm:inline">
          Swipe to explore →
        </span>
      </div>

      <div
        ref={railRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(event) => {
          if (movedRef.current) {
            event.preventDefault();
            event.stopPropagation();
            movedRef.current = false;
          }
        }}
        className={`sv-product-rail ${isReady ? "is-ready" : "is-loading"}`}
        aria-label={`${title} products`}
        aria-busy={!isReady}
      >
        {isReady ? children : <div className="sv-product-placeholder" aria-hidden />}
      </div>
    </section>
  );
}

export default ProductCarouselRow;
