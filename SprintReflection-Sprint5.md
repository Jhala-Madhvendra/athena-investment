# Sprint 5 Reflection — Company Intelligence Dashboard

*Note on file naming: this sprint's instructions asked to update `SprintReflection.md`, but that file already holds Sprint 3's reflection (an inherited naming quirk — Sprint 1 never got its own file, and the unsuffixed name landed on Sprint 3 instead). Overwriting it would destroy real documentation, so this sprint's reflection follows the `SprintReflection-SprintN.md` convention Sprint 2 and Sprint 4 already established.*

## 1. What was built

A Company Intelligence Dashboard ("Overview") that consolidates Company, Financials, Ratio, Business Analysis, and Market Intelligence data — all from Sprints 1–4 — into a single landing page, now the default destination after every company search. It's built from five new small, reusable components (`CompanyHeader`, `HealthScoreCard`, `TrendIndicator`, `InsightCard`, `BusinessPerformanceRow`, plus `SectionHeader`), fetches five existing endpoints independently and concurrently (no new backend aggregation endpoint — see the trade-offs section), and reuses two existing components wholesale (`PerformanceCards`, `StatCard`) rather than rebuilding equivalents. The navigation was restructured from six flat tabs into five (Overview, Financial Statements, Financial Analysis, Market Intelligence, Valuation), with Income Statement/Balance Sheet/Cash Flow regrouped under one "Financial Statements" tab with sub-tabs — mirroring the sub-tab pattern `BusinessAnalysis.jsx` already established in Sprint 3 rather than inventing a new one. Zero backend code changed this sprint; it's entirely a frontend/IA/UX effort, matching the sprint's own framing. 19 new Vitest + React Testing Library tests cover loading, success, missing-data, and partial-failure states.

## 2. Finance concepts reinforced

Nothing fundamentally new was calculated this sprint — the point was interpreting and juxtaposing metrics Sprints 2–4 already compute, which surfaced a real nuance: the trend engine's year-over-year *direction* and the insight engine's CAGR-based *categorization* are two independently-computed characterizations of the same underlying data, and they can legitimately disagree (Apple's Free Cash Flow shows direction "Stable" while its matched insight text says "weak at -4% annually" — both are correct outputs of Sprint 3's engine, just answering slightly different questions: "is the trend consistent" versus "is the magnitude good"). Displaying both faithfully, rather than silently reconciling them into one story, was the right call — reconciling them would mean inventing new interpretive logic on the frontend, which is exactly the kind of duplicated calculation authority this sprint was told to avoid.

## 3. Product decisions made

