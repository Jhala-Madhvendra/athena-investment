# Sector & Industry Exposure

## 1. Definition

**Sector/industry exposure** is the share of total portfolio value invested in each sector (e.g. Technology, Financials) or, at a finer grain, each industry (e.g. Semiconductors, Banks).

## 2. Formula

```
Sector Weight = Total value of holdings in sector / Total portfolio value
Industry Weight = Total value of holdings in industry / Total portfolio value
```

## 3. Intuition

Concentration (ConcentrationRisk.md/HHI.md) answers "how much is in my biggest positions"; exposure answers a related but different question - "what kind of businesses is my money actually in." Five holdings that all pass a low-concentration test can still all be the same kind of business, which exposure surfaces and concentration alone cannot.

## 4. Why investors care

A portfolio can hold many different tickers and still be effectively a single-sector bet - exposure is the check for that. It also helps an investor understand what's actually driving their portfolio's behavior: a Technology-heavy portfolio will tend to react to tech-sector news even if no individual position is unusually large.

## 5. Data required

Each holding's current weight, plus its sector and industry classification.

## 6. How Athena calculates it

`backend/portfolio/portfolio.analytics.exposure.js`'s `groupByClassification()`, called once with `Company.sector` and once with `Company.industry` as the grouping key. **Both fields are reused directly from Sprint 13's Industry & Sector Intelligence classification** (populated on the `Company` document at import time) - Sprint 14 introduces no new taxonomy, no separate sector list, and no risk of the two features disagreeing about what sector a company belongs to.

A holding whose company record has no sector/industry populated yet is grouped under `"Unclassified"` rather than silently dropped - its portfolio value is real even if Athena can't categorize it.

## 7. Assumptions

Sector/industry is read as a plain string field on the `Company` document, set once at import (from Yahoo Finance) and not re-verified on every analytics request - if a company's sector classification changes upstream, Athena reflects it the next time that company's record happens to be refreshed, not instantly.

## 8. Limitations

- **Single classification per holding.** A conglomerate operating across several genuinely distinct businesses is still assigned one sector/industry, same limitation Sprint 13 already has.
- **Says nothing about correlation.** Two different sectors can still move together during broad market stress - exposure is a categorical view, not a behavioral one (see Correlation.md and PortfolioDiversification.md).
- **Never framed as good or bad.** "Technology represents 52% of portfolio value" is reported as a fact; Athena does not follow it with "consider reducing" or similar.

## 9. Common interpretation mistakes

- **Treating a high single-sector weight as automatically risky.** It may be an entirely deliberate, informed bet - exposure is a description, not a judgment.
- **Assuming sector exposure and industry exposure tell the same story at different granularity.** They usually do, but a portfolio spread across several industries can still land almost entirely in one sector (since multiple industries roll up into the same sector) - both views are worth checking.

## 10. Interview question

*"Why does Sprint 14 reuse Company.sector/Company.industry instead of building its own portfolio-specific classification?"* — Because a second, independent classification system would risk disagreeing with Sprint 13's Industry Intelligence feature about what sector a company is in - the same ticker could then show "Technology" on the Industry page and "Software Services" on the Portfolio page, which would undermine trust in both. Reusing the single source of truth guarantees the two features are always consistent, and it's also strictly less work.
