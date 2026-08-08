# 52-Week High / Low

## 1. What is it?

The highest and lowest closing (or intraday, depending on data source) prices a stock has traded at over the trailing 52 weeks.

## 2. Why does it matter?

It gives investors an instant sense of where the current price sits relative to its recent trading range - near its highs, near its lows, or somewhere in between.

## 3. How do investors use it?

- Gauging whether a stock is trading near a recent extreme, which some use as a technical signal (e.g. "new 52-week high" momentum screens).
- Providing quick context alongside the current price - "$190 out of a $150-$220 range" is more informative than "$190" alone.
- Assessing recent volatility: a wide 52-week range relative to the current price suggests a more volatile stock than a narrow one.

## 4. What are its limitations?

- It's a purely backward-looking, price-only statistic - it carries no information about *why* the stock hit those levels (company-specific news, sector rotation, broad market moves, etc.).
- A stock sitting at its 52-week high isn't inherently "overbought," and one at its 52-week low isn't inherently "oversold" or "cheap" - both require further context to interpret.
- The window is an arbitrary trailing 52 weeks; a stock's all-time range or a shorter/longer window can tell a very different story.

## 5. How is it calculated?

Athena sources this directly from Yahoo Finance's `summaryDetail` module (`fiftyTwoWeekHigh`, `fiftyTwoWeekLow`) rather than deriving it from its own `MarketHistory` records, since Yahoo already maintains this figure continuously and Athena's own historical cache is populated on-demand per ticker (see [[HistoricalDataStorage]]) and may not always span a full trailing year at first request.

## 6. How does Athena use it?

Shown as two of the Market Snapshot stat cards on the Market Intelligence tab (`price.fiftyTwoWeekHigh`, `price.fiftyTwoWeekLow`).

## 7. What can cause the metric to be misleading?

- A single sharp spike or crash (e.g. an earnings surprise, a market-wide selloff) can set the high or low for the entire year, even if the stock has traded in a much narrower range the rest of the time.
- For newly listed companies with less than 52 weeks of trading history, the range reflects a shorter and potentially less representative period.
- Because the window rolls forward daily, both figures change over time even without new extremes being set, simply as old data ages out of the trailing window.
