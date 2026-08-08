# Engineering Concept: Reusable Chart Components

## What it is

[PriceHistoryChart.jsx](../../frontend/src/components/charts/PriceHistoryChart.jsx) is a generic, data-agnostic time-series chart component - a period selector, a recharts `AreaChart`, and built-in loading/empty/error states - that takes plain `{date, close}` (or `{date, value}`) data plus loading/error flags as props. It doesn't know anything about "market data," "tickers," or Yahoo; `MarketIntelligence.jsx` is the only file that knows this chart is currently showing stock prices.

```jsx
<PriceHistoryChart
  data={history}
  loading={historyLoading}
  error={historyError}
  period={period}
  periods={CHART_PERIODS}
  onPeriodChange={setPeriod}
  valueFormatter={valueFormatter}
/>
```

## Why we use it

This follows the same reuse pattern already established by [TrendLineChart.jsx](../../frontend/src/components/charts/TrendLineChart.jsx) (Sprint 3), which drives both the Revenue/Net Income chart and the Margin Trend chart in Business Analysis purely through its `series`/`valueFormatter` props. `PriceHistoryChart` extends that same idea to a single-series, period-selectable chart, sharing the existing `ChartTooltip` component rather than building a new tooltip. Keeping the component free of market-specific naming or logic means it's genuinely available for any future date-keyed series Athena might chart (e.g. a portfolio value over time), not just stock prices.

## Alternatives considered

- **A `MarketPriceChart` component coupled directly to the `/api/market/:ticker/history` response shape.** Rejected: this would tie the chart's rendering logic to one specific API response, making it unusable for any other time series without a rewrite, and would blur the line between "how to fetch market data" (a `MarketIntelligence.jsx` concern) and "how to render a time series" (a chart component concern).
- **Extending `TrendLineChart` itself to also handle the period-selector UI and area-fill styling.** Rejected: `TrendLineChart` is deliberately a multi-series *line* chart with no period selector, used for year-over-year statement trends where all years are always shown at once. Bolting period-selection and area-fill onto it would add conditional complexity to a component that's currently simple and well-tested by its two existing Business Analysis usages.
- **A charting library abstraction that wraps recharts entirely (so the app isn't coupled to recharts specifically).** Not pursued - recharts is already the app's chosen charting library (Sprint 3), and adding a second abstraction layer over it for a single new chart type isn't justified yet.

## Trade-offs

- **Pro:** `PriceHistoryChart` can be dropped into any future feature needing a period-selectable time series without modification - the component has no knowledge of "market" or "stock" as concepts.
- **Pro:** loading/empty/error states are handled once, inside the component, so every consumer gets consistent UX for free instead of re-implementing it.
- **Con:** the period-selector buttons are currently styled inline within the component rather than reusing the app's `Tabs` component, since `Tabs` is URL-route-based (`NavLink`) and this selector needs to be in-page state instead (switching the chart's data without navigating) - an intentional divergence, not an oversight.

## How Athena implements it

`MarketIntelligence.jsx` owns all market-specific concerns (fetching, ticker/period state, API response shapes) and passes only generic props down to `PriceHistoryChart`. The component itself reuses `ChartTooltip` (Sprint 3) for tooltip rendering and `Skeleton`/`ErrorState`/`EmptyState` (existing UI primitives) for its three non-happy-path states, so there's no new loading-spinner or error-box implementation introduced in this sprint.

## Interview questions

1. *"Why does `PriceHistoryChart` take a `period` string and a `periods` array as props instead of hard-coding '1M/3M/6M/1Y/5Y'?"* - Tests understanding of prop-driven configuration as the mechanism that keeps a component reusable: any future consumer can supply different period options (or none at all) without touching the chart's code.
2. *"This component and `TrendLineChart` both render recharts series with a shared `ChartTooltip`. Why weren't they merged into one component?"* - Should discuss that they serve different chart shapes (multi-series line-per-year vs. single-series period-selectable area) with different interaction models (static years vs. selectable date range) - forcing a shared implementation would mean one of them carries unused complexity for the other's use case.
