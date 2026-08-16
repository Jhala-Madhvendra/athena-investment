/**
 * Alert Severity
 *
 * INFO / MEDIUM / HIGH only - no CRITICAL, per the sprint brief. Criteria:
 *   - MEDIUM: the default tier when a rule fires at its configured
 *     threshold (see alert.rules.js).
 *   - HIGH: a magnitude-based rule fires at roughly 2x its MEDIUM
 *     threshold, OR the event is structurally significant regardless of
 *     magnitude (a profit/loss sign change, an M&A or Regulation/Legal
 *     news event, extreme portfolio concentration).
 *   - INFO: informational, non-directional events with nothing to compare
 *     against yet (a first-time baseline) or a fact that isn't good/bad on
 *     its own (new financial results are available).
 */

const { SEVERITY_MULTIPLIER } = require("./alert.rules");

/** MEDIUM if |magnitude| >= mediumThreshold, HIGH if >= mediumThreshold * SEVERITY_MULTIPLIER. Caller has already confirmed the rule fired. */
const byMagnitude = (magnitude, mediumThreshold) =>
    Math.abs(magnitude) >= mediumThreshold * SEVERITY_MULTIPLIER ? "HIGH" : "MEDIUM";

/** Structurally significant news categories are HIGH regardless of how many articles or how they're worded. */
const STRUCTURALLY_HIGH_NEWS_CATEGORIES = ["Acquisition / Merger", "Regulation / Legal"];

const forNewsCategory = (category) => (STRUCTURALLY_HIGH_NEWS_CATEGORIES.includes(category) ? "HIGH" : "MEDIUM");

/** A profit-margin/FCF trend flipping to a sustained decline is MEDIUM; a business falling into a loss (or losses widening) is structurally HIGH. */
const forSignChange = (signChangeType) =>
    signChangeType === "declinedToLoss" || signChangeType === "newLoss" || signChangeType === "wideningLoss" ? "HIGH" : "MEDIUM";

const forConcentration = (weightPercent, mediumThreshold, highThreshold) =>
    weightPercent >= highThreshold ? "HIGH" : weightPercent >= mediumThreshold ? "MEDIUM" : null;

module.exports = { byMagnitude, forNewsCategory, forSignChange, forConcentration };
