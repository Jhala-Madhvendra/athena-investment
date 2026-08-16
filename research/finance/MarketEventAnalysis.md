# Market Event Analysis

## 1. Definition

Market event analysis is the practice of flagging price and trading-range moves large enough to be a signal, rather than reporting every tick. Athena's Alert Engine implements three market rules: a large single-day move, a significant move over the last 5 trading sessions, and an unusually wide trading range relative to the recent baseline.

## 2. Why investors care

Daily price noise is mostly uninformative — a 1-2% move is routine for a large-cap stock and carries no news content. A move several multiples of that size, or a trading range far wider than recent sessions, usually means new information reached the market (an analyst downgrade, a leaked report, a macro shock) even before the underlying cause is known. Catching the move is the first step toward investigating the cause.

## 3. Formula

```
Daily % change   = (todayClose - yesterdayClose) / yesterdayClose * 100
5-day % change    = (todayClose - closeFiveSessionsAgo) / closeFiveSessionsAgo * 100
Range width %     = (dayHigh - dayLow) / dayClose * 100
```

## 4. Appropriate comparison period

Daily and 5-day windows are both trading-session counts, not calendar days — a Friday-to-Monday move is still "1 day" in this sense, and weekends/holidays are transparently skipped because the underlying data (`MarketHistory`) only contains trading days. There is no attempt at a "quarterly" market comparison; price is continuous, so the only meaningful periods are short trading windows.

## 5. Limitations

- No context for *why* a move happened — market rules only observe magnitude, never a cause. Pairing a large move with the News alert category is the closest Athena gets to explaining one.
- No volume confirmation. A large move on light volume is a materially different signal than the same move on heavy volume, and Athena doesn't yet compare volume to its own trailing average.
- No sector/market-relative framing — a whole-market -8% day would fire the same alert as an idiosyncratic single-stock -8% day.

## 6. False positives

A stock recovering from an earlier drop (e.g., -8% one day, +9% the next) will fire two separate alerts describing what a chart would show as one V-shaped event — this is a deliberate trade-off (see `research/engineering/EventDetection.md`) rather than a bug: each observation is independently true, and merging related market moves into one "event" would require inferring causation the engine deliberately doesn't attempt.

## 7. How Athena implements it

`backend/alerts/alert.engine.js`'s `evaluateMarketRules` computes all three rules from the same already-cached daily bar series (`market.service.js`'s `getHistoricalPrices`, which is DB-persisted and only refreshes from a provider when more than `FRESHNESS_THRESHOLD_DAYS` stale) — no dedicated market snapshot is needed, since re-deriving "price 5 sessions ago" from that cache costs a database read, not a provider call. Thresholds (`backend/alerts/alert.rules.js`): 5% daily move, 8% 5-day move, both MEDIUM at the threshold and HIGH at 2x it; a 1.5x trailing-average range width for the range-spike rule. Deduplication is by trading date, so a repeated `POST /api/alerts/monitor` call on the same day never re-fires the same observation (see `AlertDeduplication.md`).

## 8. Common mistakes

- Comparing against the previous *calendar* day instead of the previous *trading* day, which silently breaks around weekends and holidays.
- Using a percent-of-price range width without normalizing by a trailing baseline — a stock that's simply more volatile than average (e.g., a small-cap) would trip a fixed absolute-range threshold constantly, which is why Athena compares today's range to its own recent average rather than a fixed number.

## 9. Interview questions

1. *"Why compare to 5 trading sessions instead of 5 calendar days?"* — Calendar days include weekends/holidays where nothing trades; a Friday-to-Monday move over "3 calendar days" is really one trading session's worth of information gap. Trading-session counting is what the market itself uses.
2. *"A stock drops 8% one day and recovers 9% the next. Athena fires two alerts. Is that a bug?"* — No — each is an independently true observation of a large move. Merging them into "one recovery event" would require the engine to infer that the two moves are causally related, which isn't something a deterministic, no-external-data rule can do safely.
3. *"Why is 5% the daily-move threshold and not something lower?"* — A typical large-cap's daily volatility is roughly 1-2%; 5% is a clear multiple of normal noise, chosen so the alert is a real outlier day, not routine chop.
4. *"What would you add to reduce false positives here?"* — Volume confirmation (was this move on unusually high volume?) and market-relative framing (did the whole market move, or just this stock?) are the two most valuable next signals, and neither requires new infrastructure — Athena already has daily volume in `MarketHistory`.
