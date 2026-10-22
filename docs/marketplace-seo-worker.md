# Marketplace product-country SEO worker

The worker claims one product-country pair per tick and holds a database lease
for the full generation, so manual and background work cannot exceed one
in-flight pair. It waits 2.5 seconds between active ticks, checks host load and
free memory before every tick, and records its heartbeat and provider in the
SEO Manager. The queue is restricted to Ollama Local and explicitly approved
Free text providers; every gateway request is capped at the Free pricing tier.

After three consecutive Ollama failures, the worker tries active, approved,
non-local Free text providers in AI API Manager order. A rate-limited provider
is followed by the next eligible Free provider for the same item. If every
eligible provider fails, that item stays pending and is prioritized for retry.
Rate-limit failures are persisted with a 60-second retry deadline; other
provider failures use a 15-second delay. After ten consecutive failed Free
provider rounds, the worker pauses. The only eligible remote models are the
verified Groq `qwen/qwen3.8-27b` model and OpenRouter models whose IDs end in
`:free`; paid models and unverified providers are never eligible. Host-load
and low-memory safety pauses still take precedence.

Production prerequisites:

1. Apply `20261108T123000_marketplace_product_country_seo_worker.sql` to the
   same VPS database as the existing product-country SEO queue.
2. Apply `20261108T131000_marketplace_seo_free_provider_retries.sql` after
   confirming the OpenRouter service has an active encrypted production key.
   It registers the OpenRouter `xingchen-agi/xing4.0-29b-a4b:free` model and
   its chat-completions endpoint, and adds durable retry state and queue
   priority for the item being retried. Back up the affected state, dry-run
   the migration in a transaction, and keep
   `deploy/production/system/marketplace-seo-free-provider-retries.rollback.sql`
   ready before applying. The rollback restores the prior endpoint and retry
   schema while retaining provider/model registry rows and credentials.
3. Create `/etc/softwarevala/seo-worker.env` from
   `deploy/production/seo-worker.env.example`, with one generated random token
   shared by the app process and worker. Keep it root-owned, mode `0600`.
4. Install `scripts/ops/marketplace-product-country-seo-worker.mjs` as
   `/usr/local/bin/sv-marketplace-seo-worker.mjs` and the service file as
   `/etc/systemd/system/marketplace-product-country-seo-worker.service`.
5. Load the token into the app's PM2 environment, restart the app, then run
   `systemctl daemon-reload` and `systemctl enable --now
marketplace-product-country-seo-worker.service`.

Inspect runtime activity with:

```sh
systemctl status marketplace-product-country-seo-worker.service
journalctl -u marketplace-product-country-seo-worker.service -f
```

Pause and resume generation from the Marketplace SEO queue panel. A host-load
or memory safety pause remains in effect until an operator resumes it.
Provider cooldowns survive app and worker restarts; the poller sleeps for the
server-reported remaining retry interval rather than busy-polling.
