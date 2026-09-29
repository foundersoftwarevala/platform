import { Children, startTransition, useEffect, useRef, useState, type ReactNode } from "react";

/** How far the hand travels before the rail reads it as a drag and not a click. */
const DRAG_THRESHOLD = 4;

/** Cards put on a shelf the moment it is ready - more than any screen shows. */
const FIRST_CARDS = 8;
/** Cards added each time the browser is idle, until the shelf is complete. */
const CARDS_PER_STEP = 8;

type IdleHandle = number;
const whenIdle = (work: () => void): IdleHandle =>
  typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback(work, { timeout: 700 })
    : window.setTimeout(work, 50);
const cancelIdle = (handle: IdleHandle) =>
  typeof window.cancelIdleCallback === "function"
    ? window.cancelIdleCallback(handle)
    : window.clearTimeout(handle);

/**
 * How many of a shelf's cards are on the page so far.
 *
 * A shelf holds eighty cards or more, and putting all of them into the page in
 * one go took the browser most of a second - long enough to stop the page
 * scrolling under the visitor's finger. They now arrive eight at a time,
 * whenever the browser has nothing better to do, until every one is there.
 * Nothing is left out: the count only ever grows to the full shelf, and it
 * starts with more cards than any screen is wide.
 */
export function useProgressiveCount(total: number, enabled: boolean): number {
  const [shown, setShown] = useState(FIRST_CARDS);
  useEffect(() => {
    if (!enabled || shown >= total) return;
    const handle = whenIdle(() =>
      startTransition(() => setShown((count) => Math.min(count + CARDS_PER_STEP, total))),
    );
    return () => cancelIdle(handle);
  }, [enabled, shown, total]);
  return Math.min(shown, total);
}

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
  const onScreenRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const items = Children.toArray(children);
  const shown = useProgressiveCount(items.length, isReady);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        // Eighty or more cards arrive at once when a shelf comes near. As a
        // transition React can set that work aside the moment the visitor
        // scrolls again, instead of holding the page still for a second or two
        // while it finishes - the stutter this page was known for.
        startTransition(() => setIsReady(true));
      },
      { rootMargin: "700px 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  /**
   * Whether the shelf is actually on screen, kept on the element rather than in
   * state so that knowing it never re-renders the cards.
   *
   * Fifty-seven shelves each ran their own slide every 4.8 seconds whether or
   * not anyone could see them, and every card's live-dot pulsed for ever
   * underneath the fold. A shelf off screen now neither slides nor animates;
   * the moment it scrolls into view it does both again.
   */
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = Boolean(entry?.isIntersecting);
        onScreenRef.current = visible;
        if (visible) section.dataset.onscreen = "";
        else delete section.dataset.onscreen;
      },
      { rootMargin: "120px 0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isReady || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      const rail = railRef.current;
      if (!rail || !onScreenRef.current || pausedRef.current || draggingRef.current) return;
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
        {isReady ? items.slice(0, shown) : <div className="sv-product-placeholder" aria-hidden />}
      </div>
    </section>
  );
}

export default ProductCarouselRow;
