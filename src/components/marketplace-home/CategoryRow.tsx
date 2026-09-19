import { useRef, type PointerEvent, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { categoryAnchor } from "@/lib/marketplace-home/anchors";

/**
 * A horizontal product row, moved by natural interaction rather than buttons.
 *
 * The rail is the browser's own horizontal scroller, so touch swipe with
 * momentum, trackpad swipe, shift + wheel, the scrollbar and the keyboard
 * (focus the row, then the arrow keys) all work natively, in both reading
 * directions. A vertical wheel over a row still scrolls the page. The one thing
 * a native scroller does not do is follow a mouse drag, so that is added here,
 * for mice only: touch keeps the browser's own swipe. A drag never counts as a
 * click on the card under the pointer.
 */
export function CategoryRow({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    left: number;
    moved: boolean;
    lastX: number;
    lastT: number;
    velocity: number;
  } | null>(null);
  const glide = useRef(0);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !ref.current) return;
    cancelAnimationFrame(glide.current);
    drag.current = {
      x: e.clientX,
      left: ref.current.scrollLeft,
      moved: false,
      lastX: e.clientX,
      lastT: performance.now(),
      velocity: 0,
    };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 6) return;
    if (!d.moved) {
      d.moved = true;
      // Snapping or smooth scrolling while the pointer holds the rail makes
      // it lag behind the pointer and stutter.
      el.style.scrollSnapType = "none";
      el.style.scrollBehavior = "auto";
      el.setPointerCapture(e.pointerId);
    }
    const now = performance.now();
    d.velocity = (e.clientX - d.lastX) / Math.max(now - d.lastT, 1);
    d.lastX = e.clientX;
    d.lastT = now;
    el.scrollLeft = d.left - dx;
  };

  const release = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d || !el || !d.moved) return;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    // A short glide after the release, like a flick on a touch screen.
    let v = d.velocity * 16;
    const step = () => {
      if (Math.abs(v) < 0.5) {
        el.style.scrollSnapType = "";
        el.style.scrollBehavior = "";
        return;
      }
      el.scrollLeft -= v;
      v *= 0.92;
      glide.current = requestAnimationFrame(step);
    };
    glide.current = requestAnimationFrame(step);
    // Swallow the click that ends the drag, so no card opens. The browser
    // fires it right after the release, or not at all; the guard is removed
    // shortly either way so it can never eat a later, real click.
    const swallow = (click: MouseEvent) => {
      click.preventDefault();
      click.stopPropagation();
    };
    el.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => el.removeEventListener("click", swallow, { capture: true }), 50);
  };

  return (
    // The row keeps its original id so any existing link still works, and
    // carries a slug anchor that a URL fragment can actually address.
    <div id={title} className="group/row mb-5 scroll-mt-32 md:mb-6">
      <span id={categoryAnchor(title)} className="block h-0 scroll-mt-32" aria-hidden />
      <div className="mb-2.5 flex items-center gap-3">
        <h3 className="text-xl font-bold text-white md:text-2xl">{title}</h3>
        <Badge className="border-cyan-500/30 bg-cyan-500/20 text-cyan-400">{count} Products</Badge>
      </div>

      <div
        ref={ref}
        role="region"
        aria-label={title}
        tabIndex={0}
        data-product-row=""
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onDragStart={(e) => e.preventDefault()}
        className="sv-row-scroll flex gap-5 overflow-x-auto pb-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400/60"
      >
        {children}
      </div>
    </div>
  );
}

export default CategoryRow;
