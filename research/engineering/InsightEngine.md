# Insight Engine Architecture

## Overview

**Insight Engine** transforms quantitative trend metrics into human-readable, actionable business insights. It generates 5–7 key insights by evaluating rules based on trend data and presenting findings in investor-friendly language.

**Input:** Trend metrics (CAGR, margin trends, growth rates, ratios)
**Output:** 5–7 text insights with context and confidence scores

---

## Core Responsibilities

1. **Insight Rule Evaluation**
   - Evaluate 7 predefined rule sets
   - Check conditions: CAGR ranges, margin changes, ratio thresholds
   - Determine which insights apply

2. **Insight Prioritization**
   - Select top 5–7 most relevant insights
   - Prioritize: Growth > Profitability > Solvency > Liquidity > Stability
   - Exclude low-confidence insights

3. **Text Generation**
   - Use pre-written templates for each insight category
   - Fill in metric values and trends
   - Personalize context (e.g., "over the last 5 years")

4. **Confidence Scoring**
   - Rate each insight's reliability (0–100)
   - Based on metric consistency and rule trigger strength
   - Flag low-confidence insights with caveats

5. **Context Enrichment**
   - Add business meaning (what does this insight mean?)
   - Add investor importance (why should investor care?)
   - Add forward-looking statement (what could this lead to?)

---

## Insight Categories (7 Total)

### 1. Revenue Growth Insight
**Rule Triggers:**
```
Excellent Growth (✓):
  - Revenue CAGR ≥ 15%
  - Last 2 years growth > 10%
  - Consistency ≥ 75%

Strong Growth (✓):
  - Revenue CAGR 10–14%
  - Consistency ≥ 70%

Moderate Growth (→):
  - Revenue CAGR 5–9%
  - Typical for mature companies

Slow/No Growth (⚠):
  - Revenue CAGR 0–4%
  - Company stagnating

Declining (✗):
  - Revenue CAGR < 0%
  - Market share loss or industry headwind
```

**Template Examples:**
```
(Excellent)
"Revenue has grown consistently at {CAGR}% annually over the past {years} years, 
demonstrating strong market demand and business expansion."

(Moderate)
"{Company} revenue is growing at {CAGR}%, in line with mature business expectations. 
Growth is stable but not exceptional."

(Declining)
"Revenue has contracted {abs(CAGR)}% annually, indicating market share loss or industry 
headwinds. Turnaround strategy needed."
```

**Confidence Factors:**
- High: Consistency > 80%, CAGR clear and positive
- Medium: Consistency 60–80%, some volatility
- Low: Consistency < 60%, erratic pattern

---

### 2. Profit Efficiency Insight
**Rule Triggers:**
```
Improving (✓):
  - Net margin + Operating margin both improving
  - OR Operating leverage evident (margin growth > revenue growth)
  - Consistency ≥ 70%

Stable (→):
  - Margins within ±50 bps over 3 years
  - Predictable profitability

Declining (✗):
  - Net margin declining for 2+ consecutive years
  - Cost pressures evident
  - Margins down > 100 bps
```

**Template Examples:**
```
(Improving)
"Profitability is improving: operating margin expanded {bps} basis points over {years} years. 
This suggests strong cost management and operating leverage as the business scales."

(Declining)
"Operating margins are under pressure, declining {abs(bps)} basis points. 
This may reflect rising input costs, competitive pricing pressure, or higher operating expenses."

(Stable)
"Profit margins are stable at {margin}%, reflecting consistent operational control and 
predictable business model."
```

**Confidence Factors:**
- High: Multiple margin metrics moving in same direction
- Medium: One margin improving, others stable
- Low: Contradictory signals (gross margin up, net margin down)

---

### 3. Debt Position Insight
**Rule Triggers:**
```
Well-Managed (✓):
  - Debt-to-Equity < 0.5
  - Debt declining or stable
  - Interest coverage > 5x (implied from profitability)

Moderate (→):
  - Debt-to-Equity 0.5–1.5
  - Manageable debt levels

Rising Rapidly (⚠):
  - Debt-to-Equity 1.5–2.5
  - Debt growth > revenue growth
  - OR Debt growing while revenue stagnant

Excessive (✗):
  - Debt-to-Equity > 2.5
  - Solvency risk
  - OR Debt growing faster than revenue AND equity shrinking
```

