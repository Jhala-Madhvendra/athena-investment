/**
 * DCF Engine
 *
 * Deterministic, framework-independent FCFF valuation engine. Receives
 * structured financial inputs and assumptions, returns a structured
 * valuation result. Does not know about Express, MongoDB, or Yahoo
 * Finance - callers (valuation.service.js) are responsible for assembling
 * `historicalFinancials` / `capitalStructure` from stored data and for
 * merging in user-entered assumptions.
 *
 * Given the same input, calculateDCF always produces the same output -
 * no randomness, no wall-clock reads, no hidden defaults.
 *
 * Input shape:
 * {
 *   historicalFinancials: { latestRevenue, latestNWC },
 *   assumptions: {
 *     revenueGrowth, ebitMargin, depreciationPercentRevenue,
 *     capexPercentRevenue, workingCapitalPercentRevenue,  // number | number[forecastYears]
 *     taxRate, wacc, terminalGrowthRate,                  // number
 *     forecastYears                                        // integer
 *   },
 *   capitalStructure: { debt, cash, dilutedShares }
 * }
 */

const formulas = require("./dcf.formulas");
const validateDCFInput = require("./dcf.validator");

/** Broadcasts a scalar assumption to every forecast year, or passes an already-per-year array through untouched. */
const normalizeYearlySeries = (value, forecastYears) =>
    Array.isArray(value) ? value : Array(forecastYears).fill(value);

/**
 * Historical FCFF for each stored financial statement, oldest to newest.
 * Uses the same top-down-from-EBIT formulation as the forecast (see
 * dcf.formulas.js for why).
 *
 * Yahoo's `capitalExpenditure` field (and standard cash-flow-statement
 * convention generally) reports CapEx as a NEGATIVE number - a cash
 * outflow - confirmed empirically: OCF + capitalExpenditure exactly
 * equals Yahoo's own reported FCF for every year checked. dcf.formulas.js's
 * `fcff()` expects CapEx as a positive magnitude to subtract, so it's
 * normalized with Math.abs() at this boundary, once, rather than pushing
 * sign-handling into the pure formula layer.
 *
 * The first year in the series has no prior-year balance sheet to diff
 * against, so its `changeInNWC` and therefore `fcff` are null - this is
 * surfaced via `available: false`, never silently zeroed or omitted.
 *
 * @param {Array} statements - Financial statement documents/plain objects, any order
 * @returns {Array} Per-year FCFF breakdown, oldest to newest
 */
const calculateHistoricalFCFF = (statements) => {
    if (!Array.isArray(statements) || statements.length === 0) {
        return [];
    }

    const sorted = [...statements]
        .filter((statement) => statement && typeof statement.year === "number")
        .sort((first, second) => first.year - second.year);

    return sorted.map((statement, index) => {
        const ebit = statement.incomeStatement?.operatingIncome ?? null;
        const pretaxIncome = statement.incomeStatement?.pretaxIncome ?? null;
        const taxProvision = statement.incomeStatement?.taxProvision ?? null;
        const taxRate = formulas.effectiveTaxRate(pretaxIncome, taxProvision);

        const depreciationAndAmortization = statement.cashFlow?.depreciationAndAmortization ?? null;
        const rawCapitalExpenditure = statement.cashFlow?.capitalExpenditure;
        const capitalExpenditure =
            typeof rawCapitalExpenditure === "number" ? Math.abs(rawCapitalExpenditure) : null;

        const currentAssets = statement.balanceSheet?.currentAssets ?? null;
        const currentLiabilities = statement.balanceSheet?.currentLiabilities ?? null;
        const netWorkingCapital = formulas.netWorkingCapital(currentAssets, currentLiabilities);

        const priorStatement = sorted[index - 1];
        const priorNWC = priorStatement
            ? formulas.netWorkingCapital(
                  priorStatement.balanceSheet?.currentAssets ?? null,
                  priorStatement.balanceSheet?.currentLiabilities ?? null
              )
            : null;

        const changeInNWC =
            priorNWC === null || netWorkingCapital === null
                ? null
                : formulas.changeInNetWorkingCapital(netWorkingCapital, priorNWC);

        const fcffValue =
            changeInNWC === null
                ? null
                : formulas.fcff({ ebit, taxRate, depreciationAndAmortization, capitalExpenditure, changeInNWC });

        return {
            year: statement.year,
            ebit,
            taxRate,
            depreciationAndAmortization,
            capitalExpenditure,
            netWorkingCapital,
            changeInNWC,
            fcff: fcffValue,
            available: fcffValue !== null,
        };
    });
};

/**
 * Forecasts FCFF for `assumptions.forecastYears` years starting from the
 * company's latest available revenue and net working capital.
 * Revenue -> EBIT -> NOPAT -> +D&A -> -CapEx -> -Change in NWC -> FCFF,
 * discounted year by year at `assumptions.wacc`.
 */
