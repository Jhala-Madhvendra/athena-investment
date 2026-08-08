/**
 * Insight Engine
 * Generates 5-7 human-readable business insights from trend data
 * 
 * 7 Insight Categories:
 * 1. Revenue Growth
 * 2. Profit Efficiency
 * 3. Debt Position
 * 4. Cash Generation
 * 5. Return on Investment
 * 6. Liquidity Position
 * 7. Overall Stability
 */

/**
 * Insight templates organized by category and intensity
 */
const insightTemplates = {
  revenueGrowth: {
    excellent: {
      strong: 'Revenue has grown at {cagr}% annually, demonstrating strong and consistent market expansion.',
      accelerating: 'Revenue growth is accelerating, reaching {latestGrowth}% in {latestYear}, up from {priorGrowth}% in {priorYear}.',
      consistent: 'Consistent revenue growth of {cagr}% over {years} years shows a sustainable and predictable business model.'
    },
    strong: {
      standard: 'Revenue is growing at {cagr}%, above industry average and demonstrating solid market share gains.',
      outperforming: 'Strong revenue growth of {cagr}% indicates the company is gaining market share in its industry.'
    },
    moderate: {
      matureGrowth: 'Revenue growth of {cagr}% is typical for a mature business. Focus shifts to profitability and cash generation.',
      belowPeers: 'Revenue growth of {cagr}% trails peer average of {peerCAGR}%. Investigate competitive positioning.'
    },
    weak: {
      stagnant: 'Revenue growth has slowed to {cagr}%, indicating market maturity or competitive pressures.'
    },
    declining: {
      contraction: 'Revenue has contracted at {cagr}% annually, suggesting market share loss or industry headwinds.'
    },
    signChange: {
      generic: '{label} for revenue over the period, which means a standard growth-rate comparison does not apply here — {tone}.'
    }
  },
  profitMargin: {
    improving: {
      strong: 'Profitability is improving: {metric} margin expanded {bps} basis points over {years} years, indicating strong cost management.',
      accelerating: '{metric} margin expanded {bps} basis points in {latestYear}, accelerating from {priorBps} in {priorYear}.'
    },
    stable: {
      consistent: 'Profit margins are stable at {margin}%, reflecting consistent operational control and disciplined cost management.'
    },
    declining: {
      pressure: '{metric} margins are under pressure, declining {bps} basis points. Rising costs or pricing competition evident.',
      deteriorating: '{metric} margin has deteriorated from {priorMargin}% to {currentMargin}%, indicating profitability challenges.'
    }
  },
  debtPosition: {
    wellManaged: {
      conservative: 'Debt-to-equity ratio of {ratio} indicates conservative capital structure. Debt is well-managed relative to equity.',
      paying: 'Company is actively reducing debt: {metric} has declined {reduction}% over {years} years, improving financial flexibility.'
    },
    moderate: {
      standard: 'Debt levels are at typical industry levels. Capital structure appears appropriately balanced.'
    },
    risingRapidly: {
      concerning: 'Debt-to-equity ratio of {ratio} is elevated and rising, increasing financial risk. Monitor debt growth relative to revenue growth.',
      acceleration: 'Debt-to-equity ratio has risen to {ratio}, reducing financial flexibility.'
    },
    excessive: {
      critical: 'Debt levels are elevated at {ratio} debt-to-equity, limiting borrowing capacity and increasing interest rate exposure.',
      warning: 'Excessive leverage of {ratio} debt-to-equity represents significant financial risk if business pressures emerge.'
    }
  },
  cashFlow: {
    strong: {
      healthy: 'Free cash flow grows at {cagr}% annually, providing resources for growth investment and shareholder returns.',
      generation: 'Strong cash generation enables {company} to self-fund capital investments while maintaining financial flexibility.'
    },
    adequate: {
      positive: 'Free cash flow is positive and growing at {cagr}% annually, providing adequate resources to self-fund operations and modest capital investments.'
    },
    weak: {
      declining: 'Free cash flow growth is weak at {cagr}% annually. Limited resources available for growth or dividends.',
      burning: 'Free cash flow growth has turned negative, indicating heavy capital expenditures or working capital challenges.'
    },
    signChange: {
      generic: '{label} for free cash flow over the period — {tone}.'
    }
  },
  returnOnInvestment: {
    excellent: {
      strong: 'Return on equity of {roe}% indicates excellent capital efficiency and strong profitability relative to shareholder capital.',
      improving: 'ROE has improved from {priorROE}% to {currentROE}%, indicating strengthening capital efficiency.'
    },
    fair: {
      average: 'ROE of {roe}% is close to equity risk premium; capital is being deployed with average efficiency.',
      declining: 'ROE has declined from {priorROE}% to {currentROE}%, suggesting deteriorating capital efficiency.'
    },
    weak: {
      poor: 'ROE of {roe}% is below industry average, indicating inefficient capital deployment.'
    }
  },
  liquidity: {
    strong: {
      confident: 'Strong liquidity position with current ratio of {ratio}, meaning {company} can cover current liabilities {multiple}x over.',
      comfortable: 'Ample liquid assets provide comfort that {company} can meet short-term obligations without financial stress.'
    },
    adequate: {
      sufficient: 'Current ratio of {ratio} indicates adequate liquidity. Typical for healthy, operational companies.'
    },
    tight: {
      watch: 'Liquidity is tight with current ratio of {ratio}. Monitor cash flow carefully for potential stress.'
    },
    risky: {
      critical: 'Current ratio below 1.0 indicates {company} cannot cover all current liabilities with current assets. Immediate liquidity risk.'
    }
  },
  stability: {
    consistent: {
      predictable: 'Financial performance is consistent across all metrics, with clear positive trends. Investors can forecast results with confidence.',
      reliable: 'Multiple independent financial metrics show aligned positive trends, indicating a reliable and stable business model.'
    },
    uneven: {
      mixed: '{company} shows a mix of financial strengths and weaknesses across metrics. Mixed signals require closer monitoring.',
      conflicting: 'Financial metrics show conflicting signals for {company}. Investigate underlying drivers.'
    },
    volatile: {
      uncertain: 'Financial performance is erratic with inconsistent metrics. This creates forecasting uncertainty; close monitoring warranted.',
      risky: 'Multiple deteriorating metrics signal financial challenges for {company}. Business faces headwinds requiring management attention.'
    }
  }
};

