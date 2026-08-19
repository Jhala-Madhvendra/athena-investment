const calculator = require("../holdingsReconstruction.calculator");

/** Minimal transaction fixture builder - _id/createdAt default to something ordering-stable unless overridden. */
const txn = (overrides) => ({
    _id: "000000000000000000000001",
    createdAt: "2020-01-01T00:00:00.000Z",
    ...overrides,
});

describe("getHoldingsAt", () => {
    it("reconstructs holdings from Sprint 15's worked example (buy, buy, partial sell)", () => {
        const transactions = [
            txn({ _id: "1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: "2026-01-01", createdAt: "2026-01-01T00:00:00Z" }),
            txn({ _id: "2", ticker: "AAPL", type: "BUY", quantity: 5, transactionDate: "2026-02-01", createdAt: "2026-02-01T00:00:00Z" }),
            txn({ _id: "3", ticker: "AAPL", type: "SELL", quantity: 8, transactionDate: "2026-03-01", createdAt: "2026-03-01T00:00:00Z" }),
        ];

        expect(calculator.getHoldingsAt(transactions, "2026-01-15")).toEqual({ AAPL: 10 });
        expect(calculator.getHoldingsAt(transactions, "2026-02-15")).toEqual({ AAPL: 15 });
        expect(calculator.getHoldingsAt(transactions, "2026-03-15")).toEqual({ AAPL: 7 });
    });

    it("returns nothing before the first transaction", () => {
        const transactions = [txn({ _id: "1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: "2026-06-01" })];
        expect(calculator.getHoldingsAt(transactions, "2026-01-01")).toEqual({});
    });

    it("drops a ticker entirely once its position is fully closed (zero position, not an explicit 0)", () => {
        const transactions = [
            txn({ _id: "1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: "2026-01-01" }),
            txn({ _id: "2", ticker: "AAPL", type: "SELL", quantity: 10, transactionDate: "2026-02-01" }),
        ];
        const holdings = calculator.getHoldingsAt(transactions, "2026-02-15");
        expect(holdings).toEqual({});
        expect(Object.prototype.hasOwnProperty.call(holdings, "AAPL")).toBe(false);
    });

    it("supports re-entry after fully exiting a position", () => {
        const transactions = [
            txn({ _id: "1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: "2026-01-01" }),
            txn({ _id: "2", ticker: "AAPL", type: "SELL", quantity: 10, transactionDate: "2026-02-01" }),
            txn({ _id: "3", ticker: "AAPL", type: "BUY", quantity: 4, transactionDate: "2026-03-01" }),
        ];
        expect(calculator.getHoldingsAt(transactions, "2026-02-15")).toEqual({});
        expect(calculator.getHoldingsAt(transactions, "2026-03-15")).toEqual({ AAPL: 4 });
    });

    it("reconstructs multiple assets independently (Sprint 15 multi-asset test)", () => {
        const transactions = [
            txn({ _id: "1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: "2026-01-01" }),
            txn({ _id: "2", ticker: "MSFT", type: "BUY", quantity: 6, transactionDate: "2026-02-01" }),
            txn({ _id: "3", ticker: "AAPL", type: "SELL", quantity: 4, transactionDate: "2026-03-01" }),
            txn({ _id: "4", ticker: "NVDA", type: "BUY", quantity: 3, transactionDate: "2026-04-01" }),
        ];

        expect(calculator.getHoldingsAt(transactions, "2026-01-15")).toEqual({ AAPL: 10 });
        expect(calculator.getHoldingsAt(transactions, "2026-02-15")).toEqual({ AAPL: 10, MSFT: 6 });
        expect(calculator.getHoldingsAt(transactions, "2026-03-15")).toEqual({ AAPL: 6, MSFT: 6 });
        expect(calculator.getHoldingsAt(transactions, "2026-04-15")).toEqual({ AAPL: 6, MSFT: 6, NVDA: 3 });
    });

    it("supports fractional shares", () => {
        const transactions = [
            txn({ _id: "1", ticker: "AAPL", type: "BUY", quantity: 1.25, transactionDate: "2026-01-01" }),
            txn({ _id: "2", ticker: "AAPL", type: "SELL", quantity: 0.5, transactionDate: "2026-02-01" }),
        ];
        expect(calculator.getHoldingsAt(transactions, "2026-02-15").AAPL).toBeCloseTo(0.75, 9);
    });
});

describe("ordering", () => {
    it("resolves same-day transactions by timestamp (createdAt), not just date", () => {
        const transactions = [
            txn({ _id: "2", ticker: "AAPL", type: "BUY", quantity: 5, transactionDate: "2026-01-05", createdAt: "2026-01-05T13:00:00Z" }),
            txn({ _id: "1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: "2026-01-05", createdAt: "2026-01-05T10:00:00Z" }),
            txn({ _id: "3", ticker: "AAPL", type: "SELL", quantity: 3, transactionDate: "2026-01-05", createdAt: "2026-01-05T15:00:00Z" }),
        ];

        // Regardless of array insertion order, the final same-day holding must reflect 10 + 5 - 3 = 12.
        expect(calculator.getHoldingsAt(transactions, "2026-01-05")).toEqual({ AAPL: 12 });
    });

    it("is insensitive to the order transactions are passed in (out-of-order insertion)", () => {
        const inOrder = [
            txn({ _id: "1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: "2026-01-01" }),
            txn({ _id: "2", ticker: "AAPL", type: "BUY", quantity: 5, transactionDate: "2026-02-01" }),
            txn({ _id: "3", ticker: "AAPL", type: "SELL", quantity: 8, transactionDate: "2026-03-01" }),
        ];
        const shuffled = [inOrder[2], inOrder[0], inOrder[1]];

        expect(calculator.getHoldingsAt(shuffled, "2026-03-15")).toEqual(calculator.getHoldingsAt(inOrder, "2026-03-15"));
    });

    it("ties break deterministically on _id when transactionDate and createdAt are identical", () => {
        const a = txn({ _id: "1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: "2026-01-01", createdAt: "2026-01-01T00:00:00Z" });
        const b = txn({ _id: "2", ticker: "AAPL", type: "SELL", quantity: 3, transactionDate: "2026-01-01", createdAt: "2026-01-01T00:00:00Z" });

        const result1 = calculator.sortChronologically([b, a]);
        const result2 = calculator.sortChronologically([a, b]);

        expect(result1.map((t) => t._id)).toEqual(result2.map((t) => t._id));
        expect(result1.map((t) => t._id)).toEqual(["1", "2"]);
    });
});

describe("findFirstNegativeHolding", () => {
    it("returns null for a valid timeline", () => {
        const transactions = [
            txn({ _id: "1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: "2026-01-01" }),
            txn({ _id: "2", ticker: "AAPL", type: "SELL", quantity: 10, transactionDate: "2026-02-01" }),
        ];
        expect(calculator.findFirstNegativeHolding(transactions)).toBeNull();
    });

    it("flags a SELL that exceeds what was held at that point", () => {
        const transactions = [
            txn({ _id: "1", ticker: "AAPL", type: "BUY", quantity: 5, transactionDate: "2026-01-01" }),
            txn({ _id: "2", ticker: "AAPL", type: "SELL", quantity: 8, transactionDate: "2026-02-01" }),
        ];
        const violation = calculator.findFirstNegativeHolding(transactions);
        expect(violation).not.toBeNull();
        expect(violation.ticker).toBe("AAPL");
        expect(violation.transaction._id).toBe("2");
    });

    it("catches a violation introduced by editing an earlier transaction downward, even though the edited row itself looks fine in isolation", () => {
        // Jan: BUY 10 AAPL. Mar: SELL 8 AAPL (valid against 10). Editing Jan's BUY down to 5 makes Mar's SELL invalid.
        const editedTimeline = [
            txn({ _id: "1", ticker: "AAPL", type: "BUY", quantity: 5, transactionDate: "2026-01-01" }), // edited down from 10
            txn({ _id: "2", ticker: "AAPL", type: "SELL", quantity: 8, transactionDate: "2026-03-01" }),
        ];
        const violation = calculator.findFirstNegativeHolding(editedTimeline);
        expect(violation).not.toBeNull();
        expect(violation.transaction._id).toBe("2");
    });

    it("catches a violation introduced by deleting a BUY that a later SELL depended on", () => {
        // Original: BUY 10 (Jan), SELL 8 (Mar). Deleting the BUY leaves only the SELL.
        const afterDeletingTheBuy = [txn({ _id: "2", ticker: "AAPL", type: "SELL", quantity: 8, transactionDate: "2026-03-01" })];
        const violation = calculator.findFirstNegativeHolding(afterDeletingTheBuy);
        expect(violation).not.toBeNull();
        expect(violation.ticker).toBe("AAPL");
    });
});

describe("buildHoldingsTimeline", () => {
    it("matches the Sprint 15 worked example (AAPL/MSFT/NVDA over four transactions)", () => {
        const transactions = [
            txn({ _id: "1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: "2026-01-01" }),
            txn({ _id: "2", ticker: "MSFT", type: "BUY", quantity: 5, transactionDate: "2026-02-15" }),
            txn({ _id: "3", ticker: "AAPL", type: "SELL", quantity: 5, transactionDate: "2026-04-10" }),
            txn({ _id: "4", ticker: "NVDA", type: "BUY", quantity: 10, transactionDate: "2026-06-20" }),
        ];

        const timeline = calculator.buildHoldingsTimeline(transactions);

        expect(timeline).toEqual([
            { startDate: "2026-01-01", endDate: "2026-02-14", holdings: { AAPL: 10 } },
            { startDate: "2026-02-15", endDate: "2026-04-09", holdings: { AAPL: 10, MSFT: 5 } },
            { startDate: "2026-04-10", endDate: "2026-06-19", holdings: { AAPL: 5, MSFT: 5 } },
            { startDate: "2026-06-20", endDate: null, holdings: { AAPL: 5, MSFT: 5, NVDA: 10 } },
        ]);
    });

    it("collapses multiple same-day transactions into a single interval", () => {
        const transactions = [
            txn({ _id: "1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: "2026-01-05", createdAt: "2026-01-05T10:00:00Z" }),
            txn({ _id: "2", ticker: "AAPL", type: "BUY", quantity: 5, transactionDate: "2026-01-05", createdAt: "2026-01-05T13:00:00Z" }),
            txn({ _id: "3", ticker: "AAPL", type: "SELL", quantity: 3, transactionDate: "2026-01-05", createdAt: "2026-01-05T15:00:00Z" }),
        ];

        const timeline = calculator.buildHoldingsTimeline(transactions);

        expect(timeline).toEqual([{ startDate: "2026-01-05", endDate: null, holdings: { AAPL: 12 } }]);
    });

    it("returns an empty timeline for no transactions", () => {
        expect(calculator.buildHoldingsTimeline([])).toEqual([]);
    });
});

describe("holdingsEqual", () => {
    it("is true for equal maps regardless of key order and within float tolerance", () => {
        expect(calculator.holdingsEqual({ AAPL: 10, MSFT: 5 }, { MSFT: 5, AAPL: 10.0000000001 })).toBe(true);
    });

    it("is false when a ticker's quantity differs", () => {
        expect(calculator.holdingsEqual({ AAPL: 10 }, { AAPL: 9 })).toBe(false);
    });

    it("is false when one side has an extra ticker", () => {
        expect(calculator.holdingsEqual({ AAPL: 10 }, { AAPL: 10, MSFT: 1 })).toBe(false);
    });
});
