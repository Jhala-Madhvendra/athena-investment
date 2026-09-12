jest.mock("node-cron", () => ({ schedule: jest.fn() }));
jest.mock("../alertMonitoringJob", () => ({ runAlertMonitoringForAllUsers: jest.fn() }));
jest.mock("../scenarioWatchJob", () => ({ runScenarioWatchForAllUsers: jest.fn() }));
jest.mock("../portfolioDigestJob", () => ({ runPortfolioDigestsForAllUsers: jest.fn() }));
jest.mock("../telegramBotPoller", () => ({ start: jest.fn() }));

const cron = require("node-cron");
const telegramBotPoller = require("../telegramBotPoller");
const env = require("../../config/env");
const { startScheduledJobs } = require("../scheduler");

afterEach(() => {
    jest.clearAllMocks();
});

describe("startScheduledJobs", () => {
    it("schedules all three cron jobs with the configured cron expressions", () => {
        startScheduledJobs();

        expect(cron.schedule).toHaveBeenCalledTimes(3);
        const scheduledExpressions = cron.schedule.mock.calls.map((call) => call[0]);
        expect(scheduledExpressions).toEqual([env.alertMonitoringCron, env.scenarioWatchCron, env.digestCron]);
    });

    it("every scheduled callback is a function", () => {
        startScheduledJobs();

        cron.schedule.mock.calls.forEach((call) => expect(typeof call[1]).toBe("function"));
    });

    it("starts the Telegram bot poller", () => {
        startScheduledJobs();

        expect(telegramBotPoller.start).toHaveBeenCalledTimes(1);
    });
});
