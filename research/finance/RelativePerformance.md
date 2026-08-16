# Relative Performance: Strengths & Weaknesses

## 1. Definition

Relative performance classification identifies which of a company's metrics are *materially* above or below its industry reference universe — distinguishing a genuine structural difference from routine noise around the median.

## 2. The formula

```
Percent-unit metrics (growth, margins, ROE, ROA, FCF margin):
  difference ≥ +3 percentage points  → Strength
  difference ≤ −3 percentage points  → Weakness
  otherwise                          → Neutral

Valuation multiples (P/E, EV/EBITDA): never classified — see Section 6.
```

## 3. Why investors care

Not every deviation from the median is meaningful. A company sitting half a point above the industry median operating margin isn't meaningfully different from its peers — treating every non-zero difference as a "strength" or "weakness" would produce a noisy, uninformative list. A materiality threshold separates signal from rounding.

## 4. How analysts use it

Screening tools and comp sheets routinely apply a materiality band before flagging a metric as notable, for the same reason: a 0.5-point margin difference isn't actionable information, a 7-point one usually is. The specific threshold is a judgment call — Athena's 3-percentage-point default is a conservative, documented choice, not a universal constant.

## 5. How Athena calculates it

`industry.benchmark.classifyPosition()` applies the ±3 percentage-point threshold deterministically — no AI or subjective judgment is involved in deciding what counts as a strength or weakness (see `research/engineering/GroundedIndustryExplanation.md` for why this stays deterministic even where AI explanation is layered on top). The classification only fires when the comparison itself is available (sufficient universe sample, valid company value) — an unavailable comparison is never silently treated as "neutral."

## 6. Why valuation multiples are never classified as a strength or weakness

Trading at a premium or discount to the industry median P/E is not inherently good or bad — a premium can reflect either superior growth prospects (a positive read) or an overvalued market price (a negative one), and Athena has no way to distinguish the two deterministically. Per the sprint's explicit "no investment recommendations" principle, `classifyPosition()` is only ever invoked for percent-unit operating metrics; valuation comparisons are always reported as `not_classified`, with only the neutral "Nx the industry median" framing (see `IndustryValuation.md`).

## 7. Common interpretation mistakes

- **Assuming "weakness" means "sell" or "strength" means "buy."** These labels describe a factual gap versus a reference set, not an investment conclusion — Athena's copy deliberately avoids any recommendation language.
- **Ignoring a metric with `classification: "unavailable"`** as if it were neutral. Unavailable means Athena couldn't compute a reliable comparison (insufficient universe sample or missing company data) — a materially different situation from "this metric is genuinely in line with peers."
- **Applying the 3-point threshold to a ratio or multiple metric.** The threshold is calibrated for percentage-point differences specifically; it would be meaningless applied to, say, a debt-to-equity ratio (see `industry.benchmark.js`'s explicit restriction of `classifyPosition()` to `unit: "percent"` comparisons).

## 8. Interview questions

1. *"Why 3 percentage points specifically, and not 1 or 5?"* — A conservative, documented default: small enough to catch genuinely notable gaps, large enough to filter out noise from small-sample medians and normal quarter-to-quarter variation. It's a tunable constant (`industry.benchmark.MATERIALITY_THRESHOLD_PP`), not a value derived from a formal statistical test — the sprint brief explicitly asks that the threshold be documented rather than left implicit, which is why it's a single named export rather than a magic number scattered through the codebase.
2. *"Why doesn't Athena ever call a high P/E a 'weakness'?"* — Because "expensive relative to peers" isn't inherently negative — it can reflect the market pricing in superior growth, and Athena has no deterministic way to tell that apart from genuine overvaluation. Labeling it a weakness would be an implicit investment judgment the sprint brief explicitly forbids.
