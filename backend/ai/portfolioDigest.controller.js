const portfolioDigestService = require("./portfolioDigest.service");
const { sendServiceError } = require("../utils/httpErrors");

/** GET /api/ai/digest - the caller's latest persisted digest for in-app viewing. Never triggers generation - that only happens from portfolioDigestJob.js on a schedule. */
const getDigest = async (req, res) => {
    try {
        const digest = await portfolioDigestService.getPersistedDigest(req.userId);
        return res.status(200).json(digest);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

module.exports = { getDigest };
