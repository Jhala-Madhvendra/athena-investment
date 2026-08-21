const { parseExplanationResponse } = require("../portfolio.scenario.explanation.responseParser");

describe("parseExplanationResponse - well-formed responses", () => {
    it("extracts the explanation from a clean JSON object", () => {
        const raw = '{"explanation": "The portfolio falls 12% under this scenario."}';
        expect(parseExplanationResponse(raw)).toBe("The portfolio falls 12% under this scenario.");
    });

    it("strips a markdown code fence around the JSON object", () => {
        const raw = '```json\n{"explanation": "The portfolio falls 12%."}\n```';
        expect(parseExplanationResponse(raw)).toBe("The portfolio falls 12%.");
    });

    it("recovers from stray prose surrounding the JSON object", () => {
        const raw = 'Here is the explanation:\n{"explanation": "The portfolio falls 12%."}\nLet me know if you need more.';
        expect(parseExplanationResponse(raw)).toBe("The portfolio falls 12%.");
    });

    it("trims whitespace from the extracted explanation", () => {
        const raw = '{"explanation": "  The portfolio falls 12%.  "}';
        expect(parseExplanationResponse(raw)).toBe("The portfolio falls 12%.");
    });
});

describe("parseExplanationResponse - double-encoded JSON (observed with forced-JSON providers)", () => {
    it("unwraps a response that is itself a JSON string containing the real object", () => {
        // What openaiClient.js's response_format:json_object / geminiClient.js's
        // responseMimeType:application/json can produce when the model quotes
        // its own JSON object as a string value instead of emitting it directly.
        const raw = JSON.stringify('{"explanation": "The portfolio falls 12% under this scenario."}');
        expect(parseExplanationResponse(raw)).toBe("The portfolio falls 12% under this scenario.");
    });
});

describe("parseExplanationResponse - malformed responses", () => {
    it("throws on an empty response", () => {
        expect(() => parseExplanationResponse("")).toThrow(/empty/);
    });

    it("throws on text that isn't JSON at all", () => {
        expect(() => parseExplanationResponse("The portfolio falls 12% under this scenario.")).toThrow(/not valid JSON/);
    });

    it("throws when the JSON object has no explanation field", () => {
        expect(() => parseExplanationResponse('{"summary": "The portfolio falls 12%."}')).toThrow(/explanation/);
    });

    it("throws when explanation is present but not a string", () => {
        expect(() => parseExplanationResponse('{"explanation": 12}')).toThrow(/explanation/);
    });

    it("throws when explanation is an empty string", () => {
        expect(() => parseExplanationResponse('{"explanation": "   "}')).toThrow(/explanation/);
    });
});
