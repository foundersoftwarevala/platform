import { catalogConfigured, readCatalogRows, type CatalogPage } from "./catalog.server";
import { onCatalogueChange } from "@/lib/marketplace/catalogue-invalidation";
import { invalidateRedisCacheTag, redisCached } from "@/lib/server/redis-cache.server";

type HomeCatalogSeed = CatalogPage | null;

const CACHE_MS = 60_000;
let cached: { at: number; payload: HomeCatalogSeed } | null = null;

onCatalogueChange(() => {
  cached = null;
  void invalidateRedisCacheTag("marketplace-home");
});

export async function readHomeCatalogSeed(
  rowCount: number,
  perRow: number,
): Promise<HomeCatalogSeed> {
  if (!catalogConfigured()) return null;
  return redisCached("marketplace-home", "first-page:v1", CACHE_MS, async () => {
    if (!process.env.REDIS_URL?.trim() && cached && Date.now() - cached.at < CACHE_MS) {
      return cached.payload;
    }
    try {
      const payload = await readCatalogRows({ rowOffset: 0, rowCount, perRow });
      if (payload) cached = { at: Date.now(), payload };
      return payload;
    } catch (error) {
      console.error("[home catalogue] seed failed", error);
      return null;
    }
  });
}
