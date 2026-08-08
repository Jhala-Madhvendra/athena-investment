/**
 * Trend Engine
 * Transforms 5-year financial statement data into trend metrics
 * 
 * Calculations:
 * - CAGR (Compound Annual Growth Rate) for key metrics
 * - Year-over-year growth rates
 * - Trend direction detection (↑ improving, ↓ declining, → stable)
 * - Consistency scoring (0-100)
 * - Forward projections
 */

/**
 * Calculate CAGR (Compound Annual Growth Rate)
 * Formula: (Ending Value / Beginning Value) ^ (1 / Number of Years) - 1
 * 
 * @param {number} startValue - Starting value
 * @param {number} endValue - Ending value
 * @param {number} numYears - Number of years (years = data points - 1)
 * @returns {number|string} CAGR as decimal (e.g., 0.125 for 12.5%) or error code
 */
function calculateCAGR(startValue, endValue, numYears) {
  // Validation
  if (startValue === null || startValue === undefined || 
      endValue === null || endValue === undefined || 
      numYears === null || numYears === undefined) {
    return null;
  }

  // Cannot calculate CAGR with non-positive starting value
  if (startValue === 0) {
    return 'infinite'; // undefined growth from zero
  }

  if (startValue < 0) {
    return 'N/A'; // Cannot CAGR from negative value
  }

  // Cannot calculate CAGR with zero or negative years
  if (numYears <= 0) {
    return null;
  }

  // If ending value is negative/zero, CAGR is undefined (non-positive terminus)
  if (endValue <= 0) {
    return 'N/A';
  }

  try {
    const cagr = Math.pow(endValue / startValue, 1 / numYears) - 1;
    
    // Return as decimal (e.g., 0.125 for 12.5%)
    return Number.isFinite(cagr) ? cagr : 'infinite';
  } catch (error) {
    return null;
  }
}

/**
 * Get the sign of a number: 1 (positive), -1 (negative), or 0
 * @param {number} value - Numeric value
 * @returns {number} Sign
 */
