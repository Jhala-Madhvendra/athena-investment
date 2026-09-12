/**
 * Scenario Watch Job
 *
 * Re-checks every saved scenario against today's live portfolio (via
 * savedScenario.service.js's checkSavedScenario, which reuses the exact
 * existing scenario engine - no new calculation logic anywhere) and
 * delivers a notification only for the transition into "threshold
 * crossed," not on every run a scenario stays crossed (the Alert's own
 * daily periodKey already prevents re-alerting the same day; comparing
 * against the previous lastPercentageChange here additionally avoids a
 * redundant notification send within that same day if the job somehow
 * runs twice).
 */

const SavedScenario = require("../portfolio/savedScenario.model");
const User = require("../identity/identity.model");
const savedScenarioService = require("../portfolio/savedScenario.service");
const notificationService = require("../notifications/notification.service");
const env = require("../config/env");
const logger = require("../utils/logger");

const wasAlreadyCrossed = (savedScenario) =>
    typeof savedScenario.lastPercentageChange === "number" &&
    savedScenario.lastPercentageChange <= savedScenario.alertThresholdPercent;

const runScenarioWatchForAllUsers = async () => {
    const savedScenarios = await SavedScenario.find({});
    const appBaseUrl = env.frontendOrigins[0];

    let scenariosChecked = 0;
    let notificationsSent = 0;

    for (const savedScenario of savedScenarios) {
        try {
            const alreadyCrossed = wasAlreadyCrossed(savedScenario);
            const { thresholdCrossed, alert } = await savedScenarioService.checkSavedScenario(savedScenario);
            scenariosChecked += 1;

            if (thresholdCrossed && !alreadyCrossed && alert) {
                const user = await User.findById(savedScenario.userId).lean();
                if (user) {
                    await notificationService.sendToUser(user, {
                        title: alert.title,
                        message: alert.message,
                        url: appBaseUrl ? `${appBaseUrl}/portfolio` : undefined,
                    });
                    notificationsSent += 1;
                }
            }
        } catch (error) {
            logger.warn(
                { err: error, savedScenarioId: String(savedScenario._id) },
                "Scenario watch check failed for one saved scenario; skipping"
            );
        }
    }

    return { scenariosChecked, notificationsSent };
};

module.exports = { runScenarioWatchForAllUsers };
