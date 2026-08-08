# Scoring Engine Architecture

## Overview

**Scoring Engine** combines five independent component scores (Profitability, Liquidity, Solvency, Cash Flow, Growth) into a composite 0–100 Financial Health Score. It handles normalization, weighting, label assignment, and explanation generation.

**Input:** Financial ratios and trend metrics
**Output:** Component scores, composite score, label, color, and explanation

---

## Core Responsibilities

1. **Component Scoring**
   - Calculate 5 independent component scores (0–100 each)
   - Normalize diverse metrics to common scale
   - Handle missing/invalid data gracefully

2. **Composite Weighting**
   - Apply user-selected weighting strategy
   - Validate weights sum to 100%
   - Support default + custom weights

3. **Score Interpretation**
   - Assign label (Excellent/Good/Average/Weak/Poor)
   - Assign color (Green/Yellow/Orange/Red)
   - Map risk level (Low/Moderate/High/Critical)

4. **Explanation Generation**
   - Identify component strengths and weaknesses
   - Generate natural-language summary
   - Explain score reasoning

5. **Sensitivity Analysis** (Future)
   - "What if" scenarios
   - Which component has biggest impact?
   - Improvement paths

---

## Component Scoring Details

### 1. Profitability Score Calculation

**Metrics Used:**
- Net Profit Margin
- Return on Equity (ROE)
- Return on Assets (ROA)

**Normalization:**
```
Net Profit Margin (0–100):
  0% margin → 0 points
  5% margin → 50 points
  10% margin → 100 points
  Linear interpolation between points
  
  Capped at 100 (>10% margin = 100 points, not more)
  Handle negative margins: -10% margin → 0 points (cannot be below zero)

ROE (0–100):
  0% ROE → 0 points
  7.5% ROE → 50 points (half of 15%)
  15% ROE → 100 points (excellent threshold)
  
  Linear interpolation between 0–15% range
  Capped at 100 (>15% = 100 points)
  Negative ROE → 0 points

ROA (0–100):
  0% ROA → 0 points
  5% ROA → 50 points (half of 10%)
  10% ROA → 100 points (excellent threshold)
  
  Linear interpolation between 0–10% range
  Capped at 100 (>10% = 100 points)
  Negative ROA → 0 points
```

**Calculation:**
```
Profitability Score = (NetMarginScore + ROEScore + ROAScore) / 3

Example:
  Net Margin: 12% → 100 pts
  ROE: 18% → 100 pts (>15%)
  ROA: 8% → 80 pts
  
  Profitability = (100 + 100 + 80) / 3 = 93.3
```

**Interpretation:**
- Score > 80: Excellent profitability, converting revenue efficiently to profits
- 60–80: Good profitability, solid operational performance
- 40–60: Average profitability, adequate but not exceptional
- 20–40: Weak profitability, operational challenges
- < 20: Poor profitability, company unprofitable or nearly so

---

### 2. Liquidity Score Calculation

**Metrics Used:**
- Current Ratio
- Quick Ratio

**Normalization:**
```
Current Ratio (0–100):
  Ideal range: 1.0–2.5 (can pay current liabilities 1–2.5x)
  
  0.5 → 10 points (cannot pay obligations)
  1.0 → 50 points (can barely meet obligations)
  1.5 → 75 points (healthy range)
  2.0 → 100 points (excellent)
  2.5+ → 100 points (capped, excessive cash)
  
  Below 1.0: 10 + (CurrentRatio - 0.5) * 80
  Between 1.0–2.5: 50 + (CurrentRatio - 1.0) * 20
  Above 2.5: 100

Quick Ratio (0–100):
  Ideal range: 0.8–2.0 (most liquid assets vs. current liabilities)
  
  0.5 → 10 points
  0.8 → 50 points
  1.2 → 75 points
  1.5+ → 100 points
  
  Below 0.8: 10 + (QuickRatio - 0.5) * (40 / 0.3)
  Between 0.8–1.5: 50 + (QuickRatio - 0.8) * (50 / 0.7)
  Above 1.5: 100
```

**Calculation:**
```
Liquidity Score = (CurrentRatioScore + QuickRatioScore) / 2

Example:
  Current Ratio: 1.8 → 90 pts
  Quick Ratio: 1.1 → 70 pts
  
  Liquidity = (90 + 70) / 2 = 80
```

**Interpretation:**
- Score > 75: Strong liquidity, minimal short-term financial risk
- 50–75: Adequate liquidity, typical for operational companies
- 25–50: Tight liquidity, monitor cash closely
- < 25: Liquidity crisis, cannot meet short-term obligations

