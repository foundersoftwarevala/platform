import type { Sql } from "postgres";

type QuotaWindow = { subject: string; limit: number; seconds: number };
class QuotaExceeded extends Error {}

/** Reserve all windows atomically before inference, across all app workers. */
export async function reserveEngineQuota(client: Sql, units: number, windows: QuotaWindow[]) {
  if (
    !Number.isSafeInteger(units) ||
    units < 0 ||
    windows.some(
      (w) =>
        !Number.isSafeInteger(w.limit) ||
        w.limit < 0 ||
        !Number.isSafeInteger(w.seconds) ||
        w.seconds < 1,
    )
  )
    throw new Error("Invalid translation quota reservation.");
  const held: { subject: string; window: Date }[] = [];
  try {
    await client.begin(async (tx) => {
      for (const item of [...windows].sort((a, b) => a.subject.localeCompare(b.subject))) {
        const rows = await tx`
          insert into public.i18n_request_quota as q (subject, window_start, units)
          select ${item.subject}, to_timestamp(floor(extract(epoch from now()) / ${item.seconds}) * ${item.seconds}), ${units}
          where ${units} <= ${item.limit}
          on conflict (subject, window_start) do update set units = q.units + excluded.units
          where q.units + excluded.units <= ${item.limit}
          returning window_start
        `;
        if (!rows.length) throw new QuotaExceeded();
        held.push({ subject: item.subject, window: rows[0]!.window_start });
      }
    });
  } catch (error) {
    if (!(error instanceof QuotaExceeded)) throw error;
    return { allowed: false, refund: undefined };
  }
  let refund: Promise<void> | undefined;
  return {
    allowed: true,
    refund: () => {
      if (refund) return refund;
      refund = (async () => {
        await client.begin(async (tx) => {
          for (const item of held) {
            await tx`
            update public.i18n_request_quota set units = greatest(0, units - ${units})
            where subject = ${item.subject} and window_start = ${item.window}
          `;
          }
        });
      })();
      return refund;
    },
  };
}
