import { payuConfig } from "./payu";
import { readPayuFields, settlePayuCallback } from "./payu-settle";

/**
 * The buyer's browser coming back from PayU (surl / furl).
 *
 * PayU sends it as a form POST carrying the same signed result as the
 * server-to-server callback. The result is settled through the same checks as
 * the webhook — the browser is still never believed — so a payment does not
 * depend on the webhook having been configured in the PayU dashboard. The
 * buyer is then sent to the ordinary page, with the transaction id in the
 * address, where the page asks our server what actually happened.
 */
export async function payuReturn(request: Request, path: string): Promise<Response> {
  let txnid = "";
  try {
    const fields = await readPayuFields(request);
    txnid = String(fields.txnid ?? "").trim().slice(0, 80);
    const config = payuConfig();
    if (config && txnid && process.env.SUPABASE_URL?.trim()) {
      await settlePayuCallback(config, fields, "return");
    }
  } catch (error) {
    console.error("[payu return] could not read the result", error);
  }
  const target = txnid ? `${path}?txnid=${encodeURIComponent(txnid)}` : path;
  return new Response(null, { status: 303, headers: { Location: target, "Cache-Control": "no-store" } });
}
