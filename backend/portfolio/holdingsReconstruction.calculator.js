/**
 * Holdings Reconstruction Calculator
 *
 * Pure functions only - no I/O, no Mongoose (same shape as
 * portfolio.analytics.calculator.js). Given a user's raw Transaction rows,
 * replays them chronologically to answer "what did this portfolio actually
 * hold on date X" - the layer that makes true historical reconstruction
 * possible, as opposed to portfolio.analytics.calculator.js's documented
 * "today's weights applied backward" approximation.
 *
 * ORDERING
 * --------
 * Transactions are sorted by transactionDate, then by createdAt, then by
 * _id, so that same-day transactions and out-of-order inserts still replay
 * deterministically (see Sprint 15 brief section 16). This is the single
 * ordering used everywhere below - callers must not re-sort independently.
 *
 * REPLAY MODEL
 * ------------
 * holdings(t) = sum of every BUY quantity up to and including t, minus
 * every SELL quantity up to and including t, per ticker. A ticker whose
 * running quantity is ~0 (within EPSILON, to tolerate float drift from
 * fractional shares) is dropped from the returned holdings map - a closed
 * position is absence, not an explicit zero.
 */

const EPSILON = 1e-9;

const toTime = (value) => new Date(value).getTime();

/** Ascending: transactionDate, then createdAt, then _id (stable tie-break for identical timestamps). */
const compareTransactions = (a, b) => {
    const dateDiff = toTime(a.transactionDate) - toTime(b.transactionDate);
    if (dateDiff !== 0) return dateDiff;

    const createdDiff = toTime(a.createdAt || 0) - toTime(b.createdAt || 0);
    if (createdDiff !== 0) return createdDiff;

    return String(a._id) < String(b._id) ? -1 : String(a._id) > String(b._id) ? 1 : 0;
};

const sortChronologically = (transactions) => [...(transactions || [])].sort(compareTransactions);

const pruneZero = (holdings) => {
    const pruned = {};
    Object.entries(holdings).forEach(([ticker, quantity]) => {
        if (Math.abs(quantity) > EPSILON) {
            pruned[ticker] = quantity;
        }
    });
    return pruned;
};

/**
 * Replays every transaction in order, returning one step per transaction
 * with the full running holdings snapshot immediately after it was applied.
 * @returns {{transaction: object, holdingsAfter: Record<string, number>}[]}
 */
const replay = (transactions) => {
    const sorted = sortChronologically(transactions);
    const running = {};
    const steps = [];

    sorted.forEach((transaction) => {
        const delta = transaction.type === "BUY" ? transaction.quantity : -transaction.quantity;
        running[transaction.ticker] = (running[transaction.ticker] || 0) + delta;
        steps.push({ transaction, holdingsAfter: { ...running } });
    });

    return steps;
};

/**
 * Walks the replay looking for the first point where any ticker's running
 * quantity goes negative - the ledger-wide equivalent of "can't sell more
 * than you held immediately before this transaction," generalized to catch
 * an edit/delete that invalidates a *later* transaction, not just the one
 * being written (see Sprint 15 brief section 15).
 * @returns {{transaction: object, ticker: string, quantity: number}|null}
 */
const findFirstNegativeHolding = (transactions) => {
    for (const step of replay(transactions)) {
        for (const [ticker, quantity] of Object.entries(step.holdingsAfter)) {
            if (quantity < -EPSILON) {
                return { transaction: step.transaction, ticker, quantity };
            }
        }
    }
    return null;
};

/**
 * Holdings as of a specific date (inclusive) - every transaction dated on
 * or before `asOfDate` has been applied, nothing after it.
 * @returns {Record<string, number>}
 */
const getHoldingsAt = (transactions, asOfDate) => {
    const cutoff = toTime(asOfDate);
    const relevant = (transactions || []).filter((t) => toTime(t.transactionDate) <= cutoff);
    const steps = replay(relevant);
    return pruneZero(steps.length ? steps[steps.length - 1].holdingsAfter : {});
};

const toDateKey = (value) => new Date(value).toISOString().slice(0, 10);

const addDaysToDateKey = (dateKey, days) => {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

/**
 * Builds the holdings timeline: one entry per distinct calendar date on
 * which a transaction occurred, each covering [startDate, endDate] until
 * the next change (endDate is null for the still-open final interval).
 * Multiple same-day transactions collapse into a single interval reflecting
 * the end-of-day state, matching getHoldingsAt's date-inclusive semantics.
 * @returns {{startDate: string, endDate: string|null, holdings: Record<string, number>}[]}
 */
const buildHoldingsTimeline = (transactions) => {
    const steps = replay(transactions);
    if (steps.length === 0) {
        return [];
    }

    const holdingsByDateKey = new Map();
    steps.forEach((step) => {
        holdingsByDateKey.set(toDateKey(step.transaction.transactionDate), step.holdingsAfter);
    });

    const dateKeys = [...holdingsByDateKey.keys()].sort();

    return dateKeys.map((dateKey, index) => {
        const nextDateKey = dateKeys[index + 1] || null;
        return {
            startDate: dateKey,
            endDate: nextDateKey ? addDaysToDateKey(nextDateKey, -1) : null,
            holdings: pruneZero(holdingsByDateKey.get(dateKey)),
        };
    });
};

/** Holdings as of a date, read from an already-built timeline (avoids re-replaying transactions per lookup). */
const getHoldingsAtFromTimeline = (timeline, dateKey) => {
    let current = {};
    for (const interval of timeline) {
        if (interval.startDate > dateKey) break;
        current = interval.holdings;
    }
    return current;
};

/** True if two holdings maps represent the same tickers at the same quantities (within float tolerance). */
const holdingsEqual = (a, b) => {
    const tickers = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const ticker of tickers) {
        if (Math.abs((a?.[ticker] || 0) - (b?.[ticker] || 0)) > EPSILON) {
            return false;
        }
    }
    return true;
};

module.exports = {
    EPSILON,
    sortChronologically,
    replay,
    findFirstNegativeHolding,
    getHoldingsAt,
    buildHoldingsTimeline,
    getHoldingsAtFromTimeline,
    holdingsEqual,
    toDateKey,
    addDaysToDateKey,
};
