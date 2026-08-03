/**
 * GLOBAL MARKETS — live FX (ECB/Frankfurter), crypto and gold (CoinGecko),
 * refreshed in the background every 60s. All values are real quotes.
 */

import React, { memo } from "react";
import { TrendingDown, TrendingUp, RefreshCw, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarkets } from "./useLive";

const Cell = ({
  code,
  value,
  sub,
  change,
}: {
  code: string;
  value: string;
  sub?: string;
  change?: number;
}) => {
  const up = (change ?? 0) >= 0;
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] px-1.5 py-1 transition-colors hover:border-primary-glow/45">
      <p className="text-[8px] uppercase tracking-wider text-foreground/50">{code}</p>
      <p className="text-[11.5px] font-extrabold leading-tight text-foreground tabular-nums">{value}</p>
      {change === undefined ? (
        <p className="text-[8px] text-foreground/45">{sub}</p>
      ) : (
        <p className={cn("flex items-center gap-0.5 text-[8.5px] font-bold", up ? "text-emerald-300" : "text-rose-300")}>
          {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {change.toFixed(2)}%
        </p>
      )}
    </div>
  );
};

export const GlobalMarkets = memo(() => {
  const { data, isFetching, refetch, dataUpdatedAt } = useMarkets();

  return (
    <section className="rounded-xl border border-primary/30 bg-[linear-gradient(160deg,rgba(56,130,255,0.18),rgba(10,20,40,0.82))] p-2.5 shadow-[0_10px_28px_-18px_rgba(40,120,255,0.9)]">
      <header className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <LineChart className="h-3.5 w-3.5 text-emerald-300" />
          <h3 className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-foreground/75">
            Global Live Markets
          </h3>
        </div>
        <button
          onClick={() => void refetch()}
          className="rounded-md border border-white/10 bg-white/5 px-1 py-0.5 text-foreground/55 hover:text-emerald-300"
        >
          <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
        </button>
      </header>

      <div className="grid grid-cols-4 gap-1">
        {(data?.fx ?? []).map((f) => (
          <Cell
            key={f.code}
            code={`USD/${f.code}`}
            value={f.rate.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            sub="ECB spot"
          />
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-1">
        {[...(data?.crypto ?? []), ...(data?.metals ?? [])].map((c) => (
          <Cell
            key={c.code}
            code={`${c.code} · ${c.name}`}
            value={`$${c.usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            change={c.change24h}
          />
        ))}
      </div>

      <p className="mt-1.5 text-center text-[8px] uppercase tracking-[0.18em] text-foreground/35">
        {dataUpdatedAt
          ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString([], { hour12: false })} · live feed`
          : "Connecting to market feeds…"}
      </p>
    </section>
  );
});
GlobalMarkets.displayName = "GlobalMarkets";
