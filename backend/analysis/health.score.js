/**
 * Health Score Engine
 * Combines 5 component scores into composite Financial Health Score (0-100)
 * 
 * Components:
 * 1. Profitability (net margin, ROE, ROA)
 * 2. Liquidity (current ratio, quick ratio)
 * 3. Solvency (debt-to-equity, debt-to-assets)
 * 4. Cash Flow (FCF trend, operating CF)
 * 5. Growth (revenue CAGR, earnings CAGR)
 */

const growthCalculator = require('./growth.calculator');

/**
 * Normalize Net Profit Margin to 0-100 score
 * 0% → 0 pts, 5% → 50 pts, 10%+ → 100 pts
 * 
 * @param {number} netMargin - Net margin as decimal (0.12 for 12%)
 * @returns {number} Score 0-100
 */
function normalizeNetMargin(netMargin) {
  if (netMargin === null || netMargin === undefined) {
    return 0;
  }

  const marginPercent = netMargin * 100;

  if (marginPercent < 0) {
    return 0; // Company unprofitable
  }

  if (marginPercent < 10) {
    return marginPercent * 10; // Linear: 0% → 0, 10% → 100
  }

  // >10% = 100 (capped)
  return 100;
}

/**
 * Normalize Return on Equity (ROE) to 0-100 score
 * 0% → 0 pts, 7.5% → 50 pts, 15%+ → 100 pts
 * 
 * @param {number} roe - ROE as decimal (0.15 for 15%)
 * @returns {number} Score 0-100
 */
function normalizeROE(roe) {
  if (roe === null || roe === undefined) {
    return 0;
  }

  const roePercent = roe * 100;

  if (roePercent < 0) {
    return 0; // Negative ROE (destroying shareholder value)
  }

  if (roePercent < 15) {
    return (roePercent / 15) * 100; // Linear: 0% → 0, 15% → 100
  }

  // >15% = 100 (capped, excellent)
  return 100;
}

/**
 * Normalize Return on Assets (ROA) to 0-100 score
 * 0% → 0 pts, 5% → 50 pts, 10%+ → 100 pts
 * 
 * @param {number} roa - ROA as decimal (0.08 for 8%)
 * @returns {number} Score 0-100
 */
function normalizeROA(roa) {
  if (roa === null || roa === undefined) {
    return 0;
  }

  const roaPercent = roa * 100;

  if (roaPercent < 0) {
    return 0; // Negative ROA
  }

  if (roaPercent < 10) {
    return (roaPercent / 10) * 100; // Linear: 0% → 0, 10% → 100
  }

  // >10% = 100 (capped)
  return 100;
}

/**
 * Calculate Profitability Component Score
 * Average of normalized: Net Margin, ROE, ROA
 * 
 * @param {object} metrics - {netMargin, roe, roa}
 * @returns {number} Profitability score 0-100
 */
function calculateProfitabilityScore(metrics) {
  const { netMargin, roe, roa } = metrics;

  const netMarginScore = normalizeNetMargin(netMargin);
  const roeScore = normalizeROE(roe);
  const roaScore = normalizeROA(roa);

  const average = (netMarginScore + roeScore + roaScore) / 3;
  return Math.round(average);
}

/**
 * Normalize Current Ratio to 0-100 score
 * Ideal range: 1.0-2.5
 * 0.5 → 10, 1.0 → 50, 1.5 → 75, 2.0+ → 100
 * 
 * @param {number} currentRatio - Current ratio
 * @returns {number} Score 0-100
 */
function normalizeCurrentRatio(currentRatio) {
  if (currentRatio === null || currentRatio === undefined || currentRatio < 0) {
    return 0;
  }

  if (currentRatio < 1.0) {
    // Below 1.0 is problematic
    return 10 + (currentRatio - 0.5) * 80; // 0.5 → 10, 1.0 → 50
  }

  if (currentRatio < 2.5) {
    return 50 + (currentRatio - 1.0) * 20; // 1.0 → 50, 2.5 → 100
  }

  // >2.5 = 100 (excessive cash, but not penalized)
  return 100;
}

/**
 * Normalize Quick Ratio to 0-100 score
 * Ideal range: 0.8-2.0
 * 0.5 → 10, 0.8 → 50, 1.2 → 75, 1.5+ → 100
 * 
 * @param {number} quickRatio - Quick ratio
 * @returns {number} Score 0-100
 */
