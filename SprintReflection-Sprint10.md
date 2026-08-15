# Sprint 10 Reflection — News & Event Intelligence Engine

*Continuing the `SprintReflection-SprintN.md` convention Sprints 2, 4, 5, 6, 7, 8, and 9 use — see Sprint 6's reflection for the note on why the unsuffixed `SprintReflection.md` holds Sprint 3's reflection instead.*

## 1. What was built

A News & Event Intelligence Engine that answers a question Sprints 1–9 couldn't: "what has recently happened around this company that I should know about?" A deterministic pipeline (`backend/news/`) retrieves raw articles from a provider (Yahoo Finance's unofficial search endpoint by default, no API key; an optional Marketaux integration for richer data behind `NEWS_PROVIDER=marketaux`; a clearly-marked mock provider for development/tests), normalizes provider-specific shapes into one internal schema, deduplicates syndicated/repeat stories via a three-tier strategy (provider ID → canonical URL → same-day title similarity), classifies each article into one of ten fixed categories by keyword rule (falling back to "Other" on low confidence rather than guessing), and persists the result in MongoDB with a TTL-based retention policy. It's exposed via `GET /api/news/:ticker` (with `limit`/`category`/`from`/`to` filters), `GET /api/news/:ticker/categories`, and `POST /api/news/:ticker/refresh`, rendered in a new "News & Events" tab with category filter chips and clear published-vs-retrieved timestamps. The Watchlist gained a "Latest Event" column (a DB-only read, never triggering a live fetch). The Sprint 8 AI Context Builder gained a `recentEvents` section (also DB-only) and the AI Research Analyst gained an optional "Recent Developments" report section that separates stated fact from labeled interpretation and cites its source article URLs through the same evidence-allow-list mechanism Sprint 8 built for numeric citations.

## 2. Finance concepts learned

News is a leading indicator where financial statements are lagging — the four new finance docs (`NewsInEquityResearch.md`, `EarningsEvents.md`, `CorporateActions.md`, `QualitativeVsQuantitativeAnalysis.md`) work through *why* that gap matters and how analysts actually bridge it: never by plugging a headline directly into a model, but by translating an event into a revised assumption (growth rate, margin, discount rate, a one-time cash flow) and re-running the existing quantitative tools. The deepest lesson was in category design — corporate actions (M&A, buybacks, leadership changes) look superficially similar ("management made a deliberate decision") but have almost nothing in common analytically, which is why Athena classifies them into three separate categories rather than one, and why a single sentiment score can't meaningfully represent an event that's simultaneously positive for one metric and negative for another.

## 3. Engineering concepts learned

The provider-abstraction pattern Sprints 1 and 8 established (abstract base class + registry switching on one env var) generalized cleanly to a third domain with zero new design work — `newsProvider.registry.js` is structurally identical to `financialDataProvider.registry.js` and `llmProvider.registry.js`. The harder problem was deduplication: getting a three-tier strategy (ID → URL → title-similarity) right meant being explicit about what "the same story" means at each level of certainty, and resisting the urge to reach for semantic/embedding similarity when token-overlap on short, formulaic headlines does the job. Caching news turned out to need a genuinely different shape than Sprint 4's short-TTL in-memory quote cache — news needs to survive restarts, be queryable historically, and support deduplication, so it's Mongo-persisted with a TTL index for retention, gated by a freshness check that mirrors `market.service.js`'s `isCoverageSufficient` pattern rather than inventing a new one.

## 4. AI concepts learned

