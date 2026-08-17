/**
 * Alert Engine
 *
 * Deterministic rule evaluation - given the same input data and the same
 * thresholds (alert.rules.js), always produces the same candidate alerts.
 * No LLM call anywhere in this file - see research/engineering/
 * AIAlertSummarization.md for why detection stays deterministic.
 *
 * Every evaluator here is intentionally free of Mongoose/Alert-model
 * imports: it takes already-fetched data in, returns plain candidate
 * objects out (never persists anything). alert.service.js owns fetching
 * that data (reusing Sprints 2-10's existing services) and persisting the
 * candidates via alert.deduplicator.js. This mirrors dcf.engine.js's own
 * split (service loads context, engine computes) and keeps the rules
 * unit-testable without mocking a database.
 *
 * Valuation (DCF/Comps) has no evaluator here - see alert.rules.js's header
 * comment and research/finance/ValuationAlerts.md for why.
 */

const ratioFormulas = require("../ratio/ratio.formulas");
const trendEngine = require("../analysis/trend.engine");
const healthScoreEngine = require("../analysis/health.score");
const analysisService = require("../analysis/analysis.service");
const analysisValidator = require("../analysis/analysis.validator");
const portfolioCalculator = require("../portfolio/portfolio.calculator");
const { THRESHOLDS } = require("./alert.rules");
const severity = require("./alert.severity");
const dedup = require("./alert.deduplicator");

const round = (value, decimals = 2) =>
    typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(decimals)) : null;

/** Percent change from previous to current. Mirrors trend.engine.js's calculateYoYGrowth safety rules (null on a non-positive base) for consistency across the codebase. */
const percentChange = (previous, current) => {
    if (typeof previous !== "number" || typeof current !== "number" || previous <= 0) {
        return null;
    }
    const change = ((current - previous) / previous) * 100;
    return Number.isFinite(change) ? change : null;
};

/**
 * Re-runs analysis.service.js's own health-score pipeline (transform ->
 * trends -> current ratios -> health score) over a given statement window,
 * rather than reimplementing it. Called twice by evaluateFinancialRules -
 * once with all available statements, once with the latest year excluded -
 * so "did the Health Score change" compares against what the score was
 * before this year's results came in, with no separate snapshot needed.
 */
const computeHealthScoreOverall = (statements, years) => {
    const windowed = analysisService.windowStatements(statements, years);
    if (windowed.length === 0) {
        return null;
    }
    const financialData = analysisService.transformFinancialData(windowed, years);
    const trends = trendEngine.calculateAllTrends(financialData);
    const latestStatement = windowed[windowed.length - 1];
    const rawRatios = analysisService.calculateCurrentRatios(financialData, latestStatement);
    const ratios = analysisValidator.sanitizeMetrics(rawRatios);
    const healthScore = healthScoreEngine.calculateHealthScore(ratios, trends, "balanced");
    return typeof healthScore.overall === "number" ? healthScore.overall : null;
};

/**
 * Market rules. `bars` is ascending-by-date daily OHLC history (as returned
 * by market.service.js's getHistoricalPrices) - already DB-cached with its
 * own freshness check, so calling this on every monitoring pass costs no
 * extra provider calls. No snapshot needed: "price 5 sessions ago" is
 * always derivable from the same cached history, and dedup is handled by
 * the day-level periodKey on the Alert document itself.
 */
