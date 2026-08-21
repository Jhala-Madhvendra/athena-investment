const { listPresets, getPreset, PRESETS } = require("../portfolio.scenario.presets");

describe("listPresets", () => {
    it("includes Bear, Base, and Bull among the presets", () => {
        const keys = listPresets().map((p) => p.key);
        expect(keys).toEqual(expect.arrayContaining(["bear", "base", "bull"]));
    });

    it("labels every preset as hypothetical", () => {
        listPresets().forEach((preset) => {
            expect(preset.isHypothetical).toBe(true);
            expect(preset.label).toBe("Hypothetical preset");
        });
    });

    it("returns deep copies so a caller mutating a returned preset cannot corrupt the canonical source", () => {
        const [first] = listPresets();
        first.rules[0].shockPercent = 999999;

        const [second] = listPresets();
        expect(second.rules[0].shockPercent).not.toBe(999999);
    });

    it("keeps the preset library small (not a large arbitrary catalog)", () => {
        expect(Object.keys(PRESETS).length).toBeLessThanOrEqual(6);
    });
});

describe("getPreset", () => {
    it("returns null for an unknown key", () => {
        expect(getPreset("doesNotExist")).toBeNull();
    });

    it("returns the Base preset with a zero-shock rule", () => {
        const base = getPreset("base");
        expect(base.rules.every((rule) => rule.shockPercent === 0)).toBe(true);
    });
});