/**
 * Rule definitions for each insight category
 * Each rule evaluates to true/false and returns confidence score
 */
class InsightRules {
  /**
   * Revenue Growth insight rules
   * @param {object} trends - Trend data
   * @returns {object} {triggered: bool, type: string, confidence: 0-100, context: object}
   */
  static evaluateRevenueGrowth(trends) {
    if (!trends || !trends.growthMetrics || !trends.growthMetrics.revenueCAGR) {
      return { triggered: false, confidence: 0 };
    }

    const { cagr, consistency, signChange } = trends.growthMetrics.revenueCAGR;

    if (cagr === null) {
      return { triggered: false, confidence: 0 };
    }

    if (cagr === 'N/A' || cagr === 'infinite') {
      if (!signChange) {
        return { triggered: false, confidence: 0 };
      }
      return {
        triggered: true,
        category: 'revenueGrowth',
        type: 'signChange',
        confidence: 70,
        context: {
          label: signChange.label,
          tone: signChange.positive ? 'a positive inflection point worth highlighting' : 'a trend worth monitoring closely'
        }
      };
    }

    const cagrPercent = cagr * 100;
    let type, confidence;

    if (cagrPercent >= 15 && consistency >= 75) {
      type = 'excellent';
      confidence = Math.min(95, 70 + consistency);
    } else if (cagrPercent >= 10 && consistency >= 70) {
      type = 'strong';
      confidence = Math.min(90, 70 + consistency);
    } else if (cagrPercent >= 5 && cagrPercent < 10) {
      type = 'moderate';
      confidence = 75;
    } else if (cagrPercent >= 2 && cagrPercent < 5) {
      type = 'weak';
      confidence = 60;
    } else if (cagrPercent < 0) {
      type = 'declining';
      confidence = Math.min(90, 70 + Math.abs(consistency - 100));
    } else {
      return { triggered: false, confidence: 0 };
    }

    return {
      triggered: true,
      category: 'revenueGrowth',
      type,
      confidence,
      context: {
        cagr: Number((cagrPercent).toFixed(1)),
        consistency,
        years: trends.growthMetrics.revenueCAGR.period?.numYears || 4,
        direction: trends.growthMetrics.revenueCAGR.trend?.direction
      }
    };
  }

