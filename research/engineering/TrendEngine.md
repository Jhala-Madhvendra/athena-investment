# Trend Engine Architecture

## Overview

**Trend Engine** is the core analytical module that transforms raw 5-year financial statement data into meaningful trend metrics. It calculates growth rates (CAGR), identifies trend direction, measures consistency, and projects forward-looking trends.

**Input:** 5 years of financial statements (MongoDB)
**Output:** Growth metrics, trend directions, consistency scores, and projections

---

## Core Responsibilities

1. **Data Retrieval & Validation**
   - Query MongoDB for 5 years of financial data
   - Validate data completeness (minimum 2 years required)
   - Handle missing years gracefully

2. **Growth Metric Calculation**
   - Calculate CAGR for revenue, net income, operating income, free cash flow
   - Calculate year-over-year debt, equity, asset growth
   - Normalize all values to percentages

3. **Trend Direction Detection**
   - Identify if metrics are improving (↑), declining (↓), or stable (→)
   - Use consistency rules: 3+ of 4 years in same direction = trend
   - Flag erratic patterns

4. **Trend Strength Measurement**
   - Consistency score (0–100): What % of years follow the trend?
   - Volatility measure: How much do values swing year-to-year?
   - Inflection detection: Is trend changing direction recently?

5. **Forward Projection**
   - Linear projection: If trend continues, what will metric be in 1-2 years?
   - Confidence level: Based on historical consistency
   - Caveats: Mark projections as "assumes trend continues"

---

## Architecture Design

### Module Structure
```
trend.engine.js (main orchestrator)
  ├── dataRetrieval()
  ├── validateData()
  ├── calculateCAGR()
  ├── calculateGrowthMetrics()
  ├── detectTrendDirection()
  ├── calculateConsistency()
  ├── projectForward()
  └── formatOutput()
```

### Data Flow
```
MongoDB Query (5 years)
    ↓
Validation (ensure minimum 2 years)
    ↓
Extract Metrics (revenue, net income, debt, etc.)
    ↓
CAGR Calculation
    ↓
YoY Growth Calculation
    ↓
Trend Direction Detection
    ↓
Consistency & Volatility Analysis
    ↓
Forward Projection
    ↓
Output Formatting
```

---

## Algorithm Details

### 1. CAGR Calculation

**Formula:**
```
CAGR = (Ending Value / Beginning Value) ^ (1 / Number of Years) - 1
```

**Edge Cases:**
```javascript
// Negative values
if (startValue < 0 || endValue < 0) {
  return "N/A"; // CAGR undefined for non-positive starting values
}

// Zero division
if (startValue === 0) {
  return "Infinite"; // If starting from zero, CAGR is undefined
}

// Missing middle years
if (data has gaps) {
  // Skip to next available pair
  // e.g., [2019: $50M, 2021: $60M (missing 2020)] → 2 years = 1 period
  period = endYear - startYear - 1;
}
```

**Example:**
```
Years: [2019: $100M, 2020: $110M, 2021: $121M, 2022: $133M, 2023: $146M]
CAGR (2019 → 2023) = (146 / 100) ^ (1/4) - 1 = 10%
```

### 2. Trend Direction Detection

**Rules:**
```
Improving Trend:  ↑ YoY[2023] > YoY[2022] > YoY[2021] > YoY[2020]
                   → At least 3 of 4 comparisons positive
                   
Declining Trend:  ↓ YoY[2023] < YoY[2022] < YoY[2021] < YoY[2020]
                   → At least 3 of 4 comparisons negative
                   
Stable Trend:     → Fluctuations within ±50 bps (or ±2% for growth rates)
                     No clear direction
                     
Volatile Trend:   ⚠ Swings > ±100 bps; inconsistent direction
                   Cannot reliably predict direction
```

**Example:**
```
Net Profit Margin: [2019: 15%, 2020: 16%, 2021: 18%, 2022: 17%, 2023: 16%]

YoY Changes: [+1%, +2%, -1%, -1%]

Direction Analysis:
  - 2020 vs 2019: +1% ✓
  - 2021 vs 2020: +2% ✓
  - 2022 vs 2021: -1% ✗
  - 2023 vs 2022: -1% ✗

Result: Peaked in 2021, declining since
        Direction: ↓ Declining (2 of 4 years)
        Confidence: Moderate (trend shift evident)
```

### 3. Consistency Score Calculation

**Formula:**
```
Consistency = (Years following dominant direction / Total Years) × 100

Example:
  4 years improving, 1 year flat = 80% consistency (strong trend)
  2 years improving, 2 years declining = 50% consistency (no clear trend)
  3 years improving, 1 year flat = 75% consistency (moderate trend)
```

