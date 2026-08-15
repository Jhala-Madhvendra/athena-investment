/**
 * Analysis Service
 * Orchestrates trend engine, growth calculator, health score, and insight engine
 * Retrieves data, validates, and returns complete analysis
 */

const trendEngine = require('./trend.engine');
const healthScoreEngine = require('./health.score');
const insightEngine = require('./insight.engine');
const validator = require('./analysis.validator');
const financialsService = require('../financials/financials.service');
const ratioFormulas = require('../ratio/ratio.formulas');
const logger = require('../utils/logger');

/**
 * Transform financial statements from MongoDB into format required by engines
 * 
 * @param {Array} statements - Array of financial statement documents
 * @param {number} maxYears - Maximum years to include
 * @returns {object} {incomeStatement, balanceSheet, cashFlow}
 */
function transformFinancialData(statements, maxYears = 5) {
  if (!Array.isArray(statements) || statements.length === 0) {
    return { incomeStatement: {}, balanceSheet: {}, cashFlow: {} };
  }

  // Sort by year ascending
  const sorted = [...statements]
    .filter(s => s.year !== null && s.year !== undefined)
    .sort((a, b) => a.year - b.year)
    .slice(-maxYears);

  if (sorted.length === 0) {
    return { incomeStatement: {}, balanceSheet: {}, cashFlow: {} };
  }

  // Transform into series format for each metric
  const transformed = {
    incomeStatement: {
      totalRevenue: sorted.map(s => ({
        year: s.year,
        value: s.incomeStatement?.totalRevenue
      })),
      netIncome: sorted.map(s => ({
        year: s.year,
        value: s.incomeStatement?.netIncome
      })),
      operatingIncome: sorted.map(s => ({
        year: s.year,
        value: s.incomeStatement?.operatingIncome
      })),
      grossMargin: sorted.map(s => {
        const revenue = s.incomeStatement?.totalRevenue;
        const cogs = s.incomeStatement?.costOfRevenue;
        if (revenue && cogs) {
          return { year: s.year, value: (revenue - cogs) / revenue };
        }
        return { year: s.year, value: null };
      }),
      operatingMargin: sorted.map(s => {
        const revenue = s.incomeStatement?.totalRevenue;
        const opIncome = s.incomeStatement?.operatingIncome;
        if (revenue && opIncome) {
          return { year: s.year, value: opIncome / revenue };
        }
        return { year: s.year, value: null };
      }),
      netMargin: sorted.map(s => {
        const revenue = s.incomeStatement?.totalRevenue;
        const netInc = s.incomeStatement?.netIncome;
        if (revenue && netInc) {
          return { year: s.year, value: netInc / revenue };
        }
        return { year: s.year, value: null };
      })
    },
    balanceSheet: {
      totalAssets: sorted.map(s => ({
        year: s.year,
        value: s.balanceSheet?.totalAssets
      })),
      totalDebt: sorted.map(s => ({
        year: s.year,
        value: s.balanceSheet?.totalDebt
      })),
      totalStockholderEquity: sorted.map(s => ({
        year: s.year,
        value: s.balanceSheet?.totalStockholderEquity
      })),
      returnOnEquity: sorted.map(s => {
        const netInc = s.incomeStatement?.netIncome;
        const equity = s.balanceSheet?.totalStockholderEquity;
        if (netInc && equity && equity > 0) {
          return { year: s.year, value: netInc / equity };
        }
        return { year: s.year, value: null };
      }),
      returnOnAssets: sorted.map(s => {
        const netInc = s.incomeStatement?.netIncome;
        const assets = s.balanceSheet?.totalAssets;
        if (netInc && assets && assets > 0) {
          return { year: s.year, value: netInc / assets };
        }
        return { year: s.year, value: null };
      })
    },
    cashFlow: {
      freeCashFlow: sorted.map(s => ({
        year: s.year,
        value: s.cashFlow?.freeCashFlow
      })),
      operatingCashFlow: sorted.map(s => ({
        year: s.year,
        value: s.cashFlow?.operatingCashFlow
      }))
    }
  };

  return transformed;
}

/**
 * Calculate current year ratios from latest financial statement
 * Profitability ratios come from the transformed trend series; liquidity/solvency
 * ratios are computed directly from the latest raw statement via ratio.formulas
 *
 * @param {object} financialData - Transformed financial data
 * @param {object} latestStatement - Most recent raw financial statement document
 * @returns {object} Current ratio metrics
 */