---

### 3. Solvency Score Calculation

**Metrics Used:**
- Debt-to-Equity Ratio
- Debt-to-Assets Ratio

**Normalization:**
```
Debt-to-Equity Ratio (0–100):
  Lower debt = higher score
  
  > 3.0 → 10 points (excessive leverage)
  2.5 → 20 points
  2.0 → 30 points (high leverage)
  1.5 → 50 points (moderate)
  1.0 → 65 points (balanced)
  0.5 → 85 points (conservative)
  0.0–0.2 → 100 points (minimal debt)
  
  > 2.5: 10 + min(90, (2.5 - D/E) * 30) where D/E > 2.5 reduces from 10
  2.0–2.5: 30 + ((2.5 - D/E) / 0.5) * 10
  1.0–2.0: 30 + ((2.0 - D/E) / 1.0) * 35
  0.5–1.0: 65 + ((1.0 - D/E) / 0.5) * 20
  < 0.5: 85 + ((0.5 - D/E) / 0.5) * 15

Debt-to-Assets Ratio (0–100):
  Lower debt = higher score
  Optimal range: 0.3–0.6 (30–60% liabilities)
  
  > 0.8 → 10 points (overleveraged)
  0.7 → 25 points
  0.6 → 50 points (balanced)
  0.5 → 70 points
  0.4 → 85 points
  < 0.3 → 100 points (conservative)
  
  Similar linear interpolation between ranges
```

**Calculation:**
```
Solvency Score = (D/EScore + D/AScore) / 2

Example:
  Debt-to-Equity: 0.8 → 75 pts
  Debt-to-Assets: 0.45 → 85 pts
  
  Solvency = (75 + 85) / 2 = 80
```

**Interpretation:**
- Score > 75: Conservative capital structure, minimal default risk
- 50–75: Moderate leverage, typical for many industries
- 25–50: High leverage, elevated risk
- < 25: Excessive leverage, critical solvency risk

---

### 4. Cash Flow Score Calculation

**Metrics Used:**
- Free Cash Flow CAGR (5-year trend)
- Operating Cash Flow trend

**Normalization:**
```
Free Cash Flow CAGR (0–100):
  Negative CAGR (burning cash) → 0–20 pts
  0–2% (minimal growth) → 20–40 pts
  2–5% (modest growth) → 40–60 pts
  5–10% (healthy growth) → 60–85 pts
  10%+ (strong growth) → 85–100 pts
  
  < 0%: 0 + min(20, FCF_CAGR * 10)  // e.g., -5% → 0 points
  0–2%: 20 + (FCF_CAGR / 2) * 20
  2–5%: 40 + ((FCF_CAGR - 2) / 3) * 20
  5–10%: 60 + ((FCF_CAGR - 5) / 5) * 25
  10%+: 85 + min(15, (FCF_CAGR - 10))

Operating Cash Flow:
  Positive & growing → +15 points
  Positive & flat → +8 points
  Positive & declining → 0 points
  Negative → -20 points (company burning cash)
```

**Calculation:**
```
Cash Flow Score = FCF_CAGR_Score + OCF_Adjustment
  (capped at 0–100)

Example:
  FCF CAGR: 7% → 70 pts
  Operating CF: Positive & growing → +15 pts
  
  Cash Flow = min(100, 70 + 15) = 85
  
  OR
  
  FCF CAGR: -2% → 0 pts
  Operating CF: Negative → -20 pts
  
  Cash Flow = max(0, 0 - 20) = 0
```

**Interpretation:**
- Score > 80: Strong cash generation, self-funding operations and growth
- 50–80: Adequate cash flow, supporting operations and modest capex
- 25–50: Weak cash generation, may need external funding
- < 25: Cash burn, unsustainable without funding

---

### 5. Growth Score Calculation

**Metrics Used:**
- Revenue CAGR (5-year)
- Net Income CAGR (5-year)

**Normalization:**
```
Revenue CAGR (0–100):
  Negative (declining) → 0 pts
  0–2% (flat/mature) → 10–30 pts
  2–5% (modest, GDP-like) → 30–50 pts
  5–10% (healthy) → 50–75 pts
  10–15% (strong) → 75–90 pts
  15%+ (exceptional) → 90–100 pts
  
  < 0%: 0 (revenue declining)
  0–2%: 10 + (Revenue_CAGR / 2) * 20
  2–5%: 30 + ((Revenue_CAGR - 2) / 3) * 20
  5–10%: 50 + ((Revenue_CAGR - 5) / 5) * 25
  10–15%: 75 + ((Revenue_CAGR - 10) / 5) * 15
  15%+: 90 + min(10, (Revenue_CAGR - 15))

Net Income CAGR (0–100):
  Same scale as revenue (growth is growth, regardless of starting profit level)
```

