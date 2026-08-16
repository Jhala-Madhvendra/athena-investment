# Scheduled Monitoring

## What it is

The mechanism that decides *when* the Alert Engine actually runs. Sprint 11 ships exactly one trigger: an explicit, authenticated, rate-limited `POST /api/alerts/monitor` call — no background job, no cron, no continuous polling.

## Why it is needed

Detection logic (the rule engine) and detection *scheduling* are separate concerns — a perfectly correct rule engine is useless if nothing ever calls it, and the wrong triggering mechanism can turn a cheap, well-designed engine into an expensive, abuse-prone one. Sprint 11's brief explicitly calls this out as a decision to make deliberately, not default into.

## Alternatives considered

- **A scheduled backend job (cron) re-evaluating every tracked ticker on a fixed interval.** Rejected for this sprint: no scheduler infrastructure exists anywhere in the codebase (verified — no `node-cron`, `agenda`, `bull`, or any existing cron file across `backend/`), and introducing one is exactly the kind of new infrastructure the sprint brief asks to avoid unless an existing pattern already justifies it. It would also run monitoring for users who never look at the app, doing real work (financial computation, DB writes) with no one to benefit from it yet.
- **Continuous/real-time monitoring (e.g., a change stream on `MarketHistory` or `FinancialStatement` triggering immediate re-evaluation).** Explicitly ruled out by the sprint brief itself ("Do not implement continuous monitoring").
- **On-demand, per-user, explicit action.** This is what shipped. It mirrors a pattern the codebase had already established for an analogous problem: Sprint 9's `watchlistInsights.service.js` computes "what's changed" only when a user explicitly requests it (`GET /api/watchlist/insights`), never automatically, specifically because auto-firing it on every page load would silently consume the comparison baseline before the user ever saw it. Monitoring reuses the same philosophy.

## Trade-offs

- **Pro:** zero new infrastructure — no scheduler to deploy, monitor, or reason about failure modes for (a cron job that silently stops running is a real operational risk this design sidesteps entirely for v1).
- **Pro:** a user who never opens Athena costs nothing — no wasted computation on inactive accounts, unlike a fixed-interval job that would evaluate every tracked ticker for every user regardless of whether anyone's watching.
- **Con:** an alert can only be as fresh as the last time *someone* triggered monitoring — there's no guarantee a meaningful change is caught the moment it happens, only that it's caught the next time a user (any user tracking that ticker, in a future design — see below) checks.
- **Con:** because it's user-triggered rather than scheduled, it needs its own abuse protection (see below) that a purely internal cron job wouldn't require.

## How Athena implements it

`POST /api/alerts/monitor` (`alert.routes.js`) sits behind `requireIdentity` (same anonymous-token scoping as every other Watchlist/Portfolio endpoint) and a dedicated `monitorLimiter` — separate from the shared `expensiveLimiter` other fan-out endpoints use, because this is genuinely the single most expensive endpoint in the app (it iterates every ticker a user tracks across five rule categories). `env.js`'s `alertMonitorRateLimitMax` (default 10 per window) caps it independently of every other rate limit. Within one call, `alert.service.js`'s `runMonitoring` evaluates each tracked ticker's Market/Financial/Business/News rules and the account's Portfolio rules, all reusing existing, already-cached or DB-only data sources — the monitoring pass itself adds no new external-provider call sites (see the Performance section of `research/product/IntelligentAlertsProductDesign.md`).

## Interview questions

1. *"Why not just add a cron job — isn't that the standard way to do monitoring?"* — It's standard when the infrastructure already exists and the cost of always-on evaluation is justified. Neither was true here: no scheduler exists in this codebase, and evaluating every user's every tracked ticker on a timer would spend real computation on accounts nobody's actively checking. An explicit, rate-limited trigger costs nothing until a user actually wants fresh alerts.
2. *"What's the actual risk this design is guarding against with `monitorLimiter`?"* — A user (or a script) hammering `POST /api/alerts/monitor` repeatedly, each call fanning out across every tracked ticker's financial/market/news lookups — cheap individually (cached/DB-only), but not free, and not something an unauthenticated-adjacent (bearer-token, no real auth) endpoint should allow unlimited repetition of.
3. *"How would you evolve this toward something closer to real-time without building a full scheduler?"* — The cheapest next step, if ever justified by usage data, would be a low-frequency cron (e.g., hourly) that calls the exact same `runMonitoring` function already built, for a batch of active users — the trigger mechanism would change, but zero rule-engine or persistence code would need to, because scheduling and detection were kept as separate concerns from day one.
4. *"If a user never opens the Alert Center, do they still get value from Sprint 9's Watchlist or Portfolio pages?"* — Yes — those pages still show live, current data on every load, exactly as before Sprint 11. Alerts are additive: nothing about monitoring being on-demand degrades the always-fresh, always-computed-on-request experience those pages already had.