function calculateCurrentRatios(financialData, latestStatement) {
  if (!financialData || !financialData.incomeStatement || !financialData.balanceSheet) {
    return {};
  }

  // Get latest values (last element of each series)
  const getLatest = (series) => {
    if (!Array.isArray(series) || series.length === 0) {
      return null;
    }
    const valid = series.filter(s => s.value !== null && s.value !== undefined);
    return valid.length > 0 ? valid[valid.length - 1].value : null;
  };

  const income = financialData.incomeStatement;
  const balance = financialData.balanceSheet;

  const netMargin = getLatest(income.netMargin);
  const roe = getLatest(balance.returnOnEquity);
  const roa = getLatest(balance.returnOnAssets);

  return {
    netMargin,
    roe,
    roa,
    currentRatio: latestStatement ? ratioFormulas.currentRatio(latestStatement) : null,
    quickRatio: latestStatement ? ratioFormulas.quickRatio(latestStatement) : null,
    debtToEquity: latestStatement ? ratioFormulas.debtToEquity(latestStatement) : null,
    debtToAssets: latestStatement ? ratioFormulas.debtRatio(latestStatement) : null
  };
}

/**
 * Retrieve financial statements from MongoDB via the financials service
 * Throws CompanyNotFoundError (statusCode 404) if the ticker hasn't been imported
 *
 * @param {string} ticker - Stock ticker
 * @returns {Promise<Array>} Financial statements
 */
async function retrieveFinancialStatements(ticker) {
  return financialsService.getFinancialStatementsByTicker(ticker);
}

/**
 * Sort statements ascending by year and keep only the most recent `maxYears`
 *
 * @param {Array} statements - Raw financial statement documents
 * @param {number} maxYears - Maximum years to keep
 * @returns {Array} Windowed statements, oldest to newest
 */
function windowStatements(statements, maxYears = 5) {
  if (!Array.isArray(statements)) {
    return [];
  }

  return [...statements]
    .filter(s => s && s.year !== null && s.year !== undefined)
    .sort((a, b) => a.year - b.year)
    .slice(-maxYears);
}

/**
 * Calculate complete financial analysis
 * Main entry point for analysis service
 * 
 * @param {string} ticker - Stock ticker
 * @param {object} options - {years: number, weights: string|object}
 * @returns {Promise<object>} Complete analysis with trends, health score, insights
 */
