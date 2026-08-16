# Financial Signal Detection

## What it is

Classifying a metric's period-over-period change into one of three deterministic labels — Improving / Stable / Deteriorating — or, for balance-sheet items the brief says should never carry a good/bad judgment, a neutral ↑ / ↓ / → direction. `backend/earnings/earnings.signals.js`.

## Why we use it

A raw number ("+6.4%") requires the reader to already know what counts as significant for that specific metric. A signal answers "should I care about this" in one glance, but only if the underlying threshold is principled and disclosed — an arbitrary or hidden threshold would just be a more confident-looking guess.

## Alternatives considered

- **A single composite "Earnings Score."** Explicitly rejected by the brief ("Do NOT create an arbitrary 'earnings score' without a clearly defined methodology... Initially prefer metric-level signals over a single composite score") and for the same reason `EarningsQuality.md` rejects a composite quality score: a blended number hides which underlying metric is actually driving it.
- **Fixed thresholds invented specifically for Earnings, independent of the rest of the app.** Rejected wherever an equivalent already existed — see `ServiceReuse.md`. Two different numbers meaning "a margin change is significant" in two different parts of the same app would be a real, silent inconsistency.
- **The same threshold logic (Improving/Deteriorating) applied to balance-sheet items.** Rejected per the brief's explicit instruction that debt/cash should never be automatically framed as good or bad — `directionForBalanceSheetMetric` returns a bare arrow instead.

## Trade-offs

- **Pro:** every threshold is a named constant with an inline comment explaining its provenance (`SIGNAL_THRESHOLDS` in `earnings.signals.js`) — "why 5%, not 3% or 10%" is always answerable from the code itself, not tribal knowledge.
- **Pro:** reusing `alert.rules.js`'s `THRESHOLDS` for margin/FCF/debt signals means an Earnings signal and an Alert Engine trigger for the *same underlying data point* never quietly disagree about what "meaningful" means.
- **Con:** one threshold (`growthPercent: 5%`, for raw revenue/operating-income/net-income growth magnitude) has no existing Athena analog to reuse — `alert.rules.js`'s `revenueGrowthChangePoints` measures a *change in the growth rate itself* (an 18%→10% shift), a different question from "is this period's growth rate itself notable." A new, documented number was unavoidable there.

## Athena implementation

`classifyByMagnitude(value, threshold)` is the single three-way comparison every growth/margin signal is built from; `classifyDirection(value, threshold)` is its balance-sheet-safe sibling. Both return `null` (not a guessed default) when there's nothing to compare — "no signal" is the correct, honest answer for a first-ever-imported ticker with only one statement. See `earnings.signals.js`'s header comment for the full threshold-provenance table.

## Interview questions

1. *"Why does a null percentChange produce a null signal instead of defaulting to 'Stable'?"* — Because "Stable" is a claim about the data (the metric didn't move much), and "no data to compare" is a different fact entirely. Defaulting a missing comparison to "Stable" would misrepresent absence of information as evidence of steadiness.
2. *"Balance-sheet items get ↑/↓/→ instead of Improving/Deteriorating — why not just reuse the same three labels?"* — The brief is explicit that increased debt isn't inherently bad (it could fund accretive growth) and decreased debt isn't inherently good (it could mean underinvestment) — the *direction* is a fact, but "Improving"/"Deteriorating" is a judgment Athena's deterministic engine has no basis to make about a balance-sheet line item in isolation. Growth and margin metrics, by contrast, do have a broadly agreed-upon "more is better" (or "smaller decline is better") direction, which is why they get the judgment label.
