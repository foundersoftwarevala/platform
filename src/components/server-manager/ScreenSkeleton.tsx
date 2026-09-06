/** Shared loading placeholder used while a lazily-loaded screen chunk resolves. */
const ScreenSkeleton = () => (
  <div className="space-y-6" aria-busy="true" aria-live="polite">
    <div className="flex items-center justify-between">
      <div className="skeleton-shimmer h-8 w-56 rounded-lg" />
      <div className="skeleton-shimmer h-9 w-28 rounded-lg" />
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton-shimmer h-28 w-full rounded-xl" />
      ))}
    </div>
    <div className="skeleton-shimmer h-64 w-full rounded-2xl" />
    <span className="sr-only">Loading screen…</span>
  </div>
);

export default ScreenSkeleton;
