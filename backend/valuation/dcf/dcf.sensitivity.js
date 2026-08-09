/**
 * DCF Sensitivity Engine
 *
 * Builds a two-variable WACC x Terminal Growth Rate grid, re-running the
 * deterministic engine once per cell so the user can see how much the
 * intrinsic value per share moves as the two most consequential, most
 * subjective DCF inputs shift - the concrete expression of "DCF is highly
 * assumption-sensitive" rather than just stating it in a disclaimer.
 *
 * Invalid combinations (terminal growth >= WACC for that cell) are not
 * special-cased here - dcf.engine.js's own validator already rejects them
 * per cell, so a sensitivity table can legitimately contain a mix of
 * valid and invalid cells without the whole matrix failing.
 */

const { calculateDCF } = require("./dcf.engine");

const DEFAULT_STEPS = 5;
const DEFAULT_WACC_STEP = 0.01; // 1 percentage point
const DEFAULT_TERMINAL_GROWTH_STEP = 0.005; // 0.5 percentage point

/**
 * Generates `steps` evenly-spaced values centered on `center`, e.g.
 * buildRangeAroundCenter(0.09, 5, 0.01) -> [0.07, 0.08, 0.09, 0.10, 0.11].
 */
const buildRangeAroundCenter = (center, steps = DEFAULT_STEPS, stepSize = DEFAULT_WACC_STEP) => {
    const half = Math.floor(steps / 2);
    return Array.from({ length: steps }, (_, index) => Number((center + (index - half) * stepSize).toFixed(4)));
};

/**
 * @param {object} engineInput - {historicalFinancials, assumptions, capitalStructure}
 * @param {{waccValues: number[], terminalGrowthValues: number[]}} grid
 * @returns {{waccValues: number[], terminalGrowthValues: number[], rows: Array}}
 *   Each row is {wacc, cells: [{wacc, terminalGrowthRate, isValid, intrinsicValuePerShare, errors}]}
 */
const buildSensitivityMatrix = (engineInput, { waccValues, terminalGrowthValues }) => {
    const rows = waccValues.map((waccValue) => ({
        wacc: waccValue,
        cells: terminalGrowthValues.map((terminalGrowthRate) => {
            const result = calculateDCF({
                ...engineInput,
                assumptions: { ...engineInput.assumptions, wacc: waccValue, terminalGrowthRate },
            });

            return {
                wacc: waccValue,
                terminalGrowthRate,
                isValid: result.isValid,
                intrinsicValuePerShare: result.isValid ? result.intrinsicValuePerShare : null,
                errors: result.isValid ? [] : result.errors,
            };
        }),
    }));

    return { waccValues, terminalGrowthValues, rows };
};

module.exports = {
    DEFAULT_STEPS,
    DEFAULT_WACC_STEP,
    DEFAULT_TERMINAL_GROWTH_STEP,
    buildRangeAroundCenter,
    buildSensitivityMatrix,
};