**Template Examples:**
```
(Well-Managed)
"{Company}'s debt-to-equity ratio of {ratio} indicates conservative capital structure. 
Debt is well-managed relative to equity base."

(Rising Rapidly)
"Debt has increased {growth_rate}% while revenue grew only {revenue_growth}%. 
This suggests rising financial risk and potentially reduced flexibility."

(Excessive)
"Debt levels are elevated at {debt_amount}B with debt-to-equity of {ratio}. 
This leaves limited borrowing capacity and exposes the company to interest rate risk."
```

**Confidence Factors:**
- High: Debt trend clear, multiple years consistent
- Medium: Recent shift in leverage (e.g., acquisition-related)
- Low: Insufficient data or contradictory signals

---

### 4. Cash Generation Insight
**Rule Triggers:**
```
Strong (✓):
  - Free Cash Flow CAGR ≥ 8%
  - FCF positive and growing
  - Operating CF > Net Income (cash conversion strong)

Adequate (→):
  - FCF CAGR 2–7%
  - FCF positive but modest growth
  - Company funding operations and modest capex

Weak (⚠):
  - FCF CAGR < 2%
  - OR FCF declining
  - Company barely converting profits to cash

Burning Cash (✗):
  - FCF negative
  - Company consuming cash despite profitability
  - Unsustainable without external funding
```

**Template Examples:**
```
(Strong)
"The company generates strong free cash flow of {fcf}B, growing at {cagr}% annually. 
This cash generation funds growth investments and shareholder returns."

(Adequate)
"Free cash flow is positive at {fcf}B, enabling the company to self-fund operations 
and modest capital investments."

(Burning Cash)
"Despite {profit}B in net income, free cash flow is negative at {fcf}B. 
This indicates heavy capital expenditures or working capital challenges."
```

**Confidence Factors:**
- High: FCF consistently positive, growing trend clear
- Medium: FCF positive but volatile
- Low: FCF sometimes negative, or recently shifted negative

---

### 5. Return on Investment Insight
**Rule Triggers:**
```
Excellent (✓):
  - ROE ≥ 15% or improving trend
  - ROA ≥ 10% or improving trend

Good (✓):
  - ROE 10–14%
  - ROA 6–9%
  - Solid returns for shareholders/assets

Fair (→):
  - ROE 5–9%
  - ROA 3–5%
  - Below average returns

Weak (✗):
  - ROE < 5% or declining
  - ROA < 3%
  - Poor capital deployment
```

**Template Examples:**
```
(Excellent)
"Return on equity of {roe}% indicates strong profitability relative to shareholder capital. 
The company is deploying capital efficiently and generating shareholder value."

(Declining)
"ROE has declined from {past_roe}% to {current_roe}%. 
This suggests deteriorating capital efficiency, possibly due to declining profitability 
or increased leverage."

(Weak)
"ROA of {roa}% is below industry average, indicating the company is not efficiently 
deploying its asset base to generate profits."
```

**Confidence Factors:**
- High: ROE/ROA trend clear and sustained
- Medium: Recent improvement/decline (1–2 years)
- Low: ROE/ROA volatile or near zero

---

### 6. Liquidity Position Insight
**Rule Triggers:**
```
Strong (✓):
  - Current Ratio > 2.0
  - Quick Ratio > 1.5
  - No liquidity concerns

Adequate (→):
  - Current Ratio 1.2–2.0
  - Quick Ratio 0.9–1.5
  - Typical for healthy companies

Tight (⚠):
  - Current Ratio 0.9–1.2
  - Quick Ratio < 0.9
  - Watch for cash flow stress

Risky (✗):
  - Current Ratio < 0.9
  - Cannot pay current liabilities
  - Liquidity crisis risk
```

**Template Examples:**
```
(Strong)
"Strong liquidity position: current ratio of {ratio} means the company can cover 
current liabilities {multiple}x over. Minimal short-term financial stress."

(Tight)
"Liquidity is tight with current ratio of {ratio}. While not critical, this warrants 
monitoring for cash flow pressures."

(Risky)
"Current ratio below 1.0 indicates the company cannot cover all current liabilities 
with current assets. Immediate liquidity risk."
```

**Confidence Factors:**
- High: Liquidity metrics consistent across time
- Medium: Ratios adequate but near warning thresholds
- Low: Ratios near critical levels; close monitoring needed

---

### 7. Overall Stability Insight
**Rule Triggers:**
```
Consistent & Predictable (✓):
  - Most metrics showing clear trends
  - Consistency scores mostly > 75%
  - Few contradictory signals

Stable but Uneven (→):
  - Some metrics strong, others weak
  - Consistency scores 60–75%
  - No obvious turnaround or deterioration

Volatile/Uncertain (⚠):
  - Multiple erratic metrics
  - Consistency scores < 60%
  - Difficult to forecast
  - Potential inflection points

Deteriorating (✗):
  - Multiple metrics declining simultaneously
  - Negative signals outweigh positive
  - Potential crisis or turnaround needed
```

