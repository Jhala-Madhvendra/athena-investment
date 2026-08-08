# Revenue CAGR (Compound Annual Growth Rate)

## Definition

**Compound Annual Growth Rate (CAGR)** is the year-over-year growth rate of revenue over a multi-year period, expressed as a single annualized percentage.

**Formula:**
```
CAGR = (Ending Value / Beginning Value) ^ (1 / Number of Years) - 1
```

**Example:**
If a company's revenue was $100M five years ago and is now $200M:
```
CAGR = (200 / 100) ^ (1 / 4) - 1 = 2 ^ 0.25 - 1 ≈ 18.9%
```

This means revenue grew at an average rate of 18.9% per year over the 4-year period.

---

## Business Meaning

Revenue CAGR is the single most important metric for evaluating a company's growth trajectory. It answers:

- **Is the company expanding?** High CAGR indicates healthy business expansion and market penetration.
- **Is growth sustainable?** Consistent CAGR (no wild swings) suggests repeatable business model; volatile CAGR indicates unpredictable revenue streams.
- **How does growth compare?** CAGR allows comparison across time periods and industries (e.g., "Tech companies average 15% CAGR; this company achieved 8%").

**What Different CAGR Ranges Mean:**
- **> 20%:** Hypergrowth (startup/emerging company phase)
- **10-20%:** Strong growth (exceeds most mature businesses)
- **5-10%:** Healthy growth (in line with economic expansion)
- **0-5%:** Slow/stagnating growth (mature, stable business)
- **< 0%:** Declining revenue (contraction, market share loss)

---

## Investor Importance

### Growth = Profitability Potential
Investors assume that:
1. Revenue growth precedes profit growth (volume increases lead to economies of scale).
2. Declining revenue eventually pressures margins and earnings.

**Example:** A company with 15% revenue CAGR can potentially increase earnings faster if it controls costs.

### Valuation Premiums
Investors pay valuation multiples (Price-to-Sales, Price-to-Earnings) partially based on growth rate:
- High-growth companies (>15% CAGR) trade at higher multiples (justified by future earnings potential).
- Low-growth companies (<5% CAGR) trade at lower multiples (assumed to be mature, stable).

### Risk Assessment
- Consistent, predictable CAGR = **Lower risk** (repeatable business model).
- Volatile CAGR = **Higher risk** (uncertain business model, market dependency).
- Negative CAGR = **Significant risk** (company losing market share or facing structural decline).

### Investment Thesis
A typical investment thesis for growth:
> "Company X has demonstrated 12% revenue CAGR over 5 years. If we assume 10% CAGR forward and operating leverage of 2x, net income could grow at 20% CAGR, justifying current valuation."

---

## How Athena Calculates It

### Data Source
- Retrieves 5 years of historical income statements from MongoDB.
- Extracts `totalRevenue` field from each fiscal year.

### Calculation Process
1. **Validate data:** Ensure at least 2 years of revenue data exists (cannot calculate CAGR with only 1 year).
2. **Handle edge cases:**
   - If any year's revenue is $0 or negative, mark as "N/A" (CAGR undefined for non-positive values).
   - If revenue is missing for any year, skip to next available pair (or report as insufficient data).
3. **Calculate CAGR:**
   ```
   Years Analyzed: 2019, 2020, 2021, 2022, 2023 (5 years)
   Period: 4 years (2019 → 2023)
   
   Revenue: [2019: $50M, 2020: $55M, 2021: $62M, 2022: $70M, 2023: $80M]
   CAGR = (80 / 50) ^ (1 / 4) - 1 = 12.25%
   ```
4. **Normalize and format:** Round to 2 decimal places, display as percentage with direction indicator.

### Output Example
```json
{
  "metric": "revenueCAGR",
  "value": 12.25,
  "unit": "percent",
  "period": {
    "startYear": 2019,
    "endYear": 2023,
    "years": 4
  },
  "direction": "↑ improving",
  "description": "Revenue grew at a compound annual rate of 12.25% over 4 years (2019-2023)."
}
```

### Special Cases
| Scenario | Handling |
|----------|----------|
| Revenue = 0 or negative | CAGR = "N/A"; note: "Revenue includes loss/zero years" |
| Only 1 year of data | CAGR = "Insufficient data"; need min 2 years |
| Missing middle years | Use available data pair (e.g., 2019 → 2023, skip 2020-2022 if unavailable) |
| Negative to positive transition | CAGR may be artificially high (e.g., $-10M → $10M = undefined); flag as "recovery, not organic growth" |

---

## Formula Breakdown

**Why CAGR instead of simple average growth?**

Simple average: $(55 + 62 + 70 + 80) / (50 + 55 + 62 + 70) - 1$ = ~14% (misleading)

CAGR: $(80 / 50) ^ (1/4) - 1$ = ~12% (accurate annualized rate)

CAGR is more accurate because it accounts for compounding (each year's growth builds on the previous year).

**Number of Years = (End Year - Start Year)**
- 5 data points spanning 5 calendar years = 4 periods for CAGR calculation.
- 2019, 2020, 2021, 2022, 2023 = 4 years of growth (2019 → 2023).

---

## Future Features Depending On It

### Short-term (Sprint 3-4)
1. **Comparison to Industry Benchmarks:** "Apple CAGR = 8%, Tech Industry Avg = 12% → Underperforming"
2. **Margin Analysis:** "Revenue CAGR = 8%, but Net Income CAGR = 12% → Operating leverage improving"
3. **Cash Flow Consistency:** "Revenue CAGR = 8%, FCF CAGR = 15% → Improving cash generation"

### Medium-term (Sprint 5-6)
4. **Peer Ranking:** "Rank companies by revenue CAGR; show top/bottom performers in industry"
5. **Segment Analysis:** "Revenue CAGR by business segment (e.g., Cloud = 20%, Hardware = 3%)"
6. **Forward Projection:** "If CAGR trend continues, revenue in 2025 could be $X"

### Long-term (Future)
7. **Cyclical Analysis:** "Detect 3-year cycles in growth (boom/bust patterns)"
8. **Anomaly Detection:** "Growth suddenly flatlined in 2022 despite historical 12% trend → investigate cause"
9. **Correlation Analysis:** "When revenue CAGR drops below 5%, stock underperforms 12 months later"

---

## Example Scenarios

### Scenario 1: Healthy Growth
```
Company: Netflix
Years: 2019-2023
Revenue: $20B → $35B
CAGR: 15%

Interpretation:
✓ Strong growth, above GDP growth rate
✓ Consistent business model expansion
✓ Premium valuation multiples justified
```

### Scenario 2: Slowing Growth
```
Company: Microsoft
Years: 2019-2023
Revenue: $125B → $200B
CAGR: 10%

Interpretation:
⚠ Healthy but maturing (large companies naturally slow)
✓ Still growing faster than inflation
→ Expect margins to expand to drive profitability growth
```

### Scenario 3: Declining Revenue
```
Company: IBM
Years: 2019-2023
Revenue: $77B → $60B
CAGR: -6%

Interpretation:
✗ Significant contraction
✗ Lost market share or disruption in core business
⚠ Unless offset by margin improvements, earnings will decline
→ High risk; requires turnaround strategy
```

---

## Summary

- **Revenue CAGR** is the annualized growth rate over multiple years
- **Investors use it to** evaluate growth potential, justify valuation, and assess risk
- **Athena calculates it by** retrieving 5 years of historical revenue and applying the CAGR formula
- **Critical for** understanding whether a company is expanding, stable, or contracting
- **Foundation for** profit growth analysis, margin trends, and cash flow sustainability
