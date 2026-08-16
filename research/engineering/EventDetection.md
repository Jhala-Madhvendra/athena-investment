# Event Detection

## What it is

Turning raw, continuously-changing data (prices, financial statements, news, portfolio values) into discrete "something happened" events — the step between "Athena has data" and "Athena has an opinion about whether that data is worth telling someone about."

## Why it is needed

Most of Athena's data changes constantly (a quote every request, a portfolio value every time a price moves) but almost none of those changes are individually meaningful. Event detection is the filter between raw data and the Alert Engine's rules — without it, "monitoring" would just mean re-displaying the same dashboards on a timer, which is exactly the "system that displays information" Sprint 11's brief explicitly wants to move past.

## Alternatives considered

- **Compare every request to the previous request, client-side.** Rejected for the same reason Sprint 9's Watchlist snapshot design rejected it: no server-side source of truth, doesn't survive a browser switch, and provides no basis for cross-session or cross-device consistency.
- **Continuous background polling (a cron job re-evaluating every ticker on a schedule).** Rejected — no scheduler infrastructure exists anywhere in this codebase (verified: no `node-cron`, `node-schedule`, `agenda`, or `bull` dependency, and no existing cron file), and the sprint brief explicitly asks not to introduce continuous monitoring for v1. See `ScheduledMonitoring.md`.
- **Detect events by comparing every monitoring pass against the previous monitoring pass's raw response.** This was the closest alternative, but it would require persisting a snapshot of *everything* checked, not just the specific facts a rule needs — needlessly larger storage and more state to keep consistent than what was actually implemented (see below).

## Trade-offs

- **Two different event-detection strategies coexist deliberately, chosen per data source:**
  - *Structural identity as the "event," no snapshot needed* (Financial/Business/News rules): a fiscal-year pair or an article id is already a stable, non-repeating fact — the underlying data changing is itself the event, and asking "has this exact fact already produced an alert" is answered by the Alert model's own unique index, not a separate comparison step.
  - *Explicit prior-value comparison, snapshot required* (Portfolio's value-change rule, and only that rule): some facts (a portfolio position's dollar value) have no natural "version" to key off — the only way to know "did this change" is to have recorded what it was last time.
- **Con of the snapshot-free approach:** it only works when the data itself carries a stable identity (a fiscal year, an article id, a trading date) — it wouldn't work for something like "has the price moved since I last checked," which is why Portfolio's value-change rule is the one exception.
- **Con of the snapshot-based approach:** persistence to maintain, and (per `SnapshotArchitecture.md`) a real risk of choosing the wrong scope (shared vs. per-user) and silently producing wrong answers for someone.

## How Athena implements it

Market rules detect events by slicing an already-cached daily bar series (`market.service.js`'s `getHistoricalPrices`) and computing threshold crossings fresh every monitoring pass — cheap because the underlying provider-call avoidance is already solved by Sprint 4/5's own freshness-checked cache, so no additional snapshot layer was needed on top of it (this was a design correction made mid-implementation — see `SnapshotArchitecture.md`). Financial/Business rules detect events by comparing the two (or five) most recent fiscal years directly, using the fiscal-year range itself as the event's identity. News rules detect events by scanning already-classified, already-deduplicated stored articles (Sprint 10's pipeline) for important categories, using each article's own id as the event identity. Portfolio's concentration/gain-loss rules detect events as stateless threshold crossings against current data; only its value-change rule genuinely needs — and gets — a persisted prior observation (`PortfolioAlertSnapshot`).

## Interview questions

1. *"How does Athena decide whether a rule needs a snapshot at all?"* — Ask whether the data already has a stable, non-repeating identity to key off (a fiscal year, an article id, a trading date). If yes, that identity plus a unique index is sufficient — the fact of a new identity appearing *is* the event. If no (a continuously-valued fact with no natural "version," like a portfolio's dollar value), a snapshot is the only way to answer "did this change."
2. *"Isn't it inconsistent that some alert categories use a snapshot and others don't?"* — It would be inconsistent if it were arbitrary, but it isn't — it follows directly from whether the underlying data has a natural identity to compare against. Forcing every category onto the same mechanism (either all-snapshot or all-identity-based) would mean either wasting storage where none is needed or building comparisons that don't actually answer the question a rule is asking.
3. *"What's the actual cost difference between the two strategies?"* — Identity-based detection costs nothing extra to persist (the Alert's own unique index does double duty as both dedup and "have I seen this event" tracking); snapshot-based detection costs one small document per (user, ticker) pair that must be kept in sync on every write. For Athena's five categories, only one (Portfolio value-change) pays that cost, deliberately.