function normalizeQuickRatio(quickRatio) {
  if (quickRatio === null || quickRatio === undefined || quickRatio < 0) {
    return 0;
  }

  if (quickRatio < 0.8) {
    return 10 + (quickRatio - 0.5) * (40 / 0.3); // 0.5 → 10, 0.8 → 50
  }

  if (quickRatio < 1.5) {
    return 50 + (quickRatio - 0.8) * (50 / 0.7); // 0.8 → 50, 1.5 → 100
  }

  // >1.5 = 100
  return 100;
}

/**
 * Calculate Liquidity Component Score
 * Average of normalized: Current Ratio, Quick Ratio
 * 
 * @param {object} metrics - {currentRatio, quickRatio}
 * @returns {number} Liquidity score 0-100
 */
function calculateLiquidityScore(metrics) {
  const { currentRatio, quickRatio } = metrics;

  const currentScore = normalizeCurrentRatio(currentRatio);
  const quickScore = normalizeQuickRatio(quickRatio);

  const average = (currentScore + quickScore) / 2;
  return Math.round(average);
}

/**
 * Normalize Debt-to-Equity Ratio to 0-100 score
 * Lower leverage = higher score
 * >3.0 → 10, 2.0 → 30, 1.0 → 65, 0.5 → 85, 0.0-0.2 → 100
 * 
 * @param {number} debtToEquity - D/E ratio
 * @returns {number} Score 0-100
 */
function normalizeDebtToEquity(debtToEquity) {
  if (debtToEquity === null || debtToEquity === undefined || debtToEquity < 0) {
    return 50; // Unknown = neutral
  }

  if (debtToEquity > 3.0) {
    return 10; // Excessive leverage
  }

  if (debtToEquity > 2.5) {
    return 10 + (3.0 - debtToEquity) * 40; // 2.5 → 30, 3.0 → 10
  }

  if (debtToEquity > 2.0) {
    return 30 + (2.5 - debtToEquity) * 20; // 2.0 → 30, 2.5 → 50
  }

  if (debtToEquity > 1.0) {
    return 30 + ((2.0 - debtToEquity) / 1.0) * 35; // 1.0 → 65, 2.0 → 30
  }

  if (debtToEquity > 0.5) {
    return 65 + ((1.0 - debtToEquity) / 0.5) * 20; // 0.5 → 85, 1.0 → 65
  }

  // 0.0-0.5
  if (debtToEquity > 0.0) {
    return 85 + ((0.5 - debtToEquity) / 0.5) * 15; // 0.0 → 100, 0.5 → 85
  }

  // Net cash position (D/E < 0) = excellent
  return 100;
}

/**
 * Normalize Debt-to-Assets Ratio to 0-100 score
 * Lower debt = higher score
 * >0.8 → 10, 0.7 → 25, 0.6 → 50, 0.5 → 70, 0.4 → 85, <0.3 → 100
 * 
 * @param {number} debtToAssets - D/A ratio
 * @returns {number} Score 0-100
 */
function normalizeDebtToAssets(debtToAssets) {
  if (debtToAssets === null || debtToAssets === undefined || debtToAssets < 0) {
    return 50; // Unknown = neutral
  }

  if (debtToAssets > 0.8) {
    return 10; // Overleveraged
  }

  if (debtToAssets > 0.7) {
    return 10 + (0.8 - debtToAssets) * 150; // 0.7 → 25, 0.8 → 10
  }

  if (debtToAssets > 0.6) {
    return 25 + (0.7 - debtToAssets) * 250; // 0.6 → 50, 0.7 → 25
  }

  if (debtToAssets > 0.5) {
    return 50 + (0.6 - debtToAssets) * 200; // 0.5 → 70, 0.6 → 50
  }

  if (debtToAssets > 0.4) {
    return 70 + (0.5 - debtToAssets) * 150; // 0.4 → 85, 0.5 → 70
  }

  if (debtToAssets > 0.3) {
    return 85 + (0.4 - debtToAssets) * 150; // 0.3 → 100, 0.4 → 85
  }

  // <0.3 = 100 (conservative)
  return 100;
}

/**
 * Calculate Solvency Component Score
 * Average of normalized: D/E, D/A
 * 
 * @param {object} metrics - {debtToEquity, debtToAssets}
 * @returns {number} Solvency score 0-100
 */
function calculateSolvencyScore(metrics) {
  const { debtToEquity, debtToAssets } = metrics;

  const deScore = normalizeDebtToEquity(debtToEquity);
  const daScore = normalizeDebtToAssets(debtToAssets);

  const average = (deScore + daScore) / 2;
  return Math.round(average);
}

/**
 * Validate weighting configuration
 * Weights must sum to ~1.0 (allows small floating point variance)
 * 
 * @param {object} weights - {profitability, liquidity, solvency, cashFlow, growth}
 * @returns {object} {valid: boolean, normalized: object, error: string}
 */
