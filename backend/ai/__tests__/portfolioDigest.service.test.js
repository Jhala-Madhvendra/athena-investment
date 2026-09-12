jest.mock("../portfolioDigest.model", () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock("../portfolioDigest.contextBuilder", () => ({ buildDigestContext: jest.fn() }));
jest.mock("../portfolioDigest.promptBuilder", () => ({ buildPrompt: jest.fn(), buildEvidenceAllowList: jest.fn() }));
jest.mock("../portfolioDigest.validator", () => ({ validateDigestSchema: jest.fn() }));
jest.mock("../ai.responseParser", () => ({ parseReportResponse: jest.fn() }));
jest.mock("../providers/llmProvider.registry", () => ({ generateReport: jest.fn(), modelName: "test-model" }));

const PortfolioDigest = require("../portfolioDigest.model");
const { buildDigestContext } = require("../portfolioDigest.contextBuilder");
const promptBuilder = require("../portfolioDigest.promptBuilder");
const validator = require("../portfolioDigest.validator");
const responseParser = require("../ai.responseParser");
const llmProvider = require("../providers/llmProvider.registry");

const { getOrGenerateDigest, getPersistedDigest, getIsoWeekKey, NoHoldingsError, MalformedLLMResponseError } = require("../portfolioDigest.service");

const CONTEXT = { hasHoldings: true, summary: {}, holdings: [{ ticker: "AAPL" }] };
const SANITIZED = { narrative: "Portfolio up this week.", holdingHighlights: [], evidenceUsed: [] };

const freshPrompt = () => ({ systemPrompt: "sys", userMessage: "user", maxTokens: 3072, temperature: 0.25 });

const mockHappyPath = () => {
    buildDigestContext.mockResolvedValue(CONTEXT);
    promptBuilder.buildEvidenceAllowList.mockReturnValue([]);
    promptBuilder.buildPrompt.mockImplementation(freshPrompt);
    llmProvider.generateReport.mockResolvedValue('{"raw":"text"}');
    responseParser.parseReportResponse.mockReturnValue({ parsed: true });
    validator.validateDigestSchema.mockReturnValue({ isValid: true, errors: [], sanitized: SANITIZED });
    PortfolioDigest.findOneAndUpdate.mockResolvedValue({ narrative: SANITIZED.narrative });
};

afterEach(() => {
    jest.clearAllMocks();
});

describe("getIsoWeekKey", () => {
    it("returns the ISO week for a known date", () => {
        // 2026-08-31 is a Monday, the start of ISO week 36.
        expect(getIsoWeekKey(new Date("2026-08-31T12:00:00.000Z"))).toBe("2026-W36");
    });

    it("returns a stable key for every day within the same ISO week", () => {
        const monday = getIsoWeekKey(new Date("2026-08-31T00:00:00.000Z"));
        const sunday = getIsoWeekKey(new Date("2026-09-06T23:59:59.000Z"));
        expect(monday).toBe(sunday);
    });
});

describe("getOrGenerateDigest - cache hit", () => {
    it("returns the persisted digest for the current week without calling the LLM", async () => {
        PortfolioDigest.findOne.mockResolvedValue({ narrative: "cached" });

        const result = await getOrGenerateDigest("user1");

        expect(result).toEqual({ narrative: "cached" });
        expect(llmProvider.generateReport).not.toHaveBeenCalled();
    });
});

describe("getOrGenerateDigest - generation path", () => {
    it("throws NoHoldingsError and never calls the LLM when the portfolio is empty", async () => {
        PortfolioDigest.findOne.mockResolvedValue(null);
        buildDigestContext.mockResolvedValue({ hasHoldings: false, summary: null, holdings: [] });

        await expect(getOrGenerateDigest("user1")).rejects.toThrow(NoHoldingsError);
        expect(llmProvider.generateReport).not.toHaveBeenCalled();
    });

    it("generates and persists a sanitized digest when none is cached this week", async () => {
        PortfolioDigest.findOne.mockResolvedValue(null);
        mockHappyPath();

        const result = await getOrGenerateDigest("user1");

        expect(llmProvider.generateReport).toHaveBeenCalledTimes(1);
        expect(PortfolioDigest.findOneAndUpdate).toHaveBeenCalledWith(
            { userId: "user1", periodKey: expect.stringMatching(/^\d{4}-W\d{2}$/) },
            expect.objectContaining({ narrative: SANITIZED.narrative }),
            { returnDocument: "after", upsert: true, runValidators: true }
        );
        expect(result).toEqual({ narrative: SANITIZED.narrative });
    });

    it("regenerate:true skips the cache lookup and always calls the LLM", async () => {
        mockHappyPath();

        await getOrGenerateDigest("user1", { regenerate: true });

        expect(PortfolioDigest.findOne).not.toHaveBeenCalled();
        expect(llmProvider.generateReport).toHaveBeenCalledTimes(1);
    });
});

describe("getOrGenerateDigest - retry behavior", () => {
    it("retries once with a stricter prompt when the first response fails schema validation, then succeeds", async () => {
        PortfolioDigest.findOne.mockResolvedValue(null);
        mockHappyPath();
        validator.validateDigestSchema.mockReturnValueOnce({ isValid: false, errors: ['"narrative" must be a non-empty string.'], sanitized: null });

        await getOrGenerateDigest("user1");

        expect(llmProvider.generateReport).toHaveBeenCalledTimes(2);
        expect(llmProvider.generateReport.mock.calls[1][0].userMessage).toContain("could not be used");
    });

    it("throws MalformedLLMResponseError after two failed attempts, never more than two LLM calls", async () => {
        PortfolioDigest.findOne.mockResolvedValue(null);
        mockHappyPath();
        validator.validateDigestSchema.mockReturnValue({ isValid: false, errors: ["still broken"], sanitized: null });

        await expect(getOrGenerateDigest("user1")).rejects.toThrow(MalformedLLMResponseError);
        expect(llmProvider.generateReport).toHaveBeenCalledTimes(2);
        expect(PortfolioDigest.findOneAndUpdate).not.toHaveBeenCalled();
    });
});

describe("getPersistedDigest", () => {
    it("queries by userId, sorted by periodKey descending (most recent first), never calling the LLM", async () => {
        const sortMock = jest.fn().mockResolvedValue({ narrative: "cached" });
        PortfolioDigest.findOne.mockReturnValue({ sort: sortMock });

        const result = await getPersistedDigest("user1");

        expect(PortfolioDigest.findOne).toHaveBeenCalledWith({ userId: "user1" });
        expect(sortMock).toHaveBeenCalledWith({ periodKey: -1 });
        expect(result).toEqual({ narrative: "cached" });
        expect(llmProvider.generateReport).not.toHaveBeenCalled();
    });
});
