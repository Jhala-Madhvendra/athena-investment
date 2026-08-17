/**
 * Portfolio Analytics Calculator
 *
 * Pure functions only - no I/O, no Mongoose, no fetching. Same shape as
 * portfolio.calculator.js/comps.formulas.js: given numbers/arrays, return
 * numbers, so the math is unit-testable without mocking a database or a
 * market provider.
 *
 * HISTORICAL WEIGHT METHODOLOGY - READ THIS FIRST
 * -------------------------------------------------
 * Athena stores holdings, not a daily history of what a user held on any
 * past date (no transaction ledger). Every function below that consumes a
 * "portfolio return series" is therefore built by applying TODAY'S weights
 * backward over each holding's own historical price returns:
 *
 *     Rp_t = Σ wi(today) × Ri,t
 *
 * This is a deliberate, documented approximation - "what would this
 * portfolio's return have looked like on day t, if I had held today's mix
 * back then" - not a reconstruction of the portfolio's actual historical
 * value. See PortfolioCalculationAssumptions.md. Every metric derived from
 * this series (period return, volatility, Sharpe, max drawdown) inherits
 * this limitation and must be labeled accordingly by the caller.
 *
 * DATA ALIGNMENT
 * ---------------
 * Different holdings can have different trading calendars (different
 * exchanges, different listing dates, occasional missing bars). Portfolio
 * daily returns are built date-by-date over the UNION of every holding's
 * trading dates, not a naive index-aligned zip:
 *   - a ticker only contributes to a date if it has a valid close on both
 *     that date and the prior date (so its own day-over-day return exists)
 *   - a date is included in the portfolio series only if the tickers with
 *     data on that date still represent at least MIN_COVERAGE_WEIGHT of
 *     today's total portfolio weight - otherwise too much of the
 *     portfolio is unaccounted for that day to call it a portfolio return
 *   - on an included date, weights of the *covered* tickers are
 *     renormalized to sum to 1 before applying Rp_t = Σ wi × Ri,t, so a
 *     single missing small holding doesn't understate the day's return
 *     from a stale/incomplete weight base
 *
 * TRADING DAYS / ANNUALIZATION
 * ------------------------------
 * Volatility and Sharpe annualize using √252 and 252 respectively - 252 is
 * the standard approximate count of US trading days per year. This is an
 * assumption, not a universal constant (a portfolio of exclusively
 * non-US-exchange holdings may trade slightly fewer/more days a year) -
 * documented in PortfolioVolatility.md.
 */

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const TRADING_DAYS_PER_YEAR = 252;
/** A portfolio day is included only if tickers with a valid return that day still cover at least this fraction of today's total weight. */
const MIN_COVERAGE_WEIGHT = 0.5;
/** Sharpe/volatility/drawdown need enough points to be meaningful, not just non-empty. */
const MIN_OBSERVATIONS_FOR_SERIES = 10;

/**
 * Converts one ticker's ascending {date, close} bars into ascending
 * {date, return} day-over-day returns. The first bar has no prior day, so
 * it never produces a return.
 */
const computeDailyReturns = (bars) => {
    if (!Array.isArray(bars) || bars.length < 2) {
        return [];
    }

    const returns = [];
    for (let i = 1; i < bars.length; i += 1) {
        const prevClose = bars[i - 1]?.close;
        const close = bars[i]?.close;

        if (isFiniteNumber(prevClose) && isFiniteNumber(close) && prevClose !== 0) {
            returns.push({ date: bars[i].date, return: close / prevClose - 1 });
        }
    }

    return returns;
};

/**
 * Builds the portfolio-level daily return series from each ticker's own
 * daily returns and today's weights (see module header for methodology).
 * @param {Record<string, {date: string, return: number}[]>} returnsByTicker
 * @param {Record<string, number>} weightsByTicker - decimal weights (sum to ~1) as of today
 * @returns {{date: string, return: number, coveredWeight: number}[]} ascending by date
 */
const buildPortfolioReturnSeries = (returnsByTicker, weightsByTicker) => {
    const tickers = Object.keys(returnsByTicker).filter((ticker) => (weightsByTicker[ticker] || 0) > 0);
    if (tickers.length === 0) {
        return [];
    }

    const returnByTickerByDate = new Map();
    const allDates = new Set();

    tickers.forEach((ticker) => {
        const byDate = new Map();
        (returnsByTicker[ticker] || []).forEach((entry) => {
            byDate.set(entry.date, entry.return);
            allDates.add(entry.date);
        });
        returnByTickerByDate.set(ticker, byDate);
    });

    const sortedDates = [...allDates].sort();
    const series = [];

    sortedDates.forEach((date) => {
        const covered = tickers.filter((ticker) => returnByTickerByDate.get(ticker).has(date));
        const coveredWeight = covered.reduce((sum, ticker) => sum + weightsByTicker[ticker], 0);

        if (coveredWeight < MIN_COVERAGE_WEIGHT) {
            return;
        }

        const weightedReturn = covered.reduce((sum, ticker) => {
            const renormalizedWeight = weightsByTicker[ticker] / coveredWeight;
            return sum + renormalizedWeight * returnByTickerByDate.get(ticker).get(date);
        }, 0);

        series.push({ date, return: weightedReturn, coveredWeight });
    });

    return series;
};

