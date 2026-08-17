# Herfindahl-Hirschman Index (HHI)

## 1. Definition

**HHI** is a single-number concentration measure, computed by summing the squared weight of every position in a portfolio. It's borrowed directly from antitrust economics, where it's used to measure market concentration among competing firms - the same math applies unchanged to portfolio positions.

## 2. Formula

```
HHI = Σ wi²
```

Athena computes weights as **percentage points (0-100)**, not decimals (0-1) - the standard convention used in US antitrust practice - so HHI ranges from close to 0 (many small, equal positions) up to 10,000 (a single 100%-weight position).

## 3. Intuition

Squaring each weight before summing means large positions count disproportionately more than small ones: a 50% position contributes 2,500 to the sum, while ten 5% positions together contribute only 250. This is exactly the property that makes HHI more sensitive to concentration than a simple count of holdings - "10 positions" can mean HHI near 1,000 (roughly equal-weighted) or HHI above 8,000 (one dominant position plus nine tiny ones), and only HHI distinguishes them.

## 4. Why investors care

Top-N weight metrics (Top 1/3/5) only look at the largest few positions; HHI accounts for the *entire* distribution in one number, making it a common concentration benchmark that also allows comparison across portfolios with different numbers of holdings.

## 5. Data required

Each holding's current weight as a percentage of total portfolio value.

## 6. How Athena calculates it

`backend/portfolio/portfolio.analytics.exposure.js`'s `calculateConcentration()`:

```js
const hhi = priced.reduce((sum, p) => sum + p.weightPercent ** 2, 0);
```

Computed over ticker-grouped positions (multiple lots of the same stock are netted into one position first), same as Top 1/3/5 - see ConcentrationRisk.md.

## 7. Assumptions

**Percentage-point scale (0-10,000), not decimal scale (0-1).** Both conventions exist in practice; Athena uses the antitrust-standard 0-10,000 scale because it produces round, recognizable numbers (2,500 and above is commonly cited as "highly concentrated" in that literature) rather than small decimals that require an extra mental conversion.

## 8. Limitations

- **Only reflects priced positions**, same as Top 1/3/5 - an unpriced holding contributes no weight and is excluded, understating true concentration if a large-but-unpriceable position exists.
- **No correlation or sector dimension.** HHI treats every position as an independent source of risk, even if several positions are highly correlated or in the same sector - see PortfolioDiversification.md for why Athena reports Exposure and Correlation as separate signals rather than folding them into HHI.
- **Not a verdict.** A high HHI is reported as a fact ("HHI: 4,200"), never as advice.

## 9. Common interpretation mistakes

- **Comparing HHI on the 0-10,000 scale against a threshold meant for the 0-1 scale** (or vice versa) - always check which convention a given source uses.
- **Reading HHI in isolation from the number of holdings.** A portfolio of exactly 2 equally-weighted holdings has an HHI of 5,000 by construction (50² + 50² = 5,000) - not because it's poorly diversified in absolute terms, but because HHI's minimum possible value depends on how many positions exist.

## 10. Interview question

*"A portfolio has 20 holdings and an HHI of 2,000. Is that concentrated?"* — With 20 *equally-weighted* holdings, HHI would be 20 × 5² = 500 - so 2,000 is four times that floor, meaning the actual distribution is meaningfully more concentrated than an equal-weight portfolio of the same size, even though "20 holdings" sounds diversified on its own. This is exactly why HHI is more informative than a raw holdings count: it reveals uneven weighting that a simple count can't.
