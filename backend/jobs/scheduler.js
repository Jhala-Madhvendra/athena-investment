/**
 * Scheduler
 *
 * Registers every cron job. This module is deliberately thin - each job's
 * actual logic lives in its own testable function (alertMonitoringJob.js,
 * scenarioWatchJob.js, portfolioDigestJob.js); this file only wires a cron
 * expression to that function, plus the Telegram bot's polling loop. Called
 * once from server.js, guarded by env.nodeEnv !== "test" there (mirrors
 * middleware/rateLimit.js's existing skipInTest) so Jest never starts real
 * timers.
 */

const cron = require("node-cron");
const env = require("../config/env");
const logger = require("../utils/logger");
const { runAlertMonitoringForAllUsers } = require("./alertMonitoringJob");
const { runScenarioWatchForAllUsers } = require("./scenarioWatchJob");
const { runPortfolioDigestsForAllUsers } = require("./portfolioDigestJob");
const telegramBotPoller = require("./telegramBotPoller");

const runAndLog = (name, jobFn) => async () => {
    try {
        const result = await jobFn();
        logger.info({ job: name, ...result }, `Scheduled job "${name}" completed`);
    } catch (error) {
        logger.error({ err: error, job: name }, `Scheduled job "${name}" failed`);
    }
};

const startScheduledJobs = () => {
    cron.schedule(env.alertMonitoringCron, runAndLog("alertMonitoring", runAlertMonitoringForAllUsers));
    cron.schedule(env.scenarioWatchCron, runAndLog("scenarioWatch", runScenarioWatchForAllUsers));
    cron.schedule(env.digestCron, runAndLog("portfolioDigest", runPortfolioDigestsForAllUsers));
    telegramBotPoller.start();

    logger.info("Scheduled jobs started (alert monitoring, scenario watch, portfolio digest, Telegram bot poller)");
};

module.exports = { startScheduledJobs };
