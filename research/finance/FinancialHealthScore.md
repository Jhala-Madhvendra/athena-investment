# Financial Health Score

## Definition

**Financial Health Score** is a composite 0–100 metric that evaluates a company's overall financial strength by combining five critical dimensions:

1. **Profitability** — Can the company generate profits?
2. **Liquidity** — Can the company meet short-term obligations?
3. **Solvency** — Can the company sustain long-term debt levels?
4. **Cash Flow** — Does the company generate cash to fund operations and growth?
5. **Growth** — Is the company expanding or contracting?

**Single Score Formula:**
```
Financial Health Score = 
  (Profitability Score × 0.20) +
  (Liquidity Score × 0.20) +
  (Solvency Score × 0.20) +
  (Cash Flow Score × 0.20) +
  (Growth Score × 0.20)
```

Default weighting is **equal (20% each)**, but users can customize based on their priorities.

---

## Scale & Labels

| Score Range | Label | Color | Meaning |
|-------------|-------|-------|---------|
| **90–100** | **Excellent** | 🟢 Green | Outstanding financial health; minimal risk |
| **75–89** | **Good** | 🟢 Green | Strong financials; low-to-moderate risk |
| **50–74** | **Average** | 🟡 Yellow | Adequate financials; moderate risk; monitor closely |
| **25–49** | **Weak** | 🟠 Orange | Financial challenges; material risk; turnaround needed |
| **0–24** | **Poor** | 🔴 Red | Critical financial distress; bankruptcy risk |

---

## Component Breakdown

### 1. Profitability Score (0–100)

**Measures:** Can the company generate profits?

**Formula:**
```
Profitability Score = Average of:
  - Net Profit Margin normalized to 0–100
  - Return on Equity (ROE) normalized to 0–100
  - Return on Assets (ROA) normalized to 0–100
```

**Normalization:**
- Net Profit Margin: 0% = 0 pts, 10%+ = 100 pts (scale linearly)
- ROE: 0% = 0 pts, 15%+ = 100 pts (15% is excellent for most industries)
- ROA: 0% = 0 pts, 10%+ = 100 pts

**Example:**
```
Company A:
  - Net Margin: 12% → 75 pts
  - ROE: 18% → 100 pts
  - ROA: 8% → 80 pts
  
Profitability Score = (75 + 100 + 80) / 3 = 85 pts
→ "Excellent profitability"
```

**What It Signals:**
- ✓ **Score > 80:** Company converting revenue to profit efficiently; healthy bottom line
- → **50–80:** Adequate profitability; solid but not exceptional
- ✗ **Score < 30:** Company struggling to generate profits; potential operational issues

---

### 2. Liquidity Score (0–100)

**Measures:** Can the company meet short-term obligations?

**Formula:**
```
Liquidity Score = Average of:
  - Current Ratio normalized to 0–100
  - Quick Ratio normalized to 0–100
```

**Normalization:**
```
Ideal Range: 1.0–2.5 (can pay current liabilities 1–2.5x over)

Current Ratio 0.5 → 10 pts (cannot pay all obligations)
Current Ratio 1.0 → 50 pts (can barely pay)
Current Ratio 1.5 → 80 pts (healthy range)
Current Ratio 2.0 → 100 pts (excellent)
Current Ratio > 3.0 → 100 pts (excessive cash, no additional points)
```

**Example:**
```
Company B:
  - Current Ratio: 1.8 → 90 pts
  - Quick Ratio: 1.2 → 70 pts
  
Liquidity Score = (90 + 70) / 2 = 80 pts
→ "Good liquidity; can meet short-term obligations"
```

**What It Signals:**
- ✓ **Score > 75:** Company has sufficient cash/liquid assets; low risk of liquidity crisis
- → **50–75:** Adequate liquidity; typical for operational companies
- ✗ **Score < 40:** Company tight on cash; potential liquidity strain; risk of missing payments

---

### 3. Solvency Score (0–100)

**Measures:** Can the company sustain its debt levels long-term?

**Formula:**
```
Solvency Score = Average of:
  - Debt-to-Equity ratio normalized to 0–100
  - Debt-to-Assets ratio normalized to 0–100
```

**Normalization:**
```
Lower debt = higher score

Debt-to-Equity Ratio:
  - > 3.0 → 10 pts (excessive debt)
  - 2.0 → 30 pts (high leverage)
  - 1.0 → 60 pts (balanced, moderate)
  - 0.5 → 85 pts (conservative)
  - 0.2 → 100 pts (minimal debt, very conservative)
```

**Example:**
```
Company C:
  - Debt-to-Equity: 0.6 → 80 pts
  - Debt-to-Assets: 0.35 → 85 pts
  
Solvency Score = (80 + 85) / 2 = 82.5 pts
→ "Good solvency; debt well-managed"
```

**What It Signals:**
- ✓ **Score > 75:** Company has low debt; sustainable capital structure; minimal default risk
- → **50–75:** Moderate debt; typical for companies with credit facilities
- ✗ **Score < 40:** Company heavily leveraged; high default risk; vulnerable to interest rate spikes