Feeding an LLM a genuinely external data source (as opposed to Athena's own already-computed metrics) for the first time forced a sharper articulation of a rule that was implicit before: the LLM must never be the retrieval layer for anything it reasons about. `recentEvents` is built entirely from Athena's own database (`newsService.getRecentArticlesForContext`), never a live provider call, so the AI is always reasoning over exactly what a user could independently verify in the News tab — never a parallel, unverifiable view of the world. Extending the Sprint 8 evidence-allow-list mechanism to cover article URLs (not just dot-path context fields) reused one validated code path for both citation types instead of building a second one, and the FACT-vs-INTERPRETATION prompt instruction for "Recent Developments" is the same non-negotiable pattern already governing every other report section, not a new rule to remember.

## 5. Product decisions

News got its own tab, API namespace, and domain module rather than being folded into Market Intelligence or Company Overview — the same "don't blend distinct concepts" principle that kept Watchlist and Portfolio apart in Sprint 9. Category filtering was chosen over a single feed specifically because "show me only Regulation/Legal news" is a well-formed request in a way "show me only Positive news" isn't (see `QualitativeVsQuantitativeAnalysis.md`). The Watchlist integration was deliberately minimal — a one-line "Latest Event" preview, DB-only, never a fresh fetch — to keep that page's existing cheap-and-fast contract intact rather than making every watchlist load depend on news freshness.

## 6. Provider selection decisions

Yahoo Finance's unofficial `v1/finance/search?newsCount=` endpoint was chosen as the zero-setup default specifically because it required no new credential and reused an endpoint Athena's `searchTickerByName` already depended on — same reliability tier, no new trust decision. Marketaux was added as a second, opt-in real provider (behind `NEWS_PROVIDER=marketaux` + `MARKETAUX_API_KEY`) for its richer article descriptions, following the exact precedent Sprint 4 set with Twelve Data as an alternate financial data provider. Twelve Data itself was evaluated and rejected for news specifically — its news endpoint sits behind a paid tier not available on the free tier already configured in this project — a concrete example of "do not assume a provider is available" from the sprint brief being checked, not assumed.

## 7. Data freshness decisions

`publishedAt` and `retrievedAt` are tracked as two genuinely different facts and never conflated — the frontend always shows both ("Published 2h ago" for the article, "Athena last checked news 40m ago" for the pipeline) rather than collapsing them into one ambiguous timestamp. The AI context reuses each event's own `publishedAt` rather than inventing a separate freshness field, so staleness is visible per-event exactly where it matters for interpretation.

## 8. Deduplication decisions

Three tiers, cheapest and most certain first (provider ID, then canonical URL, then same-day title-token-overlap ≥ 0.85), explicitly stopping short of semantic/embedding similarity per the sprint's own instruction not to over-engineer this. A duplicate hit merges into the existing document's `tickers` array rather than being rejected outright or stored as a second row — a deliberate departure from the sprint brief's literal single-`ticker`-per-document example, made because storing the same syndicated story once per ticker it's relevant to would multiply storage and undercount true article counts in category summaries. See `NewsDeduplication.md` for the full trade-off analysis.

## 9. Caching decisions

News is persisted (not recomputed per request, unlike DCF/Comps) because it's genuinely reusable across users and because persistence is a prerequisite for deduplication to exist at all. `GET` refreshes from the provider only when nothing is cached or the cache has passed a 4-hour TTL — never on every render — while `POST /refresh` is the explicit, rate-limited escape hatch for a user who wants the absolute latest. Retention (90 days by default) uses a plain Mongo TTL index rather than a custom archival job, deliberately the simplest mechanism that satisfies "don't keep articles indefinitely."

## 10. Why simplistic sentiment was avoided

A single Positive/Negative/Neutral label discards exactly the information that makes news analytically useful — the same event can be simultaneously positive for one dimension (revenue growth) and negative for another (near-term margins), and a forced single score either misrepresents that nuance or defaults to an unhelpful "neutral." Event classification (what kind of thing happened) survives that test in a way sentiment scoring doesn't, and it's what analysts actually reason with (`QualitativeVsQuantitativeAnalysis.md`, `NewsAndEventIntelligence.md` Q5).

## 11. Why notifications were deferred

Because push/email notifications are a promise about timeliness and relevance that a TTL-cached, keyword-classified, single-provider-by-default pipeline hasn't earned yet — shipping them now risks alerting users to routine, non-material news and teaching them to ignore Athena's notifications from day one. Getting retrieval, deduplication, and classification right first (and validating the same compare-on-read pattern Sprint 9's Watchlist already established) is the correct sequencing before adding a channel that's hard to rebuild trust in once it's been noisy.

## 12. Trade-offs

- **Single active provider, not multi-source fan-in** — simpler, consistent with every other provider registry in the codebase, at the cost of no automatic failover if the active provider is down (mitigated by serving cached data, not by redundancy).
- **Storage-layer `tickers: []` array vs. the sprint brief's literal per-ticker document shape** — better dedup and storage efficiency, at the cost of a documented departure from the literal example schema.
- **4-hour cache TTL** — bounds provider call volume and cost, at the cost of occasionally serving up-to-4-hour-stale news (made visible via the "last checked" timestamp, not hidden).
- **Title-similarity dedup threshold (0.85) is heuristic, not learned** — cheap and effective for short financial headlines, with a small, accepted risk of merging two genuinely distinct but unusually similarly-worded stories.

## 13. Limitations

- Yahoo's news feed doesn't include article descriptions — a real, visible gap only Marketaux (opt-in, needs a key) closes.
- Classification is keyword-based, not contextual — a headline using unconventional phrasing for a real category can land in "Other," and confidence is a coarse high/low, not a probability.
- News for a ticker only exists in the AI context (and the Watchlist preview) once *someone* has triggered a fetch for it — the AI never fetches news itself, so a never-visited ticker's AI report will show "no recent news retrieved" even if real news exists.
- No notification/alerting layer yet (Section 11) — the feature is pull-based only.

## 14. Future improvements

- A confidence-weighted or multi-label classifier (still deterministic, still not AI-scored) for articles that plausibly span two categories instead of forcing a single winner.
- Background/scheduled refresh for watchlisted tickers specifically, so the "Latest Event" column stays fresher without a user having to visit the full News tab first — a natural, bounded first step toward Section 11's deferred notification layer.
- Multi-provider fan-in with cross-provider deduplication, now that the three-tier dedup strategy already generalizes past a single provider's syndication.

## 15. Product Management interview questions

**Q1: Why does News get its own tab and API namespace instead of living inside Market Intelligence or Company Overview?**
A: It answers a genuinely different question — "what happened" (a discrete event stream) versus "how is this priced/performing" (continuous metrics) — and blending them would repeat the exact category error Sprint 9 avoided by keeping Watchlist and Portfolio separate. A dedicated surface also makes category filtering and refresh controls make sense in a way a bolted-on news widget wouldn't.

**Q2: Why classify news into categories instead of scoring sentiment?**
A: Sentiment collapses genuinely multidimensional information onto one axis that often has no real single answer — the same headline can be good for growth and bad for margins. Categories give users an unambiguous, actionable filter ("show me only Regulation/Legal") that a sentiment label can't (`QualitativeVsQuantitativeAnalysis.md`).

**Q3: Why is Sprint 10 explicitly not shipping push notifications, and what would change that decision?**
A: Because the current pipeline (TTL-cached, keyword-classified) hasn't earned the trust a notification implies — noisy or low-materiality alerts on day one would train users to ignore them. It would change once real usage data validates that classification is accurate enough and that users actually want proactive alerts rather than the current pull-based check-in pattern.

**Q4: A stakeholder asks why Athena doesn't use a paid, more reliable news API by default. How do you respond?**
A: Because the sprint's own constraint is "do not assume a provider is available" — Athena ships a zero-setup default (Yahoo, no key) so every developer/user can use the feature immediately, with an explicit, documented upgrade path (Marketaux) for anyone who wants richer data and is willing to sign up for a key. Defaulting to a paid provider would put a real cost and setup barrier between a new user and the feature working at all.

**Q5: How would you decide what belongs in the Watchlist's "Latest Event" column versus the full News tab?**
A: The same "quick-scan test" Sprint 9 already applies to every other watchlist column — a title, category, and relative time is scannable in a couple of seconds; anything requiring more context (a description, multiple articles, filtering) belongs one click away on the full tab, not competing for space in a list meant to stay glanceable.

**Q6: Why does the AI Research Analyst's "Recent Developments" section separate fact from interpretation instead of just summarizing the news?**
A: Because an unlabeled blend of "what happened" and "what it might mean" is exactly how a reader ends up treating speculation as reported fact — the same discipline Sprint 8 already required for every other report section, applied here where the underlying data (news) is inherently less certain than Athena's own computed metrics.

**Q7: What's the biggest product risk in News & Event Intelligence as shipped?**
A: That classification accuracy isn't good enough to be trusted — a keyword-based classifier has real, known failure modes (ambiguous headlines defaulting to "Other," unconventional phrasing missed entirely), and if users notice miscategorized news often enough, they'll stop trusting the filters, undermining the feature's core value proposition.

**Q8: How would you measure whether this feature is succeeding?**
A: News tab visits per company session, category filter usage rate, and click-through rate from a headline to its original source (the direct test of whether source traceability is actually being exercised, not just present) — see `NewsAndEventIntelligence.md` Section 10.

**Q9: A user asks why Athena's AI won't just tell them whether a piece of news is good or bad for the stock. How do you respond?**
A: The same boundary Athena holds everywhere else in the AI layer — it interprets what Athena's own data shows, but it never tells a user what to do with that information. A "good or bad for the stock" verdict is a step toward investment advice, which the product deliberately never gives; the AI instead states what happened and, separately, what it might relate to in Athena's existing metrics, leaving the judgment to the reader.

**Q10: What would you build next for this feature area given more time?**
A: A background refresh job for watchlisted tickers specifically — it's the smallest possible step toward the notification layer this sprint deliberately deferred, and it would let real usage data (does "Latest Event" freshness actually matter to users) validate whether building the full notification system is worth it before committing to it.

## 16. Engineering / AI interview questions

**Q1: Walk through what happens when `GET /api/news/AAPL` is called for a ticker with no news stored yet.**
A: `news.controller.js` resolves the ticker via the shared `resolveTickerParam`, then `news.service.js`'s `getNews` calls `getFreshestRetrievedAt`, which returns `null` (nothing stored) — `isStale(null)` is always `true`, so `refreshFromProvider` runs: fetch raw articles from the active provider, normalize (`news.normalizer.js`), classify (`news.classifier.js`), then `persistArticles` deduplicates against the (empty) existing set and inserts new documents. The function then queries `NewsArticle` for the final response, now populated. If the provider call itself fails, the error is caught and logged, and the (still empty) query still runs — the endpoint returns an empty article list with a 200, not an error.

**Q2: Why does the three-tier deduplication check provider ID before URL, and URL before title similarity?**
A: Reliability decreases down the list — a provider-supplied article ID is a guaranteed-unique key when present, canonical URL matching is nearly as reliable and always available, and title similarity is a heuristic that should only run when the cheaper, more certain checks find nothing, both for correctness (fewer false positives) and for cost (it's the only tier that does real computation instead of an equality check).

**Q3: How does Athena guarantee an AI-generated "Recent Developments" claim can't cite a news article the model was never actually given?**
A: `ai.contextBuilder.js`'s `buildEvidenceAllowList` explicitly pushes each `recentEvents` article's `url` into the same allow-list array used for numeric context field paths. `ai.validator.js`'s `sanitizeSectionEvidence` — unchanged from Sprint 8 — filters every citation in `sectionEvidence.recentDevelopments` against that allow-list; any URL not present is silently dropped before the response ever reaches the client, whether it's a hallucination or just a URL from outside the given event set.

**Q4: Why is `recentEvents` in the AI context sourced from Athena's own database instead of calling the news provider live during report generation?**
A: To guarantee the AI reasons over exactly what a user can independently verify in the News tab, to avoid making AI report generation depend on a second external API's uptime/latency on top of the LLM provider's own, and to keep the deterministic news pipeline and the AI research pipeline architecturally independent, per the sprint's explicit requirement that the news pipeline "must exist independently" of the AI layer.

**Q5: A duplicate-key error occurs on `NewsArticle.create` because two concurrent refreshes raced on `canonicalUrl`'s unique index. What happens?**
A: `persistArticles` catches the error, checks `error.code === 11000` (Mongo's duplicate-key code), and instead of failing the whole batch, runs `NewsArticle.updateOne({canonicalUrl}, {$addToSet: {tickers: ticker}})` — treating the race as a merge, exactly like a dedup hit found before the insert was even attempted. Any other error code is re-thrown, since only this specific, expected race condition has a defined recovery path.

## 17. Finance interview questions

**Q1: Why is news considered a leading indicator relative to financial statements?**
A: Statements report what already happened, audited and finalized on a quarterly/annual cadence; news reports events as they occur, often weeks or months before their financial consequences are formally booked in a filing (`NewsInEquityResearch.md`).

**Q2: How should a news event be incorporated into a DCF model?**
A: Never directly — translate it into a revised assumption (growth rate, margin, discount rate, or a one-time cash flow adjustment) and re-run the model with that assumption changed. Athena's AI Research Analyst follows the same rule: it can relate a news event to an existing metric already in its context, but it never recalculates or overrides a number because of a headline (`NewsInEquityResearch.md`, `AIContextWithExternalSources.md`).

**Q3: Why can a stock fall on a reported earnings beat?**
A: The market prices expectations, not just results — disappointing forward guidance, a beat driven by unsustainable one-time items, or a "whisper number" above the reported beat can all produce a negative reaction even when the headline number technically exceeded consensus (`EarningsEvents.md`).

**Q4: Why does a share buyback raise EPS even without any change in net income?**
A: EPS = net income ÷ shares outstanding; a buyback reduces the denominator while the numerator is unchanged, so EPS rises mechanically — a distinction that matters when reading "EPS grew" headlines without checking whether it came from real earnings growth or a shrinking share count (`CorporateActions.md`).

**Q5: Why does Athena classify Acquisition/Merger, Capital Allocation, and Leadership as three separate news categories instead of one "Corporate Actions" bucket?**
A: They carry almost no analytical overlap despite all being deliberate management decisions — an investor filtering for recent buybacks has no interest in wading through leadership or M&A headlines to find them, so collapsing the categories would defeat the purpose of filtering at all (`CorporateActions.md`).

**Q6: What's the difference between qualitative and quantitative analysis, and how does Athena keep them separate?**
A: Quantitative analysis works from measurable, auditable numbers (statements, ratios, DCF); qualitative analysis works from information that resists a single verifiable number (news, management quality, competitive positioning). Athena built these as two independent pipelines across ten sprints — the quantitative engines never read news, and the deterministic news pipeline never influences the Financial Health Score or any valuation output; the two meet only in the AI Research Analyst's prose, where fact and interpretation are still kept explicitly separate (`QualitativeVsQuantitativeAnalysis.md`).

**Q7: Why is a single Positive/Negative/Neutral sentiment label a poor substitute for event classification?**
A: A real news event is often multidimensional — positive for one metric, negative for another (e.g. a product launch good for long-term growth but costly for near-term margins) — and a forced single sentiment label either misrepresents that or collapses into an unhelpful "neutral." Knowing *what kind* of event occurred (Earnings, Leadership, Regulation/Legal, ...) preserves more real signal than a one-axis sentiment score (`QualitativeVsQuantitativeAnalysis.md`).

**Q8: A company announces a regulatory investigation. How does that eventually show up in its financial statements?**
A: Initially, often not at all — it's a qualitative, forward-looking risk with no confirmed dollar amount. If a fine or settlement is later assessed, it becomes a disclosed contingent liability (footnote) and eventually a booked legal expense or cash outflow — the announcement is the leading signal; the financial statement impact, if any, lags it, sometimes by quarters (`NewsInEquityResearch.md`, `CorporateActions.md`).

**Q9: How does an analyst distinguish a durable earnings beat from a low-quality one?**
A: By checking what drove it — a beat from expanding operating margins or genuine revenue growth is read as durable; a beat driven by a one-time tax benefit, an asset sale, or a cost cut that can't be repeated is discounted, since it doesn't change the underlying run-rate of the business the way a real operating improvement does (`EarningsEvents.md`).

**Q10: Why does Athena's news classifier fall back to "Other" instead of guessing when classification confidence is low?**
A: Because a wrong but confident-looking category label is worse than an honest "uncertain" — a user filtering by category trusts that the filter is accurate, and silently mis-classifying an article (e.g. calling a routine product update "Regulation/Legal") would erode that trust more than an honest "Other" bucket that signals "the classifier wasn't sure" (`NewsInEquityResearch.md`, `EarningsEvents.md`).
