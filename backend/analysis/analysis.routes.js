/**
 * Analysis Routes
 * API endpoints for financial analysis
 */

const express = require('express');
const controller = require('./analysis.controller');

const router = express.Router();

/**
 * GET /api/analysis/health
 * Health check for analysis service
 */
router.get('/health', controller.healthCheck);

/**
 * GET /api/analysis/:ticker
 * Complete financial analysis for a single company
 * 
 * Query Parameters:
 *   - years: 2-20 (default: 5)
 *   - weights: 'balanced' | 'growthFocused' | 'safetyFocused' | custom JSON
 * 
 * Response:
 *   - Growth metrics (CAGR)
 *   - Trends (direction indicators)
 *   - 5-7 key insights
 *   - Health score with components
 * 
 * Example:
 *   GET /api/analysis/AAPL
 *   GET /api/analysis/AAPL?years=10
 *   GET /api/analysis/AAPL?weights=growthFocused
 *   GET /api/analysis/AAPL?weights={"profitability":0.25,"liquidity":0.25,"solvency":0.2,"cashFlow":0.15,"growth":0.15}
 */
router.get('/:ticker', controller.getAnalysis);

/**
 * GET /api/analysis/:ticker/trends
 * Get only trend metrics and growth indicators (lightweight)
 * 
 * Response:
 *   - Period info
 *   - Growth metrics (CAGR)
 *   - Trend directions
 */
router.get('/:ticker/trends', controller.getTrends);

/**
 * GET /api/analysis/:ticker/insights
 * Get only business insights (lightweight)
 * 
 * Response:
 *   - 5-7 key business insights
 *   - Each insight with text, confidence, category
 */
router.get('/:ticker/insights', controller.getInsights);

/**
 * GET /api/analysis/:ticker/health-score
 * Get only health score and component breakdown (lightweight)
 * 
 * Response:
 *   - Overall score (0-100)
 *   - Label (Excellent/Good/Average/Weak/Poor)
 *   - Component scores (Profitability, Liquidity, Solvency, Cash Flow, Growth)
 *   - Explanation
 */
router.get('/:ticker/health-score', controller.getHealthScore);

/**
 * GET /api/analysis/batch
 * Calculate analysis for multiple companies (portfolio screening)
 * 
 * Query Parameters:
 *   - tickers: Comma-separated list of tickers (e.g., AAPL,MSFT,GOOGL)
 *   - years: 2-20 (default: 5)
 *   - weights: Strategy or custom JSON
 * 
 * Response:
 *   - totalRequested
 *   - totalSuccessful
 *   - totalFailed
 *   - analyses: Array of full analysis objects
 *   - errors: Array of failed analyses (if any)
 * 
 * Example:
 *   GET /api/analysis/batch?tickers=AAPL,MSFT,GOOGL
 *   GET /api/analysis/batch?tickers=AAPL,MSFT&years=10&weights=safetyFocused
 */
router.get('/batch', controller.getAnalysisBatch);

module.exports = router;
