export function formatWalletAmount(cents: string, currency: string): string {
  if (!/^-?\d+$/.test(cents)) throw new Error("Wallet amount is not a whole number of cents.");
  const amount = BigInt(cents);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const whole = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, "0");
  const wholeText = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(whole);
  const template = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(negative ? -1 : 1);
  let insertedWhole = false;

  return template
    .map((part) => {
      if (part.type === "integer") {
        if (insertedWhole) return "";
        insertedWhole = true;
        return wholeText;
      }
      if (part.type === "fraction") return fraction;
      return part.value;
    })
    .join("");
}
