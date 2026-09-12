/**
 * Portfolio Digest Job
 *
 * Scheduled counterpart to the digest feature's on-demand path (there isn't
 * one - digests are opt-in and generated only here, unlike AI Research
 * Report/Earnings Summary which are user-clicked). Only runs for users who
 * opted into digestEnabled; a cache hit (this week's digest already exists)
 * is free - portfolioDigest.service.js's getOrGenerateDigest handles that.
 */

const User = require("../identity/identity.model");
const portfolioDigestService = require("../ai/portfolioDigest.service");
const notificationService = require("../notifications/notification.service");
const env = require("../config/env");
const logger = require("../utils/logger");

const runPortfolioDigestsForAllUsers = async () => {
    const users = await User.find({ "notificationPreferences.digestEnabled": true }).lean();
    const appBaseUrl = env.frontendOrigins[0];

    let digestsSent = 0;

    for (const user of users) {
        try {
            const digest = await portfolioDigestService.getOrGenerateDigest(String(user._id));
            await notificationService.sendToUser(user, {
                title: "Your weekly Athena portfolio digest",
                message: digest.narrative,
                url: appBaseUrl ? `${appBaseUrl}/portfolio` : undefined,
            });
            digestsSent += 1;
        } catch (error) {
            // NoHoldingsError (no portfolio yet) is expected and not worth a warning-level log.
            if (error.name !== "NoHoldingsError") {
                logger.warn({ err: error, userId: String(user._id) }, "Scheduled portfolio digest failed for one user; skipping");
            }
        }
    }

    return { usersChecked: users.length, digestsSent };
};

module.exports = { runPortfolioDigestsForAllUsers };
