/**
 * Portfolio Scenario Presets
 *
 * Documented, adjustable starting points - same precedent as DCF's
 * SCENARIO_DELTAS (dcf.scenarios.js): a small set of named rule bundles the
 * user can load into the scenario builder and then edit freely. Nothing
 * here is derived from market data, and nothing is treated as a forecast -
 * every preset is surfaced to the frontend with `isHypothetical: true` and
 * must be labeled "Hypothetical preset," never a prediction.
 *
 * Sector names match Yahoo Finance's standard sector labels (the same
 * source Company.sector is populated from, Sprint 13) - a portfolio whose
 * holdings carry a different sector taxonomy simply won't match a preset's
 * SECTOR rules, which is a disclosed limitation, not a bug (see
 * research/finance/BearBaseBullScenarios.md).
 *
 * Deliberately a SMALL, curated set (per the sprint brief's "do not create
 * a large library of arbitrary scenarios") - not persisted, not
 * user-editable at the source (users edit the loaded copy client-side, the
 * canonical preset here never changes at runtime).
 */

const PRESETS = {
    bear: {
        key: "bear",
        name: "Bear Case",
        description: "A hypothetical broad market decline with sharper losses concentrated in Technology and Financials.",
        rules: [
            { targetType: "MARKET", target: null, shockPercent: -15 },
            { targetType: "SECTOR", target: "Technology", shockPercent: -25 },
            { targetType: "SECTOR", target: "Financial Services", shockPercent: -10 },
        ],
    },
    base: {
        key: "base",
        name: "Base Case",
        description: "No hypothetical shock applied - a zero-movement baseline for comparing Bear and Bull against.",
        rules: [{ targetType: "PORTFOLIO", target: null, shockPercent: 0 }],
    },
    bull: {
        key: "bull",
        name: "Bull Case",
        description: "A hypothetical broad market rally with stronger gains concentrated in Technology and Financials.",
        rules: [
            { targetType: "MARKET", target: null, shockPercent: 10 },
            { targetType: "SECTOR", target: "Technology", shockPercent: 15 },
            { targetType: "SECTOR", target: "Financial Services", shockPercent: 10 },
        ],
    },
    marketCorrection: {
        key: "marketCorrection",
        name: "Market Correction",
        description: "A hypothetical broad market pullback of roughly 10%, with no sector-specific overlay.",
        rules: [{ targetType: "MARKET", target: null, shockPercent: -10 }],
    },
    technologySelloff: {
        key: "technologySelloff",
        name: "Technology Selloff",
        description: "A hypothetical sharp decline isolated to Technology holdings, with the rest of the portfolio unaffected.",
        rules: [{ targetType: "SECTOR", target: "Technology", shockPercent: -30 }],
    },
    broadMarketStress: {
        key: "broadMarketStress",
        name: "Broad Market Stress",
        description: "A hypothetical severe, broad-based market decline with no sector differentiation.",
        rules: [{ targetType: "MARKET", target: null, shockPercent: -25 }],
    },
};

/** Returns every preset as a plain, ordered list - each rule set is a fresh deep copy so a caller mutating one (e.g. editing a loaded preset) can never corrupt the canonical definition above. */
const listPresets = () =>
    Object.values(PRESETS).map((preset) => ({
        ...preset,
        rules: preset.rules.map((rule) => ({ ...rule })),
        isHypothetical: true,
        label: "Hypothetical preset",
    }));

const getPreset = (key) => {
    const preset = PRESETS[key];
    return preset ? { ...preset, rules: preset.rules.map((rule) => ({ ...rule })), isHypothetical: true, label: "Hypothetical preset" } : null;
};

module.exports = { PRESETS, listPresets, getPreset };
