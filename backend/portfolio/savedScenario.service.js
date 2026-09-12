/**
 * Saved Scenario Service
 *
 * Owns SavedScenario CRUD plus the "watch" check itself. checkSavedScenario
 * re-runs the EXACT existing portfolio.scenario.service.js's runScenario()
 * (the same function behind POST /api/portfolio/scenarios/run) against the
 * saved rules/benchmark/window - today's live holdings, not a recomputation
 * of any kind. Alert creation reuses backend/alerts/alert.model.js and
 * alert.deduplicator.js directly rather than a parallel notification-
 * dedup mechanism.
 */

const SavedScenario = require("./savedScenario.model");
const scenarioService = require("./portfolio.scenario.service");
const Alert = require("../alerts/alert.model");
const dedup = require("../alerts/alert.deduplicator");

class SavedScenarioNotFoundError extends Error {
    constructor() {
        super("Saved scenario not found.");
        this.name = "SavedScenarioNotFoundError";
        this.statusCode = 404;
    }
}

class SavedScenarioValidationError extends Error {
    constructor(errors) {
        super("Saved scenario validation failed.");
        this.name = "SavedScenarioValidationError";
        this.statusCode = 422;
        this.errors = errors;
    }
}

const createSavedScenario = (userId, { name, rules, benchmark, window, alertThresholdPercent }) =>
    SavedScenario.create({ userId, name, rules, benchmark, window, alertThresholdPercent });

const listSavedScenarios = (userId) => SavedScenario.find({ userId }).sort({ createdAt: -1 }).lean();

const deleteSavedScenario = async (userId, id) => {
    const savedScenario = await SavedScenario.findOneAndDelete({ _id: id, userId });
    if (!savedScenario) {
        throw new SavedScenarioNotFoundError();
    }
    return savedScenario;
};

/**
 * Re-runs the saved scenario against today's live portfolio and records the
 * result. Creates a deduplicated (at most once per calendar day) Alert when
 * the threshold is crossed - reuses the PORTFOLIO alert type and the same
 * insertIfNew race-safe pattern every other alert rule already uses.
 * @param {object} savedScenario - a SavedScenario document
 * @returns {Promise<{percentageChange: number|null, thresholdCrossed: boolean, alert: object|null}>}
 */
const checkSavedScenario = async (savedScenario) => {
    const result = await scenarioService.runScenario(savedScenario.userId, {
        name: savedScenario.name,
        rules: savedScenario.rules,
        benchmark: savedScenario.benchmark,
        window: savedScenario.window,
    });

    const percentageChange = result.percentageChange;

    await SavedScenario.findByIdAndUpdate(savedScenario._id, {
        lastCheckedAt: new Date(),
        lastPercentageChange: percentageChange,
    });

    const thresholdCrossed = typeof percentageChange === "number" && percentageChange <= savedScenario.alertThresholdPercent;

    let alert = null;
    if (thresholdCrossed) {
        alert = await dedup.insertIfNew(Alert, {
            userId: savedScenario.userId,
            ticker: "PORTFOLIO",
            type: "PORTFOLIO",
            rule: "SCENARIO_THRESHOLD_CROSSED",
            periodKey: `${savedScenario._id}:${dedup.dayKey()}`,
            severity: "HIGH",
            title: `"${savedScenario.name}" scenario threshold crossed`,
            message: `Your live portfolio would now lose ${percentageChange.toFixed(1)}% under "${savedScenario.name}" - at or beyond your ${savedScenario.alertThresholdPercent}% watch threshold.`,
            whyItMatters:
                "Real market conditions have moved your portfolio's composition closer to (or past) a downside scenario you're watching.",
            metric: "percentageChange",
            currentValue: percentageChange,
            threshold: savedScenario.alertThresholdPercent,
            source: "Scenario Watch",
            evidencePeriod: savedScenario.window,
            metadata: { savedScenarioId: String(savedScenario._id) },
        });
    }

    return { percentageChange, thresholdCrossed, alert };
};

module.exports = {
    createSavedScenario,
    listSavedScenarios,
    deleteSavedScenario,
    checkSavedScenario,
    SavedScenarioNotFoundError,
    SavedScenarioValidationError,
};
