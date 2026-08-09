/**
 * DCF Formulas
 *
 * Pure, side-effect-free math. No Express, no MongoDB, no Yahoo Finance.
 * Every function takes plain numbers/objects and returns a plain number or
 * null (never throws, never returns NaN/Infinity) so the engine that
 * composes these can stay deterministic and easy to reason about.
 *
 * FCFF FORMULATION
 * -----------------
 * Athena computes FCFF top-down from EBIT:
 *
 *   FCFF = EBIT x (1 - Tax Rate) + D&A - CapEx - Change in NWC
 *
 * This is deliberately NOT "Operating Cash Flow - CapEx". OCF starts from
 * Net Income, which already reflects interest expense - i.e. it is a
 * levered figure influenced by the company's actual capital structure.
 * FCFF must be capital-structure-neutral (cash available to *all* capital
 * providers, debt and equity alike) because it gets discounted at WACC,
 * a blended cost of capital. Discounting a levered cash flow at an
 * unlevered discount rate double-counts the effect of leverage. See
 * research/finance/FCFF.md for the full derivation and equivalence proof.
 */

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const safeDivide = (numerator, denominator) => {
    if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator) || denominator === 0) {
        return null;
    }

    return numerator / denominator;
};

/** Effective tax rate = Tax Provision / Pretax Income, read off a historical statement. */
const effectiveTaxRate = (pretaxIncome, taxProvision) => safeDivide(taxProvision, pretaxIncome);

/** NOPAT = Net Operating Profit After Tax = EBIT x (1 - Tax Rate). */
const nopat = (ebit, taxRate) => {
    if (!isFiniteNumber(ebit) || !isFiniteNumber(taxRate)) {
        return null;
    }

    return ebit * (1 - taxRate);
};

/** Net Working Capital = Current Assets - Current Liabilities. */
const netWorkingCapital = (currentAssets, currentLiabilities) => {
    if (!isFiniteNumber(currentAssets) || !isFiniteNumber(currentLiabilities)) {
        return null;
    }

    return currentAssets - currentLiabilities;
};

/** Change in NWC = NWC(t) - NWC(t-1). A rising NWC consumes cash (positive = cash outflow). */
const changeInNetWorkingCapital = (currentNWC, priorNWC) => {
    if (!isFiniteNumber(currentNWC) || !isFiniteNumber(priorNWC)) {
        return null;
    }

    return currentNWC - priorNWC;
};

/**
 * FCFF = EBIT x (1 - Tax Rate) + D&A - CapEx - Change in NWC
 * CapEx is expected as a positive outflow amount here (magnitude, not the
 * negative sign some cash flow statements report it with) - callers are
 * responsible for normalizing sign before calling this.
 */
const fcff = ({ ebit, taxRate, depreciationAndAmortization, capitalExpenditure, changeInNWC }) => {
    const nopatValue = nopat(ebit, taxRate);

    if (
        nopatValue === null ||
        !isFiniteNumber(depreciationAndAmortization) ||
        !isFiniteNumber(capitalExpenditure) ||
        !isFiniteNumber(changeInNWC)
    ) {
        return null;
    }

    return nopatValue + depreciationAndAmortization - capitalExpenditure - changeInNWC;
};

/** Cost of Equity via CAPM: Ke = Risk-Free Rate + Beta x Equity Risk Premium. */
const costOfEquityCAPM = ({ riskFreeRate, beta, equityRiskPremium }) => {
    if (!isFiniteNumber(riskFreeRate) || !isFiniteNumber(beta) || !isFiniteNumber(equityRiskPremium)) {
        return null;
    }

    return riskFreeRate + beta * equityRiskPremium;
};

/** After-tax Cost of Debt = Pre-tax Kd x (1 - Tax Rate). */
const afterTaxCostOfDebt = (preTaxCostOfDebt, taxRate) => {
    if (!isFiniteNumber(preTaxCostOfDebt) || !isFiniteNumber(taxRate)) {
        return null;
    }

    return preTaxCostOfDebt * (1 - taxRate);
};

/**
 * WACC = E/(D+E) x Ke + D/(D+E) x Kd(after-tax)
 * marketValueOfEquity should be market capitalization (forward-looking,
 * matches how equity actually trades); marketValueOfDebt is typically a
 * book-debt proxy in the absence of bond pricing data - see WACC.md.
 */
