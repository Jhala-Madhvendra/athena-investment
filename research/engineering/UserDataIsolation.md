# Engineering Concept: User Data Isolation

## What it is

Every piece of user-specific data Sprint 9 introduces (Watchlist, WatchlistSnapshot, Holding) is queried, updated, and deleted through `userId`, and that `userId` is never read from anything the client sends — it's resolved server-side from an opaque bearer token on every request via `identity.middleware.js`, then attached to `req.userId`. No route handler ever trusts a `userId` field in a request body or query string.

```js
// identity.middleware.js
const userId = await identityService.resolveUserIdByToken(match[1]);
req.userId = userId;

// portfolio.service.js - ownership enforced in the query itself
const holding = await Holding.findOneAndUpdate({ _id: holdingId, userId }, updates, { new: true });
if (!holding) throw new HoldingNotFoundError(); // wrong id AND wrong owner look identical
```

## Why we use it

Sprint 9 is the first time Athena has any per-user state at all (Sprints 1-8 are entirely anonymous, shared, company-scoped data). The moment user-specific data exists, "can User A see or modify User B's data" becomes a real question with a real wrong answer, and the only way to guarantee the answer is always "no" is to make it structurally impossible rather than something each route handler has to remember to check.

## Alternatives considered

- **Client-supplied `userId` in the request body, validated against a session table.** Rejected outright — this is the textbook IDOR (Insecure Direct Object Reference) vulnerability; any user could edit the field and act as any other user id they can guess or enumerate.
- **Full username/password authentication with sessions.** Rejected for this sprint's scope — the sprint brief explicitly asks whether to introduce real auth or a minimal identity mechanism, and a full login system (password hashing, session/JWT management, password reset flows) is disproportionate to what's actually needed: isolating one browser's watchlist/portfolio from another's, not securing a real user account across devices.
- **A cookie-based session instead of a bearer token.** Rejected to avoid CSRF-mitigation complexity (cookies sent automatically need explicit CSRF protection; a token the client must deliberately attach as an `Authorization` header does not) and to avoid `credentials: true` CORS complications this codebase doesn't otherwise need.

## Trade-offs

- **Pro:** ownership checks are folded directly into the database query (`{_id, userId}` together) rather than "fetch, then check owner, then act" — a guessed id belonging to another user matches nothing, and there's no code path where it's possible to forget the check.
- **Pro:** the identity mechanism reuses this codebase's existing conventions end-to-end — no new dependency (Node's built-in `crypto`, not a JWT library), same `sendServiceError`/typed-error-class pattern every other domain uses.
- **Con:** this is identity, not account security — no password, no cross-device login, no recovery if `localStorage` is cleared. Explicitly out of scope for this sprint per the approved design; a real accounts system is future work.
- **Con:** the raw token is only returned once (at `POST /api/identity`); losing it means losing access to that watchlist/portfolio permanently — an accepted trade-off for the sprint's scope, not an oversight.

## How Athena implements it

`User { tokenHash }` stores only a SHA-256 hash of the token, never the raw value — the same principle as never storing a plaintext password. `requireIdentity` is mounted only on `/api/watchlist` and `/api/portfolio`, never globally, so every Sprint 1-8 route remains exactly as unauthenticated as before. Verified live against the running app with two real, independently-created tokens: User B's `PUT`/`DELETE` against User A's holding both returned 404 (not a leak, not a mutation), and separately, User A and User B's watchlists never showed each other's tickers.

## Interview questions

1. *"Why scope the query as `{_id: holdingId, userId}` together instead of fetching by id first and then checking `if (holding.userId !== req.userId)`?"* — Both are correct if implemented carefully, but the combined-query version makes the mistake structurally impossible rather than reviewable — there's no code path where a developer could forget the ownership check, because it isn't a separate step. It also returns a uniform 404 for both "doesn't exist" and "exists but isn't yours," which avoids leaking which case occurred.
2. *"This is a bearer token, not a password-based login — is that actually secure?"* — It's not account security in the traditional sense (anyone who obtains the raw token can act as that user), but it correctly solves the problem this sprint actually has: isolating one anonymous browser's data from another's. It's an explicit, documented trade-off, not a security shortcut disguised as something stronger.