**Template Examples:**
```
(Consistent)
"Financial performance is consistent and predictable across all key metrics. 
Investors can reasonably forecast future results based on historical patterns."

(Volatile)
"{Company} shows inconsistent financial performance with erratic metrics. 
This creates forecasting uncertainty and warrants close monitoring."

(Deteriorating)
"Multiple financial metrics are deteriorating simultaneously: revenue growth slowing, 
margins declining, and cash flow tightening. Business faces headwinds."
```

**Confidence Factors:**
- High: Multiple independent metrics showing same direction
- Medium: Most metrics aligned, some outliers
- Low: Contradictory signals across metrics

---

## Insight Selection & Prioritization

### Prioritization Rules
1. **Always include** most extreme insights (very strong or very weak)
   - Example: "Revenue declining 15% CAGR" (always flag)
   - Example: "ROE declining from 20% to 8%" (always flag)

2. **Include if confidence > 70%**
   - Medium-confidence insights included if they address key investor concerns
   - Example: "Debt rising 8% while revenue flat" (medium confidence, high importance)

3. **Prioritize by investor interest**
   ```
   Tier 1 (Always include): Growth, Profitability, Solvency
   Tier 2 (Include if notable): Cash Flow, Returns, Liquidity
   Tier 3 (Context-dependent): Stability, Special situations
   ```

4. **Exclude contradictions**
   - If Insight A and B contradict, keep higher-confidence one
   - Example: If some metrics improving but overall declining, keep "Stability" insight noting contradiction

### Example Selection
```
Available Insights:
1. Revenue CAGR = 12% (✓ Excellent) - Confidence 95%
2. Operating Margin improving +150 bps (✓) - Confidence 85%
3. Debt-to-Equity = 0.6 (✓ Well-managed) - Confidence 80%
4. FCF CAGR = 2% (→ Adequate) - Confidence 70%
5. ROE improving from 15% to 18% (✓) - Confidence 90%
6. Current Ratio = 1.4 (→ Adequate) - Confidence 75%
7. Metrics consistent trend (✓) - Confidence 85%

Selected (5–7 total):
→ Insights 1, 2, 3, 5, 7 (top 5, all > 80% confidence)
→ Could include Insight 4 or 6 if pushing to 6–7

Result: 5 key insights (focused, high-confidence)
```

---

## Insight Output Format

### Individual Insight Object
```json
{
  "category": "revenueGrowth",
  "categoryLabel": "Revenue Growth",
  "priority": 1,
  "text": "Revenue has grown consistently at 12.5% annually over the past 4 years, demonstrating strong market demand and business expansion.",
  "confidence": 95,
  "metrics": {
    "cagr": 12.5,
    "consistency": 85,
    "latestGrowth": 13.2,
    "trend": "↑ improving"
  },
  "investorImportance": "Revenue growth is the primary driver of valuation multiples. Consistent growth above GDP suggests strong competitive position.",
  "forward": "If growth continues at this rate, revenue could reach $180B by 2025."
}
```

### Aggregated Insights Response
```json
{
  "ticker": "AAPL",
  "insights": [
    {category: "revenueGrowth", text: "...", confidence: 95, priority: 1},
    {category: "profitMargin", text: "...", confidence: 85, priority: 2},
    {category: "debtPosition", text: "...", confidence: 80, priority: 3},
    {category: "returnOnInvestment", text: "...", confidence: 90, priority: 4},
    {category: "stability", text: "...", confidence: 85, priority: 5}
  ],
  "summary": "Apple demonstrates strong financial health with consistent revenue growth (12.5% CAGR), expanding profitability margins, and well-managed debt levels. Returns to shareholders continue to improve.",
  "riskFactors": [],
  "positiveSignals": 5,
  "negativeSignals": 0,
  "overallSentiment": "Positive"
}
```

---

## Template System

### Template Structure
Each insight category has 3–5 pre-written templates at different intensity levels:

