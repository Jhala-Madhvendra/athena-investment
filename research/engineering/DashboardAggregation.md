# Engineering Concept: Dashboard Aggregation (and Why Athena Didn't Build One)

## What it is

A dashboard aggregation endpoint (sometimes called a Backend-for-Frontend, or BFF) is a single API route that fans out to multiple internal services server-side and returns one combined payload, so a page needing data from N sources makes one network request instead of N. The sprint explicitly named a candidate — `GET /api/company/:ticker/dashboard` — and asked whether Overview needed one before building anything.

## Why we use it (in general — Athena didn't, this sprint)

BFF endpoints earn their cost when: the client is bandwidth- or latency-constrained (mobile networks, cross-region calls) such that N round trips are materially slower than one; the partial-failure contract needs to be unified server-side rather than handled independently per call; or multiple different clients (web, mobile, a public API) all need the same combined shape and would otherwise duplicate the fan-out logic in each one.

## Alternatives considered

- **Build `GET /api/company/:ticker/dashboard`.** Rejected for this sprint — see trade-offs below.
- **Frontend-orchestrated parallel fetches** (what Athena built). Each of Overview's five data needs (`company`, `market`, `market/performance`, `analysis`, `ratios`) is fetched independently and concurrently from the browser.

## Trade-offs

**For the BFF:** one round trip instead of five; ticker resolution happens once server-side instead of once per call; one partial-failure contract to test instead of five independent ones.

**Against it, at Athena's current scale:** the browser already runs the five fetches *concurrently* — total wall-clock time is bounded by the slowest call, not the sum of all five, so the "one round trip" benefit doesn't translate into a real latency win here. Every other page in the app (Market Intelligence, Business Analysis) already uses the frontend-orchestrated multi-fetch pattern successfully; introducing a second architecture for exactly one page (Overview) breaks consistency for a single consumer, the opposite of the reuse a BFF is usually justified by. A BFF endpoint doesn't reduce total backend work — it relocates the fan-out from client to server, meaning the aggregation logic still has to exist somewhere, now as a new file needing its own tests, instead of being handled by five services that already independently test their own failure modes. And critically, independent per-section fetches are a genuine *product* advantage for progressive disclosure (see [[ProgressiveDisclosure]]): Company Header can render the instant the company profile resolves while the live market quote — the slowest call, due to Yahoo's cookie/crumb auth handshake — is still in flight. A single aggregated response would force an all-or-nothing wait, undoing that benefit unless the BFF itself streamed partial results, which reintroduces most of the complexity it was meant to remove.

## How Athena implements it

Overview.jsx fires five independent `fetch` calls in one `useEffect`, each tracked through its own `{data, loading, error}` slot via a small `useFetchSlot()` helper — not `Promise.all` (which would reject/short-circuit the whole batch on one failure) and not a single combined `Promise.allSettled` either, since that would still gate every section's *loading* state on the slowest call even though failures wouldn't crash the page. Each section reads only the slots it depends on, so Financial Health can render as soon as `analysis` resolves regardless of whether `ratios` has finished yet.

## Interview questions

1. *"A page needs data from five different services. When do you reach for a BFF endpoint versus letting the frontend call each service directly?"* — Tests whether the candidate reasons from actual constraints (client network conditions, number of consumers, partial-failure requirements) rather than treating a BFF as a default "best practice" — here, the deciding factor was that concurrent client-side fetches already achieve the latency the BFF would provide, and only one consumer exists.
2. *"If Athena later shipped a mobile app that also needed this dashboard's data, would that change the decision?"* — Should identify that a second consumer needing the identical five-source combination is exactly the signal that tips the trade-off toward building the aggregation endpoint — the "no BFF" call in this doc is scoped to *current* scale (one web consumer), not a permanent architectural stance.
