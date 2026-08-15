const { buildPrompt, buildSystemPrompt, buildUserMessage, MAX_TOKENS, TEMPERATURE } = require("../ai.promptBuilder");
const { REQUIRED_STRING_SECTIONS, REQUIRED_ARRAY_SECTIONS, OPTIONAL_STRING_SECTIONS } = require("../ai.validator");

const CONTEXT = {
    ticker: "AAPL",
    generatedAt: "2026-08-11T10:00:00.000Z",
    profile: { available: true, name: "Apple Inc." },
    ratios: { available: false, reason: "no data" },
};
const EVIDENCE_ALLOW_LIST = ["profile.name", "ratios.profitability.grossMargin"];

describe("buildSystemPrompt", () => {
    const systemPrompt = buildSystemPrompt();

    it("declares every field the validator actually requires - stays in sync with ai.validator.js", () => {
        [...REQUIRED_STRING_SECTIONS, ...REQUIRED_ARRAY_SECTIONS, ...OPTIONAL_STRING_SECTIONS, "dataGaps", "sectionEvidence"].forEach(
            (field) => {
                expect(systemPrompt).toContain(`"${field}"`);
            }
        );
    });

    it("states the core grounding, no-advice, and unavailable-data rules", () => {
        expect(systemPrompt).toMatch(/never invent|never fabricate|only.*context/i);
        expect(systemPrompt).toMatch(/Data unavailable/);
        expect(systemPrompt).toMatch(/Buy|Sell/);
        expect(systemPrompt).toMatch(/JSON object/i);
    });

    it("distinguishes fact from interpretation for recent developments and requires source citation", () => {
        expect(systemPrompt).toMatch(/RECENT DEVELOPMENTS/i);
        expect(systemPrompt).toMatch(/interpretation/i);
        expect(systemPrompt).toMatch(/recentEvents/);
    });
});

describe("buildUserMessage", () => {
    it("embeds the exact context JSON and evidence allow-list, not a paraphrase", () => {
        const message = buildUserMessage(CONTEXT, EVIDENCE_ALLOW_LIST);

        expect(message).toContain(JSON.stringify(CONTEXT));
        expect(message).toContain(JSON.stringify(EVIDENCE_ALLOW_LIST));
        expect(message).toContain("AAPL");
    });
});

describe("buildPrompt", () => {
    it("assembles a ready-to-send prompt payload", () => {
        const prompt = buildPrompt(CONTEXT, EVIDENCE_ALLOW_LIST);

        expect(prompt.systemPrompt).toBe(buildSystemPrompt());
        expect(prompt.userMessage).toBe(buildUserMessage(CONTEXT, EVIDENCE_ALLOW_LIST));
        expect(prompt.maxTokens).toBe(MAX_TOKENS);
        expect(prompt.temperature).toBe(TEMPERATURE);
        expect(prompt.temperature).toBeLessThan(0.5); // low temperature for consistent interpretation, not creative writing
    });
});