**Interpretation:**
- **80–100%:** Strong, reliable trend (predict direction)
- **60–80%:** Moderate trend (some deviations)
- **40–60%:** Weak trend (unreliable)
- **< 40%:** No clear trend (erratic)

### 4. Forward Projection

**Linear Projection:**
```
If trend: +2% annually, over last 3 years
Next year projection = Latest Value × (1 + 2%)

Example:
  2023 Revenue: $100M
  Average YoY growth: 3% (last 3 years)
  2024 Projection: $100M × 1.03 = $103M
  2025 Projection: $103M × 1.03 = $106M
```

**Confidence Levels:**
```
Consistency > 80% → High confidence (90%+ reliable)
Consistency 60–80% → Moderate confidence (70% reliable)
Consistency < 60% → Low confidence (unreliable; caveat required)
```

---

## Metrics Calculated

### Growth Metrics (CAGR)
1. **Revenue CAGR** — Top-line growth rate
2. **Net Income CAGR** — Bottom-line growth rate
3. **Operating Income CAGR** — Operational profitability growth
4. **Free Cash Flow CAGR** — Cash generation growth

### Asset & Debt Growth
5. **Total Debt Growth** — YoY debt increase/decrease
6. **Total Equity Growth** — Shareholder equity change
7. **Total Assets Growth** — Asset base expansion

### Margin Trends
8. **Gross Margin Trend** — Direction + consistency
9. **Operating Margin Trend** — Direction + consistency
10. **Net Profit Margin Trend** — Direction + consistency

### Return Trends
11. **ROE Trend** — Return on equity improving/declining
12. **ROA Trend** — Return on assets trajectory

### Efficiency Trends
13. **Debt-to-Equity Trend** — Leverage rising/falling
14. **Current Ratio Trend** — Liquidity improving/declining

---

## Output Format

### Individual Metric Response
```json
{
  "metric": "revenueCAGR",
  "value": 12.5,
  "unit": "percent",
  "period": {
    "startYear": 2019,
    "endYear": 2023,
    "numYears": 4
  },
  "direction": "↑",
  "directionLabel": "improving",
  "consistency": 85,
  "projection": {
    "value1y": 14.1,
    "value2y": 15.8,
    "confidence": "high"
  },
  "description": "Revenue grew at 12.5% annually over 4 years, with consistent upward trajectory (85% consistency). If trend continues, 2024 revenue could grow 14.1%."
}
```

### Aggregated Trends Response
```json
{
  "ticker": "AAPL",
  "period": {
    "startYear": 2019,
    "endYear": 2023,
    "numYears": 4
  },
  "growthMetrics": {
    "revenueCAGR": 12.5,
    "netIncomeCAGR": 15.2,
    "operatingIncomeCAGR": 14.8,
    "freeCashFlowCAGR": 10.3
  },
  "assetDebtGrowth": {
    "totalDebtGrowth": [3.1, 2.8, -1.5, 0.2],  // YoY %
    "totalEquityGrowth": [5.2, 4.8, 6.1, 5.3],
    "totalAssetsGrowth": [4.1, 3.8, 2.9, 2.8]
  },
  "marginTrends": {
    "grossMargin": {
      "latest": 45.2,
      "direction": "→",
      "consistency": 70,
      "change3y": "+50 bps"
    },
    "operatingMargin": {
      "latest": 30.1,
      "direction": "↑",
      "consistency": 85,
      "change3y": "+200 bps"
    },
    "netMargin": {
      "latest": 25.5,
      "direction": "↑",
      "consistency": 80,
      "change3y": "+150 bps"
    }
  },
  "returnTrends": {
    "roeDirection": "↑ improving",
    "roaDirection": "↑ improving"
  }
}
```

---

## Edge Cases & Error Handling

### Missing Data
```
Scenario: Only 2 years of data available
  → Mark as "Insufficient data for trend analysis; use 2-year pair"
  → CAGR calculated; no trend direction (need 3+ points)
  → No projection (need historical pattern)

Scenario: Middle year missing (e.g., 2019, 2020, 2022, 2023)
  → Skip to adjacent pair (2019 → 2020, 2022 → 2023)
  → Flag data gap in output
```

