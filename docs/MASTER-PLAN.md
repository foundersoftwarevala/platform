# Master plan — forensic findings, in dependency order

Every item below comes from the forensic scan of 28 September 2026. Nothing
here is speculation: each one names the measurement that put it on the list.

Rules this plan works under: read first, reuse what exists, fix, add only what
is genuinely missing, remove nothing without approval. The site has visitors on
it, so each change captures a baseline first and is verified live afterwards.

Status: `TODO` / `DOING` / `DONE` / `NEEDS-OWNER`

---

## P0 — production outage

### 0.1 The translation engine burned both CPUs while idle  `DONE`

**Issue.** Telemetry reported `cpu=100.0% health=degraded` continuously, and
the public guard recorded **seven 502 incidents a day** on 27 and 28 September,
recovering each about two minutes later.

**Root cause.** CTranslate2 decodes on OpenMP threads. OpenMP defaults to
`OMP_WAIT_POLICY=ACTIVE`, where an idle worker thread busy-waits instead of
sleeping. With `intra_threads=2` that is two threads spinning for the life of
the process whether or not anything is being translated. Per-thread accounting
found exactly two threads in state `R`, `wchan=0`, holding 37.1M and 37.0M
CPU ticks against the main thread's 211k. The container sat at its own
1.5-CPU ceiling on a two-core machine.

**Module.** `services/translation-engine` (container `sv-translate`).

**Dependency.** None. Everything else waits behind it, because no capacity
measurement means anything while 70% of the machine is being spent on nothing.

**Implementation.** `ENV OMP_WAIT_POLICY=PASSIVE` in the service Dockerfile,
placed after the dependency layers so it cannot invalidate the pip cache. It
lives in the image rather than `/etc/sv-translate.env` so it travels with the
build and cannot drift from the repository.

**Verification.** Proven before deploying, not assumed: a second container was
started from the same image, the same mounted weights and the same env file,
differing only in this variable.

| | idle CPU | languages | backend |
|---|---|---|---|
| live, ACTIVE | **150.63%** | 140 | madlad |
| probe, PASSIVE | **0.20%** | 140 | madlad |

After deploying, CPU tracks real work exactly: `inflight=0` → 0.20-14%,
`inflight=1` → ~155%. Before the fix it was 150%+ with `inflight=0`.

- 60/60 service unit tests pass
- homepage byte-identical before and after (198,778 bytes both)
- Hindi `/`: `lang=hi`, 69.0% Devanagari after reload — identical to pre-fix
- Arabic `/marketplace`: `lang=ar` `dir=rtl`, 67.2% — identical to pre-fix
- language choice persists across reload; 0 page errors
- **0 502 incidents** since the deploy
- all ten cron jobs still reporting; all three containers healthy

**Rollback.** The previous service source is kept at
`/opt/sv-translate/app.backup-20260928105504`, and the previous image is still
tagged locally. Reverting is one `docker run` with the old tag.

---

## P0/P1 — public customer flows

### 1.1 `/vala-tv` is a public page behind an operator gate  `TODO`
### 1.2 The footer sends customers to the operator support console  `TODO`

## P1 — money, mail, AI

### 2.1 Payment lifecycle audit, end to end  `TODO`
### 2.2 Email has 57 queued messages and no provider  `TODO`
### 2.3 AI API Manager has no provider registered  `TODO`
### 2.4 One AI generation has been RUNNING for twenty days  `TODO`

## P2 — automation and scale

### 3.1 AI agent / worker infrastructure  `TODO`
### 3.2 Anonymous HTML micro-caching at the edge  `TODO`
### 3.3 PM2 capacity, once CPU is measured clean  `TODO`
### 3.4 Off-server backups  `TODO`

## P3 — consistency

### 4.1 Public pages without footer or language chrome  `TODO`
### 4.2 The stale `softwarevala-lang-staging` PM2 entry  `TODO`

---

## Measurements to repeat at the end

CPU, RAM, load, latency, 502 count, HTML throughput, database and PostgREST
latency, worker throughput, translation throughput, queue depth, AI latency,
Cloudflare cache ratio — before against after.
