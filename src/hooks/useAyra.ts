import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  loadAyraCapabilities,
  loadAyraOrders,
  type AyraCapability,
  type AyraOrder,
} from "@/lib/founder/ayra/ayra.functions";

export type { AyraCapability, AyraOrder };

/**
 * What AYRA can do, and what she has been asked to do.
 *
 * The capability register is loaded separately from the orders and cached
 * longer, because what AYRA is connected to changes when an integration is
 * added, not from minute to minute. It is also the more important of the two:
 * an order list is a history, while the register is the answer to "can she
 * actually do this", which is the question that stops work being accepted
 * that cannot be done.
 */
export function useAyraCapabilities() {
  const load = useServerFn(loadAyraCapabilities);

  const result = useQuery({
    queryKey: ["ayra", "capabilities"],
    queryFn: () => load(),
    staleTime: 300_000,
  });

  const data = result.data as
    { capabilities: AyraCapability[]; connected: number; notConnected: number } | undefined;

  const reason = result.error instanceof Error ? result.error.message : "";
  const denied = /permission|authentication|authorization|forbidden/i.test(reason);

  return {
    capabilities: data?.capabilities ?? [],
    connected: data?.connected ?? 0,
    notConnected: data?.notConnected ?? 0,
    isLoading: result.isLoading,
    failed: result.isError && !denied,
    denied,
    refetch: result.refetch,
  };
}

export function useAyraOrders() {
  const load = useServerFn(loadAyraOrders);

  const result = useQuery({
    queryKey: ["ayra", "orders"],
    queryFn: () => load(),
    staleTime: 30_000,
  });

  const data = result.data as { orders: AyraOrder[]; degraded: string[] } | undefined;

  const reason = result.error instanceof Error ? result.error.message : "";
  const denied = /permission|authentication|authorization|forbidden/i.test(reason);

  return {
    orders: data?.orders ?? [],
    degraded: data?.degraded ?? [],
    isLoading: result.isLoading,
    failed: result.isError && !denied,
    denied,
    refetch: result.refetch,
  };
}