async function calculateAnalysis(ticker, options = {}) {
  // Validate ticker
  const tickerValidation = validator.validateTicker(ticker);
  if (!tickerValidation.valid) {
    return {
      error: tickerValidation.error,
      status: 400
    };
  }

  // Validate query parameters
  const queryValidation = validator.validateAnalysisQuery(options);
  if (!queryValidation.valid) {
    return {
      error: `Validation errors: ${queryValidation.errors.join('; ')}`,
      status: 400
    };
  }

  const { years } = queryValidation.validated;
  const { weights } = queryValidation.validated;

  try {
    // Retrieve financial data
    const statements = await retrieveFinancialStatements(tickerValidation.ticker);

    // Validate sufficient data
    const dataValidation = validator.validateFinancialData(statements);
    if (!dataValidation.valid) {
      return {
        error: dataValidation.error,
        status: 404
      };
    }

    // Transform financial data into engine format
    const financialData = transformFinancialData(statements, years);

    // Calculate trends
    const trends = trendEngine.calculateAllTrends(financialData);

    // Current-period ratios come from the latest statement within the analysis window
    const windowed = windowStatements(statements, years);
    const latestStatement = windowed[windowed.length - 1] || null;
    const ratios = calculateCurrentRatios(financialData, latestStatement);

    // Validate ratios have sufficient data
    const ratioValidation = validator.validateRatios(ratios);
    // Note: We continue even if some ratios missing, as engines handle null values

    // Sanitize metrics
    const sanitizedRatios = validator.sanitizeMetrics(ratios);

    // Calculate health score
    const healthScore = healthScoreEngine.calculateHealthScore(sanitizedRatios, trends, weights);

    // Generate insights
    const insights = insightEngine.generateInsights(trends, sanitizedRatios, tickerValidation.ticker);

    // Format response
    const response = {
      ticker: tickerValidation.ticker,
      period: {
        startYear: windowed.length > 0 ? windowed[0].year : null,
        endYear: windowed.length > 0 ? windowed[windowed.length - 1].year : null,
        numYears: windowed.length
      },
      growth: {
        revenueCAGR: trends.growthMetrics?.revenueCAGR?.cagr || null,
        netIncomeCAGR: trends.growthMetrics?.netIncomeCAGR?.cagr || null,
        operatingIncomeCAGR: trends.growthMetrics?.operatingIncomeCAGR?.cagr || null,
        freeCashFlowCAGR: trends.growthMetrics?.freeCashFlowCAGR?.cagr || null,
        debtGrowth: trends.growthMetrics?.debtGrowth?.cagr || null,
        equityGrowth: trends.growthMetrics?.equityGrowth?.cagr || null,
        assetGrowth: trends.growthMetrics?.assetGrowth?.cagr || null
      },
      trends: {
        revenue: withSignChange(trends.growthMetrics?.revenueCAGR),
        netIncome: withSignChange(trends.growthMetrics?.netIncomeCAGR),
        operatingIncome: withSignChange(trends.growthMetrics?.operatingIncomeCAGR),
        operatingMargin: trends.marginTrends?.operatingMargin,
        netMargin: trends.marginTrends?.netMargin,
        cashFlow: withSignChange(trends.growthMetrics?.freeCashFlowCAGR),
        roe: trends.returnTrends?.roe?.trend,
        debtGrowth: withSignChange(trends.growthMetrics?.debtGrowth),
        equityGrowth: withSignChange(trends.growthMetrics?.equityGrowth),
        assetGrowth: withSignChange(trends.growthMetrics?.assetGrowth)
      },
      insights: insights.map(insight => ({
        category: insight.category,
        categoryLabel: formatCategoryLabel(insight.category),
        priority: insights.indexOf(insight) + 1,
        text: insight.text,
        confidence: insight.confidence,
        investorImportance: insight.investorImportance,
        forward: insight.forward
      })),
      healthScore: {
        overall: healthScore.overall,
        label: healthScore.label,
        color: healthScore.color,
        riskLevel: healthScore.riskLevel,
        components: healthScore.components,
        weights: healthScore.weights,
        explanation: healthScore.explanation
      },
      calculatedAt: new Date().toISOString()
    };

    return response;
  } catch (error) {
    if (error.statusCode) {
      return {
        error: error.message,
        status: error.statusCode
      };
    }
    logger.error({ err: error }, 'Analysis calculation error');
    return {
      error: `Analysis calculation failed: ${error.message}`,
      status: 500
    };
  }
}

/**
 * Combine a growth metric's trend direction with its sign-change fallback
 * (populated when CAGR can't be expressed as a percentage, e.g. loss-to-profit)
 * so the frontend always has something meaningful to render, never a bare N/A
 *
 * @param {object} growthMetric - Entry from trends.growthMetrics (e.g. revenueCAGR)
 * @returns {object|undefined} {direction, label, consistency, signChange}
 */
function withSignChange(growthMetric) {
  if (!growthMetric) {
    return undefined;
  }
  return { ...growthMetric.trend, signChange: growthMetric.signChange || null };
}

/**
 * Format insight category name for display
 * @param {string} category - Category internal name
 * @returns {string} Formatted display name
 */
function formatCategoryLabel(category) {
  const labels = {
    revenueGrowth: 'Revenue Growth',
    profitMargin: 'Profit Margin',
    debtPosition: 'Debt Position',
    cashFlow: 'Cash Generation',
    returnOnInvestment: 'Return on Investment',
    liquidity: 'Liquidity Position',
    stability: 'Overall Stability'
  };

  return labels[category] || category;
}

/**
 * Get analysis for multiple companies
 * Useful for portfolio screening
 * 
 * @param {Array<string>} tickers - Array of stock tickers
 * @param {object} options - Analysis options
 * @returns {Promise<Array>} Array of analyses
 */
async function calculateAnalysisMultiple(tickers, options = {}) {
  if (!Array.isArray(tickers)) {
    return { error: 'Tickers must be an array' };
  }

  const results = [];

  for (const ticker of tickers) {
    const analysis = await calculateAnalysis(ticker, options);
    results.push(analysis);
  }

  return results;
}

module.exports = {
  transformFinancialData,
  calculateCurrentRatios,
  retrieveFinancialStatements,
  windowStatements,
  calculateAnalysis,
  calculateAnalysisMultiple,
  formatCategoryLabel
};