**Calculation:**
```
Growth Score = (Revenue_CAGR_Score + NetIncome_CAGR_Score) / 2

Example:
  Revenue CAGR: 12% → 85 pts
  Net Income CAGR: 15% → 95 pts
  
  Growth = (85 + 95) / 2 = 90

Example 2:
  Revenue CAGR: 8% → 62.5 pts
  Net Income CAGR: -3% → 0 pts
  
  Growth = (62.5 + 0) / 2 = 31.25
```

**Interpretation:**
- Score > 80: Exceptional growth, company expanding rapidly
- 60–80: Strong growth, outpacing GDP and most peers
- 40–60: Moderate growth, typical for mature companies
- 20–40: Slow/weak growth, company stagnating or declining
- < 20: Severe decline, business contracting

---

## Composite Score Calculation

### Step 1: Normalize Component Scores
```
All components are already 0–100, so no additional normalization needed.
```

### Step 2: Apply Weighting

**Default Weighting (Balanced):**
```
Composite = 
  (Profitability × 0.20) +
  (Liquidity × 0.20) +
  (Solvency × 0.20) +
  (CashFlow × 0.20) +
  (Growth × 0.20)
```

**Alternative: Growth-Focused Weighting**
```
Composite = 
  (Profitability × 0.25) +
  (Liquidity × 0.15) +
  (Solvency × 0.15) +
  (CashFlow × 0.15) +
  (Growth × 0.30)
```

**Alternative: Safety-Focused Weighting**
```
Composite = 
  (Profitability × 0.25) +
  (Liquidity × 0.30) +
  (Solvency × 0.25) +
  (CashFlow × 0.15) +
  (Growth × 0.05)
```

**Custom Weighting (User-defined):**
```
Composite = 
  (Profitability × w1) +
  (Liquidity × w2) +
  (Solvency × w3) +
  (CashFlow × w4) +
  (Growth × w5)
  
  where w1 + w2 + w3 + w4 + w5 = 1.0
  
Validation:
  if sum(weights) != 1.0:
    normalize: weight = weight / sum(weights)
  if any weight < 0 or > 1:
    reject: "Invalid weights"
```

### Step 3: Assign Label & Color

**Score → Label Mapping:**
```
90–100: Excellent (🟢 Green)
  - Outstanding financial health
  - Minimal risk, strong across all dimensions
  
75–89: Good (🟢 Green)
  - Strong financials, solid fundamentals
  - Low-to-moderate risk
  
50–74: Average (🟡 Yellow)
  - Adequate financials, typical for industry
  - Moderate risk, monitor closely
  
25–49: Weak (🟠 Orange)
  - Financial challenges, concerning metrics
  - Material risk, potential turnaround needed
  
0–24: Poor (🔴 Red)
  - Critical financial distress
  - Bankruptcy risk, intervention required
```

### Step 4: Generate Explanation

**Template Structure:**
```
{
  "overallScore": 82,
  "label": "Good",
  "color": "green",
  "riskLevel": "Low-to-Moderate",
  
  "summary": "[1–2 sentence summary of financial health]",
  "strengths": "[List of strong components with scores]",
  "concerns": "[List of weak/concerning components]",
  "outlook": "[Forward-looking statement based on trends]"
}

Example Response:
{
  "overallScore": 82,
  "label": "Good",
  "color": "green",
  "riskLevel": "Low-to-Moderate",
  
  "summary": "Apple demonstrates strong financial health with solid operational metrics and efficient capital deployment.",
  
  "strengths": [
    "Profitability: 85 (Excellent) - Strong margins and shareholder returns",
    "Cash Flow: 80 (Good) - Generating substantial cash from operations",
    "Growth: 85 (Excellent) - Consistent revenue and earnings expansion"
  ],
  
  "concerns": [
    "Liquidity: 62 (Average) - Current ratio below ideal, though not critical"
  ],
  
  "outlook": "With strong profitability and growth, Apple is well-positioned for continued expansion. Monitor liquidity trends for potential optimization opportunities."
}
```

---

## Edge Cases & Error Handling

