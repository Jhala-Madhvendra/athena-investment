/**
 * Analysis Controller
 * Handles HTTP requests for financial analysis endpoint
 */

const analysisService = require('./analysis.service');
const validator = require('./analysis.validator');
const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Logs the full error server-side and returns a client-safe message.
 * Unexpected errors never leak internals to the client in production.
 */
const safeErrorMessage = (prefix, error) => {
  logger.error({ err: error }, `${prefix}: ${error.message}`);
  return env.isProduction
    ? 'Something went wrong. Please try again.'
    : `${prefix}: ${error.message}`;
};

/**
 * GET /api/analysis/:ticker
 * Calculate complete financial analysis for a company
 * 
 * Query Parameters:
 *   - years: Number of years to analyze (2-20, default 5)
 *   - weights: Weighting strategy (balanced, growthFocused, safetyFocused) or custom JSON
 * 
 * Response:
 *   - Growth metrics (CAGR for revenue, earnings, FCF)
 *   - Trend indicators (↑ improving, ↓ declining, → stable)
 *   - 5-7 key business insights
 *   - Financial Health Score (0-100) with component breakdown
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
async function getAnalysis(req, res) {
  try {
    const { ticker } = req.params;
    const { years, weights } = req.query;

    // Validate ticker
    const tickerValidation = validator.validateTicker(ticker);
    if (!tickerValidation.valid) {
      return res.status(400).json({
        error: tickerValidation.error,
        status: 400
      });
    }

    // Parse weights if provided as JSON string
    let parsedWeights = weights;
    if (typeof weights === 'string') {
      try {
        // Try to parse as JSON first
        parsedWeights = JSON.parse(weights);
      } catch (e) {
        // Otherwise treat as strategy name
        parsedWeights = weights;
      }
    }

    // Calculate analysis
    const analysis = await analysisService.calculateAnalysis(
      tickerValidation.ticker,
      { years, weights: parsedWeights }
    );

    // Handle errors from service
    if (analysis.error) {
      return res.status(analysis.status || 500).json({
        error: analysis.error,
        status: analysis.status || 500
      });
    }

    return res.status(200).json(analysis);
  } catch (error) {
    return res.status(500).json({
      error: safeErrorMessage('Failed to generate analysis', error),
      status: 500
    });
  }
}

/**
 * GET /api/analysis/batch
 * Calculate analysis for multiple companies (portfolio screening)
 * 
 * Query Parameters:
 *   - tickers: Comma-separated list of tickers (e.g., AAPL,MSFT,GOOGL)
 *   - years: Number of years to analyze (default 5)
 *   - weights: Weighting strategy (default balanced)
 * 
 * Response:
 *   Array of analysis objects (same as single ticker)
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
async function getAnalysisBatch(req, res) {
  try {
    const { tickers, years, weights } = req.query;

    if (!tickers || typeof tickers !== 'string') {
      return res.status(400).json({
        error: 'Tickers parameter required (comma-separated)',
        status: 400
      });
    }

    // Parse ticker list
    const tickerList = tickers
      .split(',')
      .map(t => t.trim().toUpperCase())
      .filter(t => t.length > 0);

    if (tickerList.length === 0) {
      return res.status(400).json({
        error: 'At least one valid ticker required',
        status: 400
      });
    }

    if (tickerList.length > 50) {
      return res.status(400).json({
        error: 'Maximum 50 tickers per batch request',
        status: 400
      });
    }

    // Parse weights if provided as JSON string
    let parsedWeights = weights;
    if (typeof weights === 'string' && weights.startsWith('{')) {
      try {
        parsedWeights = JSON.parse(weights);
      } catch (e) {
        parsedWeights = weights;
      }
    }

    // Calculate analysis for each ticker
    const analyses = await analysisService.calculateAnalysisMultiple(
      tickerList,
      { years, weights: parsedWeights }
    );

    // Separate successful and failed analyses
    const successful = analyses.filter(a => !a.error);
    const failed = analyses.filter(a => a.error);

    return res.status(200).json({
      totalRequested: tickerList.length,
      totalSuccessful: successful.length,
      totalFailed: failed.length,
      analyses: successful,
      errors: failed.length > 0 ? failed : undefined
    });
  } catch (error) {
    return res.status(500).json({
      error: safeErrorMessage('Failed to generate batch analysis', error),
      status: 500
    });
  }
}

/**
 * GET /api/analysis/:ticker/trends
 * Get only trend metrics and growth indicators
 * (Lighter weight if insights/health score not needed)
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
async function getTrends(req, res) {
  try {
    const { ticker } = req.params;
    const { years } = req.query;

    const tickerValidation = validator.validateTicker(ticker);
    if (!tickerValidation.valid) {
      return res.status(400).json({ error: tickerValidation.error });
    }

    const analysis = await analysisService.calculateAnalysis(
      tickerValidation.ticker,
      { years }
    );

    if (analysis.error) {
      return res.status(analysis.status || 500).json(analysis);
    }

    // Return only trends and growth
    return res.status(200).json({
      ticker: analysis.ticker,
      period: analysis.period,
      growth: analysis.growth,
      trends: analysis.trends,
      calculatedAt: analysis.calculatedAt
    });
  } catch (error) {
    return res.status(500).json({
      error: safeErrorMessage('Failed to retrieve trends', error)
    });
  }
}

/**
 * GET /api/analysis/:ticker/insights
 * Get only insights (minimal response)
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
async function getInsights(req, res) {
  try {
    const { ticker } = req.params;
    const { years, weights } = req.query;

    const tickerValidation = validator.validateTicker(ticker);
    if (!tickerValidation.valid) {
      return res.status(400).json({ error: tickerValidation.error });
    }

    let parsedWeights = weights;
    if (typeof weights === 'string' && weights.startsWith('{')) {
      try {
        parsedWeights = JSON.parse(weights);
      } catch (e) {
        parsedWeights = weights;
      }
    }

    const analysis = await analysisService.calculateAnalysis(
      tickerValidation.ticker,
      { years, weights: parsedWeights }
    );

    if (analysis.error) {
      return res.status(analysis.status || 500).json(analysis);
    }

    return res.status(200).json({
      ticker: analysis.ticker,
      insights: analysis.insights,
      calculatedAt: analysis.calculatedAt
    });
  } catch (error) {
    return res.status(500).json({
      error: safeErrorMessage('Failed to retrieve insights', error)
    });
  }
}

/**
 * GET /api/analysis/:ticker/health-score
 * Get only health score (minimal response)
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
async function getHealthScore(req, res) {
  try {
    const { ticker } = req.params;
    const { years, weights } = req.query;

    const tickerValidation = validator.validateTicker(ticker);
    if (!tickerValidation.valid) {
      return res.status(400).json({ error: tickerValidation.error });
    }

    let parsedWeights = weights;
    if (typeof weights === 'string' && weights.startsWith('{')) {
      try {
        parsedWeights = JSON.parse(weights);
      } catch (e) {
        parsedWeights = weights;
      }
    }

    const analysis = await analysisService.calculateAnalysis(
      tickerValidation.ticker,
      { years, weights: parsedWeights }
    );

    if (analysis.error) {
      return res.status(analysis.status || 500).json(analysis);
    }

    return res.status(200).json({
      ticker: analysis.ticker,
      healthScore: analysis.healthScore,
      calculatedAt: analysis.calculatedAt
    });
  } catch (error) {
    return res.status(500).json({
      error: safeErrorMessage('Failed to retrieve health score', error)
    });
  }
}

/**
 * Health check endpoint
 * Verifies analysis service is operational
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
function healthCheck(req, res) {
  return res.status(200).json({
    status: 'operational',
    service: 'analysis',
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  getAnalysis,
  getAnalysisBatch,
  getTrends,
  getInsights,
  getHealthScore,
  healthCheck
};
