/**
 * DCF Scenario Engine
 *
 * Runs the same deterministic engine input through three assumption
 * variants - Bear / Base / Bull - so the user sees a range of outcomes
 * instead of one number presented as fact (see the sprint's "DCF should
 * NOT pretend there is one objectively correct valuation" principle).
 *
 * Only revenue growth and EBIT margin vary between scenarios - the two
 * levers the sprint brief names explicitly ("Bear: Lower growth, Lower
 * margins... Bull: Higher growth, higher margins"). Every other
 * assumption (tax rate, D&A%, CapEx%, working capital%, terminal growth,
 * WACC) stays exactly as the user entered it in the Base case, so a
 * scenario reflects a change in business performance expectations, not an
 * unexplained change in financing or macro assumptions.
 *
 * The +/-2 percentage point deltas are a documented, adjustable starting
 * point (not derived from any data source) - deliberately explicit here
 * rather than buried as a magic number, per "do not hard-code arbitrary
 * assumptions without documenting them."
 */

const { calculateDCF } = require("./dcf.engine");

const SCENARIO_DELTAS = {
    bear: { revenueGrowth: -0.02, ebitMargin: -0.02 },
    base: { revenueGrowth: 0, ebitMargin: 0 },
    bull: { revenueGrowth: 0.02, ebitMargin: 0.02 },
};

/** Adds `delta` to a scalar assumption, or to every entry of a per-year array assumption. */
const applyDelta = (value, delta) => (Array.isArray(value) ? value.map((entry) => entry + delta) : value + delta);

/**
 * @param {object} baseAssumptions - the engine's `assumptions` object (already has a computed `wacc`)
 * @param {{revenueGrowth: number, ebitMargin: number}} deltas
 * @returns {object} a new assumptions object with only revenueGrowth/ebitMargin shifted
 */
const buildScenarioAssumptions = (baseAssumptions, deltas) => ({
    ...baseAssumptions,
    revenueGrowth: applyDelta(baseAssumptions.revenueGrowth, deltas.revenueGrowth),
    ebitMargin: applyDelta(baseAssumptions.ebitMargin, deltas.ebitMargin),
});

/**
 * Runs Bear/Base/Bull through the deterministic engine.
 *
 * @param {object} engineInput - {historicalFinancials, assumptions, capitalStructure} - the same shape calculateDCF takes
 * @param {object} [deltas] - override the default +/-2pp deltas
 * @returns {{bear: object, base: object, bull: object}} each value is a calculateDCF() result
 */
const runScenarios = (engineInput, deltas = SCENARIO_DELTAS) => {
    const runOne = (scenarioDeltas) =>
        calculateDCF({
            ...engineInput,
            assumptions: buildScenarioAssumptions(engineInput.assumptions, scenarioDeltas),
        });

    return {
        bear: runOne(deltas.bear),
        base: runOne(deltas.base),
        bull: runOne(deltas.bull),
    };
};

module.exports = {
    SCENARIO_DELTAS,
    buildScenarioAssumptions,
    runScenarios,
};