const evaluateMarketRules = ({ ticker, bars }) => {
    const candidates = [];
    if (!Array.isArray(bars) || bars.length === 0) {
        return candidates;
    }

    const latestBar = bars[bars.length - 1];
    const periodKey = dedup.dayKey(new Date(latestBar.date));
    const source = "Market price history";

    if (bars.length >= 2) {
        const priorBar = bars[bars.length - 2];
        const dailyMovePercent = percentChange(priorBar.close, latestBar.close);
        if (dailyMovePercent !== null && Math.abs(dailyMovePercent) >= THRESHOLDS.market.dailyMovePercent) {
            const direction = dailyMovePercent < 0 ? "declined" : "increased";
            candidates.push({
                ticker,
                type: "MARKET",
                rule: "PRICE_MOVE_1D",
                periodKey,
                severity: severity.byMagnitude(dailyMovePercent, THRESHOLDS.market.dailyMovePercent),
                title: "Large single-day price move",
                message: `${ticker} ${direction} ${Math.abs(round(dailyMovePercent))}% on ${latestBar.date}.`,
                whyItMatters:
                    "A single-session move this large is unusual for most stocks and often reflects new information reaching the market.",
                metric: "dailyPriceChangePercent",
                previousValue: priorBar.close,
                currentValue: latestBar.close,
                percentChange: round(dailyMovePercent),
                threshold: THRESHOLDS.market.dailyMovePercent,
                source,
                evidencePeriod: `${priorBar.date} -> ${latestBar.date}`,
                triggeredAt: new Date(latestBar.date),
                metadata: {},
            });
        }
    }

    if (bars.length >= 6) {
        const bar5dAgo = bars[bars.length - 6];
        const fiveDayMovePercent = percentChange(bar5dAgo.close, latestBar.close);
        if (fiveDayMovePercent !== null && Math.abs(fiveDayMovePercent) >= THRESHOLDS.market.fiveDayMovePercent) {
            const direction = fiveDayMovePercent < 0 ? "declined" : "gained";
            candidates.push({
                ticker,
                type: "MARKET",
                rule: fiveDayMovePercent < 0 ? "PRICE_DROP_5D" : "PRICE_GAIN_5D",
                periodKey,
                severity: severity.byMagnitude(fiveDayMovePercent, THRESHOLDS.market.fiveDayMovePercent),
                title: fiveDayMovePercent < 0 ? "Significant price decline over 5 sessions" : "Significant price increase over 5 sessions",
                message: `${ticker} ${direction} ${Math.abs(round(fiveDayMovePercent))}% over the last 5 trading sessions.`,
                whyItMatters:
                    fiveDayMovePercent < 0
                        ? "A sustained multi-day decline can reflect deteriorating sentiment or new information worth understanding."
                        : "A sustained multi-day rally can reflect improving sentiment or new information worth understanding.",
                metric: "fiveDayPriceChangePercent",
                previousValue: bar5dAgo.close,
                currentValue: latestBar.close,
                percentChange: round(fiveDayMovePercent),
                threshold: THRESHOLDS.market.fiveDayMovePercent,
                source,
                evidencePeriod: `5 trading sessions ending ${latestBar.date}`,
                triggeredAt: new Date(latestBar.date),
                metadata: {},
            });
        }
    }

    if (bars.length >= 7) {
        const rangeWidthPercent = (bar) => (bar.close ? ((bar.high - bar.low) / bar.close) * 100 : null);
        const trailing = bars.slice(bars.length - 6, bars.length - 1);
        const trailingWidths = trailing.map(rangeWidthPercent).filter((value) => value !== null && Number.isFinite(value));
        const todayWidth = rangeWidthPercent(latestBar);

        if (trailingWidths.length === 5 && todayWidth !== null) {
            const avgTrailingWidth = trailingWidths.reduce((sum, value) => sum + value, 0) / trailingWidths.length;
            if (avgTrailingWidth > 0 && todayWidth >= avgTrailingWidth * THRESHOLDS.market.rangeWidthSpikeMultiple) {
                candidates.push({
                    ticker,
                    type: "MARKET",
                    rule: "TRADING_RANGE_SPIKE",
                    periodKey,
                    severity: "MEDIUM",
                    title: "Unusually wide trading range",
                    message: `${ticker}'s trading range on ${latestBar.date} was ${round(todayWidth)}% of price, vs a ${round(
                        avgTrailingWidth
                    )}% average over the prior 5 sessions.`,
                    whyItMatters: "A sharply wider intraday range than usual often signals unusual volatility or news flow.",
                    metric: "rangeWidthPercent",
                    previousValue: round(avgTrailingWidth),
                    currentValue: round(todayWidth),
                    percentChange: null,
                    threshold: THRESHOLDS.market.rangeWidthSpikeMultiple,
                    source,
                    evidencePeriod: `Trailing 5 sessions ending ${latestBar.date}`,
                    triggeredAt: new Date(latestBar.date),
                    metadata: {},
                });
            }
        }
    }

    return candidates;
};

/**
 * Financial rules: single-period deltas (latest fiscal year vs. the one
 * before it). `statements` is descending-by-year (as returned by
 * financials.service.js's getFinancialStatementsByTicker).
 */
