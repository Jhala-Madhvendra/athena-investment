const identityService = require("./identity.service");

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

/**
 * Resolves the caller's identity token to req.userId. Mounted only on the
 * Watchlist/Portfolio routers - every other route in the app stays
 * unauthenticated exactly as before this sprint.
 */
const requireIdentity = async (req, res, next) => {
    try {
        const header = req.get("authorization") || "";
        const match = header.match(BEARER_PATTERN);

        if (!match) {
            return res.status(401).json({ message: "An Authorization: Bearer <token> header is required." });
        }

        const userId = await identityService.resolveUserIdByToken(match[1]);

        if (!userId) {
            return res.status(401).json({ message: "Invalid or unrecognized identity token." });
        }

        req.userId = userId;
        return next();
    } catch (error) {
        return next(error);
    }
};

module.exports = { requireIdentity };
