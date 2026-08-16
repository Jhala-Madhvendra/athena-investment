# Earnings Quality

## 1. Definition

Whether reported profit is backed by durable, cash-generative business performance rather than accounting choices, one-time items, or timing effects — evaluated in Athena through three specific relationships, deliberately **not** collapsed into a single "quality score."

## 2. Formula

There is no formula for "earnings quality" itself — it's a set of comparisons:

```
Net income growth %   vs.   Free cash flow growth %
Revenue growth %      vs.   Net income growth %
Total debt growth %   vs.   Free cash flow growth %
```

## 3. Intuition

Net income includes non-cash items (depreciation, accruals, one-time gains/charges) that free cash flow doesn't. When the two diverge — net income up, FCF down, or vice versa — that's worth surfacing, because it means the P&L and the cash reality are telling different stories this period, even though neither number is "wrong."

## 4. Why investors care

A company can report growing net income while its ability to actually generate cash deteriorates (rising receivables, aggressive revenue recognition, working-capital drag) — earnings quality observations are the mechanism for catching that divergence before it shows up as a cash crunch.

## 5. Which financial statements are used

Income Statement (net income, revenue) and Cash Flow Statement (free cash flow) together — this is inherently a cross-statement comparison; no single statement can answer it alone.

## 6. How Athena calculates it

`backend/earnings/earnings.calculator.js`'s `computeQualityObservations` generates up to three plain-English observations from fixed templates — `observeNetIncomeVsFcf`, `observeRevenueVsProfitGrowth`, `observeDebtVsCashFlow` — each driven entirely by the sign/magnitude of already-computed variance metrics. No LLM is involved anywhere in this module; every sentence is deterministic and reproducible from the same two input statements.

## 7. Limitations

- These are observations of *divergence*, not diagnoses of *cause* — Athena has no way to know whether a net-income/FCF gap comes from legitimate working-capital timing or something worth deeper scrutiny. The text says "moved in different directions," never "this suggests earnings manipulation."
- Two-period comparisons can't see whether a divergence is a one-off or a recurring pattern; that requires the multi-year view Sprint 3's Business Analysis already provides.

## 8. Common interpretation mistakes

- Treating any net-income/FCF divergence as a red flag — it's common and often benign (e.g. a large one-time capex quarter, a real receivables build ahead of genuinely stronger future collections). The brief is explicit: present it as an observation, never an accusation.
- Assuming a single composite "quality score" would be more useful than the underlying relationships — a blended score hides *which* relationship is driving it and invites false precision the underlying data doesn't support (see the brief's own instruction: "do NOT reduce it to an arbitrary score initially").

## 9. Interview question

*"Why doesn't Athena just compute a single 'Earnings Quality Score' out of 100?"* — Because a composite score would need weights that aren't derived from anything — there's no established, defensible formula for "how much does an FCF/NI divergence matter relative to a debt/cash-flow mismatch." Presenting the three underlying relationships as separate, plainly-worded observations is more honest and more useful than a number that looks precise but rests on an arbitrary weighting scheme.