const forecastFCFF = ({ historicalFinancials, assumptions }) => {
    const { forecastYears, taxRate, wacc } = assumptions;

    const revenueGrowth = normalizeYearlySeries(assumptions.revenueGrowth, forecastYears);
    const ebitMargin = normalizeYearlySeries(assumptions.ebitMargin, forecastYears);
    const daPercentRevenue = normalizeYearlySeries(assumptions.depreciationPercentRevenue, forecastYears);
    const capexPercentRevenue = normalizeYearlySeries(assumptions.capexPercentRevenue, forecastYears);
    const nwcPercentRevenue = normalizeYearlySeries(assumptions.workingCapitalPercentRevenue, forecastYears);

    let priorRevenue = historicalFinancials.latestRevenue;
    let priorNWC = historicalFinancials.latestNWC;

    const forecastDetail = [];

    for (let index = 0; index < forecastYears; index += 1) {
        const year = index + 1;

        const revenue = priorRevenue * (1 + revenueGrowth[index]);
        const ebit = revenue * ebitMargin[index];
        const nopat = formulas.nopat(ebit, taxRate);
        const depreciationAndAmortization = revenue * daPercentRevenue[index];
        const capitalExpenditure = revenue * capexPercentRevenue[index];
        const netWorkingCapital = revenue * nwcPercentRevenue[index];
        const changeInNWC = formulas.changeInNetWorkingCapital(netWorkingCapital, priorNWC);
        const fcffValue = formulas.fcff({ ebit, taxRate, depreciationAndAmortization, capitalExpenditure, changeInNWC });
        const yearDiscountFactor = formulas.discountFactor(wacc, year);
        const yearPresentValue = formulas.presentValue(fcffValue, yearDiscountFactor);

        forecastDetail.push({
            year,
            revenue,
            ebit,
            nopat,
            depreciationAndAmortization,
            capitalExpenditure,
            netWorkingCapital,
            changeInNWC,
            fcff: fcffValue,
            discountFactor: yearDiscountFactor,
            presentValue: yearPresentValue,
        });

        priorRevenue = revenue;
        priorNWC = netWorkingCapital;
    }

    return forecastDetail;
};

/**
 * Runs the full DCF: forecast FCFF, discount it, add discounted terminal
 * value, subtract net debt, divide by diluted shares.
 *
 * @param {object} input - {historicalFinancials, assumptions, capitalStructure}
 * @returns {object} {isValid, errors, ...} - see module doc for shape on success
 */
const calculateDCF = (input) => {
    const validation = validateDCFInput(input);

    if (!validation.isValid) {
        return { isValid: false, errors: validation.errors };
    }

    const { historicalFinancials, assumptions, capitalStructure } = input;
    const { wacc, terminalGrowthRate } = assumptions;

    const forecastDetail = forecastFCFF({ historicalFinancials, assumptions });

    const projectedFCFF = forecastDetail.map((entry) => entry.fcff);
    const discountFactors = forecastDetail.map((entry) => entry.discountFactor);
    const pvOfFCFF = forecastDetail.reduce((sum, entry) => sum + entry.presentValue, 0);

    const finalYear = forecastDetail[forecastDetail.length - 1];
    const terminalValue = formulas.terminalValueGordonGrowth({
        finalYearFCFF: finalYear.fcff,
        wacc,
        terminalGrowthRate,
    });
    const pvOfTerminalValue = formulas.presentValue(terminalValue, finalYear.discountFactor);

    const enterpriseValueAmount = formulas.enterpriseValue(pvOfFCFF, pvOfTerminalValue);
    const netDebtAmount = formulas.netDebt(capitalStructure.debt, capitalStructure.cash);
    const equityValueAmount = formulas.equityValue(enterpriseValueAmount, netDebtAmount);
    const intrinsicValuePerShare = formulas.intrinsicValuePerShare(equityValueAmount, capitalStructure.dilutedShares);

    if (
        terminalValue === null ||
        pvOfTerminalValue === null ||
        enterpriseValueAmount === null ||
        equityValueAmount === null ||
        intrinsicValuePerShare === null
    ) {
        return {
            isValid: false,
            errors: [
                "DCF calculation could not be completed with the given assumptions. Check that WACC exceeds the terminal growth rate and that capital structure inputs are valid numbers.",
            ],
        };
    }

    return {
        isValid: true,
        errors: [],
        forecastDetail,
        projectedFCFF,
        discountFactors,
        pvOfFCFF,
        terminalValue,
        pvOfTerminalValue,
        enterpriseValue: enterpriseValueAmount,
        netDebt: netDebtAmount,
        equityValue: equityValueAmount,
        intrinsicValuePerShare,
        capitalStructure,
        assumptionsUsed: {
            ...assumptions,
            revenueGrowth: normalizeYearlySeries(assumptions.revenueGrowth, assumptions.forecastYears),
            ebitMargin: normalizeYearlySeries(assumptions.ebitMargin, assumptions.forecastYears),
            depreciationPercentRevenue: normalizeYearlySeries(
                assumptions.depreciationPercentRevenue,
                assumptions.forecastYears
            ),
            capexPercentRevenue: normalizeYearlySeries(assumptions.capexPercentRevenue, assumptions.forecastYears),
            workingCapitalPercentRevenue: normalizeYearlySeries(
                assumptions.workingCapitalPercentRevenue,
                assumptions.forecastYears
            ),
        },
    };
};

module.exports = {
    calculateDCF,
    calculateHistoricalFCFF,
    forecastFCFF,
    normalizeYearlySeries,
};
