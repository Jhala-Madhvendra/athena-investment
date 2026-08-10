# Trading Multiples: Statistical Aggregation Across a Peer Group

## 1. Definition

Once every peer's multiple has been calculated, "trading multiples" analysis is the process of summarizing that set of observations into a small number of statistics — and choosing which of those statistics to apply to the target company.

## 2. The formula

For each multiple (P/E, EV/EBITDA, EV/Revenue, P/B, P/S), Athena computes, from only the *valid* peer observations:

```
Min, Max, Mean, Median, 25th Percentile (P25), 75th Percentile (P75)
```

Percentiles are computed via linear interpolation (the same method Excel's `PERCENTILE.INC` and NIST's method 7 use) and are only reported once at least 4 valid observations exist — see `StatisticalAggregation.md`.

## 3. Intuition

A single peer's multiple is one data point in a noisy world; a peer *group's* statistics are an attempt to find the "typical" multiple the market is currently assigning to businesses like the target, without over-weighting any one company's idiosyncrasies.

## 4. Why investors use it

Different statistics answer different questions. The **median** answers "what does a typical peer trade at" in a way that's resistant to one extreme outlier dragging the answer around. The **mean** incorporates every observation's magnitude, for better or worse. The **25th/75th percentiles** define a plausible low/high band without going all the way to the group's absolute min/max (which may themselves be outliers).

## 5. When it is useful

Reporting a range of statistics — not just one — is useful whenever the peer group is small, has genuine dispersion, or includes companies of noticeably different quality/growth/size. It lets the person reading the analysis see *how much* the choice of statistic would change the answer, rather than hiding that sensitivity behind a single number.

## 6. When it can be misleading

A statistic computed from a very small sample (2-3 peers) carries much more uncertainty than the same statistic computed from a dozen — Athena's UI shows the valid-peer *count* for every multiple specifically so this isn't hidden, and deliberately withholds percentiles below 4 observations rather than reporting a percentile that would just echo the min or max.

## 7. What makes a company comparable

This doc covers the aggregation step; peer selection judgment itself (which companies belong in the group at all) is covered in `PeerSelection.md`.

## 8. Why Athena defaults to Median

The median is Athena's default statistic (per multiple, and it's what pre-fills the UI's statistic selector) because it is **far less sensitive to a single outlier than the mean.** Concretely: a peer group of `[10x, 12x, 14x, 16x, 1000x]` (one wildly mispriced or non-representative peer) has a mean of `210.4x` — almost entirely driven by the one outlier — but a median of `14x`, which barely moved from what the other four peers suggest. Since Athena cannot itself judge whether an included peer is genuinely comparable (see `PeerSelection.md`), defaulting to the statistic that's structurally more robust to a bad peer slipping into the group is the safer default. The user can still switch to Mean, P25, or P75 at any time — Athena never hides the alternative statistics, it just doesn't lead with the one most vulnerable to a single bad data point.

## 9. Common mistakes

- **Always reaching for the mean** out of habit, without considering how sensitive it is to outliers in a small sample.
- **Reporting a percentile computed from too few observations** as if it carried the same statistical weight as one computed from a dozen peers.
- **Silently including an excluded observation's `null` as if it were zero** when computing statistics by hand — Athena's `comps.statistics.js` filters out non-finite values before computing anything, rather than letting a `null` corrupt a sum or an average.

## 10. Interview questions

*"Why might you deliberately choose Mean over Median for a specific analysis?"* — If every peer in the group is genuinely comparable and roughly equally reliable, the mean uses more information (every observation's actual magnitude, not just its rank) and can be a better central estimate. The tradeoff is exactly its weakness: it assumes there isn't a bad or non-representative observation in the mix. Athena exposes both — the choice of which is more appropriate is a judgment call the tool deliberately leaves to the user rather than making silently.

*"Why does Athena require at least 4 peer observations before showing a percentile?"* — With fewer than 4 points, a 25th or 75th percentile computed via linear interpolation ends up being extremely close to (or identical to) the min or max — it doesn't actually convey different information from those two statistics, and displaying it as if it were a meaningfully distinct "P25" could overstate how much the underlying data actually supports that specific number. Reporting it as unavailable is more honest than reporting a number that looks precise but isn't backed by enough data.