function validateWeights(weights) {
  if (!weights) {
    return {
      valid: false,
      normalized: null,
      error: 'Weights object required'
    };
  }

  const required = ['profitability', 'liquidity', 'solvency', 'cashFlow', 'growth'];
  const missing = required.filter(w => weights[w] === undefined);

  if (missing.length > 0) {
    return {
      valid: false,
      normalized: null,
      error: `Missing weights for: ${missing.join(', ')}`
    };
  }

  const sum = Object.values(weights).reduce((a, b) => a + b, 0);

  if (sum <= 0 || !Number.isFinite(sum)) {
    return {
      valid: false,
      normalized: null,
      error: 'Weights must be positive numbers'
    };
  }

  // Normalize if not exactly 1.0
  const normalized = {};
  Object.entries(weights).forEach(([key, value]) => {
    normalized[key] = value / sum;
  });

  return {
    valid: true,
    normalized,
    error: null
  };
}

/**
 * Predefined weighting strategies
 */
const weightingStrategies = {
  balanced: {
    profitability: 0.20,
    liquidity: 0.20,
    solvency: 0.20,
    cashFlow: 0.20,
    growth: 0.20
  },
  growthFocused: {
    profitability: 0.25,
    liquidity: 0.15,
    solvency: 0.15,
    cashFlow: 0.15,
    growth: 0.30
  },
  safetyFocused: {
    profitability: 0.25,
    liquidity: 0.30,
    solvency: 0.25,
    cashFlow: 0.15,
    growth: 0.05
  }
};

/**
 * Get weighting strategy
 * 
 * @param {string|object} strategy - Strategy name or custom weights
 * @returns {object} Validated weights
 */
function getWeights(strategy = 'balanced') {
  let weights;

  if (typeof strategy === 'string') {
    weights = weightingStrategies[strategy];
    if (!weights) {
      weights = weightingStrategies.balanced; // Default to balanced
    }
  } else if (typeof strategy === 'object') {
    weights = strategy;
  } else {
    weights = weightingStrategies.balanced;
  }

  const validation = validateWeights(weights);
  if (!validation.valid) {
    console.warn(`Weight validation failed: ${validation.error}, using balanced`);
    return weightingStrategies.balanced;
  }

  return validation.normalized;
}

/**
 * Calculate composite Health Score from component scores
 * 
 * @param {object} componentScores - {profitability, liquidity, solvency, cashFlow, growth}
 * @param {object} weights - Weighting configuration
 * @returns {number} Composite score 0-100
 */
function calculateCompositeScore(componentScores, weights) {
  const {
    profitability = 0,
    liquidity = 0,
    solvency = 0,
    cashFlow = 0,
    growth = 0
  } = componentScores;

  const w = getWeights(weights);

  const composite =
    (profitability * w.profitability) +
    (liquidity * w.liquidity) +
    (solvency * w.solvency) +
    (cashFlow * w.cashFlow) +
    (growth * w.growth);

  return Math.round(composite);
}

/**
 * Map score to label and risk level
 * 
 * @param {number} score - Score 0-100
 * @returns {object} {label, color, riskLevel, description}
 */
function scoreTolabelMapping(score) {
  if (score >= 90) {
    return {
      label: 'Excellent',
      color: 'green',
      riskLevel: 'minimal',
      description: 'Outstanding financial health across all dimensions'
    };
  }

  if (score >= 75) {
    return {
      label: 'Good',
      color: 'green',
      riskLevel: 'low-to-moderate',
      description: 'Strong financial position with solid fundamentals'
    };
  }

  if (score >= 50) {
    return {
      label: 'Average',
      color: 'yellow',
      riskLevel: 'moderate',
      description: 'Adequate financial health; typical for industry'
    };
  }

  if (score >= 25) {
    return {
      label: 'Weak',
      color: 'orange',
      riskLevel: 'material',
      description: 'Financial challenges; concerns require attention'
    };
  }

  return {
    label: 'Poor',
    color: 'red',
    riskLevel: 'critical',
    description: 'Critical financial distress; high risk of failure'
  };
}

/**
 * Generate health score explanation
 * 
 * @param {number} score - Composite score
 * @param {object} components - Component scores
 * @param {object} componentMetrics - Underlying metrics for each component
 * @returns {string} Explanation text
 */
