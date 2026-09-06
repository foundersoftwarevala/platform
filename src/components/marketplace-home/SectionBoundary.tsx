import { Component, Suspense, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Isolates one home-page section. Sections such as the hero carousel read from
 * Supabase with `useSuspenseQuery`; without a boundary a failed request threw
 * past the page and the whole marketplace rendered as a blank error screen.
 * With it, a failing section degrades to a retry card and every other section
 * keeps working.
 */
class ErrorCatcher extends Component<
  { children: ReactNode; label: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surfaced in the browser console for support; never shown raw to visitors.
    console.error("[marketplace-home] section failed:", this.props.label, error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto my-6 max-w-3xl rounded-2xl border border-amber-400/30 bg-amber-400/5 p-6 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-amber-300" />
        <p className="mt-3 text-sm font-semibold text-white">
          {this.props.label} could not be loaded right now.
        </p>
        <p className="mt-1 text-xs text-white/55">
          The rest of the marketplace is unaffected — you can keep browsing.
        </p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    );
  }
}

export function SectionBoundary({
  children,
  label,
  fallback,
}: {
  children: ReactNode;
  label: string;
  fallback?: ReactNode;
}) {
  return (
    <ErrorCatcher label={label}>
      <Suspense fallback={fallback ?? <SectionSkeleton />}>{children}</Suspense>
    </ErrorCatcher>
  );
}

export const SectionSkeleton = () => (
  <div className="mx-auto my-6 h-48 w-full max-w-6xl animate-pulse rounded-3xl border border-white/5 bg-white/[0.03]" />
);

export default SectionBoundary;

/* ------------------------------------------------------------------ */
/* Page-level protection for the marketplace homepage                  */
/* ------------------------------------------------------------------ */

/**
 * Last-resort shell for `/`. The marketplace homepage is a protected route: if
 * the page component itself throws, visitors must still land on Software Vala
 * — header, a readable message, the ways to reach the business, and the footer
 * — never on a blank screen or a bare "this page didn't load" card.
 */
export function HomeShellFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0d1e36] to-[#0a1628]">
      <header className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 px-4 py-4 shadow-2xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full border-2 border-white bg-white/20 text-lg font-black text-white">
            SV
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Software Vala</h1>
            <p className="text-sm text-white/90">- The Name of Trust</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          The marketplace is taking a moment to load
        </h2>
        <p className="mt-3 text-sm text-white/65">
          Our catalogue of ready-to-deploy software is still here. Please refresh — if it
          keeps happening, the team is already on it.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => (onRetry ? onRetry() : window.location.reload())}
            className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-gray-900 shadow-2xl"
          >
            Reload the marketplace
          </button>
          <a
            href="/login"
            className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/10"
          >
            Sign in
          </a>
        </div>
      </main>

      <footer className="border-t border-cyan-500/20 bg-[#0a1628] px-4 py-8">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-gray-400">
            © {new Date().getFullYear()} Software Vala - The Name of Trust. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

/** Wraps the whole homepage so a crash never produces a blank document. */
export class HomeBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[marketplace-home] homepage crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return <HomeShellFallback onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
