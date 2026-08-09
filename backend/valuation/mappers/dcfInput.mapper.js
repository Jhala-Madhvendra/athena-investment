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

const suggestEbitMargin = (latestStatement) => {
    const value = ratioOf(latestStatement?.incomeStatement?.operatingIncome, latestStatement?.incomeStatement?.totalRevenue);
    return value === null
        ? labeled(null, "unavailable", "Latest-year operating income or revenue is missing.")
        : labeled(value, "derived", `Latest reported year's (${latestStatement.year}) Operating Income / Revenue, used as an EBIT-margin proxy.`);
};

const suggestTaxRate = (latestStatement) => {
    const rate = formulas.effectiveTaxRate(
        latestStatement?.incomeStatement?.pretaxIncome,
        latestStatement?.incomeStatement?.taxProvision
    );

    if (rate === null || rate < 0 || rate >= 1) {
        return labeled(
            null,
            "unavailable",
            "Latest-year effective tax rate is missing or outside a usable forecast range (e.g. a one-off tax benefit/charge distorted the reported rate). Enter a normalized rate."
        );
    }

    return labeled(Number(rate.toFixed(4)), "derived", `Latest reported year's (${latestStatement.year}) Tax Provision / Pretax Income.`);
};

const suggestDaPercentRevenue = (latestStatement) => {
    const value = ratioOf(
        latestStatement?.cashFlow?.depreciationAndAmortization,
        latestStatement?.incomeStatement?.totalRevenue
    );
    return value === null
        ? labeled(null, "unavailable", "D&A is not available for the latest reported year for this ticker.")
        : labeled(value, "derived", `Latest reported year's (${latestStatement.year}) D&A / Revenue.`);
};

/**
 * CapEx is stored as a negative outflow (standard cash-flow-statement sign,
 * confirmed against Yahoo's own FCF = OCF + capitalExpenditure). The
 * forecast engine expects a positive percent-of-revenue assumption it then
 * subtracts, so this suggestion is normalized to a positive magnitude here
 * - matching the same Math.abs() normalization dcf.engine.js applies to
 * historical CapEx.
 */
const suggestCapexPercentRevenue = (latestStatement) => {
    const rawCapex = latestStatement?.cashFlow?.capitalExpenditure;
    const capexMagnitude = typeof rawCapex === "number" ? Math.abs(rawCapex) : null;
    const value = ratioOf(capexMagnitude, latestStatement?.incomeStatement?.totalRevenue);
    return value === null
        ? labeled(null, "unavailable", "CapEx is not available for the latest reported year for this ticker.")
        : labeled(value, "derived", `Latest reported year's (${latestStatement.year}) CapEx / Revenue.`);
};

const suggestWorkingCapitalPercentRevenue = (latestStatement) => {
    const nwc = formulas.netWorkingCapital(
        latestStatement?.balanceSheet?.currentAssets,
        latestStatement?.balanceSheet?.currentLiabilities
    );
    const value = ratioOf(nwc, latestStatement?.incomeStatement?.totalRevenue);
    return value === null
        ? labeled(null, "unavailable", "Current assets/liabilities are not available for the latest reported year for this ticker.")
        : labeled(value, "derived", `(Current Assets - Current Liabilities) / Revenue for the latest reported year (${latestStatement.year}).`);
};

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
            ebitMargin: suggestEbitMargin(latestStatement),
            taxRate: suggestTaxRate(latestStatement),
            depreciationPercentRevenue: suggestDaPercentRevenue(latestStatement),
            capexPercentRevenue: suggestCapexPercentRevenue(latestStatement),
            workingCapitalPercentRevenue: suggestWorkingCapitalPercentRevenue(latestStatement),
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