### Missing Component Data
```
Scenario: Cannot calculate ROE (no equity data)
  → Profitability Score = Average of (Net Margin, ROA) instead of 3 metrics
  → Flag in output: "Score based on 2 of 3 profitability metrics"
  → Confidence reduced (note: partial score)

Scenario: Multiple components missing
  → Return "Incomplete Financial Health Score"
  → Recommend user ensure balance sheet data is available
  → Still calculate available components
```

### Invalid Ratios
```
Scenario: Debt-to-Equity = negative (net cash position)
  → Handle as: D/E = 0 (actually better than zero debt)
  → Solvency Score = 100 (net cash = best position)
  → Note: "Company has net cash position"

Scenario: Current Ratio = 0 (impossible, but data error)
  → Return "Invalid liquidity data; unable to calculate score"
  → Flag data quality issue
```

### Extreme Values
```
Scenario: Net Margin = 80% (typical for software)
  → Score = 100 (already capped)
  → Not a problem; correct behavior

Scenario: Revenue CAGR = 150% (unrealistic)
  → Score = 100 (capped at growth)
  → Note: "Exceptional growth; verify data"
```

### Custom Weights Validation
```
Scenario: User provides weights [0.3, 0.2, 0.2, 0.2, 0.1]
  → Sum = 1.0 ✓
  → Accept and apply

Scenario: User provides weights [0.25, 0.25, 0.25, 0.25]
  → Sum = 1.0, but only 4 components (need 5)
  → Reject: "Must provide weights for all 5 components"

Scenario: User provides weights [0.30, 0.30, 0.20, 0.15, 0.10]
  → Sum = 1.05 (not exactly 1.0)
  → Normalize: Divide each by 1.05
  → Proceed with normalized weights [0.286, 0.286, 0.190, 0.143, 0.095]
```

---

## Sensitivity Analysis (Future Feature)

**Calculate impact of each component:**
```
Impact Score = |Component Score - Weighted Contribution|

Example:
  Profitability: 85, weight 20% → Contribution = 17 points
  if we changed Profitability to 100 → Contribution = 20 points
  → Impact = 3 points (modest impact on overall score)
  
  vs.
  
  Growth: 40, weight 30% (growth-focused) → Contribution = 12 points
  if we changed Growth to 100 → Contribution = 30 points
  → Impact = 18 points (major impact on overall score)
  
Result: Growth has biggest leverage on score in growth-focused weighting
```

---

## Performance Optimization

### Calculation Complexity
```
1. Calculate 5 component scores: O(15 divisions + arithmetic) ≈ O(1)
2. Apply weighting: O(5 multiplications + 4 additions) ≈ O(1)
3. Assign label: O(1) lookup
4. Generate explanation: O(1) template filling

Total: < 5ms for complete score + explanation
```

### Caching Strategy
- Cache component normalization thresholds (static)
- Cache label mappings (static)
- Don't cache composite score (depends on real-time metrics)

---

## Testing Strategy

### Unit Tests
```javascript
// Test normalization
expect(normalizeNetMargin(12)).toBe(100); // 12% → 100 pts
expect(normalizeNetMargin(5)).toBe(50); // 5% → 50 pts
expect(normalizeNetMargin(-5)).toBe(0); // -5% → 0 pts

// Test composite calculation
const components = {profitability: 85, liquidity: 80, solvency: 75, cashflow: 70, growth: 90};
const weights = {profitability: 0.2, liquidity: 0.2, solvency: 0.2, cashflow: 0.2, growth: 0.2};
expect(calculateComposite(components, weights)).toBe(80); // (85+80+75+70+90)/5

// Test label assignment
expect(getLabel(95)).toBe("Excellent");
expect(getLabel(82)).toBe("Good");
expect(getLabel(50)).toBe("Average");
```

### Integration Tests
```javascript
// Full pipeline
const financials = {netMargin: 12, roe: 18, roa: 8, ...};
const score = calculateHealthScore(financials);
expect(score.overall).toBeGreaterThan(0);
expect(score.overall).toBeLessThanOrEqual(100);
expect(score.label).toBeDefined();
expect(score.explanation).toContain(score.label);
```

---

## Summary

- **Scoring Engine** normalizes 5 component metrics (0–100 each)
- **Components:** Profitability, Liquidity, Solvency, Cash Flow, Growth
- **Composite calculation:** Weighted average of components (default 20% each)
- **Weighting:** Default, preset strategies, or custom user-defined
- **Output:** Score (0–100), label (Excellent/Good/Average/Weak/Poor), color, explanation
- **Handles edge cases:** Missing data, negative values, extreme outliers, validation errors
- **Performance:** < 5ms calculation + explanation
- **Foundation for:** Financial health assessment, portfolio screening, risk analysis