const evaluateFinancialRules = ({ ticker, statements }) => {
    const candidates = [];
    if (!Array.isArray(statements) || statements.length === 0) {
        return candidates;
    }

    const latest = statements[0];
    const latestSource = `FY${latest.year} financial statements`;
    const latestTriggeredAt = latest.createdAt || new Date();

    // Informational: fires once per newly-imported fiscal year, regardless
    // of whether enough history exists yet for a period-over-period delta.
    candidates.push({
        ticker,
        type: "FINANCIAL",
        rule: "NEW_ANNUAL_RESULTS",
        periodKey: dedup.fiscalYearKey(latest.year),
        severity: "INFO",
        title: "New annual financial results available",
        message: `FY${latest.year} financial statements are now available for ${ticker}.`,
        whyItMatters: "New reported financials are the basis for every other financial and business alert on this ticker.",
        metric: null,
        previousValue: null,
        currentValue: null,
        percentChange: null,
        threshold: null,
        source: latestSource,
        evidencePeriod: `FY${latest.year}`,
        triggeredAt: latestTriggeredAt,
        metadata: {},
    });

    if (statements.length < 2) {
        return candidates;
    }

    const prior = statements[1];
    const periodKey = dedup.fiscalYearPairKey(prior.year, latest.year);
    const evidencePeriod = `FY${prior.year} -> FY${latest.year}`;

    const marginRule = (rule, label, computeMargin) => {
        const latestValue = computeMargin(latest);
        const priorValue = computeMargin(prior);
        if (latestValue === null || priorValue === null) return;

        const deltaPoints = latestValue - priorValue;
        if (Math.abs(deltaPoints) < THRESHOLDS.financial.marginChangePoints) return;

        const direction = deltaPoints < 0 ? "declined" : "improved";
        candidates.push({
            ticker,
            type: "FINANCIAL",
            rule: `${rule}_${deltaPoints < 0 ? "DETERIORATION" : "IMPROVEMENT"}`,
            periodKey,
            severity: severity.byMagnitude(deltaPoints, THRESHOLDS.financial.marginChangePoints),
            title: `${label} ${direction}`,
            message: `${label} ${direction} from ${round(priorValue)}% to ${round(latestValue)}%.`,
            whyItMatters:
                deltaPoints < 0
                    ? `The decline indicates pressure on ${label.toLowerCase()}.`
                    : `The improvement indicates strengthening ${label.toLowerCase()}.`,
            metric: rule === "OPERATING_MARGIN" ? "operatingMargin" : "netProfitMargin",
            previousValue: round(priorValue),
            currentValue: round(latestValue),
            percentChange: round(deltaPoints),
            threshold: THRESHOLDS.financial.marginChangePoints,
            source: latestSource,
            evidencePeriod,
            triggeredAt: latestTriggeredAt,
            metadata: {},
        });
    };

    marginRule("OPERATING_MARGIN", "Operating margin", ratioFormulas.operatingMargin);
    marginRule("NET_MARGIN", "Net profit margin", ratioFormulas.netProfitMargin);

    const latestRoe = ratioFormulas.returnOnEquity(latest);
    const priorRoe = ratioFormulas.returnOnEquity(prior);
    if (latestRoe !== null && priorRoe !== null) {
        const deltaPoints = latestRoe - priorRoe;
        if (Math.abs(deltaPoints) >= THRESHOLDS.financial.roeChangePoints) {
            const direction = deltaPoints < 0 ? "declined" : "improved";
            candidates.push({
                ticker,
                type: "FINANCIAL",
                rule: `ROE_${deltaPoints < 0 ? "DETERIORATION" : "IMPROVEMENT"}`,
                periodKey,
                severity: severity.byMagnitude(deltaPoints, THRESHOLDS.financial.roeChangePoints),
                title: `Return on equity ${direction}`,
                message: `Return on equity ${direction} from ${round(priorRoe)}% to ${round(latestRoe)}%.`,
                whyItMatters: "ROE measures how efficiently the company generates profit from shareholders' equity.",
                metric: "returnOnEquity",
                previousValue: round(priorRoe),
                currentValue: round(latestRoe),
                percentChange: round(deltaPoints),
                threshold: THRESHOLDS.financial.roeChangePoints,
                source: latestSource,
                evidencePeriod,
                triggeredAt: latestTriggeredAt,
                metadata: {},
            });
        }
    }

    const latestFcf = ratioFormulas.freeCashFlow(latest);
    const priorFcf = ratioFormulas.freeCashFlow(prior);
    const fcfChangePercent = percentChange(priorFcf, latestFcf);
    if (fcfChangePercent !== null && fcfChangePercent <= -THRESHOLDS.financial.fcfDeclinePercent) {
        candidates.push({
            ticker,
            type: "FINANCIAL",
            rule: "FCF_DETERIORATION",
            periodKey,
            severity: severity.byMagnitude(fcfChangePercent, THRESHOLDS.financial.fcfDeclinePercent),
            title: "Free cash flow declined",
            message: `Free cash flow declined ${Math.abs(round(fcfChangePercent))}% year-over-year.`,
            whyItMatters: "A significant drop in free cash flow reduces the cash available for reinvestment, debt repayment, or shareholder returns.",
            metric: "freeCashFlow",
            previousValue: round(priorFcf),
            currentValue: round(latestFcf),
            percentChange: round(fcfChangePercent),
            threshold: THRESHOLDS.financial.fcfDeclinePercent,
            source: latestSource,
            evidencePeriod,
            triggeredAt: latestTriggeredAt,
            metadata: {},
        });
    }

    const latestDebt = latest.balanceSheet?.totalDebt;
    const priorDebt = prior.balanceSheet?.totalDebt;
    const debtChangePercent = percentChange(priorDebt, latestDebt);
    if (debtChangePercent !== null && debtChangePercent >= THRESHOLDS.financial.debtIncreasePercent) {
        candidates.push({
            ticker,
            type: "FINANCIAL",
            rule: "DEBT_INCREASE",
            periodKey,
            severity: severity.byMagnitude(debtChangePercent, THRESHOLDS.financial.debtIncreasePercent),
            title: "Total debt increased",
            message: `Total debt increased ${round(debtChangePercent)}% year-over-year.`,
            whyItMatters: "A significant increase in total debt raises financial risk and future interest obligations.",
            metric: "totalDebt",
            previousValue: priorDebt,
            currentValue: latestDebt,
            percentChange: round(debtChangePercent),
            threshold: THRESHOLDS.financial.debtIncreasePercent,
            source: latestSource,
            evidencePeriod,
            triggeredAt: latestTriggeredAt,
            metadata: {},
        });
    }

    if (statements.length >= 3) {
        const chronological = [statements[2], statements[1], statements[0]];
        const revenueSeries = chronological.map((statement) => statement.incomeStatement?.totalRevenue);
        const [growthPrior, growthLatest] = trendEngine.calculateYoYGrowth(revenueSeries);
        if (typeof growthPrior === "number" && typeof growthLatest === "number") {
            const deltaPoints = (growthLatest - growthPrior) * 100;
            if (Math.abs(deltaPoints) >= THRESHOLDS.financial.revenueGrowthChangePoints) {
                const direction = deltaPoints < 0 ? "slowed" : "accelerated";
                candidates.push({
                    ticker,
                    type: "FINANCIAL",
                    rule: deltaPoints < 0 ? "REVENUE_GROWTH_DETERIORATION" : "REVENUE_GROWTH_ACCELERATION",
                    periodKey,
                    severity: severity.byMagnitude(deltaPoints, THRESHOLDS.financial.revenueGrowthChangePoints),
                    title: `Revenue growth ${direction}`,
                    message: `Revenue growth ${direction} from ${round(growthPrior * 100)}% to ${round(growthLatest * 100)}%.`,
                    whyItMatters:
                        deltaPoints < 0
                            ? "Decelerating revenue growth can signal weakening demand or increased competitive pressure."
                            : "Accelerating revenue growth can signal strengthening demand or successful execution.",
                    metric: "revenueGrowthYoY",
                    previousValue: round(growthPrior * 100),
                    currentValue: round(growthLatest * 100),
                    percentChange: round(deltaPoints),
                    threshold: THRESHOLDS.financial.revenueGrowthChangePoints,
                    source: `FY${chronological[0].year}-FY${chronological[2].year} financial statements`,
                    evidencePeriod: `FY${chronological[0].year} -> FY${chronological[1].year} -> FY${chronological[2].year}`,
                    triggeredAt: latestTriggeredAt,
                    metadata: {},
                });
            }
        }
    }

    const currentHealthScore = computeHealthScoreOverall(statements, 5);
    const priorHealthScore = computeHealthScoreOverall(statements.slice(1), 5);
    if (typeof currentHealthScore === "number" && typeof priorHealthScore === "number") {
        const deltaPoints = currentHealthScore - priorHealthScore;
        if (Math.abs(deltaPoints) >= THRESHOLDS.financial.healthScoreChangePoints) {
            const direction = deltaPoints < 0 ? "declined" : "improved";
            candidates.push({
                ticker,
                type: "FINANCIAL",
                rule: `HEALTH_SCORE_${deltaPoints < 0 ? "DECLINE" : "IMPROVEMENT"}`,
                periodKey,
                severity: severity.byMagnitude(deltaPoints, THRESHOLDS.financial.healthScoreChangePoints),
                title: `Financial Health Score ${direction}`,
                message: `Financial Health Score ${direction} from ${round(priorHealthScore)} to ${round(currentHealthScore)} (of 100).`,
                whyItMatters:
                    "The Financial Health Score is a composite of profitability, liquidity, solvency, cash flow, and growth - a significant move reflects a broad shift, not just one metric.",
                metric: "healthScore",
                previousValue: round(priorHealthScore),
                currentValue: round(currentHealthScore),
                percentChange: round(deltaPoints),
                threshold: THRESHOLDS.financial.healthScoreChangePoints,
                source: latestSource,
                evidencePeriod,
                triggeredAt: latestTriggeredAt,
                metadata: {},
            });
        }
    }

    return candidates;
};

