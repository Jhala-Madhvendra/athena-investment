# Alert Lifecycle

## What it is

The states an `Alert` document moves through after creation — unread → read (and independently) → dismissed — plus how long it's kept before being removed entirely.

## Why it is needed

An alert that can only ever be "new" or "gone" forces a false choice: either the Alert Center accumulates forever (every alert ever generated, unread and read alike, indistinguishable), or dismissing loses information a user might want to reference later ("wait, what was that alert about AAPL last week?"). Two independent booleans (`isRead`, `isDismissed`) plus a retention window solve both without conflating "I've seen this" with "I'm done with this."

## Alternatives considered

- **A single `status` enum (`unread`/`read`/`dismissed`).** Considered, but rejected in favor of two independent booleans — read and dismissed aren't mutually exclusive states in the way an enum implies (an alert can be read *and later* dismissed, or dismissed *while still unread* if a user clears their whole feed without expanding each card). Two booleans model that correctly; an enum would need a `readAndDismissed` case that's really just two facts pretending to be one.
- **Hard-delete on dismiss.** Rejected — the sprint brief explicitly says not to delete on dismiss, and it matches how every other "clear this notification" UI a user is likely to have encountered actually behaves: dismissing declutters the active view, it doesn't erase history.
- **Indefinite retention (never delete anything).** Rejected — an alert about a financial-statement change from a year ago has essentially zero decision value once newer statements have superseded it, and indefinite retention only grows a collection with no corresponding benefit. See the Retention section below.

## Trade-offs

- **Pro (two booleans over an enum):** every combination is representable without a synthetic composite state, and each transition (`markAsRead`, `dismissAlert`) is a simple, independent update — no state-machine validation logic needed to reject an "invalid" transition, because there isn't one.
- **Pro (TTL over manual archival):** a Mongo TTL index (`expireAfterSeconds` on `createdAt`) needs zero application code to enforce — no cron job, no batch-delete script, no risk of the cleanup job itself silently failing. It's the same mechanism (and reasoning) `NewsArticle`'s retention already uses.
- **Con (TTL over manual archival):** no "restore" path — once an alert ages out, it's genuinely gone, not soft-deleted. Accepted because the sprint brief explicitly asks not to over-engineer archival, and a 90-day-old alert's practical value (verifying a claim, not acting on stale data) doesn't justify building a restore feature for it.

## How Athena implements it

`alert.model.js`: `isRead` and `isDismissed`, both `Boolean, default: false`. `PATCH /api/alerts/:id/read` and `PATCH /api/alerts/:id/dismiss` (`alert.controller.js` → `alert.service.js` → `alert.repository.js`) each update exactly one field, scoped `{_id, userId}` together so a guessed id belonging to another user matches nothing. `GET /api/alerts` always excludes `isDismissed: true` from its results (`alert.repository.js`'s `buildListQuery`) — dismissed alerts are preserved in the database, just no longer surfaced in the default feed; there is currently no "view dismissed" endpoint, since nothing in the sprint brief's explicit API list calls for one. Retention: a TTL index on `createdAt` with `expireAfterSeconds` derived from `env.alertRetentionDays` (default 90) — matching the exact precedent and reasoning `NewsArticle`'s retention already established in Sprint 10 (`research/engineering/NewsCaching.md`).

## Interview questions

1. *"Why two booleans instead of a status enum?"* — Because read and dismissed genuinely are independent facts about an alert, not mutually exclusive states — an enum would need an artificial composite value (or would have to pick one fact to lose) for the case where both are true, which is a real, reachable case (a user reads an alert, then later clears it from their feed).
2. *"Why does dismissing not delete the alert?"* — Because "I don't need to see this in my active feed anymore" and "this never happened" are different intents, and the sprint brief is explicit that dismiss shouldn't destroy history a user might want to verify or reference later.
3. *"Why 90 days for retention, and why a TTL index instead of a cleanup job?"* — 90 days matches the same reasoning `NewsArticle` already uses: an alert's decision-relevance decays fast (newer financials/prices supersede it), and a TTL index enforces that at the database layer with no application code, no scheduled job to fail silently, and no batch-delete script to get the query wrong on.
4. *"What happens to a user's unread count when an alert both ages out via TTL and was never read?"* — It simply stops being counted the moment Mongo expires the document — `countUnread`'s query (`{userId, isRead: false, isDismissed: false}`) only ever sees documents that still exist, so TTL expiry and the read/dismiss lifecycle compose without any special-case handling needed between them.
