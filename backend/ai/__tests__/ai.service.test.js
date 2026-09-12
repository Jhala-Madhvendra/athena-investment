jest.mock("../ai.model", () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock("../ai.contextBuilder", () => ({
    buildResearchContext: jest.fn(),
    buildEvidenceAllowList: jest.fn(),
}));
jest.mock("../ai.promptBuilder", () => ({ buildPrompt: jest.fn() }));
jest.mock("../ai.responseParser", () => ({ parseReportResponse: jest.fn() }));
jest.mock("../ai.validator", () => ({ validateReportSchema: jest.fn() }));
jest.mock("../providers/llmProvider.registry", () => ({ generateReport: jest.fn() }));
jest.mock("../aiQuota.service", () => ({
    consumeIfAvailable: jest.fn(),
    QuotaExceededError: class QuotaExceededError extends Error {
        constructor(limit) {
            super(`You've reached your free AI report limit for this month (${limit}).`);
            this.statusCode = 429;
        }
    },
}));

const AiResearchReport = require("../ai.model");
const contextBuilder = require("../ai.contextBuilder");
const promptBuilder = require("../ai.promptBuilder");
const responseParser = require("../ai.responseParser");
const validator = require("../ai.validator");
const llmProvider = require("../providers/llmProvider.registry");
const aiQuotaService = require("../aiQuota.service");
const env = require("../../config/env");

const { getOrGenerateReport, getPersistedReport, InsufficientContextError, MalformedLLMResponseError } = require("../ai.service");

const AVAILABLE_CONTEXT = {
    ticker: "AAPL",
    generatedAt: "2026-08-11T10:00:00.000Z",
    profile: { available: true, name: "Apple Inc." },
    ratios: { available: true },
    analysis: { available: true, period: { startYear: 2020, endYear: 2024 } },
    marketData: { available: true, asOf: "2026-08-11T09:30:00.000Z" },
    dcf: { available: true, calculatedAt: "2026-08-11T10:00:00.000Z" },
    comps: { available: false, reason: "not enough peers" },
};

const UNAVAILABLE_CONTEXT = {
    ticker: "ZZZZ",
    generatedAt: "2026-08-11T10:00:00.000Z",
    profile: { available: false, reason: "no company" },
    ratios: { available: false, reason: "no data" },
    analysis: { available: false, reason: "no data" },
    marketData: { available: false, reason: "no data" },
    dcf: { available: false, reason: "no data" },
    comps: { available: false, reason: "no data" },
};

const SANITIZED_REPORT = {
    executiveSummary: "ok",
    companyOverview: "ok",
    businessPerformance: "ok",
    financialHealth: "ok",
    marketPerformance: "ok",
    valuation: "ok",
    conclusion: "ok",
    strengths: ["a"],
    risks: ["b"],
    considerations: ["c"],
    dataGaps: [],
    sectionEvidence: { valuation: ["dcf.calculatedAt"] },
};

const freshPrompt = () => ({ systemPrompt: "sys", userMessage: "user", maxTokens: 1800, temperature: 0.25 });

const mockHappyPath = () => {
    contextBuilder.buildResearchContext.mockResolvedValue({
        context: AVAILABLE_CONTEXT,
        dataFreshness: { marketDataAsOf: AVAILABLE_CONTEXT.marketData.asOf, financialDataPeriod: AVAILABLE_CONTEXT.analysis.period, dcfCalculatedAt: AVAILABLE_CONTEXT.dcf.calculatedAt },
    });
    contextBuilder.buildEvidenceAllowList.mockReturnValue(["dcf.calculatedAt"]);
    promptBuilder.buildPrompt.mockImplementation(freshPrompt);
    llmProvider.generateReport.mockResolvedValue('{"raw":"text"}');
    responseParser.parseReportResponse.mockReturnValue({ parsed: true });
    validator.validateReportSchema.mockReturnValue({ isValid: true, errors: [], warnings: [], sanitized: SANITIZED_REPORT });
    AiResearchReport.findOneAndUpdate.mockResolvedValue({ ticker: "AAPL", report: SANITIZED_REPORT });
};

afterEach(() => {
    jest.clearAllMocks();
});

describe("getOrGenerateReport - cache hit (regenerate: false)", () => {
    it("returns the persisted report without touching the context builder or LLM", async () => {
        AiResearchReport.findOne.mockResolvedValue({ ticker: "AAPL", report: SANITIZED_REPORT });

        const result = await getOrGenerateReport("aapl");

        expect(result).toEqual({ ticker: "AAPL", report: SANITIZED_REPORT });
        expect(AiResearchReport.findOne).toHaveBeenCalledWith({ ticker: "AAPL", contextVersion: env.aiPromptVersion });
        expect(contextBuilder.buildResearchContext).not.toHaveBeenCalled();
        expect(llmProvider.generateReport).not.toHaveBeenCalled();
    });
});

describe("getOrGenerateReport - generation path", () => {
    it("builds context, calls the LLM once, and persists the sanitized report when no report exists yet", async () => {
        AiResearchReport.findOne.mockResolvedValue(null);
        mockHappyPath();

        const result = await getOrGenerateReport("AAPL");

        expect(contextBuilder.buildResearchContext).toHaveBeenCalledWith("AAPL", { preTaxCostOfDebt: undefined });
        expect(llmProvider.generateReport).toHaveBeenCalledTimes(1);
        expect(AiResearchReport.findOneAndUpdate).toHaveBeenCalledWith(
            { ticker: "AAPL", contextVersion: env.aiPromptVersion },
            expect.objectContaining({
                ticker: "AAPL",
                contextVersion: env.aiPromptVersion,
                report: SANITIZED_REPORT,
                sectionEvidence: SANITIZED_REPORT.sectionEvidence,
                contextSnapshot: AVAILABLE_CONTEXT,
            }),
            { returnDocument: "after", upsert: true, runValidators: true }
        );
        expect(result).toEqual({ ticker: "AAPL", report: SANITIZED_REPORT });
    });

    it("passes a caller-supplied preTaxCostOfDebt through to the context builder", async () => {
        AiResearchReport.findOne.mockResolvedValue(null);
        mockHappyPath();

        await getOrGenerateReport("AAPL", { preTaxCostOfDebt: 0.048 });

        expect(contextBuilder.buildResearchContext).toHaveBeenCalledWith("AAPL", { preTaxCostOfDebt: 0.048 });
    });

    it("regenerate: true skips the cache lookup entirely and always calls the LLM", async () => {
        mockHappyPath();

        await getOrGenerateReport("AAPL", { regenerate: true });

        expect(AiResearchReport.findOne).not.toHaveBeenCalled();
        expect(llmProvider.generateReport).toHaveBeenCalledTimes(1);
    });

    it("throws InsufficientContextError and never calls the LLM when every context section is unavailable", async () => {
        AiResearchReport.findOne.mockResolvedValue(null);
        contextBuilder.buildResearchContext.mockResolvedValue({
            context: UNAVAILABLE_CONTEXT,
            dataFreshness: { marketDataAsOf: null, financialDataPeriod: null, dcfCalculatedAt: null },
        });
        contextBuilder.buildEvidenceAllowList.mockReturnValue([]);

        await expect(getOrGenerateReport("ZZZZ")).rejects.toThrow(InsufficientContextError);
        expect(llmProvider.generateReport).not.toHaveBeenCalled();
    });
});

describe("getOrGenerateReport - retry behavior", () => {
    it("retries once with a stricter prompt when the first response fails to parse, then succeeds", async () => {
        AiResearchReport.findOne.mockResolvedValue(null);
        mockHappyPath();
        responseParser.parseReportResponse.mockImplementationOnce(() => {
            throw new Error("The AI response was not valid JSON.");
        });

        const result = await getOrGenerateReport("AAPL");

        expect(llmProvider.generateReport).toHaveBeenCalledTimes(2);
        const secondPrompt = llmProvider.generateReport.mock.calls[1][0];
        expect(secondPrompt.userMessage).toContain("could not be used");
        expect(secondPrompt.userMessage).toContain("not valid JSON");
        expect(result).toEqual({ ticker: "AAPL", report: SANITIZED_REPORT });
    });

    it("retries once when schema validation fails, then succeeds", async () => {
        AiResearchReport.findOne.mockResolvedValue(null);
        mockHappyPath();
        validator.validateReportSchema.mockReturnValueOnce({
            isValid: false,
            errors: ['"strengths" must be a non-empty array of non-empty strings.'],
            warnings: [],
            sanitized: null,
        });

        await getOrGenerateReport("AAPL");

        expect(llmProvider.generateReport).toHaveBeenCalledTimes(2);
        const secondPrompt = llmProvider.generateReport.mock.calls[1][0];
        expect(secondPrompt.userMessage).toContain("strengths");
    });

    it("throws MalformedLLMResponseError after two failed attempts, never more than two LLM calls", async () => {
        AiResearchReport.findOne.mockResolvedValue(null);
        mockHappyPath();
        validator.validateReportSchema.mockReturnValue({
            isValid: false,
            errors: ["still broken"],
            warnings: [],
            sanitized: null,
        });

        await expect(getOrGenerateReport("AAPL")).rejects.toThrow(MalformedLLMResponseError);
        expect(llmProvider.generateReport).toHaveBeenCalledTimes(2);
        expect(AiResearchReport.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("does not retry a genuine provider error (e.g. rate limit) - propagates immediately", async () => {
        AiResearchReport.findOne.mockResolvedValue(null);
        mockHappyPath();
        const rateLimitError = new Error("Too many requests.");
        rateLimitError.statusCode = 429;
        llmProvider.generateReport.mockRejectedValue(rateLimitError);

        await expect(getOrGenerateReport("AAPL")).rejects.toThrow("Too many requests.");
        expect(llmProvider.generateReport).toHaveBeenCalledTimes(1);
        expect(AiResearchReport.findOneAndUpdate).not.toHaveBeenCalled();
    });
});

describe("getOrGenerateReport - quota", () => {
    it("never touches the quota service on a cache hit", async () => {
        AiResearchReport.findOne.mockResolvedValue({ ticker: "AAPL", report: SANITIZED_REPORT });

        await getOrGenerateReport("AAPL", { userId: "user1" });

        expect(aiQuotaService.consumeIfAvailable).not.toHaveBeenCalled();
    });

    it("skips the quota check entirely when no userId is given (e.g. a direct call with no request context)", async () => {
        AiResearchReport.findOne.mockResolvedValue(null);
        mockHappyPath();

        await getOrGenerateReport("AAPL");

        expect(aiQuotaService.consumeIfAvailable).not.toHaveBeenCalled();
        expect(llmProvider.generateReport).toHaveBeenCalled();
    });

    it("consumes quota before calling the LLM when a userId is given and quota is available", async () => {
        AiResearchReport.findOne.mockResolvedValue(null);
        mockHappyPath();
        aiQuotaService.consumeIfAvailable.mockResolvedValue({ allowed: true, used: 1, limit: 5 });

        await getOrGenerateReport("AAPL", { userId: "user1" });

        expect(aiQuotaService.consumeIfAvailable).toHaveBeenCalledWith("user1");
        expect(llmProvider.generateReport).toHaveBeenCalled();
    });

    it("throws QuotaExceededError and never calls the LLM when quota is exhausted", async () => {
        AiResearchReport.findOne.mockResolvedValue(null);
        contextBuilder.buildResearchContext.mockResolvedValue({
            context: AVAILABLE_CONTEXT,
            dataFreshness: {},
        });
        contextBuilder.buildEvidenceAllowList.mockReturnValue([]);
        aiQuotaService.consumeIfAvailable.mockResolvedValue({ allowed: false, used: 5, limit: 5 });

        await expect(getOrGenerateReport("AAPL", { userId: "user1" })).rejects.toThrow(aiQuotaService.QuotaExceededError);
        expect(llmProvider.generateReport).not.toHaveBeenCalled();
    });

    it("enforces quota on regenerate:true just like a fresh generation", async () => {
        mockHappyPath();
        aiQuotaService.consumeIfAvailable.mockResolvedValue({ allowed: false, used: 5, limit: 5 });

        await expect(getOrGenerateReport("AAPL", { regenerate: true, userId: "user1" })).rejects.toThrow(
            aiQuotaService.QuotaExceededError
        );
        expect(llmProvider.generateReport).not.toHaveBeenCalled();
    });
});

describe("getPersistedReport", () => {
    it("queries by ticker and the current contextVersion, never calling the LLM", async () => {
        AiResearchReport.findOne.mockResolvedValue({ ticker: "AAPL", report: SANITIZED_REPORT });

        const result = await getPersistedReport("aapl");

        expect(AiResearchReport.findOne).toHaveBeenCalledWith({ ticker: "AAPL", contextVersion: env.aiPromptVersion });
        expect(result).toEqual({ ticker: "AAPL", report: SANITIZED_REPORT });
        expect(llmProvider.generateReport).not.toHaveBeenCalled();
    });

    it("returns null when no report has been generated yet", async () => {
        AiResearchReport.findOne.mockResolvedValue(null);
        const result = await getPersistedReport("AAPL");
        expect(result).toBeNull();
    });
});
