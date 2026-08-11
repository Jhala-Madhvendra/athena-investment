/**
 * DCF Input Mapper
 *
 * The only layer that knows about Mongoose statement documents and Yahoo-
 * shaped market quotes. Converts them into the plain structures
 * dcf.engine.js expects, and builds the labeled "suggested starting
 * inputs" returned by GET /api/valuation/:ticker/dcf/defaults.
 *
 * Every suggested value carries a `source` tag so the frontend can render
 * "Historical" / "Derived" / "Market" / "Default" / "Required input"
 * instead of presenting one undifferentiated number (see DCF INPUT UX in
 * the sprint brief). Values with no real backing data source in Athena
 * (risk-free rate, equity risk premium, terminal growth rate, cost of
 * debt) are returned as `null` with source "required_user_input" rather
 * than a fabricated illustrative number - see CostOfDebt.md and CAPM.md
 * for why this line was drawn where it was.
 */

const trendEngine = require("../../analysis/trend.engine");
const formulas = require("../dcf/dcf.formulas");
const { calculateHistoricalFCFF } = require("../dcf/dcf.engine");
const riskFreeRateProvider = require("../providers/riskFreeRate.provider");

/**
 * Commonly-cited, long-run illustrative figures - NOT live data, NOT
 * company-specific. Used only to pre-fill the DCF form so a first-time
 * user isn't staring at a blank field; always returned with
 * source: "illustrative_default" so the frontend can render them with
 * visibly different styling than "historical"/"derived"/"market" values,
 * and the user must consciously accept or override them before running a
 * valuation. See CAPM.md and TerminalValue.md for the reasoning.
 */
const ILLUSTRATIVE_EQUITY_RISK_PREMIUM = 0.05;
const ILLUSTRATIVE_TERMINAL_GROWTH_RATE = 0.025;

const labeled = (value, source, note) => ({
    value: value === undefined ? null : value,
    source,
    ...(note ? { note } : {}),
});

const sortAscending = (statements) =>
    [...statements].filter((s) => s && typeof s.year === "number").sort((first, second) => first.year - second.year);

/** Engine's `historicalFinancials`: revenue/NWC base the forecast grows from. */
const buildHistoricalFinancials = (latestStatement) => {
    const latestRevenue = latestStatement?.incomeStatement?.totalRevenue ?? null;
    const latestNWC = formulas.netWorkingCapital(
        latestStatement?.balanceSheet?.currentAssets,
        latestStatement?.balanceSheet?.currentLiabilities
    );

    return { latestRevenue, latestNWC };
};

/** Engine's `capitalStructure`: what's subtracted from Enterprise Value and divided into Equity Value. */
const buildCapitalStructure = (latestStatement) => ({
    debt: latestStatement?.balanceSheet?.totalDebt ?? null,
    cash: latestStatement?.balanceSheet?.cashAndCashEquivalents ?? null,
    dilutedShares: latestStatement?.incomeStatement?.dilutedSharesOutstanding ?? null,
});

/**
 * Capital weights for the WACC formula. Equity is weighted at market value
 * (marketCap) because that's how the market actually prices the company's
 * claims today; debt falls back to book value since Athena has no bond
 * pricing data - see WACC.md for the documented limitation.
 */
const buildWaccCapitalWeights = (latestStatement, quote) => ({
    marketValueOfEquity: quote?.price?.marketCap ?? null,
    marketValueOfDebt: latestStatement?.balanceSheet?.totalDebt ?? null,
});

const ratioOf = (numerator, denominator) => {
    const ratio = formulas.safeDivide(numerator, denominator);
    return ratio === null ? null : Number(ratio.toFixed(4));
};

/**
 * Tries `computeValue` against each statement from most recent to oldest,
 * returning the first year where it yields a usable value plus which year
 * that was. A "latest year" suggestion (EBIT margin, tax rate, D&A%,
 * CapEx%, working capital%) would otherwise go straight to "unavailable"
 * just because the newest filing - which can still be partially reported -
 * is missing one field, even when older years have real, complete data.
 * Falling back to the most recent COMPLETE year is still genuine, reported
 * company data, not a fabricated number - it's what an analyst would do by
 * hand ("this year's figure isn't in yet, use last year's").
 *
 * @param {Array} sortedStatements - ascending by year
 * @param {(statement: object) => number|null} computeValue
 * @returns {{value: number, year: number} | null}
 */
const findMostRecentDerivable = (sortedStatements, computeValue) => {
    for (let i = sortedStatements.length - 1; i >= 0; i -= 1) {
        const statement = sortedStatements[i];
        const value = computeValue(statement);
        if (value !== null) {
            return { value, year: statement.year };
        }
    }
    return null;
};

