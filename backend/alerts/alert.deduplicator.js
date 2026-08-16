/**
 * Alert Deduplication
 *
 * An alert's identity is {userId, ticker, type, rule, periodKey}, enforced
 * by alert.model.js's unique compound index - inserting a duplicate is a
 * no-op (E11000), not an error the caller has to branch on. periodKey is
 * the piece that varies by rule family, chosen so the SAME underlying fact
 * can only ever produce one alert, no matter how many times monitoring
 * reruns before that fact changes:
 *
 *   - Market / Portfolio (value-change, concentration, gain/loss): the
 *     evaluation day. A fresh alert can still fire the next day if the
 *     condition persists or worsens.
 *   - Financial (single-period deltas): the fiscal-year pair being
 *     compared (e.g. "FY2025-FY2026") - naturally idempotent, only changes
 *     when a new statement is imported.
 *   - Business (multi-year trend / sign-change): the trend window's own
 *     fiscal-year pair.
 *   - News: the article's own _id - already unique per Sprint 10's dedup.
 *
 * See research/engineering/AlertDeduplication.md for the full reasoning.
 */

const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);

const fiscalYearPairKey = (startYear, endYear) => `FY${startYear}-FY${endYear}`;

const fiscalYearKey = (year) => `FY${year}`;

const articleKey = (articleId) => String(articleId);

/**
 * Inserts one candidate alert if (and only if) no alert with the same
 * identity already exists. A race-safe upsert via the unique index rather
 * than a check-then-insert - two concurrent monitoring calls (e.g. from two
 * browser tabs) can't both slip a duplicate through.
 *
 * @returns {Promise<object|null>} the created Alert document, or null if this identity was already alerted.
 */
const insertIfNew = async (Alert, candidate) => {
    try {
        return await Alert.create(candidate);
    } catch (error) {
        if (error.code === 11000) {
            return null;
        }
        throw error;
    }
};

module.exports = { dayKey, fiscalYearPairKey, fiscalYearKey, articleKey, insertIfNew };
