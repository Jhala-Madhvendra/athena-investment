# Engineering Concept: Independent Frontend Data Fetching

## What it is

The pattern Athena uses whenever a page needs data from more than one endpoint: each data source gets its own `{data, loading, error}` state slot and its own fetch call, fired concurrently, rather than one combined loading flag gating the whole page. Overview.jsx formalizes this into a tiny reusable helper:

```js
const useFetchSlot = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  return { data, setData, loading, setLoading, error, setError };
};
```

Five slots (`company`, `quote`, `performance`, `analysis`, `ratios`) are created, and one `useEffect` fires all five loads without awaiting them sequentially — each manages its own try/catch/finally independently.

## Why we use it

A page composed of independent sections should fail and load like independent sections. If one combined `isLoading` flag covered all five calls, the whole page would show a single skeleton until the *slowest* of five calls resolves — typically the live market quote, which can take several seconds due to Yahoo's auth handshake — even though the company profile, ratios, and analysis data are usually available almost immediately. Combining them would also mean one failing call (say, ratios) either has to fail the entire page or be silently swallowed; neither is right when four other sections have real data to show.

## Alternatives considered

- **One combined `Promise.all([...])`.** Rejected — the first rejection short-circuits the whole batch, so a single failing endpoint would blank the entire page instead of only its own section.
- **One combined `Promise.allSettled([...])` with a single loading flag.** Better than `Promise.all` (survives partial failure), but still gates *loading* on the slowest call — the page wouldn't render anything until all five settle, even the ones that resolved in milliseconds. This was Athena's first draft and was revised specifically to fix this.
- **A data-fetching library (React Query / SWR).** A legitimate choice for an app this data-heavy, but it's a new dependency + new architectural layer the existing codebase (which uses plain `fetch` + `useEffect` everywhere, established since Sprint 1) doesn't otherwise use — introducing it for one page would be inconsistent with the rest of the app.

## Trade-offs

- **Pro:** genuine progressive rendering — each section appears the moment its own data is ready, not when the slowest section is ready.
- **Pro:** failures are isolated — a `ratios` outage degrades exactly the fields that depend on it, nothing else.
- **Con:** more state to hold (5 slots × 3 fields) than a single `{data, loading, error}` triple — mitigated by the `useFetchSlot()` helper collapsing the boilerplate to one line per source.
- **Con:** no request deduplication or caching across navigations (revisiting Overview refetches everything) — acceptable at current scale; a library like React Query would solve this but isn't justified for one page.

## How Athena implements it

Each `load(url, slot, unwrap)` call inside Overview's `useEffect` sets `slot.loading = true`, awaits its own `fetch`, and updates `slot.data`/`slot.error` independently in its own `try/catch/finally` — mirroring the exact pattern already established in `MarketIntelligence.jsx` (Sprint 4), just generalized into a reusable helper since Overview needed it five times over instead of three.

## Interview questions

1. *"Why not just use `Promise.allSettled` and one loading boolean — it already survives partial failures?"* — Tests the distinction between *failure isolation* and *loading isolation*: `allSettled` solves the first but not the second, and a page meant to feel fast needs both, since users perceive "still loading" the same way whether it's due to one slow call or all five.
2. *"What would you change about this pattern if Overview needed to re-fetch its data every 30 seconds for a live-updating dashboard?"* — Should identify that manual `useEffect`-based fetching without caching/deduplication would refire duplicate requests to endpoints that hadn't changed, and that this is exactly the scenario where a library like React Query (with configurable stale time and background refetch) would start to outweigh consistency-with-the-rest-of-the-app as a concern.
