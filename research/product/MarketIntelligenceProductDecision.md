# Market Intelligence: Product Decision

## Why market data is a separate product domain

Sprints 1-3 answer one question: **"How is the business performing?"** - ingesting statements, computing ratios, and synthesizing growth/health insights, all derived from the company's own reported financials. Market Intelligence answers a genuinely different question: **"How is the market valuing and pricing this business?"** - a live, externally-determined signal (share price, trading volume, valuation multiples) that has nothing to do with what the company itself reports.

These are different data sources (stored fundamentals vs. live market feed), different refresh cadences (annual/quarterly statements vs. continuously updating price), and different failure modes (a missing financial statement means "not imported yet"; a missing P/E means "the company has no earnings" - a fact about the business, not a data gap). Bundling them into one domain would force one module to reason about both "has this been imported" and "is this still fresh," which are unrelated concerns. Keeping Market Intelligence as its own module - its own routes, service, provider, and model - mirrors the separation Athena already draws between Financials (Sprint 1), Ratios (Sprint 2), and Business Analysis (Sprint 3): each is a distinct question, so each is a distinct module.

## Why users need both business and market information

An investor evaluating a company implicitly needs to answer two separate questions: "is this a good business?" and "am I paying a reasonable amount for it?" Sprints 1-3 answer only the first. Without market data, a user could conclude a company has excellent fundamentals (high ROE, strong revenue CAGR, healthy margins) with no way to see whether the stock has already priced that in, is lagging it, or has run far ahead of it. The [[MarketVsBusinessPerformance]] section exists specifically to put both answers on screen at once, without collapsing them into a single verdict Athena doesn't have the mandate (or the information) to make.

## Why we shouldn't overload the Financial Statements page

The Financial Statements tab and Business Analysis tab already carry a specific, coherent narrative: what the company reported, and what an automated read of those reports suggests about its trajectory. Market data - a live, second-by-second changing number sourced from a completely different system - doesn't belong embedded inside that narrative. Mixing "the company's Q4 net income was $X" with "the stock is currently trading at $Y" on the same view invites users to conflate the two, exactly the mistake [[MarketVsBusinessPerformance]] is designed to guard against. A dedicated tab keeps each question legible on its own, and lets a user who only cares about fundamentals ignore market data entirely (and vice versa) without either cluttering the other.

## Why the historical price chart is useful

A single current price is a snapshot; it says nothing about trajectory. The chart answers questions a number alone can't: has this stock been trending up or down, how volatile has it been, and how does the current price compare to where it's traded recently? It's also the visual anchor for the Performance cards - seeing the 1Y return number next to the actual price path that produced it makes the number concrete instead of abstract.

## How the period selector improves usability

Different questions need different lookback windows - "how has this stock done this week" and "how has it done over five years" are different investor concerns, and no single fixed window serves both. Rather than showing five separate charts (overwhelming) or forcing a page reload per window (slow), the period selector lets a user stay on one chart and switch context with a single click, matching the same pattern already validated elsewhere for switching views without leaving a page (e.g. the URL-synced tab bar used across the app). It also keeps the initial page load light (fetch one default period, 1Y, on mount) rather than eagerly loading all five windows before anything renders.

## What user problem the Market Intelligence section solves

Before this sprint, a user researching a company on Athena could form a complete opinion of the business itself but had no way to see how the market was actually pricing that business - they'd have to leave Athena entirely (to Yahoo Finance, Google, or a brokerage app) to check the current price, valuation multiples, or recent stock performance, breaking their research flow and losing the ability to view business and market data side by side. Market Intelligence closes that gap: a user can now go from "this company's fundamentals look strong" to "here's how the market is currently pricing that strength" without leaving the app, while Athena explicitly stops short of telling them what to conclude from the comparison.