/** Builds the labeled result for a "latest year, with fallback" suggestion - shared by every suggestX below except revenue growth (a multi-year CAGR, not a single-year snapshot). */
const suggestWithFallback = (statements, latestStatement, computeValue, { unavailableNote, describeYear }) => {
    const sorted = sortAscending(statements);
    const found = findMostRecentDerivable(sorted, computeValue);

    if (!found) {
        return labeled(null, "unavailable", unavailableNote);
    }

    const isLatestYear = latestStatement && found.year === latestStatement.year;
    return labeled(found.value, "derived", describeYear(found.year, isLatestYear));
};

const suggestRevenueGrowth = (statements) => {
    const sorted = sortAscending(statements);

    if (sorted.length < 2) {
        return labeled(null, "unavailable", "At least two years of revenue history are needed to derive a growth rate.");
    }

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const years = last.year - first.year;
    const cagr = trendEngine.calculateCAGR(first.incomeStatement?.totalRevenue, last.incomeStatement?.totalRevenue, years);

    if (typeof cagr !== "number") {
        return labeled(
            null,
            "unavailable",
            "Historical revenue CAGR could not be computed (e.g. a negative or zero revenue year in the window)."
        );
    }

    return labeled(Number(cagr.toFixed(4)), "derived", `${sorted.length}-year historical revenue CAGR (${first.year}-${last.year}).`);
};

const suggestEbitMargin = (statements, latestStatement) =>
    suggestWithFallback(
        statements,
        latestStatement,
        (statement) => ratioOf(statement?.incomeStatement?.operatingIncome, statement?.incomeStatement?.totalRevenue),
        {
            unavailableNote: "Operating income or revenue is not available for any reported year for this ticker.",
            describeYear: (year, isLatestYear) =>
                isLatestYear
                    ? `Latest reported year's (${year}) Operating Income / Revenue, used as an EBIT-margin proxy.`
                    : `Latest reported year's Operating Income or Revenue was unavailable - using the most recent complete year (${year}) Operating Income / Revenue instead.`,
        }
    );

const suggestTaxRate = (statements, latestStatement) =>
    suggestWithFallback(
        statements,
        latestStatement,
        (statement) => {
            const rate = formulas.effectiveTaxRate(statement?.incomeStatement?.pretaxIncome, statement?.incomeStatement?.taxProvision);
            return rate === null || rate < 0 || rate >= 1 ? null : Number(rate.toFixed(4));
        },
        {
            unavailableNote:
                "A usable effective tax rate (Tax Provision / Pretax Income, between 0 and 1) is not available for any reported year for this ticker. Enter a normalized rate.",
            describeYear: (year, isLatestYear) =>
                isLatestYear
                    ? `Latest reported year's (${year}) Tax Provision / Pretax Income.`
                    : `Latest reported year's tax rate was unavailable or outside a usable range (e.g. a one-off tax benefit/charge) - using the most recent complete year's (${year}) Tax Provision / Pretax Income instead.`,
        }
    );

const suggestDaPercentRevenue = (statements, latestStatement) =>
    suggestWithFallback(
        statements,
        latestStatement,
        (statement) => ratioOf(statement?.cashFlow?.depreciationAndAmortization, statement?.incomeStatement?.totalRevenue),
        {
            unavailableNote: "D&A is not available for any reported year for this ticker.",
            describeYear: (year, isLatestYear) =>
                isLatestYear
                    ? `Latest reported year's (${year}) D&A / Revenue.`
                    : `Latest reported year's D&A was unavailable - using the most recent complete year's (${year}) D&A / Revenue instead.`,
        }
    );

/**
 * CapEx is stored as a negative outflow (standard cash-flow-statement sign,
 * confirmed against Yahoo's own FCF = OCF + capitalExpenditure). The
 * forecast engine expects a positive percent-of-revenue assumption it then
 * subtracts, so this suggestion is normalized to a positive magnitude here
 * - matching the same Math.abs() normalization dcf.engine.js applies to
 * historical CapEx.
 */
const suggestCapexPercentRevenue = (statements, latestStatement) =>
    suggestWithFallback(
        statements,
        latestStatement,
        (statement) => {
            const rawCapex = statement?.cashFlow?.capitalExpenditure;
            const capexMagnitude = typeof rawCapex === "number" ? Math.abs(rawCapex) : null;
            return ratioOf(capexMagnitude, statement?.incomeStatement?.totalRevenue);
        },
        {
            unavailableNote: "CapEx is not available for any reported year for this ticker.",
            describeYear: (year, isLatestYear) =>
                isLatestYear
                    ? `Latest reported year's (${year}) CapEx / Revenue.`
                    : `Latest reported year's CapEx was unavailable (a still-incomplete recent filing) - using the most recent complete year's (${year}) CapEx / Revenue instead.`,
        }
    );

