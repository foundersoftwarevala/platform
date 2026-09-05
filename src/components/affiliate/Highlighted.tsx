import { highlight } from "@/lib/affiliate-search";

export function Highlighted({ text, q }: { text: string; q: string }) {
  const parts = highlight(text, q);
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-sm bg-accent/25 px-0.5 text-foreground">
            {p.t}
          </mark>
        ) : (
          <span key={i}>{p.t}</span>
        ),
      )}
    </>
  );
}
