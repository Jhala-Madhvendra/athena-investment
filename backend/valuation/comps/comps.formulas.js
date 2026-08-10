/**
 * Comps Formulas
 *
 * Pure, side-effect-free trading-multiple math. No Express, no MongoDB,
 * no Yahoo Finance - every function takes plain numbers and returns a
 * plain number or null (never NaN/Infinity), mirroring dcf.formulas.js
 * and ratio.formulas.js.
 *
 * MULTIPLE TYPES
 * --------------
 * Equity multiples (numerator is Equity Value / Market Cap - belongs only
 * to equity holders): P/E, P/B, P/S.
 * Enterprise multiples (numerator is Enterprise Value - belongs to debt +
 * equity holders): EV/EBITDA, EV/Revenue.
 * These are never interchanged - see research/finance/ValuationMultiples.md.
 *
 * A multiple is only "meaningful" when its denominator is a positive
 * number: negative or zero earnings/EBITDA/book value/revenue make the
 * ratio economically nonsensical, so these functions return null rather
 * than a misleading negative or inverted-sign multiple. Callers are
 * responsible for surfacing *why* a value was excluded (see
 * comps.engine.js) - these functions only decide whether it's valid.
 */

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

/** Denominator must be a positive number - zero/negative denominators make a multiple non-meaningful, not just undefined. */
const safeDivide = (numerator, denominator) => {
    if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator) || denominator <= 0) {
        return null;
    }

    return numerator / denominator;
};

/**
 * EBITDA proxy = EBIT (Operating Income) + D&A.
 * Athena doesn't store a reported EBITDA figure - operatingIncome is
 * already used as EBIT elsewhere (see FCFF.md), and
 * depreciationAndAmortization is the standard add-back, so
 * "EBITDA = EBIT + D&A" is used consistently here rather than sourcing a
 * second, differently-defined EBITDA figure from elsewhere.
 */
const ebitda = (operatingIncome, depreciationAndAmortization) => {
    if (!isFiniteNumber(operatingIncome) || !isFiniteNumber(depreciationAndAmortization)) {
        return null;
    }

    return operatingIncome + depreciationAndAmortization;
};

/**
 * Enterprise Value from market data - distinct from dcf.formulas.js's
 * enterpriseValue() (which sums discounted cash flows). This is EV as the
 * market prices it today: EV = Market Cap + Total Debt - Cash.
 */
const enterpriseValue = (marketCap, totalDebt, cashAndEquivalents) => {
    if (!isFiniteNumber(marketCap) || !isFiniteNumber(totalDebt) || !isFiniteNumber(cashAndEquivalents)) {
        return null;
    }

    return marketCap + totalDebt - cashAndEquivalents;
};

/** P/E = Market Cap (Equity Value) / Net Income. Null when Net Income <= 0 - negative earnings make P/E meaningless, never inverted into an artificial positive figure. */
const priceToEarnings = (marketCap, netIncome) => safeDivide(marketCap, netIncome);

/** EV/EBITDA = Enterprise Value / EBITDA. Null when EBITDA <= 0. */
const evToEbitda = (ev, ebitdaValue) => safeDivide(ev, ebitdaValue);

/** EV/Revenue = Enterprise Value / Revenue. Null when Revenue <= 0. */
const evToRevenue = (ev, revenue) => safeDivide(ev, revenue);

/** P/B = Market Cap (Equity Value) / Total Shareholders' Equity (Book Value). Null when Book Value <= 0. */
const priceToBook = (marketCap, bookValue) => safeDivide(marketCap, bookValue);

/** P/S = Market Cap (Equity Value) / Revenue. Null when Revenue <= 0. */
const priceToSales = (marketCap, revenue) => safeDivide(marketCap, revenue);

module.exports = {
    isFiniteNumber,
    safeDivide,
    ebitda,
    enterpriseValue,
    priceToEarnings,
    evToEbitda,
    evToRevenue,
    priceToBook,
    priceToSales,
};
