/**
 * Tax Lot Calculator
 *
 * Pure functions only - no I/O, no Mongoose (same discipline as
 * holdingsReconstruction.calculator.js). FIFO-matches a single ticker's
 * BUY/SELL transaction history: each SELL consumes the oldest still-open
 * BUY lots first, splitting a lot when it's only partially consumed.
 *
 * Built on top of Transaction (the real chronological ledger), never
 * Holding (a separate, unsynchronized manually-entered current-state
 * model) - see the bookkeeping-depth plan's Context section for why.
 *
 * "term" (SHORT/LONG at the common >365-day threshold) is an informational
 * estimate, not a tax filing claim - see ProductBoundaries.md. Athena
 * never computes or asserts an actual tax liability.
 */

const { sortChronologically } = require("./holdingsReconstruction.calculator");

const LONG_TERM_THRESHOLD_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const holdingPeriodDays = (buyDate, sellDate) => Math.round((new Date(sellDate).getTime() - new Date(buyDate).getTime()) / MS_PER_DAY);

/**
 * FIFO-matches one ticker's chronologically-sorted BUY/SELL transactions.
 * @param {object[]} transactions - all BUY/SELL rows for a single ticker (any order - sorted internally)
 * @returns {{ realizedLots: object[], openLots: object[] }}
 */
const matchLotsFIFO = (transactions) => {
    const sorted = sortChronologically(transactions || []);

    // FIFO queue of still-open buy-lot portions: { date, price, quantityRemaining }
    const openQueue = [];
    const realizedLots = [];

    sorted.forEach((transaction) => {
        if (transaction.type === "BUY") {
            openQueue.push({ date: transaction.transactionDate, price: transaction.price, quantityRemaining: transaction.quantity });
            return;
        }

        // SELL - consume the oldest open lots first, splitting the last one touched if needed.
        let remainingToSell = transaction.quantity;

        while (remainingToSell > 0 && openQueue.length > 0) {
            const lot = openQueue[0];
            const quantityConsumed = Math.min(lot.quantityRemaining, remainingToSell);

            const days = holdingPeriodDays(lot.date, transaction.transactionDate);
            realizedLots.push({
                ticker: transaction.ticker,
                buyDate: lot.date,
                buyPrice: lot.price,
                sellDate: transaction.transactionDate,
                sellPrice: transaction.price,
                quantity: quantityConsumed,
                proceeds: quantityConsumed * transaction.price,
                costBasis: quantityConsumed * lot.price,
                gainLoss: quantityConsumed * (transaction.price - lot.price),
                holdingPeriodDays: days,
                term: days > LONG_TERM_THRESHOLD_DAYS ? "LONG" : "SHORT",
            });

            lot.quantityRemaining -= quantityConsumed;
            remainingToSell -= quantityConsumed;

            if (lot.quantityRemaining <= 0) {
                openQueue.shift();
            }
        }
        // A SELL exceeding open quantity (remainingToSell > 0 here) can't happen for data that
        // already passed transaction.service.js's findFirstNegativeHolding guard - not re-guarded here.
    });

    const openLots = openQueue.map((lot) => ({
        ticker: sorted[0]?.ticker,
        buyDate: lot.date,
        buyPrice: lot.price,
        quantityRemaining: lot.quantityRemaining,
        costBasis: lot.quantityRemaining * lot.price,
    }));

    return { realizedLots, openLots };
};

module.exports = { matchLotsFIFO, LONG_TERM_THRESHOLD_DAYS };
