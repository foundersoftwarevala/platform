/**
 * Whether the signed-in caller of a server function is a Marketplace operator.
 *
 * Evaluated with the caller's own token through mm_is_operator - the same
 * database gate every Marketplace Manager function uses - so the answer is the
 * database's, not something the browser claims. Returns null when the caller
 * may proceed, otherwise a sentence to show them.
 *
 * Use it after `requireSupabaseAuth`, which puts the caller's client on
 * `context.supabase`.
 */
export async function operatorRefusal(context: unknown): Promise<string | null> {
  const sb = (context as { supabase?: { rpc: (fn: string) => PromiseLike<{ data: unknown; error: { message: string } | null }> } } | undefined)
    ?.supabase;
  if (!sb) return "Sign in to use this.";
  const { data, error } = await sb.rpc("mm_is_operator");
  if (error) return `Could not confirm your access: ${error.message}`;
  return data === true ? null : "Marketplace operator access is required.";
}
