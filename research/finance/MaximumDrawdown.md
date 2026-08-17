# Maximum Drawdown

## 1. Definition

**Maximum drawdown** is the largest peak-to-trough decline a portfolio experienced over the analysis window - the biggest percentage drop from a high point before a new high was reached (or the window ended).

## 2. Formula

```
Running Peak_t = max(Value_0 ... Value_t)
Drawdown_t = (Value_t - Running Peak_t) / Running Peak_t
Maximum Drawdown = min(Drawdown_t)  (the most negative value, i.e. the worst decline)
```

## 3. Intuition

Average volatility tells you how bumpy the ride was on a typical day; max drawdown tells you the single worst continuous fall an investor holding through the whole window would have felt - the number that answers "what's the worst it got?"

## 4. Why investors care

A portfolio's average return and volatility can look identical to another portfolio's while their drawdown experiences are completely different - one might have declined smoothly by a small amount many times, the other might have had one severe drop. Drawdown captures the "how bad did it get" question that averages and standard deviations don't directly answer, and it's often the number that most closely tracks an investor's actual emotional experience of holding through a decline.

## 5. Data required

The same simulated historical portfolio value series used for volatility and period return (today's weights applied backward over each holding's price history).

## 6. How Athena calculates it

`backend/portfolio/portfolio.analytics.calculator.js`'s `calculateMaxDrawdown()` walks the return series as a cumulative value curve starting at 1.0, tracking the running peak and the worst drawdown seen at each point. It reports:
- `maxDrawdownPercent` - the size of the decline
- `peakDate` - the date of the high point the decline started from
- `troughDate` - the date of the low point
- `recoveryDate` - the first date after the trough the value rose back above the pre-drawdown peak, or `null` if it never did within the window

## 7. Assumptions

Built on the same current-weights-applied-backward series as every other historical metric (see PortfolioCalculationAssumptions.md) - this is not a record of the portfolio's actual worst historical decline, it's an estimate of what the decline would have looked like with today's holdings.

## 8. Limitations

- **Window-dependent.** A 1-month window can only find a drawdown that happened within that month; a 5-year window sees more history but also dilutes recent behavior.
- **"No recovery" doesn't mean "still down."** A `null` recovery date only means the series didn't climb back above the pre-drawdown peak *before the window ended* - not that the portfolio is still at its lowest point today.
- **Not predictive.** Athena states this explicitly in the UI: historical drawdown is not a forecast of future losses.

## 9. Common interpretation mistakes

- **Confusing max drawdown with total volatility.** A portfolio can have a large single max drawdown and otherwise-modest day-to-day volatility, or vice versa - they measure different things.
- **Reading "no recovery observed" as more alarming than it is.** It's frequently just an artifact of a short analysis window ending mid-decline, not evidence the position never recovered in reality.

## 10. Interview question

*"Why track the peak that preceded the trough, rather than just the global peak of the whole window?"* — Because maximum drawdown is defined relative to the highest point reached *before* the decline, not the highest point reached at any time in the whole series (which could occur after recovery, at a new all-time high). Athena's implementation updates the running peak continuously and only records a new "worst drawdown" when the current value falls further below the peak in effect at that moment - this correctly finds the single worst continuous decline, not a comparison between two unrelated high and low points.
