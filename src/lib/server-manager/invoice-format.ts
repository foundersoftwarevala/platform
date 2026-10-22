export function formatMinorCurrency(amountMinor: number, currency: string): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new RangeError("Invoice amount must be a nonnegative safe integer");
  }

  const currencyFormat = new Intl.NumberFormat("en", { style: "currency", currency });
  const fractionDigits = currencyFormat.resolvedOptions().maximumFractionDigits;
  if (fractionDigits === undefined) {
    throw new RangeError("Currency fraction digits are unavailable");
  }

  return currencyFormat.format(amountMinor / 10 ** fractionDigits);
}
