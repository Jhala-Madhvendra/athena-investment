# Dividend Yield

## 1. What is it?

Dividend yield expresses a company's annual dividend payment as a percentage of its current share price - the return an investor receives purely from cash distributions, before any change in share price.

## 2. Why does it matter?

It's a key metric for income-focused investors, and it also signals something about a company's capital allocation strategy: mature, cash-generative companies tend to pay dividends, while younger or high-growth companies typically reinvest earnings instead and pay little or no dividend.

## 3. How do investors use it?

- Comparing income potential across dividend-paying stocks.
- As one factor (alongside payout ratio and earnings stability, neither of which Athena currently calculates) when assessing whether a dividend looks sustainable.
- Distinguishing "growth" companies (typically low/no yield) from "income" or "value" companies (typically higher yield) as a rough style classification.

## 4. What are its limitations?

- Many companies - especially high-growth ones - pay no dividend at all. A missing or zero yield does not indicate a problem with the company.
- A high dividend yield can be a warning sign rather than a benefit: if a stock price has fallen sharply, the yield rises mechanically even if the dividend itself is about to be cut.
- Dividend yield says nothing about whether the dividend is affordable relative to earnings or free cash flow.
- It ignores buybacks, which are an alternative way companies return cash to shareholders without showing up in yield.

## 5. How is it calculated?

```
Dividend Yield = Annual Dividend per Share / Current Share Price
```

Sourced directly from Yahoo Finance's `summaryDetail` module (`dividendYield`, `dividendRate`) rather than derived from Athena's own statement data, since dividend policy isn't part of the income/balance sheet/cash-flow statements Athena stores.

## 6. How does Athena use it?

Shown in the Market Snapshot section (`dividend.yield`) of the Market Intelligence tab. When a company pays no dividend, the field is `null` and rendered as "—" rather than "0%", to distinguish "does not pay a dividend" from "pays a dividend of zero."

## 7. What can cause the metric to be misleading?

- A spiking yield driven by a falling share price ("yield trap") can look attractive while actually signaling market concern about the company's ability to sustain the payout.
- Special/one-time dividends can distort the trailing yield figure without being repeatable.
- Yield alone says nothing about total return - a low-yield, high-growth stock can outperform a high-yield, stagnant one on a total-return basis.
