const validator = require("../alert.validator");
const { ALERT_TYPES, ALERT_SEVERITIES } = require("../alert.model");

describe("validateListQuery", () => {
    it("applies defaults (limit 20, page 1) when nothing is supplied", () => {
        const { isValid, normalized } = validator.validateListQuery({});
        expect(isValid).toBe(true);
        expect(normalized).toEqual({ limit: 20, page: 1 });
    });

    it.each(ALERT_TYPES)("accepts each valid alert type (%s)", (type) => {
        expect(validator.validateListQuery({ type }).isValid).toBe(true);
    });

    it("rejects an invalid type", () => {
        const { isValid, errors } = validator.validateListQuery({ type: "BOGUS" });
        expect(isValid).toBe(false);
        expect(errors[0]).toMatch(/type must be one of/);
    });

    it.each(ALERT_SEVERITIES)("accepts each valid severity (%s)", (severity) => {
        expect(validator.validateListQuery({ severity }).isValid).toBe(true);
    });

    it("rejects an invalid severity", () => {
        expect(validator.validateListQuery({ severity: "CRITICAL" }).isValid).toBe(false);
    });

    it("parses unread=true/false into a boolean, and rejects any other value", () => {
        expect(validator.validateListQuery({ unread: "true" }).normalized.unread).toBe(true);
        expect(validator.validateListQuery({ unread: "false" }).normalized.unread).toBe(false);
        expect(validator.validateListQuery({ unread: "yes" }).isValid).toBe(false);
    });

    it("normalizes a valid ticker to uppercase and rejects an invalid one", () => {
        expect(validator.validateListQuery({ ticker: "aapl" }).normalized.ticker).toBe("AAPL");
        expect(validator.validateListQuery({ ticker: "not valid!" }).isValid).toBe(false);
    });

    it("rejects a limit outside [1, 100] and a non-integer limit", () => {
        expect(validator.validateListQuery({ limit: "0" }).isValid).toBe(false);
        expect(validator.validateListQuery({ limit: "101" }).isValid).toBe(false);
        expect(validator.validateListQuery({ limit: "5.5" }).isValid).toBe(false);
        expect(validator.validateListQuery({ limit: "50" }).normalized.limit).toBe(50);
    });

    it("rejects a non-positive page", () => {
        expect(validator.validateListQuery({ page: "0" }).isValid).toBe(false);
        expect(validator.validateListQuery({ page: "-1" }).isValid).toBe(false);
        expect(validator.validateListQuery({ page: "3" }).normalized.page).toBe(3);
    });
});

describe("isValidAlertId", () => {
    it("accepts a valid Mongo ObjectId string", () => {
        expect(validator.isValidAlertId("507f1f77bcf86cd799439011")).toBe(true);
    });

    it("rejects a malformed id", () => {
        expect(validator.isValidAlertId("not-an-id")).toBe(false);
    });
});

describe("validateTickersQuery", () => {
    it("requires the tickers param", () => {
        expect(validator.validateTickersQuery({}).isValid).toBe(false);
    });

    it("parses a comma-separated list, uppercasing and deduplicating", () => {
        const { isValid, normalized } = validator.validateTickersQuery({ tickers: "aapl,MSFT,aapl" });
        expect(isValid).toBe(true);
        expect(normalized.tickers).toEqual(["AAPL", "MSFT"]);
    });

    it("rejects a list containing an invalid ticker", () => {
        expect(validator.validateTickersQuery({ tickers: "AAPL,not valid!" }).isValid).toBe(false);
    });

    it("rejects more than 50 tickers", () => {
        const tickers = Array.from({ length: 51 }, (_, i) => `T${i}`).join(",");
        expect(validator.validateTickersQuery({ tickers }).isValid).toBe(false);
    });

    it("accepts exactly 50 tickers", () => {
        const tickers = Array.from({ length: 50 }, (_, i) => `T${i}`).join(",");
        expect(validator.validateTickersQuery({ tickers }).isValid).toBe(true);
    });
});
