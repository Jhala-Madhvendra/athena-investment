# Earnings Intelligence — Product Design

## 1. Why users need earnings interpretation rather than raw statements

Sprint 1 already lets a user see every line of a financial statement, and Sprint 3 already lets them see 5-year trends. Neither answers the specific question a user asks right after a company reports: *how did they just do, and what changed?* Answering that from a raw statement table requires manually locating the same line across two years, computing the delta by hand, and knowing which changes are actually meaningful — friction most users won't push through. Earnings Intelligence does that comparison for them and surfaces only what changed.

## 2. Why comparison is more useful than isolated numbers

"$416B in revenue" is a fact with no reference point — is that good? A user has no way to know without already knowing last year's figure and doing the math themselves. "$416B, up 6.4% from $391B" is the same fact with the comparison built in, which is the difference between information and interpretation (the same distinction `research/product/IntelligentAlertsProductDesign.md` §2 makes for alerts — Earnings Intelligence is the same principle applied to a company's own latest results rather than to threshold-triggered events).

## 3. Why the latest earnings period should be emphasized

Recency is what makes a number decision-relevant — a user checking Athena the week a company reports wants to know about *that* report, not be routed through a 5-year chart to find it. The page leads with the latest period's label (`FY2026 for AAPL compared with FY2025`) and its comparison table before anything else, matching how an investor actually reads earnings news: newest first.

## 4. Why YoY and QoQ serve different purposes

YoY removes seasonality and answers "is the underlying business growing." QoQ (not implemented — Athena has annual data only, see `research/finance/QoQvsYoY.md`) would answer "what's the most recent sequential momentum." Presenting both, where both exist, lets a user choose the lens appropriate to their question instead of Athena silently picking one and hiding the other.

## 5. Why the product should avoid information overload

The brief is explicit: "Do not use excessive charts... one or two simple visualizations only if they clearly improve comprehension." Sprint 12 shipped zero charts — a single grouped comparison table, a short quality-observations list, and two stat tiles for market reaction cover every required metric without turning the page into a dashboard the user has to parse rather than read. Every metric shown maps directly to something the brief asked for; nothing was added "because the data existed."

## 6. Why deterministic calculations come before AI explanation

A user needs to trust that "$416B, up 6.4%" is *exactly* right before they'll trust any narrative built on top of it — an AI-generated summary is only as credible as the numbers underneath it. Sprint 12 shipped the full deterministic pipeline first and deferred the optional AI narration layer (see `research/engineering/GroundedEarningsExplanation.md`) rather than risk shipping an unreliable summary over reliable numbers.

## 7. How Earnings Intelligence fits into the overall Athena workflow

It sits between Financial Analysis (the 5-year trend view) and Alerts (the threshold-triggered notification) in the investor's mental model: Financial Analysis answers "how has this business trended over years," Alerts answer "did something just cross a threshold I should know about," and Earnings Intelligence answers "how did the most recent period specifically go, in full context." A user arriving via an Alert about a margin change now has a natural next click — the Earnings tab — to see that change in its full period-comparison context rather than as an isolated number in a notification.

## 8. What user behavior we expect

A user who has just seen a headline ("AAPL beats estimates") or an Alert about a metric change opens the Earnings tab to get the full picture in one place, rather than reconstructing it from three separate pages. Repeat visits are expected to cluster around actual reporting periods (annual results, for now) rather than being a daily-check habit — unlike Watchlist/Portfolio, which are naturally daily-use pages.

## 9. What user research should validate

- Whether "Not available" for a metric (missing EPS, no market reaction) reads as an honest limitation or as a broken page — the wording and placement matter for trust.
- Whether the percentage-point vs. relative-percent distinction for margins is actually understood by non-expert users, or needs a tooltip/explainer.
- Whether users want the quality observations phrased more directly, or whether the deliberately neutral tone ("moved in different directions" rather than a verdict) is the right register.

## 10. What product metrics could measure success

- Earnings page views (and whether they cluster around known reporting periods).
- Earnings comparison table interactions (which metric group gets the most attention — Growth, Profitability, Cash Flow, Balance Sheet, or Per Share).
- Related-news click-through rate from the Earnings tab specifically.
- Research-report generation rate immediately following an Earnings page visit (does seeing the scorecard prompt a deeper AI research request).
- Alert-to-Earnings-page conversion (does receiving a financial Alert lead to a visit to the Earnings tab for full context).

None of these are instrumented in Sprint 12 — analytics infrastructure doesn't exist yet in Athena, and adding it solely to measure a single new feature isn't justified before the feature itself has real usage to measure.
