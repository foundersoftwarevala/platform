import { toast } from 'sonner';

/**
 * Shared data-access helper for the Server Manager module.
 *
 * Every screen loads from Lovable Cloud (Supabase) directly. Without this
 * wrapper a failed query resolves with `{ data: null, error }` and the screen
 * silently renders an empty state, which is indistinguishable from "no rows".
 * `smQuery` surfaces the failure to the user and to the console instead.
 */
export interface SmResult<T> {
  data: T | null;
  error: { message: string } | null;
}

export async function smQuery<T>(
  label: string,
  run: () => PromiseLike<SmResult<T>>,
): Promise<T | null> {
  try {
    const { data, error } = await run();
    if (error) throw new Error(error.message);
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[server-manager] ${label} failed`, err);
    toast.error(`Could not load ${label}`, { description: message });
    return null;
  }
}

/** Same as `smQuery` but for writes — returns success/failure and toasts both ways. */
export async function smMutate<T>(
  label: string,
  run: () => PromiseLike<SmResult<T>>,
  successMessage?: string,
): Promise<boolean> {
  try {
    const { error } = await run();
    if (error) throw new Error(error.message);
    if (successMessage) toast.success(successMessage);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[server-manager] ${label} failed`, err);
    toast.error(`${label} failed`, { description: message });
    return false;
  }
}

/** Human-readable message for an inline error banner. */
export function smErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong loading this data.';
}
