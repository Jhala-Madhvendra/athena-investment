# News in Equity Research

## 1. What it means

News flow is the stream of discrete, dated, sourced events about a company — an earnings release, a leadership change, a lawsuit, a new partnership — as distinct from the *statistics* a company reports on a schedule (revenue, EPS, ratios). Where a financial statement tells you what already happened over a quarter or a year, news tells you what happened *this week*, often before it shows up in any statement at all.

## 2. Why investors care

Financial statements are backward-looking and slow (quarterly, sometimes annual). Markets move on forward-looking information long before the next 10-Q confirms it. An analyst who only reads statements is always working from data that's weeks or months stale; news is how they stay current between filing dates. It's also how they catch *qualitative* risk a ratio can't encode — a regulatory investigation doesn't show up in the balance sheet until a fine is booked, but it's material the day it's announced.

## 3. How analysts use it

Analysts don't treat news as a standalone signal — they use it to update or stress-test a model built from statements. A reported earnings beat gets checked against the analyst's own revenue/margin assumptions; a leadership departure prompts a review of execution risk on a strategy the model assumed would continue; an acquisition announcement means the target's standalone model is about to be irrelevant. News is the trigger for "should I revisit this number," not a number itself.

## 4. How it relates to financial statements

News and statements are complementary, not competing, sources: statements are the *quantitative, audited, periodic* record; news is the *qualitative, unaudited, continuous* record. A single news event often becomes a financial statement line item later — an acquisition announced today becomes goodwill on a future balance sheet; a lawsuit disclosed today becomes a contingent liability footnote and, eventually, a legal settlement expense. Reading news well means anticipating which line items a given event will eventually touch.

## 5. How it can affect valuation

News changes valuation through the assumptions that feed it, not by being plugged into a DCF directly. A product launch can raise a revenue growth assumption; a regulatory fine can lower a margin assumption or add a one-time cash outflow; a leadership change can widen the discount rate an analyst applies to reflect execution uncertainty. The mechanism is always indirect: news → revised assumption → revised model output, never news → valuation directly.

## 6. Limitations

- **Noise-to-signal ratio is low.** Most news about a company is routine (a minor product update, a syndicated wire recap) and doesn't warrant a model revision — treating every headline as material leads to overreacting to noise.
- **Timing risk.** Markets often price news faster than any single investor can act on it, especially for large, liquid names.
- **Source quality varies wildly.** A press release, a rumor, and an investigative report carry very different reliability, and headlines rarely make that distinction obvious.
- **News alone has no magnitude.** "Company sued" tells you nothing about whether the exposure is $1M or $1B — that requires reading past the headline, which no automated pipeline (including Athena's) does.

## 7. How Athena uses it

Athena's News & Event Intelligence Engine (Sprint 10) retrieves, deduplicates, and rule-classifies company news into 10 fixed categories (Earnings, Revenue/Financial Results, Product/Business, Acquisition/Merger, Leadership, Regulation/Legal, Capital Allocation, Partnerships, Market/Stock, Other) — see `backend/news/`. It deliberately stops short of assigning magnitude or sentiment; Athena treats classification as "what kind of event is this," leaving "how much does it matter" as a question for the user or the AI Research Analyst's interpretive layer (see `EarningsEvents.md`, `QualitativeVsQuantitativeAnalysis.md`, and `AIContextWithExternalSources.md`) to reason about *with* the existing deterministic metrics, never in isolation.

## 8. Interview questions

1. *"Why is news considered a 'leading' indicator and financial statements a 'lagging' one?"* — Statements report what already happened, audited and finalized on a quarterly/annual cadence; news reports events as they happen, often weeks or months before their financial consequences are formally booked in a filing.
2. *"How would you incorporate a news event into a DCF model?"* — Never directly — translate it into a revised assumption (growth rate, margin, discount rate, one-time cash flow) and re-run the model with that assumption changed, the same way Athena's context builder feeds recent events to the AI as context for interpretation rather than as a model input itself.
