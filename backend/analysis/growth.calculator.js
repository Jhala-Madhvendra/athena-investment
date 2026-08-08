/**
 * Growth Calculator
 * Normalizes growth metrics (CAGR, growth rates) to 0-100 scores
 * Used by health score engine for component scoring
 */

/**
 * Normalize Revenue CAGR to 0-100 score
 * Scale:
 *   < 0% (declining) → 0 pts
 *   0-2% (flat/mature) → 10-30 pts
 *   2-5% (modest, GDP-like) → 30-50 pts
 *   5-10% (healthy) → 50-75 pts
 *   10-15% (strong) → 75-90 pts
 *   15%+ (exceptional) → 90-100 pts
 * 
 * @param {number} cagr - CAGR as decimal (e.g., 0.125 for 12.5%)
 * @returns {number} Score 0-100
 */
function normalizeRevenueCAGR(cagr) {
  if (cagr === null || cagr === undefined || cagr === 'N/A' || cagr === 'infinite') {
    return 0;
  }

  const cagrPercent = cagr * 100;

  if (cagrPercent < 0) {
    return 0; // Declining revenue
  }

  if (cagrPercent < 2) {
    return 10 + (cagrPercent / 2) * 20; // Linear: 0% → 10, 2% → 30
  }

  if (cagrPercent < 5) {
    return 30 + ((cagrPercent - 2) / 3) * 20; // Linear: 2% → 30, 5% → 50
  }

  if (cagrPercent < 10) {
    return 50 + ((cagrPercent - 5) / 5) * 25; // Linear: 5% → 50, 10% → 75
  }

  if (cagrPercent < 15) {
    return 75 + ((cagrPercent - 10) / 5) * 15; // Linear: 10% → 75, 15% → 90
  }

  // 15%+
  const above15 = Math.min(cagrPercent - 15, 10); // Cap additional growth at 10%
  return 90 + (above15 / 10) * 10; // Linear: 15% → 90, 25%+ → 100
}

/**
 * Normalize Net Income CAGR to 0-100 score
 * Same scale as revenue CAGR
 * 
 * @param {number} cagr - CAGR as decimal
 * @returns {number} Score 0-100
 */
function normalizeNetIncomeCAGR(cagr) {
  // Same scale as revenue
  return normalizeRevenueCAGR(cagr);
}

/**
 * Normalize Operating Income CAGR to 0-100 score
 * Same scale as revenue CAGR
 * 
 * @param {number} cagr - CAGR as decimal
 * @returns {number} Score 0-100
 */
function normalizeOperatingIncomeCAGR(cagr) {
  // Same scale as revenue
  return normalizeRevenueCAGR(cagr);
}

/**
 * Normalize Free Cash Flow CAGR to 0-100 score
 * Same scale as revenue CAGR
 * 
 * @param {number} cagr - CAGR as decimal
 * @returns {number} Score 0-100
 */
function normalizeFCFCAGR(cagr) {
  // Same scale as revenue
  return normalizeRevenueCAGR(cagr);
}

/**
 * Normalize YoY growth rate to 0-100 score
 * Used for debt, equity, asset growth
 * 
 * Scale:
 *   < -10% (rapid decline) → 10 pts
 *   -10% to 0% (decline) → 10-40 pts
 *   0% to 5% (slow growth) → 40-70 pts
 *   5% to 10% (moderate growth) → 70-85 pts
 *   10%+ (strong growth) → 85-100 pts
 * 
 * @param {number} growthRate - YoY growth as decimal (e.g., 0.05 for 5%)
 * @returns {number} Score 0-100
 */
function normalizeYoYGrowth(growthRate) {
  if (growthRate === null || growthRate === undefined) {
    return 0;
  }

  const growthPercent = growthRate * 100;

  if (growthPercent < -10) {
    return 10; // Rapid decline
  }

  if (growthPercent < 0) {
    return 10 + ((growthPercent + 10) / 10) * 30; // Linear: -10% → 10, 0% → 40
  }

  if (growthPercent < 5) {
    return 40 + (growthPercent / 5) * 30; // Linear: 0% → 40, 5% → 70
  }

  if (growthPercent < 10) {
    return 70 + ((growthPercent - 5) / 5) * 15; // Linear: 5% → 70, 10% → 85
  }

  // 10%+
  const above10 = Math.min(growthPercent - 10, 15); // Cap at 15%
  return 85 + (above10 / 15) * 15; // Linear: 10% → 85, 25%+ → 100
}

/**
 * Normalize debt growth (higher growth = lower score for debt)
 * We want to penalize rapid debt growth
 * 
 * @param {number} debtCAGR - Debt CAGR as decimal
 * @returns {number} Score 0-100
 */
function normalizeDebtGrowth(debtCAGR) {
  if (debtCAGR === null || debtCAGR === undefined || debtCAGR === 'N/A') {
    return 50; // Neutral if missing
  }

  const debtPercent = debtCAGR * 100;

  // Debt growth should be low
  // Negative debt growth (paying down debt) = great
  // High positive debt growth = bad
  
  if (debtPercent < -5) {
    return 100; // Paying down debt rapidly
  }

  if (debtPercent < 0) {
    return 75 + (debtPercent / 5) * 25; // Linear: -5% → 100, 0% → 75
  }

  if (debtPercent < 5) {
    return 50 + ((5 - debtPercent) / 5) * 25; // Linear: 0% → 50, 5% → 25
  }

  if (debtPercent < 10) {
    return 25 + ((10 - debtPercent) / 5) * 25; // Linear: 5% → 25, 10% → 0
  }

  return 0; // Debt growing > 10% annually = critical
}

