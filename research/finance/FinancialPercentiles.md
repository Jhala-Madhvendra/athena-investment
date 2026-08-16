# Financial Percentiles

## 1. Definition

A percentile expresses where one observation falls within a distribution — the *p*th percentile is the value below which *p* percent of the observations fall. Industry Intelligence uses percentiles two ways: (a) the value at a given percentile of the universe (P25/P75, already used by Sprint 7's Comps), and (b) the **percentile rank** of the target company's own value within the universe — "where does this company sit?"

## 2. The formula

**Value at a percentile** (already implemented, `comps.statistics.percentile()`): linear interpolation between the two nearest ranks (Excel `PERCENTILE.INC` / NIST method 7).

**Percentile rank of a value** (new for Sprint 13, `industry.benchmark.percentileRank()`):

```
Percentile Rank = ((count below + 0.5 × count equal) / total count) × 100
```

Ties are counted at half weight so a value tied with several peers doesn't jump to the top of its tie band — a company tied with 3 of 4 peers at the same value lands around the 63rd percentile, not the 100th.

## 3. Why investors care

"28% operating margin" and "28% operating margin, 78th percentile of tracked peers" carry different information density — the percentile compresses the entire distribution into one intuitive number: "better than roughly 78% of the reference universe."

## 4. How analysts use it

Percentile framing is common in screening tools ("show me companies above the 75th percentile ROE in their sector") precisely because it's unit-agnostic and instantly comparable across different metrics — a company can be described as "80th percentile growth, 40th percentile margin" without needing the reader to separately calibrate what's typical for growth vs. margin.

## 5. How Athena calculates it

Both directions are computed only once the reference universe has at least `MIN_UNIVERSE_SIZE` (4) valid observations for that metric — below that, Athena reports the metric as unavailable rather than a percentile with almost no statistical backing. `industry.benchmark.percentileRank()` is deliberately a new function, not a repurposing of `comps.statistics.percentile()` — the two answer inverse questions (value-at-percentile vs. percentile-of-value) and conflating them would be a real correctness bug, not just a naming inconvenience.

## 6. Limitations

- With a small universe (4-6 companies), percentile rank moves in large, coarse steps — a universe of 4 can only express percentiles in ~12.5-point increments in practice, which is far less precise than the "78th percentile" framing implies to a casual reader.
- A percentile rank says nothing about the *magnitude* of the gap to the next company — being at the 90th percentile in a tightly clustered universe is a very different statement than being at the 90th percentile with a wide gap to everyone else.

## 7. Common interpretation mistakes

- **Reading percentile rank as a quality score.** The 78th percentile of operating margin says nothing by itself about whether that margin is sustainable, or whether the peer group itself is a strong or weak universe.
- **Not accounting for tie-handling.** A naive "count of values ≤ target" rank formula would let a company tied with the entire universe claim the 100th percentile — Athena's half-weight tie handling avoids that overstatement (see `industry.benchmark.test.js`'s explicit test of a tied universe).
- **Extrapolating precision the sample doesn't support.** A "63rd percentile" computed from 4 observations is not as precise a statement as the same percentile computed from 40.

## 8. Interview questions

1. *"What's the difference between 'the value at the 75th percentile' and 'this company's percentile rank'?"* — The first answers "what value would a company need to be at the top quartile?" (a threshold); the second answers "where does this specific company's actual value fall?" (a rank). Athena needed both: Sprint 7's Comps already used the first for peer statistics; Industry Intelligence's Company Position feature needed the second and had to build it new.
2. *"Why does Athena round tie-handling to half weight instead of just counting ties as 'below'?"* — Counting ties as strictly below would systematically understate a tied company's position; counting them as strictly above would systematically overstate it. Splitting the weight is the standard, symmetric convention (matches how most statistical packages compute percentile rank with ties) and avoids biasing the result in either direction.