/**
 * Business rules: sustained multi-year trend direction and profit-sign
 * inflections, using trend.engine.js's own consistency scoring - distinct
 * from Financial's single-period deltas above. Needs a window of at least
 * 3 years to say anything about a "sustained" trend.
 */
const evaluateBusinessRules = ({ ticker, statements }) => {
    const candidates = [];
    if (!Array.isArray(statements) || statements.length < 3) {
        return candidates;
    }

    const windowed = analysisService.windowStatements(statements, 5);
    const financialData = analysisService.transformFinancialData(windowed, 5);
    const startYear = windowed[0]?.year;
    const endYear = windowed[windowed.length - 1]?.year;
    const periodKey = dedup.fiscalYearPairKey(startYear, endYear);
    const evidencePeriod = `FY${startYear} -> FY${endYear}`;
    const source = `FY${startYear}-FY${endYear} financial statements`;
    const triggeredAt = windowed[windowed.length - 1]?.createdAt || new Date();
    const comparisonCount = windowed.length - 1;

    const operatingMarginTrend = trendEngine.analyzeMarginTrend(financialData.incomeStatement.operatingMargin);
    if (operatingMarginTrend.direction === "↓" && operatingMarginTrend.consistency >= THRESHOLDS.business.trendConsistencyPercent) {
        candidates.push({
            ticker,
            type: "BUSINESS",
            rule: "OPERATING_MARGIN_TREND_DECLINE",
            periodKey,
            severity: "MEDIUM",
            title: "Sustained operating margin decline",
            message: `Operating margin declined in ${operatingMarginTrend.consistency}% of the last ${comparisonCount} year-over-year comparisons (${evidencePeriod}).`,
            whyItMatters:
                "A single bad year can be noise; a consistent multi-year decline in operating margin points to a structural change in the business, not a one-off.",
            metric: "operatingMarginTrend",
            previousValue: null,
            currentValue: operatingMarginTrend.latest,
            percentChange: null,
            threshold: THRESHOLDS.business.trendConsistencyPercent,
            source,
            evidencePeriod,
            triggeredAt,
            metadata: { consistency: operatingMarginTrend.consistency },
        });
    }

    const fcfGrowth = trendEngine.calculateGrowthMetrics(financialData.cashFlow.freeCashFlow);
    if (fcfGrowth.trend.direction === "↓" && fcfGrowth.trend.consistency >= THRESHOLDS.business.trendConsistencyPercent) {
        candidates.push({
            ticker,
            type: "BUSINESS",
            rule: "FCF_TREND_DECLINE",
            periodKey,
            severity: "MEDIUM",
            title: "Sustained free cash flow decline",
            message: `Free cash flow declined in ${fcfGrowth.trend.consistency}% of the last ${comparisonCount} year-over-year comparisons (${evidencePeriod}).`,
            whyItMatters:
                "A consistent multi-year decline in free cash flow reduces the company's capacity to reinvest, pay down debt, or return cash to shareholders.",
            metric: "freeCashFlowTrend",
            previousValue: null,
            currentValue: null,
            percentChange: null,
            threshold: THRESHOLDS.business.trendConsistencyPercent,
            source,
            evidencePeriod,
            triggeredAt,
            metadata: { consistency: fcfGrowth.trend.consistency },
        });
    }

    const netIncomeSeries = financialData.incomeStatement.netIncome.filter((point) => typeof point.value === "number");
    if (netIncomeSeries.length >= 2) {
        const startValue = netIncomeSeries[0].value;
        const endValue = netIncomeSeries[netIncomeSeries.length - 1].value;
        const signChange = trendEngine.describeSignChange(startValue, endValue);
        const relevantTypes = ["turnaround", "declinedToLoss", "narrowingLoss", "wideningLoss", "newLoss", "newProfit"];

        if (signChange && relevantTypes.includes(signChange.type)) {
            candidates.push({
                ticker,
                type: "BUSINESS",
                rule: `PROFIT_${signChange.type.toUpperCase()}`,
                periodKey,
                severity: severity.forSignChange(signChange.type),
                title: signChange.label,
                message: `Net income moved from ${round(startValue)} (FY${startYear}) to ${round(endValue)} (FY${endYear}): ${signChange.label.toLowerCase()}.`,
                whyItMatters: signChange.positive
                    ? "A profitability inflection like this is a meaningful structural change worth understanding, not a routine fluctuation."
                    : "A move into, or deeper into, a loss is a meaningful structural change worth understanding, not a routine fluctuation.",
                metric: "netIncome",
                previousValue: round(startValue),
                currentValue: round(endValue),
                percentChange: null,
                threshold: null,
                source,
                evidencePeriod,
                triggeredAt,
                metadata: { signChangeType: signChange.type },
            });
        }
    }

    return candidates;
};