/**
 * Normalize equity growth
 * Equity growth is positive (same scale as revenue)
 * 
 * @param {number} equityCAGR - Equity CAGR as decimal
 * @returns {number} Score 0-100
 */
function normalizeEquityGrowth(equityCAGR) {
  return normalizeRevenueCAGR(equityCAGR);
}

/**
 * Normalize asset growth
 * Asset growth is positive (same scale as revenue)
 * 
 * @param {number} assetCAGR - Asset CAGR as decimal
 * @returns {number} Score 0-100
 */
function normalizeAssetGrowth(assetCAGR) {
  return normalizeRevenueCAGR(assetCAGR);
}

/**
 * Get average growth rate from array of annual rates
 * Filters out null values and calculates mean
 * 
 * @param {Array} growthRates - Array of growth rates as decimals
 * @returns {number} Average growth rate as decimal
 */
function getAverageGrowthRate(growthRates) {
  if (!Array.isArray(growthRates) || growthRates.length === 0) {
    return 0;
  }

  const validRates = growthRates.filter(r => r !== null && r !== undefined);
  if (validRates.length === 0) {
    return 0;
  }

  return validRates.reduce((a, b) => a + b, 0) / validRates.length;
}

/**
 * Calculate growth score for health score engine
 * Combines Revenue CAGR and Net Income CAGR
 * 
 * Formula:
 *   Growth Score = (RevenueCAGR_Score + NetIncomeCAGR_Score) / 2
 * 
 * @param {number} revenueCAGR - Revenue CAGR as decimal
 * @param {number} netIncomeCAGR - Net Income CAGR as decimal
 * @returns {number} Growth Score 0-100
 */
function calculateGrowthScore(revenueCAGR, netIncomeCAGR) {
  const revenueScore = normalizeRevenueCAGR(revenueCAGR);
  const earningsScore = normalizeNetIncomeCAGR(netIncomeCAGR);

  return Math.round((revenueScore + earningsScore) / 2);
}

/**
 * Calculate debt trend score for solvency
 * Lower debt growth = higher score
 * 
 * @param {Array} debtGrowthRates - Array of YoY debt growth rates
 * @returns {object} {score: 0-100, direction: string}
 */
function calculateDebtTrendScore(debtGrowthRates) {
  if (!Array.isArray(debtGrowthRates) || debtGrowthRates.length === 0) {
    return { score: 50, direction: '→', trend: 'unknown' };
  }

  const validRates = debtGrowthRates.filter(r => r !== null);
  if (validRates.length === 0) {
    return { score: 50, direction: '→', trend: 'unknown' };
  }

  // Average debt growth over period
  const avgDebtGrowth = getAverageGrowthRate(validRates);
  const score = normalizeDebtGrowth(avgDebtGrowth);

  // Determine direction
  let direction = '→';
  if (validRates.length >= 2) {
    const recentGrowth = validRates[validRates.length - 1];
    const priorGrowth = validRates[validRates.length - 2];
    
    if (recentGrowth < priorGrowth) {
      direction = '↓'; // Debt growth declining (good)
    } else if (recentGrowth > priorGrowth) {
      direction = '↑'; // Debt growth accelerating (bad)
    }
  }

  return {
    score: Math.round(score),
    direction,
    trend: avgDebtGrowth < 0 ? 'improving' : avgDebtGrowth > 5 ? 'declining' : 'stable'
  };
}

/**
 * Calculate cash flow growth score
 * 
 * @param {number} fcfCAGR - Free Cash Flow CAGR as decimal
 * @param {object} operatingCFTrend - Operating CF trend info
 * @returns {number} Cash flow component score 0-100
 */
function calculateCashFlowScore(fcfCAGR, operatingCFTrend = {}) {
  let fcfScore = normalizeFCFCAGR(fcfCAGR);

  // Operating CF bonus/penalty
  if (operatingCFTrend.positive && operatingCFTrend.growing) {
    fcfScore = Math.min(100, fcfScore + 15);
  } else if (operatingCFTrend.positive) {
    fcfScore = Math.min(100, fcfScore + 8);
  } else if (operatingCFTrend.negative) {
    fcfScore = Math.max(0, fcfScore - 20);
  }

  return Math.round(fcfScore);
}

/**
 * Summary of all normalizers by metric type
 * Used by health score engine to quickly normalize metrics
 */
const normalizers = {
  revenueCAGR: normalizeRevenueCAGR,
  netIncomeCAGR: normalizeNetIncomeCAGR,
  operatingIncomeCAGR: normalizeOperatingIncomeCAGR,
  freeCashFlowCAGR: normalizeFCFCAGR,
  yoyGrowth: normalizeYoYGrowth,
  debtGrowth: normalizeDebtGrowth,
  equityGrowth: normalizeEquityGrowth,
  assetGrowth: normalizeAssetGrowth
};

module.exports = {
  normalizeRevenueCAGR,
  normalizeNetIncomeCAGR,
  normalizeOperatingIncomeCAGR,
  normalizeFCFCAGR,
  normalizeYoYGrowth,
  normalizeDebtGrowth,
  normalizeEquityGrowth,
  normalizeAssetGrowth,
  getAverageGrowthRate,
  calculateGrowthScore,
  calculateDebtTrendScore,
  calculateCashFlowScore,
  normalizers
};
