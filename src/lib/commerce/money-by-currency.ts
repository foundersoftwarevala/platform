export type CurrencyAmount = { currency: string; amount: number };

export function currencyCode(currency: string | null | undefined): string {
  return currency?.trim().toUpperCase() || "UNKNOWN";
}

export function sumByCurrency<T>(
  rows: readonly T[],
  currencyOf: (row: T) => string | null | undefined,
  amountOf: (row: T) => number,
): CurrencyAmount[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const currency = currencyCode(currencyOf(row));
    totals.set(currency, (totals.get(currency) ?? 0) + amountOf(row));
  }
  return [...totals]
    .map(([currency, amount]) => ({
      currency,
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function singleCurrencyAmount(amounts: readonly CurrencyAmount[]): number | null {
  if (amounts.length > 1) return null;
  return amounts[0]?.amount ?? 0;
}