The 5-tab restructure over the safer "just add two tabs" option — argued for in-conversation before building, on the grounds that an 8-tab bar directly undercuts a sprint whose stated goal is "don't overload the page." Business Analysis was deliberately dropped from the primary nav (the sprint's own nav example omitted it too) but kept fully reachable as a "View full breakdown" drill-down from the Financial Health card, rather than removed — Overview absorbs its summary role without deleting the detail view underneath it. "Current Price" was deliberately omitted from the Market Performance section even though the spec lists it there, since it's already shown in the header directly above; repeating it would be the raw-data padding the sprint explicitly warns against. See [[CompanyIntelligenceDashboard]] for the full reasoning on both above-the-fold selection and information left out.

## 4. Engineering decisions made

No aggregation endpoint, despite Overview needing five endpoints (more than any existing page) — the full trade-off is written up in [[DashboardAggregation]]; the short version is that concurrent client-side fetches already achieve the latency a BFF would provide at this app's current scale (one web consumer), and independent per-section loading is a genuine UX win a single aggregated response would undo. Five independent `{data, loading, error}` slots via a small `useFetchSlot()` helper, not one combined `Promise.allSettled` — see [[FrontendDataFetching]] for why loading-isolation and failure-isolation are different problems that both needed solving. `BusinessAnalysis.jsx` was deliberately left untouched rather than refactored to share the new `HealthScoreCard`/`InsightCard` components with Overview — a real DRY opportunity declined in favor of not touching a working Sprint 3 file for a refactor this sprint didn't require.

## 5. Trade-offs made

- **~30 lines of intentional duplication** (health-score card markup, insight-card markup) between `BusinessAnalysis.jsx` and Overview's new components, chosen over refactoring a working existing file.
- **No chart on Overview**, even though `PriceHistoryChart` already exists and could be dropped in with little effort — a chart demands more attention than the numeric summary it would duplicate, on a page whose entire value is speed of comprehension; it stays one click away on Market Intelligence.
- **Client-side threshold-based "market observations"** (near 52-week high/low, large 1-year move) appended to Key Insights, since no dedicated market-insight engine exists yet to genuinely aggregate from a "Market Intelligence Engine" source the way the sprint asks. These are deliberately confidence-less and purely descriptive — never "overvalued/cheap" language — a narrow, explicit exception to "don't compute in the frontend," made because the alternative was silently *not* fulfilling one of the sprint's explicit requirements.
- **Old bookmarked statement URLs** (`/income-statement`, `/balance-sheet`, `/cash-flow`) now redirect rather than resolve directly, since they're nested one level deeper (`/financial-statements/:subtab`) — a one-time URL-shape cost in exchange for the cleaner 5-tab nav.

## 6. What was intentionally NOT built

DCF or any valuation logic (explicitly out of scope — Valuation tab is a placeholder). A dashboard aggregation endpoint (see above). A refactor of `BusinessAnalysis.jsx` to share components with Overview. Any new chart. A dedicated backend market-insight engine (the client-side observations are a stopgap, not a replacement for one). Fixing the pre-existing `Company.marketCap` casting bug discovered while testing the shell-gating fix against an ETF ticker — real, but out of this sprint's scope, and flagged separately rather than folded in.

## 7. User assumptions being made

That a single 0–100 health score is legible and trustworthy enough on first glance that users won't need to read its explanation sentence before forming an opinion — untested. That drill-down links get used at all, rather than users only ever navigating via the top tab bar (if true, the "View full breakdown" and "View details" action links are dead weight). That five seconds is roughly the right budget for Overview to become fully useful, even though the live market quote (the slowest of five calls, due to Yahoo's auth handshake) sometimes takes longer than that. That regrouping the statement tabs under one "Financial Statements" parent doesn't confuse users who'd built muscle memory around three separate top-level tabs, even with redirects preserving old links.

## 8. What we'd validate with real users

Whether users can answer "would I investigate this company further" within roughly five seconds of Overview finishing load, without scrolling. Whether the health score gauge gets read and trusted on its own, or gets skipped in favor of hunting for familiar numbers (P/E, market cap) further down the page. Real click-through rates on the drill-down links, to settle the open question of whether `BusinessAnalysis.jsx` is still earning its place as a separate tab (see [[CompanyIntelligenceDashboard]], PM question 2). Whether the "Valuation (Coming Soon)" tab reads as an honest placeholder or gets clicked repeatedly as if something is broken.

## 9. Product Management interview questions

*(Five more, focused on this sprint's engineering/product interplay — see [[CompanyIntelligenceDashboard]] for five additional PM questions focused purely on the dashboard's design reasoning.)*

**Q1: You chose not to build a dashboard aggregation endpoint even though this page needs more data sources than any other. What would change your mind?**
A: A second consumer needing the identical combination — a mobile app, a public API, or a second web page reusing this exact five-source shape. Right now there's exactly one consumer (Overview), and concurrent client-side fetches already deliver the latency a BFF would provide; building one now would be optimizing for a scale that doesn't exist yet.

