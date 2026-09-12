/**
 * Tax Lot Service
 *
 * I/O layer over taxLot.calculator.js's pure FIFO matching. Reuses
 * transactionService.getTransactions (never re-fetches Transaction
 * directly) and portfolioService.fetchQuotesByTicker for open-lot pricing -
 * see the bookkeeping-depth plan's reuse notes.
 */

const transactionService = require("./transaction.service");
const portfolioService = require("./portfolio.service");
const { matchLotsFIFO } = require("./taxLot.calculator");

const groupByTicker = (transactions) => {
    const byTicker = new Map();
    transactions.forEach((transaction) => {
        const bucket = byTicker.get(transaction.ticker) || [];
        bucket.push(transaction);
        byTicker.set(transaction.ticker, bucket);
    });
    return byTicker;
};

const summarizeRealizedLots = (realizedLots) => {
    const totals = realizedLots.reduce(
        (acc, lot) => {
            acc.totalProceeds += lot.proceeds;
            acc.totalCostBasis += lot.costBasis;
            acc.totalRealizedGain += lot.gainLoss;
            if (lot.term === "LONG") acc.longTermGain += lot.gainLoss;
            else acc.shortTermGain += lot.gainLoss;
            return acc;
        },
        { totalProceeds: 0, totalCostBasis: 0, totalRealizedGain: 0, shortTermGain: 0, longTermGain: 0 }
    );

    return totals;
};

/**
 * @param {string} userId
 * @param {{ portfolioId?: string|null, ticker?: string, taxYear?: number }} [options]
 */
const getRealizedGains = async (userId, { portfolioId, ticker, taxYear } = {}) => {
    const transactions = await transactionService.getTransactions(userId, { ticker, portfolioId });
    const byTicker = groupByTicker(transactions);

    let realizedLots = [];
    for (const tickerTransactions of byTicker.values()) {
        const { realizedLots: lots } = matchLotsFIFO(tickerTransactions);
        realizedLots = realizedLots.concat(lots);
    }

    if (taxYear) {
        realizedLots = realizedLots.filter((lot) => new Date(lot.sellDate).getUTCFullYear() === Number(taxYear));
    }

    realizedLots.sort((a, b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime());

    return { realizedLots, summary: summarizeRealizedLots(realizedLots) };
};

/**
 * @param {string} userId
 * @param {{ portfolioId?: string|null, ticker?: string }} [options]
 */
const getOpenLots = async (userId, { portfolioId, ticker } = {}) => {
    const transactions = await transactionService.getTransactions(userId, { ticker, portfolioId });
    const byTicker = groupByTicker(transactions);

    let openLots = [];
    for (const tickerTransactions of byTicker.values()) {
        const { openLots: lots } = matchLotsFIFO(tickerTransactions);
        openLots = openLots.concat(lots);
    }

    if (openLots.length === 0) {
        return { openLots: [] };
    }

    const quotesByTicker = await portfolioService.fetchQuotesByTicker(openLots.map((lot) => lot.ticker));

    const pricedOpenLots = openLots.map((lot) => {
        const quote = quotesByTicker.get(lot.ticker);
        const currentPrice = quote?.price ?? null;
        const currentValue = typeof currentPrice === "number" ? lot.quantityRemaining * currentPrice : null;

        return {
            ...lot,
            currency: quote?.currency ?? null,
            currentPrice,
            currentValue,
            unrealizedGainLoss: currentValue === null ? null : currentValue - lot.costBasis,
        };
    });

    pricedOpenLots.sort((a, b) => new Date(a.buyDate).getTime() - new Date(b.buyDate).getTime());

    return { openLots: pricedOpenLots };
};

module.exports = { getRealizedGains, getOpenLots };
