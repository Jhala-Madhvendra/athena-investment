# Core User Journeys

Five journeys, each annotated with what exists today vs. what Phase 2+ would need to add. Written against the primary user (serious self-directed investor) from `AthenaProductVision.md`.

---

## Journey 1 — Discover, research, and record a thesis

```
Search a ticker (Sidebar search)
  → Research it (Overview, Financials, Ratios, Business Analysis, Market Intelligence)
  → Evaluate valuation (DCF, Comps)
  → [GAP] Create a thesis, citing the DCF value and Comps range as evidence
  → Add to Watchlist (exists) and/or record a Decision (Phase 2)
```

**Exists today:** everything up to "Evaluate valuation," plus Watchlist-add.
**Gap:** the thesis-creation step. Without it, a user's valuation work evaporates the moment they close the tab — there's no record of *why* $96/share seemed reasonable three months ago when the price has since moved.

---

## Journey 2 — Own a company, monitor it, and check the thesis still holds

```
Own a company (Holding recorded)
  → Monitor it (Alerts: Financial/Market/Business/News rules)
  → Review earnings (Earnings Intelligence: period comparison, quality signals)
  → [GAP] Compare against original thesis
  → [GAP] Decide whether thesis changed, record the update
```

**Exists today:** Holding, Alerts, Earnings Intelligence — a genuinely strong monitoring loop for *what changed*, already.
**Gap:** nothing connects an alert or an earnings surprise back to *why the user originally bought*. A user gets "Operating margin declined from 32.1% to 28.7%" but has no recorded thesis to check that decline against ("was my thesis that margins would expand? then this matters a lot more than if margin expansion was never part of my reasoning").

---

## Journey 3 — Build a portfolio, analyze exposure, stress-test it

```
Build portfolio (Holdings + Transactions)
  → Analyze exposure (Portfolio Analytics: sector/concentration/correlation)
  → Simulate stress (Portfolio Scenario: multi-factor Bear/Base/Bull)
  → Evaluate risk (volatility, Sharpe, drawdown, beta)
  → [PARTIAL] Implement a transaction based on findings
```

**Exists today:** every step except the last is fully built and is one of Athena's strongest journeys. "Implement a transaction" already exists mechanically (the Transaction ledger accepts new BUY/SELL rows) but there's no closed loop back to *why* — a user who decides to trim a concentrated position based on the Exposure card has nowhere to record "I sold because concentration was too high," so three months later that reasoning is gone even though the transaction itself is logged.
**Gap:** connecting a Scenario/Analytics finding to a recorded decision (Phase 2's `InvestmentDecision`, which can reference a `SELL` transaction the same way it references a `BUY`).

---

## Journey 4 — Create a goal, build toward it, monitor progress

```
[GAP] Create an investment goal (target amount, timeframe)
  → [GAP] Define target allocation
  → Build portfolio (exists)
  → [GAP] Monitor progress against goal
```

**Exists today:** only the "build portfolio" step.
**Gap:** everything else. This journey is explicitly classified Phase 6 (see `FutureRoadmap.md`) — it depends on cash-flow tracking (Phase 3) to know what's actually been contributed toward a goal, and on the identity system evolving past an anonymous single-device token (a goal a user can lose by clearing their browser is a bad goal-tracking product). Building this journey now, ahead of those dependencies, would produce a goal feature that can't actually compute honest progress.

---

## Journey 5 — Make a decision, record reasoning, review the outcome later

```
[GAP] Make an investment decision (citing DCF/Comps/Scenario evidence)
  → [GAP] Record reasoning (thesis, bull/bear case, confidence, expected holding period)
  → Track outcome (partially exists: Holdings/Transactions show what happened to price/position)
  → [GAP] Review decision later (compare recorded thesis against actual outcome)
  → [GAP] Learn from outcome (pattern recognition across multiple past decisions)
```

**Exists today:** only the "track outcome" step, and only in the narrow sense of current price/return — not "did my stated reasoning turn out to be right."
**Gap:** this is the fullest expression of the Decide → Learn gap identified in `ProductPillars.md`. It's also the journey with the highest potential differentiation (see `AthenaProductVision.md`'s competitive positioning) — no competitor reviewed there closes this loop end to end.

---

## What these five journeys show in aggregate

Journeys 1–3 are strong today because they stay entirely within Research and Manage. Journeys 4 and 5 are almost entirely gaps because they require Decide (and, for Journey 4, Manage-depth and identity evolution) that doesn't exist yet. This is the same conclusion `ProductPillars.md` reaches from the module-inventory side — arrived at independently here from the user-journey side, which is a useful cross-check that Decide is genuinely the right next investment, not an artifact of how the pillars happened to be defined.