const wacc = ({ marketValueOfEquity, marketValueOfDebt, costOfEquity, afterTaxCostOfDebt: kdAfterTax }) => {
    if (
        !isFiniteNumber(marketValueOfEquity) ||
        !isFiniteNumber(marketValueOfDebt) ||
        !isFiniteNumber(costOfEquity) ||
        !isFiniteNumber(kdAfterTax) ||
        marketValueOfEquity < 0 ||
        marketValueOfDebt < 0
    ) {
        return null;
    }

    const totalCapital = marketValueOfEquity + marketValueOfDebt;

    if (totalCapital === 0) {
        return null;
    }

    const equityWeight = marketValueOfEquity / totalCapital;
    const debtWeight = marketValueOfDebt / totalCapital;

    return equityWeight * costOfEquity + debtWeight * kdAfterTax;
};

/** Discount Factor for year t = 1 / (1 + WACC)^t. */
const discountFactor = (rate, year) => {
    if (!isFiniteNumber(rate) || !isFiniteNumber(year) || rate <= -1) {
        return null;
    }

    return 1 / Math.pow(1 + rate, year);
};

const presentValue = (cashflow, factor) => {
    if (!isFiniteNumber(cashflow) || !isFiniteNumber(factor)) {
        return null;
    }

    return cashflow * factor;
};

/**
 * Terminal Value (Perpetual Growth / Gordon Growth Method):
 *   TV = FCFF(n+1) / (WACC - g),  FCFF(n+1) = FCFF(n) x (1 + g)
 *
 * WACC must exceed the terminal growth rate - a perpetuity growing faster
 * than the discount rate has an undefined (infinite/negative) present
 * value, which is economically meaningless (no real company can out-grow
 * its cost of capital forever). Returns null rather than Infinity/NaN;
 * callers should reject this combination via dcf.validator.js *before*
 * calculating, this is a last-resort guard.
 */
const terminalValueGordonGrowth = ({ finalYearFCFF, wacc: waccRate, terminalGrowthRate }) => {
    if (!isFiniteNumber(finalYearFCFF) || !isFiniteNumber(waccRate) || !isFiniteNumber(terminalGrowthRate)) {
        return null;
    }

    if (waccRate <= terminalGrowthRate) {
        return null;
    }

    const nextYearFCFF = finalYearFCFF * (1 + terminalGrowthRate);

    return nextYearFCFF / (waccRate - terminalGrowthRate);
};

/** Enterprise Value = sum(PV of forecast FCFF) + PV of Terminal Value. */
const enterpriseValue = (pvOfForecastFCFF, pvOfTerminalValue) => {
    if (!isFiniteNumber(pvOfForecastFCFF) || !isFiniteNumber(pvOfTerminalValue)) {
        return null;
    }

    return pvOfForecastFCFF + pvOfTerminalValue;
};

/** Net Debt = Total Debt - Cash & Cash Equivalents. Can be negative (net cash position). */
const netDebt = (totalDebt, cashAndEquivalents) => {
    if (!isFiniteNumber(totalDebt) || !isFiniteNumber(cashAndEquivalents)) {
        return null;
    }

    return totalDebt - cashAndEquivalents;
};

/**
 * Equity Value = Enterprise Value - Net Debt
 * (equivalently EV - Debt + Cash). EV belongs to all capital providers;
 * subtracting what's owed to debt holders leaves what's left for equity.
 */
const equityValue = (enterpriseValueAmount, netDebtAmount) => {
    if (!isFiniteNumber(enterpriseValueAmount) || !isFiniteNumber(netDebtAmount)) {
        return null;
    }

    return enterpriseValueAmount - netDebtAmount;
};

/** Intrinsic Value Per Share = Equity Value / Diluted Shares Outstanding. */
const intrinsicValuePerShare = (equityValueAmount, dilutedShares) => safeDivide(equityValueAmount, dilutedShares);

/** Valuation gap, NOT a recommendation: (Intrinsic - Market) / Market x 100. */
const upsideDownsidePercent = (intrinsicValue, marketPrice) => {
    if (!isFiniteNumber(intrinsicValue) || !isFiniteNumber(marketPrice) || marketPrice <= 0) {
        return null;
    }

    return ((intrinsicValue - marketPrice) / marketPrice) * 100;
};

module.exports = {
    isFiniteNumber,
    safeDivide,
    effectiveTaxRate,
    nopat,
    netWorkingCapital,
    changeInNetWorkingCapital,
    fcff,
    costOfEquityCAPM,
    afterTaxCostOfDebt,
    wacc,
    discountFactor,
    presentValue,
    terminalValueGordonGrowth,
    enterpriseValue,
    netDebt,
    equityValue,
    intrinsicValuePerShare,
    upsideDownsidePercent,
};
