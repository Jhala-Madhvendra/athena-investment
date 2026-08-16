# Rule Engine

## What it is

A deterministic function that maps input data plus a fixed set of thresholds to a set of triggered outcomes — given the same statements/prices/holdings and the same `alert.rules.js` thresholds, `alert.engine.js` always produces exactly the same candidate alerts. No randomness, no model inference, no hidden state.

## Why it is needed

Alerts are only trustworthy if they're explainable and reproducible: a user asking "why did I get this alert" needs an answer that doesn't change depending on when they ask, and a threshold that turns out to be miscalibrated needs to be fixable in one place, not scattered across the codebase. A rule engine gives both — the "why" is always "rule X compared value A to value B against threshold C," and the thresholds live in exactly one file (`alert.rules.js`).

## Alternatives considered

- **An LLM classifying "is this significant"** — rejected outright; see `AIAlertSummarization.md` for the full reasoning. The short version: non-deterministic, unauditable, and the codebase already has a working deterministic pattern for exactly this shape of problem (`insight.engine.js`'s rule evaluators from Sprint 3).
- **Inline threshold checks scattered per call site** — the sprint brief explicitly calls this out as the anti-pattern to avoid, and Sprint 9's `watchlistInsights.service.js` already established the alternative (a single `THRESHOLDS` object) that this sprint extends rather than reinvents.
- **A general-purpose rules engine library (e.g., json-rules-engine)** — rejected for the same reason Athena has avoided every other piece of infrastructure this sprint didn't strictly need: five categories of pure-function threshold checks don't need a rule-authoring DSL, a plugin system, or a dependency the rest of the team would need to learn. Plain JavaScript functions are more legible and more directly testable.

## Trade-offs

- **Pro:** every rule is independently unit-testable with plain objects in, plain objects out — no database, no HTTP, no mocking framework needed beyond what `alert.engine.test.js` already does.
- **Pro:** adding a rule means adding a function and a threshold, not touching persistence, dedup, or severity logic — those are separate concerns (`alert.deduplicator.js`, `alert.severity.js`) the engine composes with, not reimplements.
- **Con:** a purely rule-based engine can't catch a genuinely novel pattern that doesn't fit any authored rule — it will never say "something unusual is happening here" without a human having anticipated that shape of "unusual" in advance. This is an accepted trade-off for signal reliability over recall.

## How Athena implements it

`backend/alerts/alert.engine.js` exports five evaluator functions (`evaluateMarketRules`, `evaluateFinancialRules`, `evaluateBusinessRules`, `evaluateNewsRules`, `evaluatePortfolioRules`), each taking already-fetched data and returning plain candidate objects — no Mongoose imports anywhere in the file, mirroring `dcf.engine.js`'s split between a pure computation core and an I/O-owning service layer (`alert.service.js`). Thresholds live centrally in `alert.rules.js`, each with a one-line documented reason (see the file's own comments) rather than a bare magic number. Severity banding is a separate module (`alert.severity.js`) the engine calls into, so "is this significant" (the rule) and "how significant" (the severity) stay independently reasoned about and independently testable.

## Interview questions

1. *"Why not use an off-the-shelf rules engine library?"* — The problem is small and homogeneous enough (threshold comparisons over numeric deltas) that a library's generality (a rule-authoring DSL, dynamic rule loading, a plugin system) would add indirection without adding real capability — five plain functions are easier to read, test, and debug than the same logic expressed through a framework's abstraction layer.
2. *"How would you add a sixth Market rule, say a 52-week-high/low breakout?"* — Add a threshold to `THRESHOLDS.market` in `alert.rules.js` with a documented reason, add a check inside `evaluateMarketRules` that pushes a candidate object with a new `rule` name, and add a `periodKey` scheme for its deduplication identity — no other file needs to change.
3. *"What guarantees the engine is actually deterministic, not just intended to be?"* — No calls to `Date.now()`/`Math.random()` drive branching logic (only `triggeredAt`/`periodKey` timestamps, which are inputs to identity, not decision logic), no network or database calls inside the engine itself, and the test suite asserts exact outputs given fixed inputs — a non-deterministic engine would make those tests flaky, and they aren't.
