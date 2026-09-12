/**
 * Alert Monitoring Job
 *
 * Scheduled counterpart to POST /api/alerts/monitor - calls the exact same
 * alert.service.js's runMonitoring(userId) (zero changes to the alert
 * engine itself), then delivers a batched notification for any genuinely
 * new alerts. Only runs for users who opted into at least one push channel;
 * running the existing, non-trivial runMonitoring for every anonymous,
 * never-opted-in user would be pure waste - those users keep the existing
 * pull-triggered (open the Alerts page) behavior unchanged.
 */

const User = require("../identity/identity.model");
const alertService = require("../alerts/alert.service");
const notificationService = require("../notifications/notification.service");
const { formatAlertBatch } = require("./alertNotificationFormatter");
const env = require("../config/env");
const logger = require("../utils/logger");

const findOptedInUsers = () =>
    User.find({
        $or: [
            { "notificationPreferences.emailEnabled": true },
            { "notificationPreferences.slackWebhookUrl": { $ne: null } },
            { "notificationPreferences.telegramChatId": { $ne: null } },
        ],
    }).lean();

const runAlertMonitoringForAllUsers = async () => {
    const users = await findOptedInUsers();
    const appBaseUrl = env.frontendOrigins[0];

    let usersNotified = 0;

    for (const user of users) {
        try {
            const result = await alertService.runMonitoring(String(user._id));
            if (result.alertsCreated > 0) {
                await notificationService.sendToUser(user, formatAlertBatch(result.alerts, appBaseUrl));
                usersNotified += 1;
            }
        } catch (error) {
            logger.warn({ err: error, userId: String(user._id) }, "Scheduled alert monitoring failed for one user; skipping");
        }
    }

    return { usersChecked: users.length, usersNotified };
};

module.exports = { runAlertMonitoringForAllUsers };