**Q2: How do you decide when "don't duplicate calculation logic" should bend, as it did for the market observations?**
A: When the alternative is silently failing to deliver something explicitly required. The sprint asked Key Insights to aggregate from three engines, but only two exist. The options were: fabricate a third source of insight text on the frontend, quietly drop the requirement, or add a narrow, clearly-flagged exception — simple threshold comparisons on data already fetched, never framed as a recommendation. I chose the third and documented it as an explicit, bounded exception rather than a precedent.

**Q3: What's the biggest risk you're carrying into production with this dashboard, that you can't fully validate pre-launch?**
A: That the health score, shown as a single number with no context, gets misread as more authoritative or complete than it is — five components compressed into one number necessarily loses nuance, and Overview shows that number before showing any of the nuance beneath it. It's the exact tension progressive disclosure is meant to manage, but it can't be fully resolved without watching real users react to the number first.

**Q4: How would you explain the decision to restructure existing URLs mid-sprint, to a stakeholder worried about breaking bookmarks?**
A: Every old URL still works — it redirects to the new location rather than 404ing. The cost is one extra hop for anyone with an old bookmark, paid once; the benefit is a nav bar that actually matches the product principle we're shipping (five clear destinations instead of eight cluttered ones) for every visit after that.

**Q5: If you had one more week on this sprint, what would you build?**
A: Real usage data, not another feature — specifically instrumenting drill-down click-through so the open question about `BusinessAnalysis.jsx`'s future (question 2 above) has an actual answer instead of a guess. Shipping more UI without knowing whether the UI already shipped is being used would be solving the wrong problem.

## 10. Finance interview questions

**Q1: Why does the "Profit" row on Business Performance show a trend direction but no supporting insight text, while "Revenue" and "Operating Margin" both have one?**
A: The insight engine's seven categories don't include one specifically for net-income growth — only revenue growth and margin trends are covered as distinct categories. Rather than reuse a mismatched insight (e.g., borrowing the margin insight for a growth row) or write new categorization logic on the frontend, the row honestly shows trend-only. It's a real gap in the underlying engine, surfaced by trying to show all five rows consistently, not something Sprint 5 should paper over.

**Q2: A company's Free Cash Flow row shows "Stable" as its direction, but its insight text says growth is "weak at -4% annually." Is that a bug?**
A: No — it's two different, both-correct measurements. Direction comes from year-over-year consistency (does the metric move the same way most years); the insight's characterization comes from the overall CAGR from the first to the last year in the window. A metric can be *consistent* (stable trend, low year-to-year volatility) while still being *weak* (a small negative multi-year growth rate) — those aren't contradictory, they're answering different questions about the same series.

**Q3: Why does the dashboard show Return on Equity without also showing Debt-to-Equity right next to it in the same visual weight?**
A: It does — both appear in the same Financial Health stat-card row, deliberately side by side, precisely because ROE without leverage context is misleading (a company can inflate ROE through debt rather than operating excellence, the exact trap [[ROE]] documents). Neither metric is elevated above the other on this dashboard; they're presented as a pair on purpose.

**Q4: The Market Performance section shows five return periods (1M through 5Y) but no benchmark comparison (e.g., against an index). Why not?**
A: Because Athena doesn't fetch or store any index/benchmark data — adding a comparison would mean either fabricating a number or building a new data source, neither of which this sprint's scope covers. The five returns are shown as facts about this stock alone; the sprint is explicit that context and interpretation (like "is 36% good relative to the market") aren't Athena's job yet.

**Q5: Why does the header's daily price change get calculated in the frontend instead of pulled from an API, when everything else on the dashboard is API-sourced?**
A: It's the one deliberate, documented exception — see [[DailyPriceChange]]. It's arithmetic on two numbers (`current`, `previousClose`) the market API already returns together; there's no financial formula being reimplemented, just display-layer subtraction. The distinction that matters is between *duplicating a calculation the backend owns* (which Sprint 5 avoids everywhere else) and *trivial presentation math on already-fetched values* (which every dashboard in this app already does in some form, e.g. formatting a number as "4572.8B").
