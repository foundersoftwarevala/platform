import os from "node:os";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

const token = process.env.SEO_MARKETPLACE_WORKER_TOKEN?.trim();
const endpoint =
  process.env.SEO_MARKETPLACE_WORKER_URL?.trim() ??
  "http://127.0.0.1:3000/api/marketplace-product-country-seo-worker";

if (!token) {
  console.error("[marketplace-seo-worker] missing worker token");
  process.exit(1);
}

let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});

function log(event, fields = {}) {
  console.log(
    JSON.stringify({
      time: new Date().toISOString(),
      event,
      ...fields,
    }),
  );
}

while (!stopping) {
  const metrics = {
    loadAverage1m: os.loadavg()[0],
    cpuCount: os.availableParallelism(),
    availableMemoryBytes: os.freemem(),
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metrics),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) {
      log("request-failed", { status: response.status });
      await sleep(15_000);
      continue;
    }

    const result = await response.json();
    if (
      result.retryAfterMs !== undefined &&
      (!Number.isSafeInteger(result.retryAfterMs) || result.retryAfterMs < 0)
    ) {
      throw new Error("worker returned an invalid retry delay");
    }
    if (result.claimed > 0) {
      log("item-processed", {
        completed: result.completed,
        failed: result.failed,
        provider: result.provider,
        remaining: result.progress?.pending,
      });
    } else if (!result.enabled) {
      log("worker-paused", {
        provider: result.provider,
        reason: result.pauseReason,
        loadAverage1m: metrics.loadAverage1m,
        availableMemoryBytes: metrics.availableMemoryBytes,
      });
    }
    if (result.retryAfterMs > 0) {
      log("provider-cooldown", {
        provider: result.provider,
        retryAfterMs: result.retryAfterMs,
      });
      await sleep(Math.min(result.retryAfterMs, 60_000));
      continue;
    }
    await sleep(result.enabled ? 2500 : 15_000);
  } catch (error) {
    log("request-error", {
      message: error instanceof Error ? error.message.slice(0, 200) : "unknown error",
    });
    await sleep(15_000);
  }
}

log("stopped");