  /**
   * Profit Margin insight rules
   */
  static evaluateProfitMargin(trends) {
    if (!trends || !trends.marginTrends) {
      return { triggered: false, confidence: 0 };
    }

    const operatingMargin = trends.marginTrends.operatingMargin;
    const netMargin = trends.marginTrends.netMargin;

    if (!operatingMargin || operatingMargin.direction === '?') {
      return { triggered: false, confidence: 0 };
    }

    let type, confidence, metric, change;

    // Use operating margin as primary indicator
    if (operatingMargin.direction === '↑' && operatingMargin.consistency >= 70) {
      type = 'improving';
      confidence = Math.min(95, 70 + operatingMargin.consistency);
      metric = 'Operating';
      change = operatingMargin.change3y;
    } else if (operatingMargin.direction === '→' && Math.abs(operatingMargin.latestChange) < 100) {
      type = 'stable';
      confidence = 80;
      metric = 'Operating';
      change = 0;
    } else if (operatingMargin.direction === '↓') {
      type = 'declining';
      confidence = Math.min(90, 70 + operatingMargin.consistency);
      metric = 'Operating';
      change = operatingMargin.change3y;
    } else {
      return { triggered: false, confidence: 0 };
    }

    return {
      triggered: true,
      category: 'profitMargin',
      type,
      confidence,
      context: {
        metric,
        margin: operatingMargin.latest,
        bps: Math.abs(change),
        years: 3,
        direction: operatingMargin.direction
      }
    };
  }

  /**
   * Debt Position insight rules
   */
  static evaluateDebtPosition(trends, ratios = {}) {
    if (!trends || !trends.assetDebtGrowth || !ratios) {
      return { triggered: false, confidence: 0 };
    }

    const debtRatio = ratios.debtToEquity;

    if (debtRatio === null || debtRatio === undefined) {
      return { triggered: false, confidence: 0 };
    }

    let type, confidence, context;

    if (debtRatio < 0.5) {
      type = 'wellManaged';
      confidence = 85;
      context = { ratio: debtRatio.toFixed(2) };
    } else if (debtRatio < 1.5) {
      type = 'moderate';
      confidence = 70;
      context = { ratio: debtRatio.toFixed(2) };
    } else if (debtRatio < 2.5) {
      type = 'risingRapidly';
      confidence = 80;
      context = { ratio: debtRatio.toFixed(2) };
    } else {
      type = 'excessive';
      confidence = 90;
      context = { ratio: debtRatio.toFixed(2) };
    }

    return {
      triggered: true,
      category: 'debtPosition',
      type,
      confidence,
      context
    };
  }

  /**
   * Cash Flow insight rules
   */
  static evaluateCashFlow(trends) {
    if (!trends || !trends.growthMetrics || !trends.growthMetrics.freeCashFlowCAGR) {
      return { triggered: false, confidence: 0 };
    }

    const { cagr, consistency, signChange } = trends.growthMetrics.freeCashFlowCAGR;

    if (cagr === null) {
      return { triggered: false, confidence: 0 };
    }

    if (cagr === 'N/A' || cagr === 'infinite') {
      if (!signChange) {
        return { triggered: false, confidence: 0 };
      }
      return {
        triggered: true,
        category: 'cashFlow',
        type: 'signChange',
        confidence: 70,
        context: {
          label: signChange.label,
          tone: signChange.positive ? 'a positive inflection point worth highlighting' : 'a trend worth monitoring closely'
        }
      };
    }

    const cagrPercent = cagr * 100;
    let type, confidence;

    if (cagrPercent >= 8 && consistency >= 70) {
      type = 'strong';
      confidence = Math.min(95, 70 + consistency);
    } else if (cagrPercent >= 2 && cagrPercent < 8) {
      type = 'adequate';
      confidence = 75;
    } else if (cagrPercent < 0) {
      type = 'weak';
      confidence = Math.min(90, 70 + consistency);
    } else {
      return { triggered: false, confidence: 0 };
    }

    return {
      triggered: true,
      category: 'cashFlow',
      type,
      confidence,
      context: {
        cagr: Number((cagrPercent).toFixed(1)),
        consistency,
        direction: trends.growthMetrics.freeCashFlowCAGR.trend?.direction
      }
    };
  }