const NEWS_CATEGORY_CONTEXT = {
    Earnings: "Earnings releases are a primary driver of how the market reprices a company.",
    "Acquisition / Merger": "M&A activity can materially change a company's strategy, ownership, or capital structure.",
    "Regulation / Legal": "Regulatory or legal developments can carry direct financial or operational consequences.",
    Leadership: "Leadership changes can signal a shift in strategy or execution risk.",
};

/**
 * News rules. `articles` are already classified and deduplicated by
 * Sprint 10's pipeline (news.classifier.js / news.deduplicator.js) before
 * they're ever stored - one Alert candidate per distinct stored article in
 * an important category, so "multiple articles about the same event"
 * inherits Sprint 10's own dedup rather than needing a second pass here.
 */
const evaluateNewsRules = ({ ticker, articles }) => {
    if (!Array.isArray(articles)) {
        return [];
    }

    return articles.map((article) => ({
        ticker,
        type: "NEWS",
        rule: "IMPORTANT_NEWS_EVENT",
        periodKey: dedup.articleKey(article._id),
        severity: severity.forNewsCategory(article.category),
        title: `${article.category} event`,
        message: article.title,
        whyItMatters: NEWS_CATEGORY_CONTEXT[article.category] || "This event category is one Athena treats as significant enough to flag.",
        metric: null,
        previousValue: null,
        currentValue: null,
        percentChange: null,
        threshold: null,
        source: article.source || "News provider",
        evidencePeriod: null,
        triggeredAt: article.publishedAt,
        metadata: { newsArticleId: String(article._id), url: article.url, category: article.category },
    }));
};

