import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Netflix-style horizontal product row: snap scrolling, hover arrows and
 * lazy-friendly fixed-width cards.
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

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.85, 320), behavior: "smooth" });
  };

  return (
    <div id={title} className="group/row mb-12 scroll-mt-32">
      <div className="mb-4 flex items-center gap-3">
        <h3 className="text-xl font-bold text-white md:text-2xl">{title}</h3>
        <Badge className="border-cyan-500/30 bg-cyan-500/20 text-cyan-400">{count} Products</Badge>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            aria-label={`Scroll ${title} left`}
            onClick={() => scrollBy(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:border-cyan-400/50 hover:bg-cyan-500/20"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Scroll ${title} right`}
            onClick={() => scrollBy(1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:border-cyan-400/50 hover:bg-cyan-500/20"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={ref}
        className="sv-row-scroll flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-4"
      >
        {children}
      </div>
    </div>
  );
}

export default CategoryRow;