---

### 4. Cash Flow Score (0–100)

**Measures:** Does the company generate cash to fund operations and growth?

**Formula:**
```
Cash Flow Score = Average of:
  - Free Cash Flow (FCF) trend normalized to 0–100
  - Operating Cash Flow trend normalized to 0–100
```

**Normalization:**
```
Positive FCF = healthier; growing FCF = best

FCF CAGR:
  - Negative (burning cash) → 0–20 pts
  - 0% (flat) → 40 pts
  - 5% (modest growth) → 60 pts
  - 10% (strong growth) → 85 pts
  - 15%+ (exceptional) → 100 pts
  
Plus: Operating CF positive? Add 10 pts; Negative? Subtract 20 pts
```

**Example:**
```
Company D:
  - FCF CAGR: 8% → 75 pts
  - Operating CF: Positive & growing → +10 pts → 85 pts
  
Cash Flow Score = (75 + 85) / 2 = 80 pts
→ "Good cash generation; company funding itself"
```

**What It Signals:**
- ✓ **Score > 80:** Company generates strong, sustainable cash; low bankruptcy risk
- → **50–80:** Adequate cash flow; can fund operations and modest growth
- ✗ **Score < 40:** Company struggling to generate cash; burning cash; needs external funding

---

### 5. Growth Score (0–100)

**Measures:** Is the company expanding or contracting?

**Formula:**
```
Growth Score = Average of:
  - Revenue CAGR normalized to 0–100
  - Net Income CAGR normalized to 0–100
```

**Normalization:**
```
Revenue CAGR:
  - Negative (declining) → 0 pts
  - 0–2% (flat/mature) → 20 pts
  - 2–5% (modest growth, GDP-like) → 40 pts
  - 5–10% (healthy growth) → 60 pts
  - 10–15% (strong growth) → 80 pts
  - 15%+ (high growth) → 100 pts

Net Income CAGR: Same scale as revenue
```

**Example:**
```
Company E:
  - Revenue CAGR: 12% → 80 pts
  - Net Income CAGR: 15% → 100 pts
  
Growth Score = (80 + 100) / 2 = 90 pts
→ "Excellent growth trajectory"
```

**What It Signals:**
- ✓ **Score > 80:** Company expanding rapidly; strong market position; growth continuation likely
- → **50–80:** Adequate growth; outpacing inflation and mature markets
- ✗ **Score < 30:** Company stagnant or contracting; market share loss; turnaround needed

---

## Health Score Calculation Workflow

### Step 1: Calculate Component Scores
```
Input: Financial statements (5 years)

Calculate:
  1. Profitability Score (using net margin, ROE, ROA)
  2. Liquidity Score (using current ratio, quick ratio)
  3. Solvency Score (using debt/equity, debt/assets)
  4. Cash Flow Score (using FCF & Operating CF trends)
  5. Growth Score (using revenue & net income CAGR)
```

### Step 2: Apply Weighting
```
Default weighting (balanced):
  Health Score = 
    (Profitability × 0.20) +
    (Liquidity × 0.20) +
    (Solvency × 0.20) +
    (Cash Flow × 0.20) +
    (Growth × 0.20)

Alternative: Growth-Focused Weighting
  Health Score = 
    (Profitability × 0.25) +
    (Liquidity × 0.15) +
    (Solvency × 0.15) +
    (Cash Flow × 0.15) +
    (Growth × 0.30)
```

### Step 3: Assign Label & Color
```
Score = 82
→ Label: "Good"
→ Color: Green (75–89 range)
→ Risk Level: Low-to-Moderate
```

### Step 4: Generate Explanation
```
"Financial Health Score: 82 (Good)

Strengths:
  • Profitability: 85 (Excellent margins and returns)
  • Cash Flow: 80 (Strong cash generation)

Concerns:
  • Growth: 45 (Revenue growth slowing)

Overall: Company is financially healthy with strong operational metrics. 
Primary concern is slowing growth, which could pressure long-term value.
"
```

---

## Weighting Strategies

### Default: Balanced (20% each)
- Best for: General-purpose investment screening
- Assumes: All factors equally important
- Suitable for: Most industries and investor types

### Growth-Focused (30% growth, 25% profitability, 15% others)
- Best for: Growth investors, venture/emerging markets
- Assumes: Top-line growth is primary value driver
- Suitable for: Tech, biotech, high-growth sectors
- Example: Prefers 90-point Growth, 60-point Liquidity score company

### Safety-Focused (30% liquidity, 25% solvency, 25% profitability, 15% others)
- Best for: Conservative investors, bond analysts, risk-averse portfolios
- Assumes: Downside protection is paramount
- Suitable for: Financial institutions, retirees, value investors
- Example: Prefers 90-point Liquidity, 60-point Growth company

### Custom (User-defined)
- Best for: Specific investment theses or industry-specific priorities
- Example: "Banks value solvency (40%) + liquidity (35%) over growth (5%)"

---

## Investor Importance