  /**
   * Return on Investment insight rules
   */
  static evaluateReturnOnInvestment(trends, ratios = {}) {
    if (!ratios) {
      return { triggered: false, confidence: 0 };
    }

    const roe = ratios.roe;

    if (roe === null || roe === undefined) {
      return { triggered: false, confidence: 0 };
    }

    const roePercent = roe * 100;
    let type, confidence;

    if (roePercent >= 15) {
      type = 'excellent';
      confidence = 85;
    } else if (roePercent >= 10) {
      type = 'fair';
      confidence = 75;
    } else if (roePercent >= 5) {
      type = 'fair';
      confidence = 65;
    } else {
      type = 'weak';
      confidence = 80;
    }

    return {
      triggered: true,
      category: 'returnOnInvestment',
      type,
      confidence,
      context: {
        roe: Number((roePercent).toFixed(1))
      }
    };
  }

  /**
   * Liquidity Position insight rules
   */
  static evaluateLiquidity(ratios = {}) {
    const currentRatio = ratios.currentRatio;

    if (currentRatio === null || currentRatio === undefined) {
      return { triggered: false, confidence: 0 };
    }

    let type, confidence;

    if (currentRatio > 2.0) {
      type = 'strong';
      confidence = 85;
    } else if (currentRatio >= 1.2) {
      type = 'adequate';
      confidence = 80;
    } else if (currentRatio >= 0.9) {
      type = 'tight';
      confidence = 80;
    } else {
      type = 'risky';
      confidence = 95;
    }

    return {
      triggered: true,
      category: 'liquidity',
      type,
      confidence,
      context: {
        ratio: Number((currentRatio).toFixed(2)),
        multiple: currentRatio >= 1 ? Math.round(currentRatio * 10) / 10 : 'below 1'
      }
    };
  }

  /**
   * Overall Stability insight rules
   */
  static evaluateStability(trends, ratios = {}) {
    if (!trends) {
      return { triggered: false, confidence: 0 };
    }

    // Count strong vs. weak signals
    let strongSignals = 0;
    let weakSignals = 0;
    let totalSignals = 0;

    // Revenue trend
    if (trends.growthMetrics?.revenueCAGR?.consistency >= 75) {
      strongSignals++;
    } else if (trends.growthMetrics?.revenueCAGR?.consistency < 50) {
      weakSignals++;
    }
    totalSignals++;

    // Margin trend
    if (trends.marginTrends?.operatingMargin?.consistency >= 70) {
      if (trends.marginTrends.operatingMargin.direction === '↑') {
        strongSignals++;
      } else if (trends.marginTrends.operatingMargin.direction === '↓') {
        weakSignals++;
      }
    }
    totalSignals++;

    // Growth consistency
    if (trends.growthMetrics?.netIncomeCAGR?.consistency >= 75) {
      strongSignals++;
    } else if (trends.growthMetrics?.netIncomeCAGR?.consistency < 50) {
      weakSignals++;
    }
    totalSignals++;

    let type, confidence;

    if (strongSignals >= 2 && weakSignals === 0) {
      type = 'consistent';
      confidence = 90;
    } else if (strongSignals >= 1 && weakSignals <= 1) {
      type = 'uneven';
      confidence = 75;
    } else if (weakSignals >= 2) {
      type = 'volatile';
      confidence = 85;
    } else {
      return { triggered: false, confidence: 0 };
    }

    return {
      triggered: true,
      category: 'stability',
      type,
      confidence,
      context: {
        strongSignals,
        weakSignals,
        totalSignals
      }
    };
  }
}

/**
 * Fill template with context variables
 * @param {string} template - Template string with {VAR} placeholders
 * @param {object} context - Variable values
 * @returns {string} Filled template
 */
function fillTemplate(template, context = {}) {
  if (!template) {
    return '';
  }

  return template.replace(/{(\w+)}/g, (match, key) => {
    return context[key] !== undefined ? context[key] : match;
  });
}

/**
 * Select and prioritize insights
 * Returns top 5-7 insights by priority and confidence
 * 
 * @param {Array} allInsights - All evaluated insights
 * @param {number} maxInsights - Maximum number to return (default 7)
 * @returns {Array} Prioritized insights
 */
