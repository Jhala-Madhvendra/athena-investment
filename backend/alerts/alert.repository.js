/**
 * Alert Repository
 *
 * Thin Mongoose data-access layer for the Alert collection - unlike most
 * Athena domains (which query their model directly from the service), this
 * one gets a dedicated file because the sprint brief explicitly calls for
 * it and because Alert has more read shapes (list with filters, unread
 * count, per-ticker recent alerts, per-ticker counts) than a typical
 * domain's CRUD. alert.service.js owns all business logic; this file only
 * knows how to query/update the Alert collection.
 */

const mongoose = require("mongoose");
const Alert = require("./alert.model");

const buildListQuery = (userId, filters) => {
    const query = { userId, isDismissed: false };
    if (filters.type) query.type = filters.type;
    if (filters.severity) query.severity = filters.severity;
    if (filters.unread !== undefined) query.isRead = !filters.unread;
    if (filters.ticker) query.ticker = filters.ticker;
    return query;
};

/** Paginated, filtered list for GET /api/alerts. Dismissed alerts are preserved (not deleted) but never shown in this feed. */
const findAlerts = async (userId, filters) => {
    const query = buildListQuery(userId, filters);
    const skip = (filters.page - 1) * filters.limit;

    const [alerts, total] = await Promise.all([
        Alert.find(query).sort({ createdAt: -1 }).skip(skip).limit(filters.limit).lean(),
        Alert.countDocuments(query),
    ]);

    return { alerts, total };
};

/** Scoped by {_id, userId} together - a guessed/enumerated id belonging to another user matches nothing, same convention as Watchlist/Portfolio. */
const markRead = (userId, alertId) => Alert.findOneAndUpdate({ _id: alertId, userId }, { isRead: true }, { new: true }).lean();

const dismiss = (userId, alertId) => Alert.findOneAndUpdate({ _id: alertId, userId }, { isDismissed: true }, { new: true }).lean();

const countUnread = (userId) => Alert.countDocuments({ userId, isRead: false, isDismissed: false });

/** One count per ticker (undismissed alerts, read or not) - powers the Watchlist's compact "N alerts" indicator. */
const countByTicker = async (userId, tickers) => {
    if (!Array.isArray(tickers) || tickers.length === 0) {
        return new Map();
    }

    const rows = await Alert.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), ticker: { $in: tickers }, isDismissed: false } },
        { $group: { _id: "$ticker", count: { $sum: 1 } } },
    ]);

    return new Map(rows.map((row) => [row._id, row.count]));
};

module.exports = { findAlerts, markRead, dismiss, countUnread, countByTicker };
