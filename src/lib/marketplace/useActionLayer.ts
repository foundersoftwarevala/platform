import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_ACTIONS, resolveProductActions,
  type ActionConfig, type ProductContext, type ResolvedAction,
} from "./action-layer";

/**
 * The storefront's view of the action layer.
 *
 * Fetched once per page load and shared by every caller through a module-level
 * promise, so a grid of product cards makes one request rather than one each -
 * section 38. Until it arrives the defaults are used, which is why a card never
 * renders empty while the configuration is in flight.
 */

type Config = { actions: ActionConfig[]; paymentConfigured: boolean; configured: boolean };

let inflight: Promise<Config> | null = null;
let held: Config | null = null;

async function fetchConfig(): Promise<Config> {
  if (held) return held;
  if (!inflight) {
    inflight = fetch("/api/actions/config")
      .then(async (r) => {
        if (!r.ok) throw new Error("unavailable");
        const payload = (await r.json()) as Config;
        held = {
          actions: Array.isArray(payload.actions) && payload.actions.length
            ? payload.actions
            : DEFAULT_ACTIONS,
          paymentConfigured: Boolean(payload.paymentConfigured),
          configured: Boolean(payload.configured),
        };
        return held;
      })
      .catch(() => {
        // A failed read must not take the buttons away.
        held = { actions: DEFAULT_ACTIONS, paymentConfigured: false, configured: false };
        return held;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * What this surface may render for this product, and why not where it may not.
 *
 * Every surface asks the same question of the same resolver, so a change in the
 * Action Layer reaches all of them without any of them knowing the rules.
 */
export function useProductActions(
  product: ProductContext,
  opts: { signedIn?: boolean } = {},
): { actions: ResolvedAction[]; ready: boolean; paymentConfigured: boolean } {
  const [config, setConfig] = useState<Config | null>(held);

  useEffect(() => {
    let alive = true;
    void fetchConfig().then((c) => {
      if (alive) setConfig(c);
    });
    return () => {
      alive = false;
    };
  }, []);

  const effective = config ?? { actions: DEFAULT_ACTIONS, paymentConfigured: false, configured: false };

  // Resolved once per product rather than on every render. A grid of product
  // cards calls this hook once per card, and the resolver walks the whole
  // action list each time, so re-running it on every render made an ordinary
  // re-render cost proportional to cards x actions.
  const signedIn = Boolean(opts.signedIn);
  const actions = useMemo(
    () =>
      resolveProductActions(effective.actions, product, {
        paymentConfigured: effective.paymentConfigured,
        signedIn,
      }),
    // The product is rebuilt by the caller on every render, so its identity
    // cannot be a dependency; what it holds can.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      effective.actions, effective.paymentConfigured, signedIn,
      product.id, product.slug, product.demo_url, product.visible,
      product.price_label, product.content_status,
    ],
  );

  return {
    actions,
    ready: config !== null,
    paymentConfigured: effective.paymentConfigured,
  };
}