function prioritizeInsights(allInsights, maxInsights = 7) {
  if (!Array.isArray(allInsights)) {
    return [];
  }

  const triggered = allInsights.filter(i => i.triggered);

  if (triggered.length === 0) {
    return [];
  }

  // Define priority order
  const priorityMap = {
    revenueGrowth: 1,
    profitMargin: 2,
    debtPosition: 3,
    returnOnInvestment: 4,
    cashFlow: 5,
    liquidity: 6,
    stability: 7
  };

  // Sort by priority, then by confidence
  triggered.sort((a, b) => {
    const priorityDiff = priorityMap[a.category] - priorityMap[b.category];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return b.confidence - a.confidence; // Higher confidence first
  });

  return triggered.slice(0, maxInsights);
}

/**
 * Generate insight text from template
 * @param {object} insight - Insight object with category, type, context
 * @param {string} companyName - Ticker/company name to fill {company} placeholders
 * @returns {object} Complete insight with text
 */
function generateInsightText(insight, companyName = 'The company') {
  if (!insight || !insight.category || !insight.type) {
    return null;
  }

  const categoryTemplates = insightTemplates[insight.category];
  if (!categoryTemplates) {
    return null;
  }

  const typeTemplates = categoryTemplates[insight.type];
  if (!typeTemplates) {
    return null;
  }

  // Select template (use first available)
  let template = null;
  for (const key in typeTemplates) {
    template = typeTemplates[key];
    break;
  }

  if (!template) {
    return null;
  }

  const context = { company: companyName, ...(insight.context || {}) };
  const text = fillTemplate(template, context);

  return {
    ...insight,
    text,
    investorImportance: getInvestorImportance(insight.category),
    forward: getForwardLookingStatement(insight.category, insight.type)
  };
}

/**
 * Get investor importance for category
 */
function getInvestorImportance(category) {
  const importance = {
    revenueGrowth: 'Revenue growth is the primary driver of valuation multiples and long-term business value.',
    profitMargin: 'Margin trends signal competitive strength and operational efficiency.',
    debtPosition: 'Debt levels determine financial flexibility and default risk.',
    cashFlow: 'Cash generation is essential for funding growth and weathering downturns.',
    returnOnInvestment: 'Returns on capital determine shareholder value creation.',
    liquidity: 'Liquidity ensures the company can meet obligations and fund operations.',
    stability: 'Financial stability enables predictable performance and lower valuation risk.'
  };

  return importance[category] || 'Financial metric relevant to company assessment.';
}

/**
 * Get forward-looking statement for category/type
 */
function getForwardLookingStatement(category, type) {
  const statements = {
    revenueGrowth: {
      excellent: 'Continued strong growth likely if market demand remains robust.',
      strong: 'Growth momentum supports optimistic near-term outlook.',
      moderate: 'Mature growth trajectory suggests focus on profitability.',
      weak: 'Revenue headwinds require business model adjustment or turnaround.',
      declining: 'Revenue stabilization critical for financial health.'
    },
    profitMargin: {
      improving: 'Margin expansion trend suggests improving operational leverage.',
      stable: 'Consistent margins indicate predictable profit generation.',
      declining: 'Margin recovery needed to support earnings growth.'
    }
  };

  const categoryStatements = statements[category] || {};
  return categoryStatements[type] || 'Monitor this metric in coming quarters.';
}

/**
 * Generate all insights from complete financial data
 * Main entry point for insight engine
 *
 * @param {object} trends - Trend engine output
 * @param {object} ratios - Ratio metrics
 * @param {string} companyName - Ticker/company name to fill {company} placeholders
 * @returns {Array} Prioritized, generated insights
 */
function generateInsights(trends, ratios = {}, companyName = 'The company') {
  if (!trends) {
    return [];
  }

  // Evaluate all insight categories
  const allInsights = [
    InsightRules.evaluateRevenueGrowth(trends),
    InsightRules.evaluateProfitMargin(trends),
    InsightRules.evaluateDebtPosition(trends, ratios),
    InsightRules.evaluateCashFlow(trends),
    InsightRules.evaluateReturnOnInvestment(trends, ratios),
    InsightRules.evaluateLiquidity(ratios),
    InsightRules.evaluateStability(trends, ratios)
  ];

  // Prioritize insights
  const prioritized = prioritizeInsights(allInsights, 7);

  // Generate text for each
  const withText = prioritized
    .map(insight => generateInsightText(insight, companyName))
    .filter(i => i !== null);

  return withText;
}

module.exports = {
  insightTemplates,
  InsightRules,
  fillTemplate,
  prioritizeInsights,
  generateInsightText,
  getInvestorImportance,
  getForwardLookingStatement,
  generateInsights
};
