// What a person has saved, kept for them rather than for one browser.
//
// The heart on a product card wrote to localStorage under
// sv.home.favorites.v1, so a buyer who saved six products on their phone
// found none of them on their laptop and a cleared cache lost all of it.
// These are the same saves, held against the person.
//
// A visitor who is not signed in keeps the browser store exactly as before -
// saving something must not demand an account first - and whatever they
// collected is carried up to their list the moment they do sign in.
import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useFavorites } from "@/lib/marketplace-home/persistentState";

type SavedList = "saved" | "compare";

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * The person's saved products, or the browser's while nobody is signed in.
 *
 * Returns the same shape the card already used - a list of ids and a toggle -
 * so nothing about the card changes.
 */
export function useSavedProducts(list: SavedList = "saved") {
  const local = useFavorites();
  const [remote, setRemote] = useState<string[] | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const merged = useRef(false);

  const load = useCallback(async () => {
    const userId = await currentUserId();
    setSignedIn(Boolean(userId));
    if (!userId) {
      setRemote(null);
      return;
    }
    const { data, error } = await supabase.rpc("my_saved_products" as never, { _list: list } as never);
    if (error) {
      // A failure here must not lose what the visitor has; the browser copy stands.
      setRemote(null);
      return;
    }
    const rows = (data ?? []) as { product_slug: string | null }[];
    setRemote(rows.map((r) => r.product_slug ?? "").filter(Boolean));
  }, [list]);

  useEffect(() => {
    void load();
    const { data } = supabase.auth.onAuthStateChange(() => {
      merged.current = false;
      void load();
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  // Whatever was saved before signing in belongs to the person who saved it.
  useEffect(() => {
    if (merged.current || !signedIn || remote === null || list !== "saved") return;
    const toCarry = local.favorites.filter((id) => !remote.includes(id));
    if (toCarry.length === 0) {
      merged.current = true;
      return;
    }
    merged.current = true;
    void (async () => {
      for (const slug of toCarry) {
        await supabase.rpc("toggle_saved_product" as never, { _product_slug: slug, _list: list } as never);
      }
      await load();
    })();
  }, [signedIn, remote, local.favorites, list, load]);

  const favorites = remote ?? local.favorites;

  const toggle = useCallback(
    (slug: string) => {
      if (!signedIn) {
        local.toggle(slug);
        return;
      }
      // Answer the click at once; the server confirms straight after.
      setRemote((prev) =>
        prev === null ? prev : prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
      );
      void supabase
        .rpc("toggle_saved_product" as never, { _product_slug: slug, _list: list } as never)
        .then(() => load());
    },
    [signedIn, local, list, load],
  );

  return { favorites, toggle, signedIn: Boolean(signedIn) };
}
