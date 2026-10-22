export const SEO_PRODUCT_CRAWL_LIMIT = 50;
export const SEO_PRODUCT_CRAWL_CONCURRENCY = 10;

export type SeoProductCrawlUrl = {
  url: string;
  sourceUrl: string | null;
};

export type SeoProductCrawlCheck = SeoProductCrawlUrl & {
  httpStatus: number | null;
  error: string | null;
};

type CrawlOptions = {
  concurrency?: number;
  timeoutMs?: number;
  fetcher?: typeof fetch;
};

function validateCrawlUrl(value: SeoProductCrawlUrl, origin: string): URL {
  const target = new URL(value.url);
  if (target.protocol !== "https:" || target.origin !== origin) {
    throw new Error("The crawler only accepts HTTPS URLs on this site.");
  }
  return target;
}

export function isBrokenSeoHttpStatus(status: number): boolean {
  return status === 404 || (status >= 500 && status <= 599);
}

async function requestStatus(url: URL, timeoutMs: number, fetcher: typeof fetch): Promise<number> {
  let response = await fetcher(url, {
    method: "HEAD",
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": "SoftwareVala-TechnicalSEO/1.0" },
  });

  if (response.status === 405 || response.status === 501) {
    response = await fetcher(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        range: "bytes=0-0",
        "user-agent": "SoftwareVala-TechnicalSEO/1.0",
      },
    });
    await response.body?.cancel().catch((cause: unknown) => {
      console.warn("[seo-product-crawl] response body cleanup failed", cause);
    });
  }

  return response.status;
}

export async function scanSeoProductUrls(
  urls: SeoProductCrawlUrl[],
  siteOrigin: string,
  options: CrawlOptions = {},
): Promise<SeoProductCrawlCheck[]> {
  if (urls.length > SEO_PRODUCT_CRAWL_LIMIT) {
    throw new Error(`A crawl is limited to ${SEO_PRODUCT_CRAWL_LIMIT} URLs.`);
  }

  const origin = new URL(siteOrigin);
  if (origin.protocol !== "https:" || origin.origin !== siteOrigin) {
    throw new Error("The configured crawl origin must be an HTTPS origin.");
  }

  const uniqueUrls = [...new Map(urls.map((item) => [item.url, item])).values()];
  const targets = uniqueUrls.map((item) => ({
    item,
    target: validateCrawlUrl(item, origin.origin),
  }));
  const concurrency = options.concurrency ?? SEO_PRODUCT_CRAWL_CONCURRENCY;
  if (
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > SEO_PRODUCT_CRAWL_CONCURRENCY
  ) {
    throw new Error(`Crawler concurrency must be between 1 and ${SEO_PRODUCT_CRAWL_CONCURRENCY}.`);
  }
  const timeoutMs = options.timeoutMs ?? 8_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
    throw new Error("Crawler timeout must be between 1 and 30000 milliseconds.");
  }

  const results = new Array<SeoProductCrawlCheck>(targets.length);
  let nextIndex = 0;
  const fetcher = options.fetcher ?? fetch;

  const worker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= targets.length) return;
      const { item, target } = targets[index];
      try {
        results[index] = {
          ...item,
          httpStatus: await requestStatus(target, timeoutMs, fetcher),
          error: null,
        };
      } catch (cause) {
        results[index] = {
          ...item,
          httpStatus: null,
          error:
            cause instanceof Error ? cause.message.slice(0, 300) : "The URL could not be reached.",
        };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()));
  return results;
}
