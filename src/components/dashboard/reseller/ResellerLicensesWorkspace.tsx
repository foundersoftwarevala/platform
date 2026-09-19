import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * The licences this reseller holds: rows in marketplace_licenses issued to
 * their account when an order they paid for was fulfilled. Read-only — a
 * licence is issued by the platform on payment, never created from here.
 * RLS returns only the signed-in buyer's own rows.
 */

type Licence = {
  id: string;
  license_key: string;
  license_model: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
  marketplace_products: { name: string | null; slug: string | null } | null;
};

function masked(key: string): string {
  return key.length <= 8 ? key : `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export function ResellerLicensesWorkspace({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["reseller-licences"],
    queryFn: async (): Promise<Licence[]> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return [];
      // marketplace_licenses is not in the generated Supabase types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("marketplace_licenses")
        .select(
          "id,license_key,license_model,status,expires_at,created_at,marketplace_products(name,slug)",
        )
        .eq("buyer_id", auth.user.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Licence[];
    },
  });

  return (
    <div className="space-y-5" data-reseller-licences>
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm hover:bg-card"
        >
          <ArrowLeft className="h-4 w-4" /> {t("reseller.licences.back")}
        </button>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("reseller.licences.eyebrow")}
          </div>
          <h1 className="text-xl font-semibold md:text-2xl">{t("reseller.licences.title")}</h1>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{t("reseller.licences.intro")}</p>

      {q.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("reseller.licences.loading")}
        </p>
      ) : q.error ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : (q.data ?? []).length === 0 ? (
        <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
          {t("reseller.licences.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {(q.data ?? []).map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
              data-licence={l.id}
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {l.marketplace_products?.name ?? t("reseller.licences.product")}
                </p>
                <p className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                  <KeyRound className="h-3 w-3" /> {masked(l.license_key)}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{l.license_model ?? ""}</span>
              <span className="text-xs text-muted-foreground">
                {l.expires_at
                  ? t("reseller.licences.expires", {
                      date: new Date(l.expires_at).toLocaleDateString(),
                    })
                  : t("reseller.licences.no_expiry")}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                {l.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
