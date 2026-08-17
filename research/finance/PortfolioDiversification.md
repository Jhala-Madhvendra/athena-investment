# Portfolio Diversification

## 1. Definition

**Diversification** is the degree to which a portfolio's risk is spread across distinct, not-fully-related sources, rather than concentrated in a small number of positions that tend to move together. Athena doesn't compute one single "diversification score" - it's the combined picture from three distinct, individually-honest metrics: Concentration (ConcentrationRisk.md/HHI.md), Sector/Industry Exposure (SectorExposure.md), and Correlation (Correlation.md).

## 2. Formula

There isn't one formula - diversification in Athena is a *composite read* across:
```
Concentration:  how much value sits in the top few positions (position-count diversification)
Exposure:       how spread out that value is across sectors/industries (category diversification)
Correlation:    how independently those positions have actually moved (behavioral diversification)
```

## 3. Intuition

Five holdings at 20% each look perfectly diversified by concentration alone - but if all five are semiconductor companies, they may still move together in practice. Diversification only really exists when all three lenses agree: value is spread across positions, those positions span different sectors, and (ideally) they haven't historically moved in lockstep. Any one lens in isolation can be misleading.

## 4. Why investors care

Diversification is one of the few genuinely "free" risk-reduction tools in investing - combining imperfectly-correlated assets can reduce portfolio volatility without necessarily reducing expected return. Investors use it to avoid a single event (one company's bad quarter, one sector's downturn) dominating their entire portfolio's outcome.

## 5. Data required

Portfolio weights (for concentration), each holding's sector/industry classification (for exposure), and historical returns (for correlation).

## 6. How Athena calculates it

There's no single "diversification" number returned by the API - Sprint 14 deliberately avoids collapsing three genuinely different signals into one composite score, which would hide exactly the kind of disagreement between lenses that matters (e.g. low concentration but high sector overlap). Instead, `GET /api/portfolio/analytics` returns `concentration`, `sectorExposure`, `industryExposure`, and `correlation` as separate, independently-interpretable blocks.

## 7. Assumptions

Every constituent metric carries its own assumptions (see PortfolioBeta.md/HHI.md/Correlation.md for each) - diversification as a composite inherits all of them.

## 8. Limitations

- **No single score.** This is a deliberate product choice, not a missing feature - see PortfolioRiskProductDesign.md for the reasoning.
- **Requires at least two holdings for the correlation lens** to say anything; concentration and exposure remain meaningful with just one holding (trivially: 100% concentrated, 100% in one sector).
- **Says nothing about whether a portfolio's diversification level is appropriate** for its owner - a concentrated, high-conviction portfolio can be an entirely deliberate and reasonable strategy. Athena reports facts, never a verdict.

## 9. Common interpretation mistakes

- **Assuming low concentration alone means well-diversified.** See the five-semiconductor-stocks example above - this is the single most common diversification misreading, and exactly why Athena surfaces exposure and correlation as separate signals rather than folding everything into a concentration number.
- **Assuming high correlation between two holdings is inherently a mistake.** It might be a completely intentional pairs-style or sector-conviction bet.

## 10. Interview question

*"Why doesn't Athena compute one overall diversification score (e.g. 0-100)?"* — Because a single score would force an arbitrary weighting between three conceptually different signals (position concentration, category overlap, and behavioral correlation) that can disagree with each other in informative ways. Collapsing them loses exactly the information a user needs to understand *why* their diversification looks the way it does - a low score could mean high concentration, high sector overlap, high correlation, or some combination, and a single number can't distinguish between those very different situations.