const suggestWorkingCapitalPercentRevenue = (statements, latestStatement) =>
    suggestWithFallback(
        statements,
        latestStatement,
        (statement) =>
            ratioOf(
                formulas.netWorkingCapital(statement?.balanceSheet?.currentAssets, statement?.balanceSheet?.currentLiabilities),
                statement?.incomeStatement?.totalRevenue
            ),
        {
            unavailableNote: "Current assets/liabilities are not available for any reported year for this ticker.",
            describeYear: (year, isLatestYear) =>
                isLatestYear
                    ? `(Current Assets - Current Liabilities) / Revenue for the latest reported year (${year}).`
                    : `Latest reported year's current assets/liabilities were unavailable - using (Current Assets - Current Liabilities) / Revenue for the most recent complete year (${year}) instead.`,
        }
    );

/** Builds the full GET /:ticker/dcf/defaults response. */
const buildDefaults = async ({ ticker, statements, latestStatement, quote }) => {
    const riskFreeRate = await riskFreeRateProvider.getRiskFreeRate();

    return {
        ticker,
        latestFiscalYear: latestStatement?.year ?? null,
        historicalFCFF: calculateHistoricalFCFF(statements),
        suggestedAssumptions: {
            forecastYears: labeled(5, "default", "Sprint-standard 5-year explicit forecast period."),
            revenueGrowth: suggestRevenueGrowth(statements),
            ebitMargin: suggestEbitMargin(statements, latestStatement),
            taxRate: suggestTaxRate(statements, latestStatement),
            depreciationPercentRevenue: suggestDaPercentRevenue(statements, latestStatement),
            capexPercentRevenue: suggestCapexPercentRevenue(statements, latestStatement),
            workingCapitalPercentRevenue: suggestWorkingCapitalPercentRevenue(statements, latestStatement),
            terminalGrowthRate: labeled(
                ILLUSTRATIVE_TERMINAL_GROWTH_RATE,
                "illustrative_default",
                "Not company-specific or live data - a commonly-cited long-run growth/inflation figure, pre-filled so the form isn't blank. Review and adjust before relying on the result."
            ),
        },
        waccInputs: {
            riskFreeRate:
                riskFreeRate !== null
                    ? labeled(
                          Number(riskFreeRate.toFixed(4)),
                          "market",
                          "10-Year US Treasury yield, fetched live from Yahoo Finance (^TNX). Verify or override."
                      )
                    : labeled(
                          null,
                          "unavailable",
                          "The live 10-Year US Treasury yield could not be fetched. Enter a current government bond yield."
                      ),
            beta: quote?.riskMetrics?.beta != null
                ? labeled(quote.riskMetrics.beta, "market", "From Yahoo Finance. Verify or override with your own estimate.")
                : labeled(null, "unavailable", "Beta is not available from the market data provider for this ticker."),
            equityRiskPremium: labeled(
                ILLUSTRATIVE_EQUITY_RISK_PREMIUM,
                "illustrative_default",
                "Not company-specific or live data - a commonly-cited long-run US equity risk premium figure, pre-filled so the form isn't blank. Review and adjust before relying on the result."
            ),
            preTaxCostOfDebt: labeled(
                null,
                "required_user_input",
                "Athena has no interest expense or credit spread data for this ticker. Enter an assumption based on the company's borrowing rate. This is never fabricated or defaulted."
            ),
        },
        capitalStructure: {
            debt: labeled(
                latestStatement?.balanceSheet?.totalDebt ?? null,
                latestStatement?.balanceSheet?.totalDebt != null ? "historical" : "unavailable",
                "Book value of total debt, latest reported year - used as a market-value-of-debt proxy (no bond pricing data available)."
            ),
            cash: labeled(
                latestStatement?.balanceSheet?.cashAndCashEquivalents ?? null,
                latestStatement?.balanceSheet?.cashAndCashEquivalents != null ? "historical" : "unavailable"
            ),
            dilutedShares: labeled(
                latestStatement?.incomeStatement?.dilutedSharesOutstanding ?? null,
                latestStatement?.incomeStatement?.dilutedSharesOutstanding != null ? "historical" : "unavailable",
                latestStatement?.incomeStatement?.dilutedSharesOutstanding != null
                    ? undefined
                    : "Diluted shares outstanding is not available in stored data for this ticker. Re-import financial statements, or the DCF cannot compute an intrinsic value per share."
            ),
            marketValueOfEquity: labeled(
                quote?.price?.marketCap ?? null,
                quote?.price?.marketCap != null ? "market" : "unavailable"
            ),
        },
        currentMarketPrice: labeled(quote?.price?.current ?? null, quote?.price?.current != null ? "market" : "unavailable"),
    };
};

module.exports = {
    buildHistoricalFinancials,
    buildCapitalStructure,
    buildWaccCapitalWeights,
    buildDefaults,
};
