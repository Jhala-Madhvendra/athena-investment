# News & Event Intelligence Product Design

## 1. Why does Athena need qualitative information?

Sprints 1–9 built a complete quantitative research stack — financial statements, ratios, growth, health score, DCF, comps, portfolio/watchlist tracking — but every one of those answers a version of "how is this company performing, structurally." None of them can answer "what just happened that I should know about," because that question is fundamentally about discrete, dated events, not continuous or periodic metrics. A platform that only ever tells a user what changed in a company's *statements* is always weeks behind what actually moves markets and decisions.

## 2. Why are financial statements alone insufficient for timely analysis?

Statements are audited, comparable, and trustworthy — and quarterly or annual, by design. A regulatory investigation, a CEO resignation, or an acquisition announcement is material the day it happens, not the day it eventually appears as a line item in a future filing. A user relying only on Athena's Sprints 1–9 engines would have no way to know, mid-quarter, that something material had occurred at a company they're researching or watching — the product's timeliness was capped at the filing cadence, regardless of how good the analysis built on top of those filings was.

## 3. Why should News be a separate product capability, not folded into an existing one?

Because it answers a genuinely different question than every prior sprint, and blending it into an existing surface would muddy both. Financial Health, Market Intelligence, and Valuation all answer "how is this company doing, by the numbers" — adding news to any of those pages would mix a fact stream with a metrics dashboard, the same category error the product deliberately avoided when it kept Watchlist and Portfolio separate (see `WatchlistVsPortfolio.md`) rather than merging "interested in" and "own." News gets its own tab, its own API namespace, and its own domain module (`backend/news/`) so a user (or a future engineer) never has to guess which system "recent events" belongs to.

## 4. Why do users need source traceability?

Because news, unlike Athena's own computed metrics, isn't something Athena can vouch for the accuracy of — it's third-party reporting. A user has to be able to click through to the original source to judge its credibility themselves; presenting a headline with no link, or an AI-generated summary with no citation, would ask the user to trust Athena's word for something Athena didn't actually originate. Every article, everywhere it's shown (the News tab, the Watchlist row, an AI report's "Recent Developments" section), carries its original URL, source, and publish date — never optional, never dropped.

## 5. Why is event classification more useful than simplistic sentiment?

A Positive/Negative/Neutral label collapses genuinely multidimensional news into one axis that often doesn't have a real answer — a product launch can be positive for long-term growth and negative for near-term margins in the same headline; a lawsuit settlement can be negative in isolation but positive relative to a worse feared outcome. Forcing a single sentiment score onto that either produces a misleadingly confident answer or a meaningless "neutral" default. Classifying *what kind of event* this is (Earnings, Leadership, Regulation/Legal, etc.) instead gives the user something unambiguous and immediately actionable — "show me only Regulation/Legal news" is a well-formed filter; "show me only Positive news" isn't, because positive-for-what is left unanswered.

## 6. Why are notifications intentionally deferred?

Because a notification is a promise about *timeliness and relevance* that Athena's current news pipeline hasn't earned yet — it's TTL-cached (not real-time), keyword-classified (not judgment-scored for materiality), and single-provider by default. Shipping push/email notifications on top of that would risk alerting users to routine, non-material news as if it mattered, training them to ignore Athena's notifications the same way over-alerting trains people to ignore any notification system. Getting retrieval, classification, and deduplication right first — and proving out the compare-on-read pattern the Watchlist's "Check What's Changed" already established — is the correct sequencing before adding a push channel that, once shipped, is hard to walk back trust in if it's noisy from day one.

## 7. What user problem does this feature solve?

"I researched this company last week — has anything happened since that I should know about before I act?" Today, without this feature, a user has to leave Athena and check a separate news source, losing the context (Athena's own computed metrics, the company's current watchlist status) they were just looking at. News & Event Intelligence keeps that question answerable inside the same product, next to the numbers it might eventually affect.

## 8. What user behavior do we expect?

Not continuous monitoring — periodic, purposeful check-ins, the same usage pattern Sprint 9's Watchlist was designed around (see `WatchlistAndPortfolioProductDesign.md` Q7). A user opens a company's News & Events tab after a gap (a few days, a week), filters to a category they care about, skims recent headlines, and clicks through to the ones that matter — then, for a watchlisted company, glances at the "Latest Event" column on future Watchlist visits as a quick freshness check without opening the full tab every time.

## 9. What user research should validate?

Whether users actually use category filters, or whether an undifferentiated recency-sorted list is sufficient — directly testing whether the ten-category classification (Q5) earns its complexity in practice. Whether the "Latest Event" watchlist column gets clicked through to the full News tab, or is glanced at and ignored — a test of whether a one-line preview is the right level of detail for that surface. Whether users notice or care about the "last checked Xh ago" freshness indicator, or whether the TTL-cached model (see `NewsCaching.md`) needs to be more aggressive to match user expectations of "live" news. And whether users read AI-generated "Recent Developments" prose as a shortcut *instead of* clicking through to sources, undermining the traceability design's actual goal (Q4) — the strongest signal for whether Athena needs to more actively encourage source-checking rather than just enabling it.

## 10. What product metrics could measure success?

- **News tab visits per company session** — the direct usage signal for whether the feature is being used at all relative to the rest of the company dashboard.
- **Category filter usage rate** — whether users engage with classification (Q5's bet) or treat the feed as undifferentiated.
- **Click-through rate from a headline/card to the original source** — the most direct test of whether source traceability (Q4) is actually being exercised, not just present.
- **Refresh button usage vs. passive TTL-driven refreshes** — whether users feel the cached data is stale enough to warrant manually forcing a refresh, informing whether `NEWS_CACHE_TTL_MS` is tuned correctly.
- **"Latest Event" watchlist column click-through rate** — whether the compact preview successfully funnels users to the full tab, the same funnel goal Sprint 9's watchlist rows were designed around.
- **Correlation between AI Research Analyst usage and prior News tab visits for the same ticker** — a signal for whether news is genuinely feeding the "should I regenerate/re-examine this report" decision the way `NewsInEquityResearch.md` describes analysts using it.

None of these are instrumented yet, matching Sprint 9's own precedent — this section names what would be worth measuring once the feature has real usage, not a build-it-now checklist.
