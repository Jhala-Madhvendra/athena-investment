jest.mock("../earningsAiSummary.model", () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock("../earnings.service", () => ({ getEarningsIntelligence: jest.fn() }));
jest.mock("../earnings.aiPromptBuilder", () => ({ buildPrompt: jest.fn(), buildEvidenceAllowList: jest.fn() }));
jest.mock("../earnings.aiValidator", () => ({ validateSummarySchema: jest.fn() }));
jest.mock("../../ai/ai.responseParser", () => ({ parseReportResponse: jest.fn() }));
jest.mock("../../ai/providers/llmProvider.registry", () => ({ generateReport: jest.fn(), modelName: "test-model" }));
jest.mock("../../ai/aiQuota.service", () => ({
    consumeIfAvailable: jest.fn(),
    QuotaExceededError: class QuotaExceededError extends Error {
        constructor(limit) {
            super(`You've reached your free AI report limit for this month (${limit}).`);
            this.statusCode = 429;
        }
    },
}));

const EarningsAiSummary = require("../earningsAiSummary.model");
const earningsService = require("../earnings.service");
const promptBuilder = require("../earnings.aiPromptBuilder");
const validator = require("../earnings.aiValidator");
const responseParser = require("../../ai/ai.responseParser");
const llmProvider = require("../../ai/providers/llmProvider.registry");
const aiQuotaService = require("../../ai/aiQuota.service");
const env = require("../../config/env");

const { getOrGenerateSummary, getPersistedSummary, MalformedLLMResponseError } = require("../earnings.aiService");

const EARNINGS_DATA_FY2026 = { ticker: "AAPL", period: { latestPeriod: "FY2026" }, growth: { revenue: { variancePercent: 10 } } };
const SANITIZED_SUMMARY = { narrative: "Revenue grew.", evidenceUsed: ["growth.revenue.variancePercent"] };

const freshPrompt = () => ({ systemPrompt: "sys", userMessage: "user", maxTokens: 2048, temperature: 0.25 });

const mockHappyPath = () => {
    earningsService.getEarningsIntelligence.mockResolvedValue(EARNINGS_DATA_FY2026);
    promptBuilder.buildEvidenceAllowList.mockReturnValue(["growth.revenue.variancePercent"]);
    promptBuilder.buildPrompt.mockImplementation(freshPrompt);
    llmProvider.generateReport.mockResolvedValue('{"raw":"text"}');
    responseParser.parseReportResponse.mockReturnValue({ parsed: true });
    validator.validateSummarySchema.mockReturnValue({ isValid: true, errors: [], sanitized: SANITIZED_SUMMARY });
    EarningsAiSummary.findOneAndUpdate.mockResolvedValue({ ticker: "AAPL", narrative: SANITIZED_SUMMARY.narrative });
};

afterEach(() => {
    jest.clearAllMocks();
});

describe("getOrGenerateSummary - cache hit", () => {
    it("returns the persisted summary for the current fiscal year without calling the LLM", async () => {
        earningsService.getEarningsIntelligence.mockResolvedValue(EARNINGS_DATA_FY2026);
        EarningsAiSummary.findOne.mockResolvedValue({ ticker: "AAPL", narrative: "cached" });

        const result = await getOrGenerateSummary("aapl");

        expect(result).toEqual({ ticker: "AAPL", narrative: "cached" });
        expect(EarningsAiSummary.findOne).toHaveBeenCalledWith({
            ticker: "AAPL",
            fiscalYearKey: "FY2026",
            contextVersion: env.earningsAiPromptVersion,
        });
        expect(llmProvider.generateReport).not.toHaveBeenCalled();
    });

    it("misses the cache and generates fresh when a newer fiscal year is now reported (no matching fiscalYearKey)", async () => {
        earningsService.getEarningsIntelligence.mockResolvedValue({ ticker: "AAPL", period: { latestPeriod: "FY2027" } });
        EarningsAiSummary.findOne.mockResolvedValue(null); // no FY2027 summary cached yet
        mockHappyPath();
        earningsService.getEarningsIntelligence.mockResolvedValue({ ticker: "AAPL", period: { latestPeriod: "FY2027" } });

        await getOrGenerateSummary("AAPL");

        expect(llmProvider.generateReport).toHaveBeenCalledTimes(1);
    });
});

describe("getOrGenerateSummary - generation path", () => {
    it("generates and persists a sanitized summary when none is cached", async () => {
        EarningsAiSummary.findOne.mockResolvedValue(null);
        mockHappyPath();

        const result = await getOrGenerateSummary("AAPL");

        expect(llmProvider.generateReport).toHaveBeenCalledTimes(1);
        expect(EarningsAiSummary.findOneAndUpdate).toHaveBeenCalledWith(
            { ticker: "AAPL", fiscalYearKey: "FY2026", contextVersion: env.earningsAiPromptVersion },
            expect.objectContaining({ narrative: SANITIZED_SUMMARY.narrative, evidenceUsed: SANITIZED_SUMMARY.evidenceUsed }),
            { returnDocument: "after", upsert: true, runValidators: true }
        );
        expect(result).toEqual({ ticker: "AAPL", narrative: SANITIZED_SUMMARY.narrative });
    });

    it("regenerate:true skips the cache lookup and always calls the LLM", async () => {
        mockHappyPath();

        await getOrGenerateSummary("AAPL", { regenerate: true });

        expect(EarningsAiSummary.findOne).not.toHaveBeenCalled();
        expect(llmProvider.generateReport).toHaveBeenCalledTimes(1);
    });
});

describe("getOrGenerateSummary - retry behavior", () => {
    it("retries once with a stricter prompt when the first response fails schema validation, then succeeds", async () => {
        EarningsAiSummary.findOne.mockResolvedValue(null);
        mockHappyPath();
        validator.validateSummarySchema.mockReturnValueOnce({
            isValid: false,
            errors: ['"narrative" must be a non-empty string.'],
            sanitized: null,
        });

        await getOrGenerateSummary("AAPL");

        expect(llmProvider.generateReport).toHaveBeenCalledTimes(2);
        const secondPrompt = llmProvider.generateReport.mock.calls[1][0];
        expect(secondPrompt.userMessage).toContain("could not be used");
    });

    it("throws MalformedLLMResponseError after two failed attempts, never more than two LLM calls", async () => {
        EarningsAiSummary.findOne.mockResolvedValue(null);
        mockHappyPath();
        validator.validateSummarySchema.mockReturnValue({ isValid: false, errors: ["still broken"], sanitized: null });

        await expect(getOrGenerateSummary("AAPL")).rejects.toThrow(MalformedLLMResponseError);
        expect(llmProvider.generateReport).toHaveBeenCalledTimes(2);
        expect(EarningsAiSummary.findOneAndUpdate).not.toHaveBeenCalled();
    });
});

describe("getOrGenerateSummary - quota", () => {
    it("never touches the quota service on a cache hit", async () => {
        EarningsAiSummary.findOne.mockResolvedValue({ ticker: "AAPL", narrative: "cached" });

        await getOrGenerateSummary("AAPL", { userId: "user1" });

        expect(aiQuotaService.consumeIfAvailable).not.toHaveBeenCalled();
    });

    it("consumes quota before calling the LLM when a userId is given", async () => {
        EarningsAiSummary.findOne.mockResolvedValue(null);
        mockHappyPath();
        aiQuotaService.consumeIfAvailable.mockResolvedValue({ allowed: true, used: 1, limit: 5 });

        await getOrGenerateSummary("AAPL", { userId: "user1" });

        expect(aiQuotaService.consumeIfAvailable).toHaveBeenCalledWith("user1");
        expect(llmProvider.generateReport).toHaveBeenCalled();
    });

    it("throws QuotaExceededError and never calls the LLM when quota is exhausted", async () => {
        EarningsAiSummary.findOne.mockResolvedValue(null);
        earningsService.getEarningsIntelligence.mockResolvedValue(EARNINGS_DATA_FY2026);
        aiQuotaService.consumeIfAvailable.mockResolvedValue({ allowed: false, used: 5, limit: 5 });

        await expect(getOrGenerateSummary("AAPL", { userId: "user1" })).rejects.toThrow(aiQuotaService.QuotaExceededError);
        expect(llmProvider.generateReport).not.toHaveBeenCalled();
    });
});

describe("getPersistedSummary", () => {
    it("queries by ticker, current fiscal year, and contextVersion, never calling the LLM", async () => {
        earningsService.getEarningsIntelligence.mockResolvedValue(EARNINGS_DATA_FY2026);
        EarningsAiSummary.findOne.mockResolvedValue({ ticker: "AAPL", narrative: "cached" });

        const result = await getPersistedSummary("aapl");

        expect(EarningsAiSummary.findOne).toHaveBeenCalledWith({
            ticker: "AAPL",
            fiscalYearKey: "FY2026",
            contextVersion: env.earningsAiPromptVersion,
        });
        expect(result).toEqual({ ticker: "AAPL", narrative: "cached" });
        expect(llmProvider.generateReport).not.toHaveBeenCalled();
    });

    it("returns null when no summary has been generated yet", async () => {
        earningsService.getEarningsIntelligence.mockResolvedValue(EARNINGS_DATA_FY2026);
        EarningsAiSummary.findOne.mockResolvedValue(null);

        const result = await getPersistedSummary("AAPL");
        expect(result).toBeNull();
    });
});