### Negative Values
```
Scenario: Company has net loss in year 1
  Revenue: 2019: $100M, 2020: -$10M (loss)
  
  → CAGR = undefined (cannot CAGR from positive to negative)
  → Flag as "Loss year; CAGR not calculated"
  → Trend direction: ↓ (deteriorating)
  → Mark as "Recovery from loss" if trending back positive

Scenario: Debt goes negative (net cash position)
  Total Debt: $50M → $0M → -$30M (net cash)
  
  → Debt-to-Equity CAGR = undefined
  → Report as "Transitioned to net cash position"
  → Solvency actually improved; note context
```

### Zero Division
```
Scenario: Revenue = 0 (bankruptcy scenario)
  → Ratios undefined
  → Return "N/A" for all metrics
  → Flag as "Critical: Company insolvent"

Scenario: Equity < 0 (liabilities > assets; balance sheet negative)
  → ROE = undefined (cannot calculate)
  → Solvency critically poor
  → Debt-to-Equity = undefined
  → Flag as "Critical solvency issue"
```

### Volatility Handling
```
Scenario: Metric wildly oscillates
  Revenue Growth: [+20%, -15%, +18%, -12%]
  
  → Consistency = 25% (no clear direction)
  → Direction = "Volatile" or "Erratic"
  → Confidence = Low
  → No forward projection (unreliable)
  → Flag for manual investigation
```

---

## Performance Considerations

### Query Optimization
- **Single DB query:** Retrieve all 5 years in one call (indexed on ticker + year)
- **Caching:** Cache results for 1 hour (trends don't change intraday)
- **Lazy loading:** Only calculate metrics requested (e.g., if frontend only needs CAGR, skip margin trends)

### Calculation Complexity
- Most calculations O(1) or O(n) where n=5 (5 years)
- CAGR, trend detection, consistency all < 1ms
- Total Trend Engine execution: < 50ms (including DB query)

### Projection Accuracy
- Linear projections valid for 1-2 years only
- Beyond 2 years, mark as "speculative"
- Consider adding confidence decay: Year 1 = 90% confidence, Year 2 = 70% confidence

---

## Future Enhancements

### Short-term
1. **Cyclical Detection:** Identify 3-year or 5-year repeating patterns
2. **Inflection Point Detection:** Alert when trend reverses (e.g., margin peaked and now declining)
3. **Anomaly Flagging:** Identify years where metric deviates > 2σ from trend

### Medium-term
4. **Competitive Comparison:** Compare trend to industry benchmark (revenue CAGR: company 8%, industry 12%)
5. **Segment-level Trends:** Break down trends by business segment
6. **Monte Carlo Projection:** Range of outcomes (best/base/worst case) instead of single projection

### Long-term
7. **Predictive Model:** ML-based forecast based on historical patterns
8. **Correlation Analysis:** "When this metric changes, these others typically follow"
9. **Scenario Modeling:** "If revenue CAGR drops to 5%, health score = X"

---

## Testing Strategy

### Unit Tests
```javascript
// Test CAGR calculation
expect(calculateCAGR(100, 200, 4)).toBe(18.9); // ±0.1

// Test edge cases
expect(calculateCAGR(100, -50, 3)).toBe("N/A"); // negative end value
expect(calculateCAGR(0, 100, 3)).toBe("Infinite"); // zero start
expect(calculateCAGR(100, 100, 5)).toBe(0); // flat revenue

// Test trend detection
expect(detectTrend([1, 2, 3, 4])).toEqual({direction: "↑", consistency: 100});
expect(detectTrend([1, 3, 2, 4])).toEqual({direction: "→", consistency: 50});
expect(detectTrend([5, 4, 3, 2, 1])).toEqual({direction: "↓", consistency: 100});
```

### Integration Tests
```javascript
// Test full pipeline
const trends = await calculateTrends("AAPL", 5);
expect(trends).toHaveProperty("growthMetrics");
expect(trends).toHaveProperty("marginTrends");
expect(trends.period.numYears).toBe(4); // 5 data points = 4 periods
```

### Manual Validation
```
Spot check:
1. Calculate CAGR manually for Apple 2019-2023; compare with Athena output
2. Verify trend direction matches visual inspection of data
3. Validate projections using 2023 as base + calculated growth rate
```

---

## Summary

- **Trend Engine** transforms raw financial data into meaningful growth and trend metrics
- **Core calculations:** CAGR, YoY growth, trend direction, consistency, projections
- **Output:** Quantified trends with direction indicators, consistency scores, and forward-looking projections
- **Error handling:** Comprehensive edge cases (missing data, negative values, zero division, volatility)
- **Performance:** Sub-50ms execution including DB query
- **Foundation for:** Insight generation, health score calculation, and financial analysis
