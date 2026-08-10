# Price-to-Book (P/B) Ratio

## 1. What is it?

Price-to-Book compares a company's market capitalization to its book value (total shareholders' equity, as recorded on the balance sheet). It answers: "how much is the market paying for each dollar of the company's recorded net assets?"

## 2. Why does it matter?

It's a classic valuation multiple, historically used to identify companies trading below the accounting value of their net assets, and to compare valuation across asset-heavy businesses (banks, insurers, industrials) where book value is a meaningful anchor.

## 3. How do investors use it?

- Comparing P/B across companies in the same capital-intensive industry (e.g. banks, where book value closely tracks tangible capital).
- As a sanity check alongside P/E, especially for companies with volatile or negative earnings where P/E isn't usable.
- Historically, value-investing strategies have screened for low P/B stocks, though this has limitations (see below).

## 4. What are its limitations?

- Book value is an accounting concept, not a market one - it reflects historical cost, depreciation policy, and accounting choices, not what assets are actually worth today.
- It's far less meaningful for asset-light businesses (software, services) where most of the company's value is in intangibles (brand, IP, people) that don't appear on the balance sheet.
- A very low P/B isn't automatically "cheap" - it can reflect a genuinely troubled business that the market has correctly marked down.
- Share buybacks, historical write-downs, and differing accounting standards across countries can all distort book value in ways unrelated to current economic reality.

## 5. How is it calculated?

```
P/B = Market Capitalization / Total Shareholders' Equity
    = Share Price / Book Value per Share
```

Sourced directly from Yahoo Finance's `defaultKeyStatistics` module (`priceToBook`) rather than recomputed from Athena's own stored balance sheet data, to stay consistent with the live share price used in the numerator.

## 6. How does Athena use it?

Shown in the Market Snapshot section (`valuation.priceToBook`) and in the Business vs. Market Performance comparison, as a plain number - never framed as a buy/sell signal.

## 7. What can cause the metric to be misleading?

- Asset-light, high-growth companies can show very high P/B ratios that look "expensive" purely because their balance sheet understates their real economic value.
- Companies that have written down assets (impairments) can show artificially low book value, inflating P/B in a way unrelated to the underlying business quality.
- P/B is not comparable across industries with fundamentally different capital structures.

## 8. Sprint 7 addendum: a second, distinct P/B in Comparable Company Analysis

Since Sprint 7, Athena computes a **second P/B figure**, separate from the Yahoo-sourced one above:

| | This doc's P/B (Sprint 4) | Comps' P/B (Sprint 7) |
|---|---|---|
| Source | Sourced directly from Yahoo's `defaultKeyStatistics.priceToBook` | Computed by Athena: `Market Cap / Total Stockholders' Equity` (`comps.formulas.js`'s `priceToBook()`) |
| Purpose | A market snapshot metric, shown standalone | A trading multiple, aggregated across a peer group and applied to a target's own book value to produce an Implied Value Per Share |
| Negative/zero book value | Not applicable/returned by Yahoo | Explicitly excluded (`null`) - see `research/finance/OutlierHandling.md` |

As with P/E (see `PERatio.md`'s Sprint 7 addendum), both are legitimate, will usually be close, and are kept as separate code paths so the Comps engine's peer aggregation only ever depends on Athena's own consistently-sourced book-value figures, not a third-party snapshot. P/B is an **equity** multiple - see `research/finance/ValuationMultiples.md` for why it is never bridged through Enterprise Value.