function generateExplanation(score, components, componentMetrics = {}) {
  const scoreInfo = scoreTolabelMapping(score);

  // Identify strengths and concerns
  const strengths = [];
  const concerns = [];

  const threshold = {
    strong: 75,
    weak: 40
  };

  if (components.profitability >= threshold.strong) {
    strengths.push('Profitability');
  } else if (components.profitability < threshold.weak) {
    concerns.push('Profitability');
  }

  if (components.liquidity >= threshold.strong) {
    strengths.push('Liquidity');
  } else if (components.liquidity < threshold.weak) {
    concerns.push('Liquidity');
  }

  if (components.solvency >= threshold.strong) {
    strengths.push('Solvency');
  } else if (components.solvency < threshold.weak) {
    concerns.push('Solvency');
  }

  if (components.cashFlow >= threshold.strong) {
    strengths.push('Cash Flow');
  } else if (components.cashFlow < threshold.weak) {
    concerns.push('Cash Flow');
  }

  if (components.growth >= threshold.strong) {
    strengths.push('Growth');
  } else if (components.growth < threshold.weak) {
    concerns.push('Growth');
  }

  // Build explanation
  let explanation = scoreInfo.description + '. ';

  if (strengths.length > 0) {
    explanation += `Strengths: ${strengths.join(', ')}. `;
  }

  if (concerns.length > 0) {
    explanation += `Concerns: ${concerns.join(', ')}. `;
  }

  if (score >= 75) {
    explanation += 'Company is well-positioned for continued success.';
  } else if (score >= 50) {
    explanation += 'Monitor key metrics for changes in financial position.';
  } else {
    explanation += 'Significant improvement needed; close monitoring required.';
  }

  return explanation;
}

/**
 * Calculate complete health score with all details
 * Main entry point for health score engine
 * 
 * @param {object} ratios - All ratio metrics
 * @param {object} trendData - Trend engine output
 * @param {string|object} weightStrategy - Weighting strategy or custom weights
 * @returns {object} Complete health score report
 */
function calculateHealthScore(ratios, trendData, weightStrategy = 'balanced') {
  if (!ratios) {
    return {
      error: 'No ratio data provided',
      score: null,
      label: null
    };
  }

  const {
    netMargin = 0,
    roe = 0,
    roa = 0,
    currentRatio = 1,
    quickRatio = 1,
    debtToEquity = 1,
    debtToAssets = 0.5
  } = ratios;

  // Calculate component scores
  const profitabilityScore = calculateProfitabilityScore({
    netMargin,
    roe,
    roa
  });

  const liquidityScore = calculateLiquidityScore({
    currentRatio,
    quickRatio
  });

  const solvencyScore = calculateSolvencyScore({
    debtToEquity,
    debtToAssets
  });

  // Cash flow score from trends
  let cashFlowScore = 50; // Default neutral
  if (trendData && trendData.growthMetrics && trendData.growthMetrics.freeCashFlowCAGR) {
    const fcfCAGR = trendData.growthMetrics.freeCashFlowCAGR.cagr;
    cashFlowScore = growthCalculator.calculateCashFlowScore(fcfCAGR);
  }

  // Growth score from trends
  let growthScore = 50; // Default neutral
  if (trendData && trendData.growthMetrics) {
    const revenueCAGR = trendData.growthMetrics.revenueCAGR?.cagr || 0;
    const netIncomeCAGR = trendData.growthMetrics.netIncomeCAGR?.cagr || 0;
    growthScore = growthCalculator.calculateGrowthScore(revenueCAGR, netIncomeCAGR);
  }

  // Component scores object
  const componentScores = {
    profitability: profitabilityScore,
    liquidity: liquidityScore,
    solvency: solvencyScore,
    cashFlow: cashFlowScore,
    growth: growthScore
  };

  // Calculate composite score
  const compositeScore = calculateCompositeScore(componentScores, weightStrategy);

  // Get label and risk
  const scoreMapping = scoreTolabelMapping(compositeScore);

  // Generate explanation
  const explanation = generateExplanation(compositeScore, componentScores, ratios);

  return {
    overall: compositeScore,
    label: scoreMapping.label,
    color: scoreMapping.color,
    riskLevel: scoreMapping.riskLevel,
    components: componentScores,
    weights: getWeights(weightStrategy),
    explanation,
    calculatedAt: new Date().toISOString()
  };
}

module.exports = {
  normalizeNetMargin,
  normalizeROE,
  normalizeROA,
  calculateProfitabilityScore,
  normalizeCurrentRatio,
  normalizeQuickRatio,
  calculateLiquidityScore,
  normalizeDebtToEquity,
  normalizeDebtToAssets,
  calculateSolvencyScore,
  validateWeights,
  getWeights,
  weightingStrategies,
  calculateCompositeScore,
  scoreTolabelMapping,
  generateExplanation,
  calculateHealthScore
};