**Example: Revenue Growth Templates**
```javascript
const revenueGrowthTemplates = {
  excellent: {
    strong: "Revenue has grown at {CAGR}% annually, demonstrating exceptional market expansion and strong demand.",
    accelerating: "Revenue growth is accelerating: {latestYear} achieved {latestGrowth}%, up from {priorYear} of {priorGrowth}%.",
    consistent: "Consistent revenue growth of {CAGR}% over {years} years shows a sustainable, predictable business model."
  },
  good: {
    standard: "{Company} revenue is growing at {CAGR}%, above industry average and demonstrating market share gains.",
    lateEntry: "Despite entering market later, {Company} has achieved {CAGR}% revenue CAGR."
  },
  moderate: {
    matureGrowth: "{CAGR}% revenue growth is typical for a mature business in {industry}. Focus shifts to profitability and cash generation.",
    belowExpectation: "At {CAGR}%, revenue growth is below peers ({peerCAGR}%). Investigate competitive position."
  },
  // ... more templates
};
```

### Template Variable Substitution
```javascript
// Variables filled from trend data:
{CAGR} → 12.5
{latestYear} → 2023
{latestGrowth} → 13.2
{priorYear} → 2022
{priorGrowth} → 12.0
{Company} → Apple
{years} → 4
{industry} → Technology
{peerCAGR} → 15.0
```

---

## Edge Cases & Handling

### Missing Metrics
```
Scenario: FCF data not available
  → Skip cash flow insight
  → Don't mark as negative (missing data, not bad data)
  → Reduce total insight count (may result in 4–5 instead of 7)

Scenario: Only 2 years of data
  → Cannot calculate trend (need 3+ points)
  → Use single-year metrics and direction: "latest vs. prior year"
  → Mark confidence < 60%
```

### Contradictory Signals
```
Scenario: Revenue up 10% CAGR, but net income down
  → Generate both insights
  → Add caveat: "Revenue growth not translating to earnings due to margin compression"
  → Prioritize negative signal (earnings more important than revenue)
  → Confidence of "positive" growth insight reduced

Scenario: Debt-to-Equity high (2.5), but declining
  → Generate insight: "Debt remains elevated but trending down"
  → Medium confidence (positive trend, but current level risky)
```

### Low Confidence Insights
```
Scenario: Confidence < 70%
  → Can include if Tier 1 priority and notable (e.g., dramatic inflection)
  → Must add caveat: "Based on limited data" or "Pattern not consistent"
  → Flag for manual review

Scenario: All insights < 60% confidence
  → Return generic insight: "Financial trends are inconsistent. Monitor closely for clearer patterns."
  → User should investigate business drivers manually
```

---

## Performance & Optimization

### Execution Path
```
1. Receive trend metrics (10–15 key metrics) - O(1)
2. Evaluate all 7 rule sets - O(7) ≈ O(1)
3. Calculate confidence for each - O(7)
4. Prioritize and select top 5–7 - O(7 log 7) ≈ O(1)
5. Fill templates - O(5–7) ≈ O(1)
6. Format output - O(5–7)

Total: < 10ms for full insight generation
```

### Caching
- Cache insight rules (static)
- Cache templates (static)
- Don't cache output (depends on real-time trend data)

---

## Testing Strategy

### Unit Tests
```javascript
// Test rule evaluation
expect(evaluateRevenueGrowthRule(cagr=12.5, consistency=85))
  .toEqual({trigger: "excellent", confidence: 95});

// Test template filling
expect(fillTemplate("Revenue has grown at {CAGR}%", {CAGR: 12.5}))
  .toBe("Revenue has grown at 12.5%");

// Test prioritization
const insights = [
  {confidence: 85}, {confidence: 70}, {confidence: 95}, 
  {confidence: 60}, {confidence: 88}, {confidence: 75}, {confidence: 92}
];
expect(selectTopInsights(insights, 5)).toHaveLength(5);
expect(selectTopInsights(insights, 5)[0].confidence).toBe(95);
```

### Integration Tests
```javascript
// Full pipeline
const trends = {revenueCAGR: 12.5, operatingMarginTrend: "↑", ...};
const insights = generateInsights(trends);
expect(insights).toHaveLength(5);
expect(insights[0].confidence).toBeGreaterThan(70);
expect(insights[0].text.length).toBeGreaterThan(50);
```

---

## Summary

- **Insight Engine** converts quantitative metrics into human-readable business insights
- **7 insight categories** cover: growth, profitability, debt, cash flow, returns, liquidity, stability
- **Rule-based system** evaluates metric thresholds to determine insight type and confidence
- **Template system** allows rapid generation of contextual, professional-quality text
- **Prioritization** ensures top 5–7 most relevant insights displayed
- **Confidence scoring** reflects reliability based on metric consistency
- **Output:** High-quality, investor-focused insights with business meaning and forward-looking context