/** Sample standard deviation (n-1 denominator) - the conventional choice for a return series treated as a sample, not a full population. */
const standardDeviation = (values) => {
    if (!Array.isArray(values) || values.length < 2) {
        return null;
    }

    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
};

/**
 * Annualized volatility from a daily portfolio return series.
 * @returns {number|null} decimal (e.g. 0.184 for 18.4%), or null if there aren't enough observations
 */
const calculateVolatility = (portfolioReturnSeries) => {
    if (!Array.isArray(portfolioReturnSeries) || portfolioReturnSeries.length < MIN_OBSERVATIONS_FOR_SERIES) {
        return null;
    }

    const dailyStdDev = standardDeviation(portfolioReturnSeries.map((entry) => entry.return));
    return dailyStdDev === null ? null : dailyStdDev * Math.sqrt(TRADING_DAYS_PER_YEAR);
};

/** Total (non-annualized) compounded return over the whole series window. */
const calculatePeriodReturn = (portfolioReturnSeries) => {
    if (!Array.isArray(portfolioReturnSeries) || portfolioReturnSeries.length === 0) {
        return null;
    }

    const compounded = portfolioReturnSeries.reduce((product, entry) => product * (1 + entry.return), 1);
    return compounded - 1;
};

/**
 * Annualizes a compounded period return using the actual number of
 * observed trading days (not a fixed window length) - correct regardless
 * of how many usable days survived the coverage/alignment filtering.
 */
const annualizeReturn = (periodReturn, observedTradingDays) => {
    if (!isFiniteNumber(periodReturn) || !isFiniteNumber(observedTradingDays) || observedTradingDays <= 0) {
        return null;
    }

    if (periodReturn <= -1) {
        return null; // total loss - (1 + periodReturn) ^ x is undefined/misleading
    }

    return (1 + periodReturn) ** (TRADING_DAYS_PER_YEAR / observedTradingDays) - 1;
};

/**
 * Sharpe Ratio = (annualized return - risk-free rate) / annualized volatility.
 * Returns null (never Infinity/NaN) on zero volatility or a missing input -
 * an undefined risk-adjusted return is more honest than a fabricated one.
 */
const calculateSharpeRatio = (annualizedReturnValue, riskFreeRate, volatility) => {
    if (!isFiniteNumber(annualizedReturnValue) || !isFiniteNumber(riskFreeRate) || !isFiniteNumber(volatility)) {
        return null;
    }

    if (volatility === 0) {
        return null;
    }

    return (annualizedReturnValue - riskFreeRate) / volatility;
};

/**
 * Maximum drawdown over a portfolio return series, walked as a cumulative
 * value curve starting at 1.0. Reports the peak/trough dates and, if the
 * series recovers above the pre-drawdown peak before the window ends, the
 * recovery date.
 */
const calculateMaxDrawdown = (portfolioReturnSeries) => {
    if (!Array.isArray(portfolioReturnSeries) || portfolioReturnSeries.length === 0) {
        return { maxDrawdownPercent: null, peakDate: null, troughDate: null, recoveryDate: null };
    }

    let value = 1;
    let peakValue = 1;
    let peakDate = portfolioReturnSeries[0].date;

    let worst = { drawdown: 0, peakDate, troughDate: null, peakValueAtWorst: 1 };

    portfolioReturnSeries.forEach((entry) => {
        value *= 1 + entry.return;

        if (value > peakValue) {
            peakValue = value;
            peakDate = entry.date;
        }

        const drawdown = (value - peakValue) / peakValue;
        if (drawdown < worst.drawdown) {
            worst = { drawdown, peakDate, troughDate: entry.date, peakValueAtWorst: peakValue };
        }
    });

    if (worst.troughDate === null) {
        return { maxDrawdownPercent: 0, peakDate: null, troughDate: null, recoveryDate: null };
    }

    const troughIndex = portfolioReturnSeries.findIndex((entry) => entry.date === worst.troughDate);
    let recoveryDate = null;
    let recoveryValue = worst.peakValueAtWorst * (1 + worst.drawdown);

    for (let i = troughIndex + 1; i < portfolioReturnSeries.length; i += 1) {
        recoveryValue *= 1 + portfolioReturnSeries[i].return;
        if (recoveryValue >= worst.peakValueAtWorst) {
            recoveryDate = portfolioReturnSeries[i].date;
            break;
        }
    }

    return {
        maxDrawdownPercent: worst.drawdown * 100,
        peakDate: worst.peakDate,
        troughDate: worst.troughDate,
        recoveryDate,
    };
};

module.exports = {
    TRADING_DAYS_PER_YEAR,
    MIN_COVERAGE_WEIGHT,
    MIN_OBSERVATIONS_FOR_SERIES,
    computeDailyReturns,
    buildPortfolioReturnSeries,
    standardDeviation,
    calculateVolatility,
    calculatePeriodReturn,
    annualizeReturn,
    calculateSharpeRatio,
    calculateMaxDrawdown,
};
