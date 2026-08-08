# Market Performance vs. Business Performance

## 1. What is it?

Two distinct lenses on the same company:

- **Business performance** - how the underlying company itself is doing: revenue growth, profitability, cash generation. This is what Athena's Sprint 2 (ratios) and Sprint 3 (growth/CAGR/health score) modules measure.
- **Market performance** - how investors are currently pricing the company's shares: stock price returns and valuation multiples (P/E, P/B). This is what Sprint 4's Market Intelligence module measures.

## 2. Why does it matter?

These two things are related but not the same, and conflating them is one of the most common sources of confused investing reasoning. A company can be executing well operationally while its stock underperforms (or vice versa), because the stock price reflects not just current fundamentals but also expectations, sentiment, and the price already paid for future growth.

## 3. How do investors use it?

- Checking whether a stock's price movement has been "supported" by underlying business improvement, or has run ahead of (or lagged) it.
- Understanding that a "good company" and a "good investment" are different questions - the second depends on the price paid relative to the business's performance, not the business's performance alone.
- Using divergences between the two (e.g. strong revenue growth but a falling stock price) as a prompt for further research, not as a conclusion in itself.

## 4. What are its limitations?

- There's no formula that combines the two into a single "correct" answer - reconciling them requires judgment, and reasonable investors can disagree.
- Business performance is reported with a lag (annual/quarterly statements); market performance is continuous. Comparing a CAGR computed over several fiscal years against a 1-year stock return is comparing different time horizons, not a precise like-for-like measurement.
- Neither side of the comparison, alone or together, indicates whether a stock is currently a "good buy" - that additionally depends on the price paid, the investor's time horizon, and their own risk tolerance, none of which Athena assesses.

## 5. How is it calculated?

Athena does not compute a combined score. It presents both sides side by side as plain figures:

| Business Performance (from Sprint 2/3) | Market Performance (from Sprint 4) |
|---|---|
| Revenue CAGR | 1 Year Stock Return |
| Net Income CAGR | P/E Ratio |
| Free Cash Flow CAGR | Price to Book |
| Return on Equity (ROE) | Market Capitalization |
| Operating Margin | |

## 6. How does Athena use it?

The "Business vs. Market Performance" section on the Market Intelligence tab fetches Sprint 3's `/api/analysis/:ticker` (for growth CAGRs) and Sprint 2's `/api/ratios/:ticker` (for ROE and operating margin) alongside Sprint 4's own market data, and renders them in two adjacent cards with a short explanatory paragraph. No score, verdict, or recommendation is generated from the comparison - by design, per the sprint's explicit requirement not to imply investment advice.

## 7. What can cause the metric to be misleading?

- Reading a mismatch between business and market performance as automatically meaning the stock is "mispriced" - it may instead reflect information the market has that a backward-looking financial statement doesn't yet capture (e.g. anticipated future competition, regulatory risk, or a slowing growth trajectory).
- Comparing CAGR (computed over the analysis module's multi-year window, default 5 years) directly against a 1-year stock return, which covers a different, shorter timeframe.
- Treating either side of the comparison as a complete picture on its own - each is a narrow slice (fundamentals *or* pricing), not a full investment thesis.
