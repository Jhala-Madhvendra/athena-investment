/**
 * Analysis Validator
 * Validates input data for analysis pipeline
 */

/**
 * Validate ticker format
 * Accepts plain tickers (1-5 alphanumeric, e.g. AAPL) and exchange-suffixed
 * tickers (up to 10 alphanumeric chars, a dot, 1-5 letters, e.g. WIPRO.NS,
 * TATAPOWER.NS) - matches the pattern already used by company.service.js
 * @param {string} ticker - Stock ticker symbol
 * @returns {object} {valid: boolean, error: string}
 */
function validateTicker(ticker) {
  if (!ticker || typeof ticker !== 'string') {
    return { valid: false, error: 'Ticker must be a non-empty string' };
  }

  const cleaned = ticker.toUpperCase().trim();
  const tickerPattern = /^([A-Z0-9]{1,5}|[A-Z0-9]{1,10}\.[A-Z]{1,5})$/;

  if (!tickerPattern.test(cleaned)) {
    return {
      valid: false,
      error: 'Ticker must be 1-5 alphanumeric characters, or an exchange-suffixed ticker like SYMBOL.NS'
    };
  }

  return { valid: true, ticker: cleaned };
}

/**
 * Validate year range parameter
 * @param {number} years - Number of years to analyze
 * @returns {object} {valid: boolean, error: string, years: number}
 */
function validateYears(years) {
  if (years === null || years === undefined) {
    // Default to 5
    return { valid: true, years: 5 };
  }

  const parsed = parseInt(years, 10);

  if (!Number.isInteger(parsed) || parsed < 2 || parsed > 20) {
    return { valid: false, error: 'Years must be an integer between 2 and 20' };
  }

  return { valid: true, years: parsed };
}

/**
 * Validate health score weighting configuration
 * @param {object|string} weights - Weighting strategy or custom weights object
 * @returns {object} {valid: boolean, error: string, weights: object}
 */
function validateWeights(weights) {
  if (weights === null || weights === undefined) {
    // Default to balanced
    return {
      valid: true,
      weights: 'balanced'
    };
  }

  // String: must be predefined strategy
  if (typeof weights === 'string') {
    const strategies = ['balanced', 'growthFocused', 'safetyFocused'];
    if (!strategies.includes(weights)) {
      return {
        valid: false,
        error: `Weighting strategy must be one of: ${strategies.join(', ')}`
      };
    }
    return { valid: true, weights };
  }

  // Object: validate structure
  if (typeof weights === 'object') {
    const required = ['profitability', 'liquidity', 'solvency', 'cashFlow', 'growth'];
    const missing = required.filter(w => weights[w] === undefined);

    if (missing.length > 0) {
      return {
        valid: false,
        error: `Missing weight keys: ${missing.join(', ')}`
      };
    }

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);

    if (Math.abs(sum - 1.0) > 0.01) {
      return {
        valid: false,
        error: `Weights must sum to 1.0 (got ${sum.toFixed(2)})`
      };
    }

    // Validate each weight is 0-1
    for (const [key, value] of Object.entries(weights)) {
      if (typeof value !== 'number' || value < 0 || value > 1) {
        return {
          valid: false,
          error: `Weight ${key} must be a number between 0 and 1`
        };
      }
    }

    return { valid: true, weights };
  }

  return { valid: false, error: 'Weights must be a string or object' };
}

/**
 * Validate financial statements retrieved from the database
 * Requires at least 2 distinct years to calculate CAGR/trends
 * @param {Array} statements - Array of financial statement documents ({year, incomeStatement, balanceSheet, cashFlow})
 * @returns {object} {valid: boolean, error: string, dataPoints: number}
 */
function validateFinancialData(statements) {
  if (!Array.isArray(statements)) {
    return { valid: false, error: 'Financial data must be an array of statements', dataPoints: 0 };
  }

  const validYears = statements.filter(s => s && s.year !== null && s.year !== undefined).length;

  if (validYears < 2) {
    return {
      valid: false,
      error: 'Insufficient financial data: need at least 2 years of data',
      dataPoints: validYears
    };
  }

  return { valid: true, dataPoints: validYears };
}

/**
 * Validate ratio data completeness
 * @param {object} ratios - Ratio metrics
 * @returns {object} {valid: boolean, missingFields: Array}
 */
function validateRatios(ratios) {
  if (!ratios || typeof ratios !== 'object') {
    return { valid: false, missingFields: ['all ratios'] };
  }

  const required = [
    'netMargin', 'roe', 'roa',
    'currentRatio', 'quickRatio',
    'debtToEquity', 'debtToAssets'
  ];

  const missing = required.filter(field => {
    const value = ratios[field];
    return value === null || value === undefined;
  });

  if (missing.length > 0) {
    return { valid: false, missingFields: missing };
  }

  return { valid: true, missingFields: [] };
}

/**
 * Validate query parameters for /api/analysis/:ticker
 * @param {object} query - Query parameters
 * @returns {object} {valid: boolean, errors: Array, validated: object}
 */
function validateAnalysisQuery(query = {}) {
  const errors = [];
  const validated = {};

  // Validate years
  const yearsValidation = validateYears(query.years);
  if (!yearsValidation.valid) {
    errors.push(yearsValidation.error);
  } else {
    validated.years = yearsValidation.years;
  }

  // Validate weights
  const weightsValidation = validateWeights(query.weights);
  if (!weightsValidation.valid) {
    errors.push(weightsValidation.error);
  } else {
    validated.weights = weightsValidation.weights;
  }

  return {
    valid: errors.length === 0,
    errors,
    validated
  };
}

/**
 * Sanitize numeric metric
 * Ensures value is finite number or null
 * @param {*} value - Value to sanitize
 * @returns {number|null} Sanitized value
 */
function sanitizeMetric(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const num = Number(value);

  if (!Number.isFinite(num)) {
    return null;
  }

  return num;
}

/**
 * Sanitize all metrics in an object
 * @param {object} metrics - Metrics object
 * @returns {object} Sanitized metrics
 */
function sanitizeMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object') {
    return {};
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(metrics)) {
    if (Array.isArray(value)) {
      sanitized[key] = value.map(v => sanitizeMetric(v));
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetrics(value);
    } else {
      sanitized[key] = sanitizeMetric(value);
    }
  }

  return sanitized;
}

module.exports = {
  validateTicker,
  validateYears,
  validateWeights,
  validateFinancialData,
  validateRatios,
  validateAnalysisQuery,
  sanitizeMetric,
  sanitizeMetrics
};
