/**
 * Lightweight offline stand-in for the marketplace backend client.
 * All content on the home page falls back to bundled defaults, so these
 * calls resolve to empty results instead of hitting a network service.
 */
type Result = { data: unknown[] | null; error: null };

const emptyResult: Result = { data: [], error: null };

function queryBuilder() {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    then: (resolve: (r: Result) => void) => Promise.resolve(emptyResult).then(resolve),
  };
  return builder;
}

export const supabase = {
  from: () => queryBuilder(),
  auth: {
    getSession: async () => ({ data: { session: null as null | { user: { email: string } } } }),
    onAuthStateChange: (
      _cb: (event: string, session: null | { user: { email: string } }) => void,
    ) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async (_c: { email: string; password: string }) => ({
      error: { message: "Sign-in is not connected yet." },
    }),
    signOut: async () => ({ error: null }),
  },
} as any;