/**
 * Portfolio rules. `holdings` is the enriched, per-lot array from
 * portfolio.service.js's getPortfolio(); `summary` is its summary object.
 * Concentration and gain/loss are absolute-threshold checks against
 * current data (no snapshot needed, deduped by day); value-change is the
 * one portfolio rule that genuinely needs the prior observation, supplied
 * via `previousSnapshots` (a Map<ticker, PortfolioAlertSnapshot>).
 */
const evaluatePortfolioRules = ({ holdings, summary, previousSnapshots }) => {
    const candidates = [];
    const snapshotUpdates = [];

    if (!Array.isArray(holdings) || holdings.length === 0) {
        return { candidates, snapshotUpdates };
    }

    const periodKey = dedup.dayKey();
    const source = "Portfolio holdings";
    // Weight is cross-holding by definition - must use USD-normalized value (currentValueUSD), never native currency (see portfolio.calculator.js's currency-normalization note).
    const positions = portfolioCalculator.groupByTicker(holdings).map((position) => ({
        ...position,
        weightPercent:
            position.currentValueUSD !== null && summary.totalCurrentValue > 0
                ? (position.currentValueUSD / summary.totalCurrentValue) * 100
                : null,
    }));

    for (const position of positions) {
        const { ticker, currentValue, returnPercent, weightPercent } = position;

        if (weightPercent !== null) {
            const concentrationSeverity = severity.forConcentration(
                weightPercent,
                THRESHOLDS.portfolio.concentrationPercent,
                THRESHOLDS.portfolio.concentrationHighPercent
            );
            if (concentrationSeverity) {
                candidates.push({
                    ticker,
                    type: "PORTFOLIO",
                    rule: "HIGH_CONCENTRATION",
                    periodKey,
                    severity: concentrationSeverity,
                    title: "High portfolio concentration",
                    message: `${ticker} represents ${round(weightPercent)}% of your tracked portfolio value.`,
                    whyItMatters: "A large concentration in one holding means that company's performance disproportionately drives your overall portfolio's results.",
                    metric: "portfolioWeightPercent",
                    previousValue: null,
                    currentValue: round(weightPercent),
                    percentChange: null,
                    threshold: THRESHOLDS.portfolio.concentrationPercent,
                    source,
                    evidencePeriod: periodKey,
                    triggeredAt: new Date(),
                    metadata: {},
                });
            }
        }

        if (returnPercent !== null && Math.abs(returnPercent) >= THRESHOLDS.portfolio.gainLossPercent) {
            const isLoss = returnPercent < 0;
            candidates.push({
                ticker,
                type: "PORTFOLIO",
                rule: isLoss ? "SIGNIFICANT_UNREALIZED_LOSS" : "SIGNIFICANT_UNREALIZED_GAIN",
                periodKey,
                severity: severity.byMagnitude(returnPercent, THRESHOLDS.portfolio.gainLossPercent),
                title: `Significant unrealized ${isLoss ? "loss" : "gain"}`,
                message: `${ticker} has a ${round(Math.abs(returnPercent))}% unrealized ${isLoss ? "loss" : "gain"} relative to its cost basis.`,
                whyItMatters: "A position that has moved this far from its cost basis is a meaningful change in your portfolio's composition.",
                metric: "returnPercent",
                previousValue: null,
                currentValue: round(returnPercent),
                percentChange: round(returnPercent),
                threshold: THRESHOLDS.portfolio.gainLossPercent,
                source,
                evidencePeriod: periodKey,
                triggeredAt: new Date(),
                metadata: {},
            });
        }

        if (currentValue !== null) {
            const previousSnapshot = previousSnapshots?.get(ticker);
            if (previousSnapshot && typeof previousSnapshot.currentValue === "number") {
                const changePercent = percentChange(previousSnapshot.currentValue, currentValue);
                if (changePercent !== null && Math.abs(changePercent) >= THRESHOLDS.portfolio.valueChangePercent) {
                    const direction = changePercent < 0 ? "decreased" : "increased";
                    candidates.push({
                        ticker,
                        type: "PORTFOLIO",
                        rule: "HOLDING_VALUE_CHANGE",
                        periodKey,
                        severity: severity.byMagnitude(changePercent, THRESHOLDS.portfolio.valueChangePercent),
                        title: `Holding value ${direction}`,
                        message: `The value of your ${ticker} position ${direction} ${Math.abs(round(changePercent))}% since it was last checked.`,
                        whyItMatters: "A significant change in a holding's value changes its weight and contribution to your overall portfolio.",
                        metric: "holdingCurrentValue",
                        previousValue: round(previousSnapshot.currentValue),
                        currentValue: round(currentValue),
                        percentChange: round(changePercent),
                        threshold: THRESHOLDS.portfolio.valueChangePercent,
                        source,
                        evidencePeriod: `Since ${dedup.dayKey(previousSnapshot.observedAt)}`,
                        triggeredAt: new Date(),
                        metadata: {},
                    });
                }
            }

            snapshotUpdates.push({ ticker, currentValue, returnPercent, weightPercent });
        }
    }

    return { candidates, snapshotUpdates };
};

module.exports = {
    evaluateMarketRules,
    evaluateFinancialRules,
    evaluateBusinessRules,
    evaluateNewsRules,
    evaluatePortfolioRules,
};