function getSign(value) {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

/**
 * Describe a start-to-end transition that CAGR cannot express as a percentage
 * (a negative or zero value at either end makes fractional exponentiation
 * undefined). Used as a fallback so a sign change still produces a meaningful,
 * investor-relevant signal instead of a bare "N/A".
 *
 * @param {number} startValue - Value at the start of the period
 * @param {number} endValue - Value at the end of the period
 * @returns {object|null} {type, label, positive, absoluteChange} or null if not applicable
 */
function describeSignChange(startValue, endValue) {
  if (typeof startValue !== 'number' || typeof endValue !== 'number') {
    return null;
  }

  const startSign = getSign(startValue);
  const endSign = getSign(endValue);

  if (startSign === 1 && endSign === 1) {
    return null; // Both strictly positive: CAGR is well-defined, no fallback needed
  }

  const absoluteChange = endValue - startValue;

  if (startSign < 0 && endSign > 0) {
    return { type: 'turnaround', label: 'Turned profitable', positive: true, absoluteChange };
  }
  if (startSign > 0 && endSign < 0) {
    return { type: 'declinedToLoss', label: 'Declined into a loss', positive: false, absoluteChange };
  }
  if (startSign < 0 && endSign < 0) {
    if (Math.abs(endValue) < Math.abs(startValue)) {
      return { type: 'narrowingLoss', label: 'Losses narrowing', positive: true, absoluteChange };
    }
    if (Math.abs(endValue) > Math.abs(startValue)) {
      return { type: 'wideningLoss', label: 'Losses widening', positive: false, absoluteChange };
    }
    return { type: 'steadyLoss', label: 'Losses roughly unchanged', positive: false, absoluteChange };
  }
  if (startSign === 0 && endSign > 0) {
    return { type: 'newProfit', label: 'Grew from breakeven', positive: true, absoluteChange };
  }
  if (startSign === 0 && endSign < 0) {
    return { type: 'newLoss', label: 'Fell into a loss from breakeven', positive: false, absoluteChange };
  }
  if (startSign > 0 && endSign === 0) {
    return { type: 'declinedToBreakeven', label: 'Declined to breakeven', positive: false, absoluteChange };
  }
  if (startSign < 0 && endSign === 0) {
    return { type: 'improvedToBreakeven', label: 'Improved to breakeven', positive: true, absoluteChange };
  }
  // startSign === 0 && endSign === 0
  return { type: 'flatAtZero', label: 'Unchanged at breakeven', positive: null, absoluteChange };
}

/**
 * Validate financial data completeness
 * Requires at least 2 data points to calculate CAGR
 * 
 * @param {Array} dataPoints - Array of numeric values
 * @param {number} requiredMinPoints - Minimum data points required (default: 2)
 * @returns {object} {isValid: boolean, numPoints: number, message: string}
 */
function validateData(dataPoints, requiredMinPoints = 2) {
  if (!Array.isArray(dataPoints)) {
    return { isValid: false, numPoints: 0, message: 'Data must be an array' };
  }

  const validPoints = dataPoints.filter(p => p !== null && p !== undefined);
  
  if (validPoints.length < requiredMinPoints) {
    return {
      isValid: false,
      numPoints: validPoints.length,
      message: `Insufficient data: ${validPoints.length} points found, ${requiredMinPoints} required`
    };
  }

  return { isValid: true, numPoints: validPoints.length, message: 'Valid' };
}

/**
 * Calculate year-over-year growth rates
 * 
 * @param {Array} dataPoints - Array of numeric values in chronological order
 * @returns {Array} Array of YoY growth rates (as decimals)
 */
function calculateYoYGrowth(dataPoints) {
  if (!Array.isArray(dataPoints) || dataPoints.length < 2) {
    return [];
  }

  const yoyGrowth = [];
  
  for (let i = 1; i < dataPoints.length; i++) {
    const prior = dataPoints[i - 1];
    const current = dataPoints[i];

    if (prior === null || prior === undefined || current === null || current === undefined) {
      yoyGrowth.push(null);
      continue;
    }

    if (prior === 0) {
      // Avoid division by zero
      yoyGrowth.push(null);
      continue;
    }

    if (prior < 0) {
      // Cannot calculate YoY growth from negative value
      yoyGrowth.push(null);
      continue;
    }

    const growth = (current - prior) / Math.abs(prior);
    yoyGrowth.push(Number.isFinite(growth) ? growth : null);
  }

  return yoyGrowth;
}

/**
 * Detect trend direction based on YoY growth pattern
 * Rule: 3+ of 4 comparisons in same direction = clear trend
 * 
 * @param {Array} yoyGrowthRates - Array of YoY growth rates (as decimals)
 * @param {number} threshold - Threshold for "stable" (default: 0.005 = 50 bps)
 * @returns {object} {direction: '↑'|'↓'|'→'|'⚠', label: string, consistency: number}
 */
function detectTrendDirection(yoyGrowthRates, threshold = 0.005) {
  if (!Array.isArray(yoyGrowthRates) || yoyGrowthRates.length < 2) {
    return { direction: '?', label: 'insufficient data', consistency: 0 };
  }

  const validRates = yoyGrowthRates.filter(r => r !== null);
  
  if (validRates.length < 2) {
    return { direction: '?', label: 'insufficient data', consistency: 0 };
  }

  // Count direction trends
  let improving = 0;
  let declining = 0;
  let stable = 0;

  for (const rate of validRates) {
    if (rate > threshold) {
      improving++;
    } else if (rate < -threshold) {
      declining++;
    } else {
      stable++;
    }
  }

  const total = validRates.length;
  
  // Determine direction based on majority
  if (improving >= 3 && improving > declining) {
    return {
      direction: '↑',
      label: 'improving',
      consistency: Math.round((improving / total) * 100)
    };
  }
  
  if (declining >= 3 && declining > improving) {
    return {
      direction: '↓',
      label: 'declining',
      consistency: Math.round((declining / total) * 100)
    };
  }

  // If no clear trend, check for volatility
  const stdDev = calculateStdDev(validRates);
  if (stdDev > 0.1) { // High volatility (>10%)
    return {
      direction: '⚠',
      label: 'volatile',
      consistency: 0
    };
  }

  // Stable trend
  return {
    direction: '→',
    label: 'stable',
    consistency: Math.round((stable / total) * 100) || 50 // At least 50% if tied
  };
}

/**
 * Calculate standard deviation of array
 * 
 * @param {Array} values - Array of numeric values
 * @returns {number} Standard deviation
 */
function calculateStdDev(values) {
  if (!Array.isArray(values) || values.length < 2) {
    return 0;
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate consistency score (0-100)
 * Measures what % of years follow the detected trend
 * 
 * @param {Array} yoyGrowthRates - Array of YoY growth rates (as decimals)
 * @param {object} trendInfo - Result from detectTrendDirection()
 * @param {number} threshold - Threshold for "stable" (default: 0.005 = 50 bps)
 * @returns {number} Consistency score 0-100
 */
function calculateConsistency(yoyGrowthRates, trendInfo, threshold = 0.005) {
  if (!Array.isArray(yoyGrowthRates) || yoyGrowthRates.length < 2) {
    return 0;
  }

  const validRates = yoyGrowthRates.filter(r => r !== null);
  if (validRates.length < 2) {
    return 0;
  }

  let conformingCount = 0;
  const total = validRates.length;

  for (const rate of validRates) {
    if (trendInfo.direction === '↑' && rate > threshold) {
      conformingCount++;
    } else if (trendInfo.direction === '↓' && rate < -threshold) {
      conformingCount++;
    } else if (trendInfo.direction === '→' && Math.abs(rate) <= threshold) {
      conformingCount++;
    } else if (trendInfo.direction === '⚠') {
      // Volatile: consistency is 0 by definition
      conformingCount = 0;
      break;
    }
  }

  return Math.round((conformingCount / total) * 100);
}

/**
 * Project metric forward using linear regression
 * Assumes trend continues at average rate
 * 
 * @param {Array} yoyGrowthRates - Historical YoY growth rates (as decimals)
 * @param {number} lastValue - Most recent value
 * @param {number} yearsToProject - Number of years to project (1-2 recommended)
 * @returns {object} {value1y: number, value2y: number, confidence: string}
 */
function projectForward(yoyGrowthRates, lastValue, yearsToProject = 1) {
  if (!Array.isArray(yoyGrowthRates) || yoyGrowthRates.length < 2 || lastValue === null) {
    return { value1y: null, value2y: null, confidence: 'low' };
  }

  const validRates = yoyGrowthRates.filter(r => r !== null && Number.isFinite(r));
  if (validRates.length < 2) {
    return { value1y: null, value2y: null, confidence: 'low' };
  }

  // Use average of last 3 years (if available) for projection
  const recentRates = validRates.slice(-3);
  const avgGrowth = recentRates.reduce((a, b) => a + b, 0) / recentRates.length;

  if (!Number.isFinite(avgGrowth)) {
    return { value1y: null, value2y: null, confidence: 'low' };
  }

  // Determine confidence based on consistency
  const stdDev = calculateStdDev(validRates);
  let confidence = 'high';
  if (stdDev > 0.05) { // >5% variation
    confidence = 'medium';
  }
  if (stdDev > 0.1) { // >10% variation
    confidence = 'low';
  }

  // Project forward
  const value1y = lastValue * (1 + avgGrowth);
  const value2y = value1y * (1 + avgGrowth);

  return {
    value1y: Number.isFinite(value1y) ? value1y : null,
    value2y: yearsToProject >= 2 && Number.isFinite(value2y) ? value2y : null,
    confidence
  };
}

/**
 * Calculate all growth metrics from financial statement series
 * 
 * @param {Array} metricSeries - Array of {year, value} objects in chronological order
 * @param {number} maxYears - Maximum years to analyze (default: 5)
 * @returns {object} {cagr, yoyGrowth, trend, consistency, projection}
 */
function calculateGrowthMetrics(metricSeries, maxYears = 5) {
  if (!Array.isArray(metricSeries) || metricSeries.length < 2) {
    return {
      cagr: null,
      yoyGrowth: [],
      trend: { direction: '?', label: 'insufficient data', consistency: 0 },
      consistency: 0,
      projection: { value1y: null, value2y: null, confidence: 'low' }
    };
  }

  // Sort by year ascending
  const sorted = [...metricSeries]
    .filter(item => item.value !== null && item.value !== undefined)
    .sort((a, b) => a.year - b.year);

  if (sorted.length < 2) {
    return {
      cagr: null,
      yoyGrowth: [],
      trend: { direction: '?', label: 'insufficient data', consistency: 0 },
      consistency: 0,
      projection: { value1y: null, value2y: null, confidence: 'low' }
    };
  }

  // Use up to maxYears of data
  const dataTouse = sorted.slice(-maxYears);
  const values = dataTouse.map(item => item.value);

  // Calculate CAGR
  const startValue = values[0];
  const endValue = values[values.length - 1];
  const numYears = dataTouse.length - 1;
  const cagr = calculateCAGR(startValue, endValue, numYears);

  // Calculate YoY growth
  const yoyGrowth = calculateYoYGrowth(values);

  // Detect trend
  const trend = detectTrendDirection(yoyGrowth);

  // Calculate consistency
  const consistency = calculateConsistency(yoyGrowth, trend);

  // Project forward
  const projection = projectForward(yoyGrowth, endValue, 2);

  // When CAGR can't be expressed as a percentage (sign change at start/end),
  // describe the transition instead so the metric still carries a signal
  const signChange = typeof cagr !== 'number' ? describeSignChange(startValue, endValue) : null;

  return {
    cagr: typeof cagr === 'number' ? Number(cagr.toFixed(4)) : cagr,
    signChange,
    yoyGrowth: yoyGrowth.map(v => v !== null ? Number(v.toFixed(4)) : null),
    trend: {
      ...trend,
      consistency: consistency || trend.consistency
    },
    consistency,
    projection: {
      ...projection,
      value1y: projection.value1y ? Number(projection.value1y.toFixed(2)) : null,
      value2y: projection.value2y ? Number(projection.value2y.toFixed(2)) : null
    },
    period: {
      startYear: dataTouse[0].year,
      endYear: dataTouse[dataTouse.length - 1].year,
      numYears: numYears
    }
  };
}

/**
 * Analyze margin trend from historical margin values
 * 
 * @param {Array} marginSeries - Array of {year, value} objects (value = 0.25 for 25%)
 * @param {number} maxYears - Maximum years to analyze (default: 5)
 * @returns {object} {latest, direction, consistency, change3y, description}
 */
function analyzeMarginTrend(marginSeries, maxYears = 5) {
  if (!Array.isArray(marginSeries) || marginSeries.length < 2) {
    return {
      latest: null,
      direction: '?',
      consistency: 0,
      change3y: null,
      description: 'Insufficient data'
    };
  }

  const sorted = [...marginSeries]
    .filter(item => item.value !== null && item.value !== undefined)
    .sort((a, b) => a.year - b.year);

  if (sorted.length < 2) {
    return {
      latest: null,
      direction: '?',
      consistency: 0,
      change3y: null,
      description: 'Insufficient data'
    };
  }

  const dataTouse = sorted.slice(-maxYears);
  const values = dataTouse.map(item => item.value);
  const latest = values[values.length - 1];

  // Calculate changes in basis points
  const yoyChanges = [];
  for (let i = 1; i < values.length; i++) {
    const change = (values[i] - values[i - 1]) * 10000; // Convert to basis points
    yoyChanges.push(change);
  }

  // Detect trend (for margins, we look at changes, not absolute values)
  const trend = detectTrendDirection(yoyChanges.map(c => c / 10000), 0.005); // 50 bps threshold

  // Calculate 3-year change if available
  let change3y = null;
  if (values.length >= 4) {
    change3y = (values[values.length - 1] - values[values.length - 4]) * 10000;
  } else if (values.length > 1) {
    change3y = (values[values.length - 1] - values[0]) * 10000;
  }

  const latestChange = yoyChanges[yoyChanges.length - 1];

  return {
    latest: latest ? Number((latest * 100).toFixed(2)) : null, // Return as percentage
    direction: trend.direction,
    consistency: trend.consistency,
    change3y: change3y ? Number(change3y.toFixed(0)) : null, // In basis points
    latestChange: latestChange ? Number(latestChange.toFixed(0)) : null,
    avgChange: yoyChanges.length > 0 
      ? Number((yoyChanges.reduce((a, b) => a + b, 0) / yoyChanges.length).toFixed(0))
      : null,
    values: values.map(v => v ? Number((v * 100).toFixed(2)) : null),
    years: dataTouse.map(item => item.year)
  };
}

/**
 * Format growth metric for API response
 * 
 * @param {string} metric - Metric name (e.g., 'revenueCAGR')
 * @param {number} value - Calculated value
 * @param {object} details - Additional details (period, trend, etc.)
 * @returns {object} Formatted metric for response
 */
function formatMetric(metric, value, details = {}) {
  const metricMetadata = {
    revenueCAGR: { label: 'Revenue CAGR', unit: 'percent', format: 2 },
    netIncomeCAGR: { label: 'Net Income CAGR', unit: 'percent', format: 2 },
    operatingIncomeCAGR: { label: 'Operating Income CAGR', unit: 'percent', format: 2 },
    freeCashFlowCAGR: { label: 'Free Cash Flow CAGR', unit: 'percent', format: 2 },
    debtGrowth: { label: 'Total Debt Growth', unit: 'percent', format: 2 },
    equityGrowth: { label: 'Total Equity Growth', unit: 'percent', format: 2 },
    assetGrowth: { label: 'Total Assets Growth', unit: 'percent', format: 2 }
  };

  const meta = metricMetadata[metric] || { label: metric, unit: 'value', format: 2 };

  return {
    metric,
    label: meta.label,
    value: value && typeof value === 'number' ? Number(value.toFixed(meta.format)) : value,
    unit: meta.unit,
    ...details
  };
}

/**
 * Calculate all trend metrics from complete financial data
 * Main entry point for trend engine
 * 
 * @param {object} financialData - {incomeStatement, balanceSheet, cashFlow} with series data
 * @returns {object} Complete trend analysis
 */
function calculateAllTrends(financialData) {
  if (!financialData) {
    return {
      error: 'No financial data provided',
      growthMetrics: {},
      marginTrends: {},
      returnTrends: {}
    };
  }

  const {
    incomeStatement = {},
    balanceSheet = {},
    cashFlow = {}
  } = financialData;

  // Growth Metrics
  const growthMetrics = {
    revenueCAGR: calculateGrowthMetrics(incomeStatement.totalRevenue || []),
    netIncomeCAGR: calculateGrowthMetrics(incomeStatement.netIncome || []),
    operatingIncomeCAGR: calculateGrowthMetrics(incomeStatement.operatingIncome || []),
    freeCashFlowCAGR: calculateGrowthMetrics(cashFlow.freeCashFlow || []),
    debtGrowth: calculateGrowthMetrics(balanceSheet.totalDebt || []),
    equityGrowth: calculateGrowthMetrics(balanceSheet.totalStockholderEquity || []),
    assetGrowth: calculateGrowthMetrics(balanceSheet.totalAssets || [])
  };

  // Asset/Debt Growth
  const assetDebtGrowth = {
    totalDebtGrowth: calculateYoYGrowth((balanceSheet.totalDebt || []).map(d => d.value)),
    totalEquityGrowth: calculateYoYGrowth((balanceSheet.totalStockholderEquity || []).map(d => d.value)),
    totalAssetsGrowth: calculateYoYGrowth((balanceSheet.totalAssets || []).map(d => d.value))
  };

  // Margin Trends
  const marginTrends = {
    grossMargin: analyzeMarginTrend(incomeStatement.grossMargin || []),
    operatingMargin: analyzeMarginTrend(incomeStatement.operatingMargin || []),
    netMargin: analyzeMarginTrend(incomeStatement.netMargin || [])
  };

  // Return Trends
  const returnTrends = {
    roe: calculateGrowthMetrics(balanceSheet.returnOnEquity || []),
    roa: calculateGrowthMetrics(balanceSheet.returnOnAssets || [])
  };

  return {
    growthMetrics,
    assetDebtGrowth,
    marginTrends,
    returnTrends
  };
}

module.exports = {
  calculateCAGR,
  validateData,
  calculateYoYGrowth,
  detectTrendDirection,
  calculateConsistency,
  projectForward,
  calculateGrowthMetrics,
  analyzeMarginTrend,
  formatMetric,
  calculateAllTrends,
  calculateStdDev,
  describeSignChange
};
