# Intelligent Alerts — Product Design

## 1. Why Athena needs alerts

Sprints 1-10 answered "what companies am I tracking" (Watchlist/Portfolio) and "what's happening around those companies" (News). Neither answers the question an active investor actually asks day to day: *what changed that deserves my attention, without me having to go check every dashboard myself.* Without alerts, staying current requires a user to remember to revisit Athena, remember which numbers to compare against what they last saw, and manually notice a change buried in a page of otherwise-unchanged metrics. Alerts move that burden from the user to the system.

## 2. Information vs. actionable information

A dashboard showing "Operating margin: 28.7%" is information — true, but inert until someone notices it's different from what it used to be. "Operating margin declined from 32.1% to 28.7%" is the same fact, framed as a *change*, which is what actually prompts a decision to investigate further. Alerts don't add new facts Athena didn't already have (every number an alert cites already existed on some dashboard) — they add the comparison and the framing that turns a static fact into something worth acting on.

## 3. Why alert noise is dangerous

An alert system that fires on every 1% price move, every article, or every minor ratio wobble doesn't get ignored gracefully — it trains the user to ignore *all* alerts, including the ones that matter. That failure mode is worse than having no alerts at all, because it burns the trust a genuinely important alert needs to be acted on. This is why every rule in `alert.engine.js` has an explicit, documented threshold (`alert.rules.js`) rather than firing on any detectable change, and why News alerts are restricted to a handful of important categories rather than every stored article.

## 4. How thresholds should be selected

Every threshold in this sprint was chosen against one of three anchors, never picked arbitrarily:

- **The sprint brief's own worked examples** — e.g., an 8.4% five-day decline is explicitly called out as alert-worthy, so 8% became the five-day threshold.
- **A documented "typical noise" baseline** — e.g., a large-cap's normal daily volatility is roughly 1-2%, so 5% (a clear multiple of that) is the daily-move threshold, not an arbitrary round number.
- **An existing, already-reasoned-about number elsewhere in the codebase** — e.g., portfolio concentration's 25%/40% bands echo the qualitative framing already present in `research/finance/ConcentrationRisk.md`, rather than inventing a fresh number with no prior basis in this codebase.

None of Sprint 11's thresholds were picked "because it seemed reasonable" without one of those three anchors — see each threshold's inline comment in `alert.rules.js` for the specific reasoning.

## 5. Why deterministic alerts are preferred initially

An alert is a claim: "this specific thing happened, by this specific magnitude." A user needs to be able to trust that claim without having to independently re-verify it every time — and trust requires the claim to be reproducible and explainable. A rule engine gives an unambiguous answer to "why did I get this" (a specific comparison crossed a specific threshold); an LLM-driven detector would not, and would additionally risk fabricating the underlying numbers rather than just their phrasing. See `research/engineering/AIAlertSummarization.md` for the full reasoning, including how AI *could* be layered on top of already-verified alerts later without reintroducing that risk.

## 6. Why notifications are deferred

Email/push/SMS notifications are a distribution mechanism, not a detection mechanism — building them well requires deliverability infrastructure, unsubscribe/preference management, and (for anything beyond a single device) a real identity system Athena doesn't have yet (identity here is an anonymous bearer token, not an email address). Building notification delivery before the underlying detection logic is proven and trustworthy would mean shipping infrastructure for alerts that might still be too noisy or too sparse to be worth pushing to someone's phone. In-app-only for v1 lets the detection logic be validated (and thresholds tuned) against real usage before investing in distribution.

## 7. How alerts can improve retention

An alert is a reason to come back that didn't exist before Sprint 11 — Watchlist and Portfolio are pull experiences (a user has to think to check them); an unread-count badge is a lightweight push signal without needing real push infrastructure. The Company Dashboard's "Recent Alerts" panel and the Watchlist's compact per-ticker indicator both surface the same underlying data at the point a user is already looking at a company, turning a passive dashboard visit into an active "something changed here" prompt.

## 8. How to measure alert usefulness

Metrics worth watching, none of which Sprint 11 instruments (see Section 9 for why):

- **Alert open rate** — of alerts generated, what fraction does a user actually expand/read? A low rate across the board would suggest thresholds are too loose (too much noise) more than it would suggest bad UI.
- **Alert dismissal rate** — dismissed-without-expanding is a stronger noise signal than "read then dismissed"; the two should probably be tracked separately if this is ever instrumented.
- **Alert-to-company-view rate** — how often does an alert lead to a "View Company" click? This is the closest proxy for "did this alert actually prompt investigation," the behavior alerts exist to enable.
- **Unread alert accumulation** — a user with dozens of unread alerts either isn't visiting enough to keep up, or the alerts aren't compelling enough to prompt a visit; distinguishing those two causes would need visit-frequency data alongside the count.
- **Repeat visits after alerts** — does receiving an alert correlate with a return visit within N days, versus a user who received none?
- **Alert false-positive rate** — the hardest to measure without direct user feedback (a dismiss doesn't necessarily mean "this was wrong," it might mean "I've already seen this, elsewhere"), which is part of why this metric would need a more deliberate signal (e.g., a "not useful" action) than what v1 ships.

## 9. What was NOT instrumented, and why

None of the metrics in Section 8 are implemented in Sprint 11 — no analytics events, no dashboards. Building instrumentation for metrics before the underlying feature has real usage to measure would mean guessing at what's worth tracking rather than learning it from actual behavior; the sprint brief itself flags this ("do not implement analytics solely for these metrics unless justified"). The `isRead`/`isDismissed` fields already on every `Alert` document are sufficient raw material to backfill several of these metrics later without a schema change, if and when they're prioritized.

## 10. How users could customize alerts in the future

Not built in Sprint 11, but the architecture doesn't foreclose it: `alert.rules.js`'s centralized threshold object is already the natural extension point — a future per-user threshold override (e.g., "only alert me on moves over 10%, not 5%") would mean reading a user-specific override before falling back to the global default, not restructuring the rule engine. Category-level opt-out (e.g., "don't alert me about News events") would similarly be a filter applied before persistence, reusing the same `type` field `GET /api/alerts` already filters by. Neither was built now because neither has been validated as needed yet — see Section 10 of the sprint's user-research question below.

## What user research should validate

Before investing further in this feature: whether the chosen thresholds actually match what users consider "worth an alert" (the anchors in Section 4 are principled, but untested against real reactions); whether users want the day-level throttling Market/Portfolio alerts use, or would prefer even less frequent digests; and whether "in-app only" is sufficient, or whether the lack of push/email meaningfully suppresses the retention benefit Section 7 describes, because a user who doesn't visit Athena never sees the badge that would have brought them back.