### Portfolio Screening
Investors use health score as a **quick filter**:
- Score > 75? → "Qualifies for consideration"
- Score < 40? → "High risk, skip or deep-dive investigation"

### Risk Assessment
Health score components reveal **specific risks**:
- High profitability, low liquidity → Cash management risk
- High liquidity, low growth → Mature/stagnant company
- High growth, low solvency → Unsustainable leverage risk

### Comparative Analysis
Health score enables **ranking across companies**:
- "Of 50 tech companies, Apple ranks #3 in health score"
- Benchmarking against peers reveals competitive position

### Due Diligence
Investors drill into **low scores** for root causes:
- Score = 35? → Which component is dragging? (usually solvency or growth)
- Is it temporary (COVID impact) or structural (business model issue)?

---

## Future Features Depending On It

### Short-term (Sprint 3-4)
1. **Historical Score Tracking:** Show health score trend (improving/declining over 3-5 years)
2. **Peer Comparison:** "This company's score = 75, peer average = 68 → Above average health"
3. **Industry Benchmarking:** "Tech industry average = 70; this company = 75 → Slightly better than peers"

### Medium-term (Sprint 5-6)
4. **Score Forecast:** "If current trends continue, health score will be 65 by 2025"
5. **Risk Heatmap:** Identify which components have deteriorated most
6. **Sensitivity Analysis:** "If debt increases by 20%, health score drops to 72; if revenue CAGR continues, score improves to 85"

### Long-term (Future)
7. **Machine Learning Prediction:** "Companies with score trend like this historically outperform/underperform by X%"
8. **Trigger Alerts:** "Health score dropped 10 points quarter-over-quarter → investigate"
9. **Peer Percentile Ranking:** Show what percentile company ranks in vs. industry peers
10. **Recovery Scenarios:** "To improve health score to 80, company needs to reduce debt by $X or improve margins by Y%"

---

## Example Scenarios

### Scenario 1: Excellent Health (Score = 92)
```
Company: Apple
Profitability: 95 (Exceptional margins: 30%+ net margin, 100%+ ROE)
Liquidity: 88 (Strong current ratio: 2.1)
Solvency: 90 (Low debt-to-equity: 0.3)
Cash Flow: 95 (Strong FCF generation: 25% CAGR)
Growth: 85 (Solid growth: 8% revenue CAGR, 12% earnings)

Label: Excellent (90–100)
Color: Green
Interpretation:
✓ Financial fortress; minimal risk
✓ All components strong; no weak points
✓ Can fund growth, pay dividends, weather downturns
```

### Scenario 2: Average Health (Score = 58)
```
Company: Regional Bank
Profitability: 65 (Modest margins: 15% net margin, 10% ROE)
Liquidity: 55 (Adequate ratio: 1.2)
Solvency: 48 (Elevated leverage: debt-to-equity = 1.5)
Cash Flow: 60 (Adequate FCF: 3% CAGR)
Growth: 55 (Slow growth: 2% revenue CAGR)

Label: Average (50–74)
Color: Yellow
Interpretation:
→ Operational company; typical for industry
⚠ Solvency and growth are concerns
→ Stable but not expanding
→ Watch for rising rates (impacts margins) or loan quality deterioration
```

### Scenario 3: Poor Health (Score = 28)
```
Company: Struggling Retailer
Profitability: 15 (Significant losses: -5% net margin)
Liquidity: 42 (Tight: current ratio = 0.9)
Solvency: 20 (Overleveraged: debt-to-equity = 3.2)
Cash Flow: 10 (Negative FCF: burning cash at 8% annually)
Growth: 8 (Severe contraction: revenue CAGR = -12%)

Label: Poor (0–24)
Color: Red
Interpretation:
✗ Financial distress; bankruptcy risk
✗ Multiple critical weaknesses
✗ Company losing money, burning cash, heavily indebted
→ Turnaround or restructuring required
→ High-risk investment; recovery uncertain
```

---

## Calculation Considerations

### Data Completeness
- **All 5 years required?** Prefer yes; minimum 2 years acceptable (noted in output)
- **Missing a metric?** Exclude from calculation; reduce score appropriately (flag as "Partial Health Score")

### Normalization Approach
- **Why normalize to 0–100?** Allows combining metrics with different units (percentages, ratios, growth rates)
- **Why not use raw values?** Ratios are not comparable directly (ROE 50% ≠ liquidity score of 50)

### Industry Variations
- Financial institutions: Adjust solvency weighting (banks naturally have high leverage)
- Growth startups: Adjust growth weighting higher (negative profitability typical)
- Utilities: Adjust profitability lower (regulated, lower margins typical)

---

## Summary

- **Financial Health Score** combines five critical dimensions into a single 0–100 metric
- **Labels** (Excellent/Good/Average/Weak/Poor) provide intuitive interpretation
- **Weighting** is configurable: balanced (default), growth-focused, safety-focused, or custom
- **Investors use it** for portfolio screening, risk assessment, and benchmarking
- **Athena calculates it** by normalizing component scores and applying user-selected weighting
- **Foundation for** risk assessment, comparative analysis, and portfolio decision-making
