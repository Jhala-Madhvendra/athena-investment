# Alert Deduplication

## What it is

Preventing the same underlying fact from producing more than one `Alert` document for the same user, no matter how many times `POST /api/alerts/monitor` runs.

## Why it is needed

The Alert Engine is stateless and recomputes its rule checks fresh on every monitoring pass (see `EventDetection.md`) — without deduplication, a stock sitting 8% below its 5-day-ago price would create a new "AAPL declined 8%" alert on every single call, drowning the Alert Center in duplicates of the same fact rather than the one alert that fact actually deserves. This is precisely the "signal > noise" principle the sprint brief leads with.

## Alternatives considered

- **Check-then-insert (query for an existing matching alert, insert only if none found).** Rejected — this has a race window: two concurrent monitoring calls (e.g., two browser tabs, or a retried request) could both check, both find nothing, and both insert, producing exactly the duplicate the check was meant to prevent.
- **A separate "seen events" table tracking what's already been alerted, independent of the Alert collection itself.** Rejected as needless duplication — the Alert documents themselves already carry every field needed to define an identity; a second collection recording the same identities would just be a second source of truth to keep in sync.
- **Application-level in-memory dedup (a cache of recently-created alert keys).** Rejected — doesn't survive a server restart, doesn't work across multiple server instances, and Mongo's own unique index already provides exactly this guarantee, atomically, for free.

## Trade-offs

- **Pro:** a Mongo unique compound index makes the guarantee atomic and race-safe at the database layer — no application-level locking or coordination needed, and it works identically whether one request or ten concurrent requests all try to create the same alert at once.
- **Pro:** the "is this a duplicate" check and the "create it" action are the same operation (`insertIfNew`'s `Alert.create` call) — there's no window between checking and acting for a race to slip through.
- **Con:** designing the right identity (`periodKey`) per rule family requires real thought — get it wrong (too narrow) and genuine repeats slip through; get it wrong (too broad) and a legitimately new occurrence of the same rule gets silently swallowed. See the per-category reasoning below.

## How Athena implements it

Every `Alert` document's identity is the tuple `{userId, ticker, type, rule, periodKey}`, enforced by a unique compound index in `alert.model.js`. `alert.deduplicator.js`'s `insertIfNew(Alert, candidate)` simply attempts `Alert.create(candidate)` and treats a Mongo duplicate-key error (`error.code === 11000`) as "already alerted" — returning `null`, not throwing — rather than checking first. `periodKey` varies by rule family, chosen so the *same underlying fact* can only ever produce one alert:

- **Market / Portfolio (day-scoped rules):** the evaluation date. A fresh alert can still fire the next day if the condition persists or worsens — this is a deliberate throttle, not a permanent suppression.
- **Financial (single-period deltas):** the fiscal-year pair being compared (e.g. `FY2025-FY2026`) — naturally idempotent, since it only changes when a new statement is imported.
- **Business (multi-year trend / sign-change):** the trend window's own fiscal-year pair, same reasoning.
- **News:** the article's own `_id` — already unique per Sprint 10's own dedup pipeline, so no new dedup logic was needed here, only reuse.

`alert.service.js`'s `runMonitoring` inserts candidates one at a time (not `Promise.all`) — a deliberate throttle so a user tracking many tickers doesn't fire dozens of concurrent writes in one request, not a missed optimization opportunity.

## Interview questions

1. *"Why does inserting a duplicate return `null` instead of throwing an error the caller has to catch?"* — Because a duplicate isn't an error condition from the caller's perspective — it's the expected, correct outcome of "this fact was already alerted." Forcing every call site to wrap `insertIfNew` in a try/catch for a routine, expected case would be worse ergonomics than a plain return value the caller can check.
2. *"Why day-level granularity for Market alerts instead of, say, comparing against the last-alerted value?"* — A value-based comparison (only re-alert if the decline has worsened by another X%) is more precise but requires storing the value that generated the last alert — extra state for a case day-level throttling already handles well: at most one alert per rule per ticker per day, with a fresh alert available the next day if the situation persists.
3. *"What would happen if `periodKey` for Financial alerts were just `'latest'` instead of the fiscal-year pair?"* — It would still dedupe correctly *within* one fiscal year, but it would also incorrectly suppress a genuinely new alert once FY2027 arrives and produces a new FY2026→FY2027 comparison — `'latest'` doesn't distinguish which comparison it's protecting, the fiscal-year pair does.
4. *"How do you know the unique index is actually race-safe, not just intended to be?"* — Because the guarantee comes from MongoDB itself (a unique index rejects a second insert with the same key values, full stop, regardless of timing), not from any coordination Athena's own code has to get right — `alert.deduplicator.test.js` verifies the E11000-to-`null` mapping, and the underlying atomicity is Mongo's contract, not something to re-prove at the application layer.
