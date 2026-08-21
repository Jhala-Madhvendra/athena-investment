jest.mock("../portfolio.scenario.explanation.promptBuilder", () => ({ buildPrompt: jest.fn() }));
jest.mock("../portfolio.scenario.explanation.responseParser", () => ({ parseExplanationResponse: jest.fn() }));
jest.mock("../portfolio.scenario.explanation.responseValidator", () => ({ validateExplanationText: jest.fn() }));
jest.mock("../../ai/providers/llmProvider.registry", () => ({ generateReport: jest.fn() }));

const promptBuilder = require("../portfolio.scenario.explanation.promptBuilder");
const responseParser = require("../portfolio.scenario.explanation.responseParser");
const responseValidator = require("../portfolio.scenario.explanation.responseValidator");
const llmProvider = require("../../ai/providers/llmProvider.registry");

const { explainScenario, MalformedLLMResponseError } = require("../portfolio.scenario.explanation.service");

const NORMALIZED = { scenario: { name: "Bear Case", rules: [] }, currentPortfolioValueUSD: 100000 };
const freshPrompt = () => ({ systemPrompt: "sys", userMessage: "user", maxTokens: 1024, temperature: 0.2 });

afterEach(() => {
    jest.clearAllMocks();
});

describe("explainScenario - happy path", () => {
    it("returns the parsed, verified explanation on first attempt, without retrying", async () => {
        promptBuilder.buildPrompt.mockReturnValue(freshPrompt());
        llmProvider.generateReport.mockResolvedValue('{"explanation": "The portfolio falls 12% under this scenario."}');
        responseParser.parseExplanationResponse.mockReturnValue("The portfolio falls 12% under this scenario.");
        responseValidator.validateExplanationText.mockReturnValue({ isValid: true, errors: [], unverifiedNumbers: [] });

        const result = await explainScenario(NORMALIZED);

        expect(result.explanation).toBe("The portfolio falls 12% under this scenario.");
        expect(typeof result.generatedAt).toBe("string");
        expect(llmProvider.generateReport).toHaveBeenCalledTimes(1);
        expect(responseValidator.validateExplanationText).toHaveBeenCalledWith(
            "The portfolio falls 12% under this scenario.",
            NORMALIZED
        );
    });

    it("never mutates the normalized input it was given", async () => {
        promptBuilder.buildPrompt.mockReturnValue(freshPrompt());
        llmProvider.generateReport.mockResolvedValue('{"explanation": "Fine."}');
        responseParser.parseExplanationResponse.mockReturnValue("Fine.");
        responseValidator.validateExplanationText.mockReturnValue({ isValid: true, errors: [], unverifiedNumbers: [] });

        const snapshot = JSON.parse(JSON.stringify(NORMALIZED));
        await explainScenario(NORMALIZED);

        expect(NORMALIZED).toEqual(snapshot);
    });
});

describe("explainScenario - retry on parse failure", () => {
    it("retries once with a stricter prompt after an unparseable response, then succeeds", async () => {
        promptBuilder.buildPrompt.mockReturnValue(freshPrompt());
        llmProvider.generateReport
            .mockResolvedValueOnce("The portfolio falls 12% under this scenario.") // not JSON - forced-JSON providers shouldn't produce this, but a non-forced provider might ignore the envelope instruction
            .mockResolvedValueOnce('{"explanation": "The portfolio falls 12% under this scenario."}');
        responseParser.parseExplanationResponse
            .mockImplementationOnce(() => {
                throw new Error("The AI response was not valid JSON.");
            })
            .mockReturnValueOnce("The portfolio falls 12% under this scenario.");
        responseValidator.validateExplanationText.mockReturnValue({ isValid: true, errors: [], unverifiedNumbers: [] });

        const result = await explainScenario(NORMALIZED);

        expect(result.explanation).toBe("The portfolio falls 12% under this scenario.");
        expect(llmProvider.generateReport).toHaveBeenCalledTimes(2);
        expect(llmProvider.generateReport.mock.calls[1][0].userMessage).toMatch(/could not be used/);
    });
});

describe("explainScenario - retry on verification failure", () => {
    it("retries once with a stricter prompt after a failed verification, then succeeds", async () => {
        promptBuilder.buildPrompt.mockReturnValue(freshPrompt());
        llmProvider.generateReport
            .mockResolvedValueOnce('{"explanation": "The portfolio would fall 47.5% next quarter."}')
            .mockResolvedValueOnce('{"explanation": "The portfolio falls 12% under this scenario."}');
        responseParser.parseExplanationResponse
            .mockReturnValueOnce("The portfolio would fall 47.5% next quarter.")
            .mockReturnValueOnce("The portfolio falls 12% under this scenario.");
        responseValidator.validateExplanationText
            .mockReturnValueOnce({ isValid: false, errors: ["contains an unverified number: 47.5"], unverifiedNumbers: [47.5] })
            .mockReturnValueOnce({ isValid: true, errors: [], unverifiedNumbers: [] });

        const result = await explainScenario(NORMALIZED);

        expect(result.explanation).toBe("The portfolio falls 12% under this scenario.");
        expect(llmProvider.generateReport).toHaveBeenCalledTimes(2);
        expect(llmProvider.generateReport.mock.calls[1][0].userMessage).toMatch(/could not be used/);
    });

    it("throws MalformedLLMResponseError when both attempts fail verification", async () => {
        promptBuilder.buildPrompt.mockReturnValue(freshPrompt());
        llmProvider.generateReport.mockResolvedValue('{"explanation": "The portfolio would fall 47.5% next quarter."}');
        responseParser.parseExplanationResponse.mockReturnValue("The portfolio would fall 47.5% next quarter.");
        responseValidator.validateExplanationText.mockReturnValue({
            isValid: false,
            errors: ["contains an unverified number: 47.5"],
            unverifiedNumbers: [47.5],
        });

        await expect(explainScenario(NORMALIZED)).rejects.toThrow(MalformedLLMResponseError);
        expect(llmProvider.generateReport).toHaveBeenCalledTimes(2);
    });

    it("throws MalformedLLMResponseError when both attempts fail to parse", async () => {
        promptBuilder.buildPrompt.mockReturnValue(freshPrompt());
        llmProvider.generateReport.mockResolvedValue("not json at all");
        responseParser.parseExplanationResponse.mockImplementation(() => {
            throw new Error("The AI response was not valid JSON.");
        });

        await expect(explainScenario(NORMALIZED)).rejects.toThrow(MalformedLLMResponseError);
        expect(llmProvider.generateReport).toHaveBeenCalledTimes(2);
        expect(responseValidator.validateExplanationText).not.toHaveBeenCalled();
    });
});
