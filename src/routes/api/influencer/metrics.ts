import { createFileRoute } from "@tanstack/react-router";

/**
 * Real dashboard numbers for the influencer who is signed in.
 *
 * The influencer portal's six KPI cards were drawn by the seeded generator in
 * lib/metrics.ts - the same invented figures for every influencer account,
 * while that influencer's real followers, assignments and earnings sat in the
 * influencer tables the Manager operates. This is the other end of that wire:
 * the portal and Influencer Manager now read the same rows, one scoped to a
 * person and one to the programme.
 *
 * The caller's own token is forwarded, so influencer_self_summary() resolves
 * the profile from auth.uid() and row level security decides the rest. A
 * signed-in account with no influencer profile gets 403, which the portal reads
 * as "no figures for you" and shows dashes - not an error, and never a number
 * borrowed from somewhere else.
 *
 * The metric keys match `kpis[].key` in lib/roles.ts, so the dashboard can look
 * a card up by the key it already holds.
 */

type Summary = {
  profile: {
    id: string;
    full_name: string | null;
    status: string;
    niche: string | null;
    country: string | null;
    since: string;
  } | null;
  metrics: Record<string, number | null>;
};

function gateway(): string {
  const base = process.env.SUPABASE_URL?.trim() ?? process.env.VITE_SUPABASE_URL?.trim() ?? "";
  return base.replace(/\/+$/, "");
}

function publishableKey(): string {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim() ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    ""
  );
}

export const Route = createFileRoute("/api/influencer/metrics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const header = request.headers.get("authorization");
        const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
        // i18n-ignore: an API error message; this API answers in English.
        if (!token) return Response.json({ error: "Sign in required" }, { status: 401 });

        const base = gateway();
        if (!base) {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json(
            {
              error: "The database is not configured on this server." /* i18n-ignore: API error */,
            },
            { status: 503 },
          );
        }

        const response = await fetch(`${base}/rest/v1/rpc/influencer_self_summary`, {
          method: "POST",
          headers: {
            apikey: publishableKey(),
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        });

        if (response.status === 401 || response.status === 403) {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json(
            { error: "Not an influencer account" /* i18n-ignore: API error */ },
            { status: 403 },
          );
        }
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          return Response.json(
            { error: `Your figures could not be read: ${response.status} ${detail.slice(0, 160)}` },
            { status: 502 },
          );
        }

        const summary = (await response.json()) as Summary;
        // Signed in, but this account holds no influencer profile.
        // i18n-ignore: an API error message; this API answers in English.
        if (!summary?.profile)
          return Response.json(
            { error: "Not an influencer account" /* i18n-ignore: API error */ },
            { status: 403 },
          );

        return Response.json({
          profile: summary.profile,
          metrics: summary.metrics ?? {},
          source: "platform:influencer_self_summary",
          generatedAt: new Date().toISOString(),
        });
      },
    },
  },
});
