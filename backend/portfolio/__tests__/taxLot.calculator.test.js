const { matchLotsFIFO, LONG_TERM_THRESHOLD_DAYS } = require("../taxLot.calculator");

const buy = (date, price, quantity) => ({ ticker: "AAPL", type: "BUY", price, quantity, transactionDate: new Date(date) });
const sell = (date, price, quantity) => ({ ticker: "AAPL", type: "SELL", price, quantity, transactionDate: new Date(date) });

describe("matchLotsFIFO", () => {
    it("returns everything as an open lot when there are no sells", () => {
        const { realizedLots, openLots } = matchLotsFIFO([buy("2025-01-01", 100, 10)]);

        expect(realizedLots).toEqual([]);
        expect(openLots).toEqual([{ ticker: "AAPL", buyDate: expect.any(Date), buyPrice: 100, quantityRemaining: 10, costBasis: 1000 }]);
    });

    it("fully consumes a single lot with an exact-quantity sell", () => {
        const { realizedLots, openLots } = matchLotsFIFO([buy("2025-01-01", 100, 10), sell("2025-06-01", 150, 10)]);

        expect(realizedLots).toHaveLength(1);
        expect(realizedLots[0]).toMatchObject({ quantity: 10, proceeds: 1500, costBasis: 1000, gainLoss: 500 });
        expect(openLots).toEqual([]);
    });

    it("splits a lot when only partially consumed", () => {
        const { realizedLots, openLots } = matchLotsFIFO([buy("2025-01-01", 100, 10), sell("2025-06-01", 150, 4)]);

        expect(realizedLots).toHaveLength(1);
        expect(realizedLots[0]).toMatchObject({ quantity: 4, costBasis: 400 });
        expect(openLots).toEqual([{ ticker: "AAPL", buyDate: expect.any(Date), buyPrice: 100, quantityRemaining: 6, costBasis: 600 }]);
    });

    it("consumes the oldest lot first (FIFO), splitting across multiple lots when one sell spans them", () => {
        const transactions = [
            buy("2025-01-01", 100, 5), // lot A
            buy("2025-02-01", 120, 5), // lot B
            sell("2025-06-01", 150, 8), // consumes all of A (5) + part of B (3)
        ];

        const { realizedLots, openLots } = matchLotsFIFO(transactions);

        expect(realizedLots).toHaveLength(2);
        expect(realizedLots[0]).toMatchObject({ buyPrice: 100, quantity: 5, costBasis: 500 });
        expect(realizedLots[1]).toMatchObject({ buyPrice: 120, quantity: 3, costBasis: 360 });
        expect(openLots).toEqual([{ ticker: "AAPL", buyDate: expect.any(Date), buyPrice: 120, quantityRemaining: 2, costBasis: 240 }]);
    });

    it("labels a lot held longer than 365 days as LONG term, and 365 or fewer as SHORT", () => {
        const longTerm = matchLotsFIFO([buy("2024-01-01", 100, 1), sell("2025-01-02", 150, 1)]); // 367 days
        const shortTerm = matchLotsFIFO([buy("2025-01-01", 100, 1), sell("2025-06-01", 150, 1)]); // ~151 days
        const exactlyAtThreshold = matchLotsFIFO([buy("2024-01-01", 100, 1), sell("2024-12-31", 150, 1)]); // 365 days exactly

        expect(longTerm.realizedLots[0].term).toBe("LONG");
        expect(longTerm.realizedLots[0].holdingPeriodDays).toBeGreaterThan(LONG_TERM_THRESHOLD_DAYS);
        expect(shortTerm.realizedLots[0].term).toBe("SHORT");
        expect(exactlyAtThreshold.realizedLots[0].term).toBe("SHORT");
    });

    it("processes transactions in chronological order regardless of input order", () => {
        const transactions = [sell("2025-06-01", 150, 5), buy("2025-01-01", 100, 5)];

        const { realizedLots } = matchLotsFIFO(transactions);

        expect(realizedLots).toHaveLength(1);
        expect(realizedLots[0].gainLoss).toBe(250);
    });

    it("returns empty results for an empty transaction list", () => {
        expect(matchLotsFIFO([])).toEqual({ realizedLots: [], openLots: [] });
    });
});
