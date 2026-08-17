/**
 * Comps Engine
 *
 * Deterministic, framework-independent Comparable Company Analysis engine.
 * Receives already-assembled plain financial/market bundles for a target
 * and its peers (comps.service.js + a compsInput mapper are responsible
 * for pulling those from MongoDB/Yahoo) and returns a fully structured
 * result: per-company metrics, per-multiple peer statistics, and the
 * target's implied valuation under each applicable multiple.
 *
 * Given the same input, calculateComps always produces the same output -
 * no randomness, no wall-clock reads, no hidden defaults (see dcf.engine.js
 * for the same discipline applied to DCF).
 */

const formulas = require("./comps.formulas");
const statistics = require("./comps.statistics");
const { MULTIPLE_DEFINITIONS, calculateImpliedValuation } = require("./comps.valuation");

const MULTIPLE_KEYS = Object.keys(MULTIPLE_DEFINITIONS);

const isPositive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;

/** Explains *why* a multiple is null for one company - never left as an unexplained blank. */
const buildExclusionReason = ({ multipleKey, value, denominatorValue, denominatorLabel, evAvailable }) => {
    if (value !== null) {
        return null;
    }

    if (denominatorValue == null) {
        return `${denominatorLabel} is not available.`;
    }

    if (!isPositive(denominatorValue)) {
        return `${denominatorLabel} is zero or negative - this multiple is not meaningful for this company.`;
    }

    if ((multipleKey === "evEbitda" || multipleKey === "evRevenue") && !evAvailable) {
        return "Enterprise Value could not be computed (missing market cap, debt, or cash).";
    }

    return "This multiple could not be computed.";
};

/**
 * Computes every derived metric + multiple for one company (target or peer).
 * Never throws - missing inputs simply propagate as null with a reason,
 * exactly like dcf.formulas.js/ratio.formulas.js.
 */
const buildCompanyMetrics = (company) => {
    const ebitdaValue = formulas.ebitda(
        company.ebitdaInputs?.operatingIncome,
        company.ebitdaInputs?.depreciationAndAmortization
    );
    const enterpriseValueAmount = formulas.enterpriseValue(company.marketCap, company.debt, company.cash);
    const evAvailable = enterpriseValueAmount !== null;

    const peValue = formulas.priceToEarnings(company.marketCap, company.netIncome);
    const evEbitdaValue = formulas.evToEbitda(enterpriseValueAmount, ebitdaValue);
    const evRevenueValue = formulas.evToRevenue(enterpriseValueAmount, company.revenue);
    const pbValue = formulas.priceToBook(company.marketCap, company.bookValue);
    const psValue = formulas.priceToSales(company.marketCap, company.revenue);

    const multiples = {
        pe: {
            value: peValue,
            excludedReason: buildExclusionReason({
                multipleKey: "pe",
                value: peValue,
                denominatorValue: company.netIncome,
                denominatorLabel: "Net Income",
                evAvailable,
            }),
        },
        evEbitda: {
            value: evEbitdaValue,
            excludedReason: buildExclusionReason({
                multipleKey: "evEbitda",
                value: evEbitdaValue,
                denominatorValue: ebitdaValue,
                denominatorLabel: "EBITDA",
                evAvailable,
            }),
        },
        evRevenue: {
            value: evRevenueValue,
            excludedReason: buildExclusionReason({
                multipleKey: "evRevenue",
                value: evRevenueValue,
                denominatorValue: company.revenue,
                denominatorLabel: "Revenue",
                evAvailable,
            }),
        },
        pb: {
            value: pbValue,
            excludedReason: buildExclusionReason({
                multipleKey: "pb",
                value: pbValue,
                denominatorValue: company.bookValue,
                denominatorLabel: "Book Value",
                evAvailable,
            }),
        },
        ps: {
            value: psValue,
            excludedReason: buildExclusionReason({
                multipleKey: "ps",
                value: psValue,
                denominatorValue: company.revenue,
                denominatorLabel: "Revenue",
                evAvailable,
            }),
        },
    };

    return {
        ticker: company.ticker,
        name: company.name ?? null,
        // Every dollar figure below (marketCap, enterpriseValue, revenue, ...) is in THIS company's own
        // currency - carried through so a caller can label each row correctly instead of assuming the
        // target's currency applies to every peer too. Multiples are dimensionless and need no currency.
        currency: company.currency ?? null,
        price: company.price ?? null,
        marketCap: company.marketCap ?? null,
        enterpriseValue: enterpriseValueAmount,
        revenue: company.revenue ?? null,
        ebitda: ebitdaValue,
        netIncome: company.netIncome ?? null,
        bookValue: company.bookValue ?? null,
        debt: company.debt ?? null,
        cash: company.cash ?? null,
        dilutedShares: company.dilutedShares ?? null,
        multiples,
    };
};

/** Peer statistics for every multiple, computed only from peers whose multiple was valid (not excluded). */
const buildPeerStatistics = (peerMetrics) => {
    const peerStatistics = {};

    MULTIPLE_KEYS.forEach((key) => {
        const validValues = peerMetrics.map((peer) => peer.multiples[key].value).filter((value) => value !== null);
        const excludedPeers = peerMetrics
            .filter((peer) => peer.multiples[key].value === null)
            .map((peer) => ({ ticker: peer.ticker, reason: peer.multiples[key].excludedReason }));

        peerStatistics[key] = {
            ...statistics.summarize(validValues),
            excludedPeers,
        };
    });

    return peerStatistics;
};

const selectStatisticValue = (summary, statisticName) => (summary ? summary[statisticName] ?? null : null);

/**
 * @param {object} input
 * @param {object} input.target - {ticker, name, currency, price, marketCap, revenue, netIncome, bookValue,
 *   ebitdaInputs: {operatingIncome, depreciationAndAmortization}, debt, cash, dilutedShares}
 * @param {object[]} input.peers - same shape as target, one per selected peer
 * @param {"mean"|"median"|"p25"|"p75"} input.statistic - which peer statistic to apply to the target
 * @returns {object} {target, peers, peerStatistics, statistic, impliedValuations, valuationRange}
 */
const calculateComps = ({ target, peers, statistic }) => {
    const targetMetrics = buildCompanyMetrics(target);
    const peerMetrics = peers.map(buildCompanyMetrics);
    const peerStatistics = buildPeerStatistics(peerMetrics);

    const impliedValuations = {};
    MULTIPLE_KEYS.forEach((key) => {
        const selectedPeerStatistic = selectStatisticValue(peerStatistics[key], statistic);
        impliedValuations[key] = calculateImpliedValuation(key, selectedPeerStatistic, targetMetrics);
    });

    const applicablePerShareValues = MULTIPLE_KEYS.map((key) => impliedValuations[key])
        .filter((result) => result.isApplicable)
        .map((result) => result.impliedValuePerShare);

    const rangeSummary = statistics.summarize(applicablePerShareValues);

    return {
        target: targetMetrics,
        peers: peerMetrics,
        peerStatistics,
        statistic,
        impliedValuations,
        valuationRange: {
            low: rangeSummary.min,
            median: rangeSummary.median,
            high: rangeSummary.max,
            methodologiesApplied: rangeSummary.count,
        },
    };
};

module.exports = { calculateComps, buildCompanyMetrics, buildPeerStatistics, MULTIPLE_KEYS };
