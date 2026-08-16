const alertService = require("./alert.service");
const validator = require("./alert.validator");
const { sendServiceError } = require("../utils/httpErrors");

const getAlerts = async (req, res) => {
    const validation = validator.validateListQuery(req.query);
    if (!validation.isValid) {
        return res.status(400).json({ message: "Invalid query parameters.", errors: validation.errors });
    }

    try {
        const result = await alertService.getAlerts(req.userId, validation.normalized);
        res.status(200).json(result);
    } catch (error) {
        sendServiceError(res, error, 500);
    }
};

const markAsRead = async (req, res) => {
    if (!validator.isValidAlertId(req.params.id)) {
        return res.status(400).json({ message: "Invalid alert id." });
    }

    try {
        const alert = await alertService.markAsRead(req.userId, req.params.id);
        res.status(200).json({ alert });
    } catch (error) {
        sendServiceError(res, error, 404);
    }
};

const dismissAlert = async (req, res) => {
    if (!validator.isValidAlertId(req.params.id)) {
        return res.status(400).json({ message: "Invalid alert id." });
    }

    try {
        const alert = await alertService.dismissAlert(req.userId, req.params.id);
        res.status(200).json({ alert });
    } catch (error) {
        sendServiceError(res, error, 404);
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const result = await alertService.getUnreadCount(req.userId);
        res.status(200).json(result);
    } catch (error) {
        sendServiceError(res, error, 500);
    }
};

/** GET /api/alerts/counts?tickers=A,B,C - one alert count per ticker, for the Watchlist/Portfolio compact indicators. */
const getCountsByTicker = async (req, res) => {
    const validation = validator.validateTickersQuery(req.query);
    if (!validation.isValid) {
        return res.status(400).json({ message: "Invalid query parameters.", errors: validation.errors });
    }

    try {
        const counts = await alertService.getAlertCountsByTicker(req.userId, validation.normalized.tickers);
        res.status(200).json({ counts: Object.fromEntries(counts) });
    } catch (error) {
        sendServiceError(res, error, 500);
    }
};

/** POST /api/alerts/monitor - rate-limited at the route level (monitorLimiter); iterates every tracked ticker, so it's the one Alert endpoint that isn't cheap. */
const monitor = async (req, res) => {
    try {
        const result = await alertService.runMonitoring(req.userId);
        res.status(200).json(result);
    } catch (error) {
        sendServiceError(res, error, 500);
    }
};

module.exports = { getAlerts, markAsRead, dismissAlert, getUnreadCount, getCountsByTicker, monitor };
