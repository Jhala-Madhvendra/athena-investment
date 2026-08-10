const { calculateComps } = require("../comps.engine");

/**
 * Fixture: one target + three peers, deliberately including a loss-making
 * peer (B, excluded from P/E), a peer with negative book value and no
 * EBITDA/debt data (C, excluded from P/B, EV/EBITDA, EV/Revenue), so every
 * exclusion path and the "some multiples still work" case are exercised.
 * All numbers were chosen so peer statistics come out to clean values.
 */
const target = {
    ticker: "TARGET",
    name: "Target Co",
    price: 100,
    marketCap: 10000,
    revenue: 5000,
    netIncome: 500,
    bookValue: 2500,
    ebitdaInputs: { operatingIncome: 800, depreciationAndAmortization: 200 },
    debt: 2000,
    cash: 1000,
    dilutedShares: 100,
};

const peerA = {
    ticker: "PEERA",
    name: "Peer A",
    price: 80,
    marketCap: 8000,
    revenue: 4000,
    netIncome: 400,
    bookValue: 2000,
    ebitdaInputs: { operatingIncome: 750, depreciationAndAmortization: 250 },
    debt: 1000,
    cash: 0,
};

const peerB = {
    ticker: "PEERB",
    name: "Peer B",
    price: 60,
    marketCap: 12000,
    revenue: 5000,
    netIncome: -300, // loss-making -> P/E excluded
    bookValue: 3000,
    ebitdaInputs: { operatingIncome: 700, depreciationAndAmortization: 300 },
    debt: 1500,
    cash: 500,
};

const peerC = {
    ticker: "PEERC",
    name: "Peer C",
    price: 90,
    marketCap: 9000,
    revenue: 4500,
    netIncome: 450,
    bookValue: -100, // negative book value -> P/B excluded
    // no ebitdaInputs -> EBITDA null -> EV/EBITDA excluded
    debt: null, // missing debt -> EV null -> EV/Revenue excluded
    cash: 300,
};

describe("comps.engine calculateComps", () => {
    const result = calculateComps({ target, peers: [peerA, peerB, peerC], statistic: "median" });

    it("computes derived EBITDA and Enterprise Value for every company", () => {
        expect(result.target.ebitda).toBe(1000);
        expect(result.target.enterpriseValue).toBe(11000); // 10000 + 2000 - 1000
        expect(result.peers[0].ebitda).toBe(1000); // peer A
        expect(result.peers[0].enterpriseValue).toBe(9000); // 8000 + 1000 - 0
    });

    it("excludes P/E for the loss-making peer with a stated reason", () => {
        const peerBMetrics = result.peers.find((p) => p.ticker === "PEERB");
        expect(peerBMetrics.multiples.pe.value).toBeNull();
        expect(peerBMetrics.multiples.pe.excludedReason).toMatch(/Net Income is zero or negative/);
    });

    it("excludes P/B, EV/EBITDA, and EV/Revenue for peer C with distinct reasons", () => {
        const peerCMetrics = result.peers.find((p) => p.ticker === "PEERC");
        expect(peerCMetrics.multiples.pb.value).toBeNull();
        expect(peerCMetrics.multiples.pb.excludedReason).toMatch(/Book Value is zero or negative/);

        expect(peerCMetrics.multiples.evEbitda.value).toBeNull();
        expect(peerCMetrics.multiples.evEbitda.excludedReason).toMatch(/EBITDA is not available/);

        expect(peerCMetrics.multiples.evRevenue.value).toBeNull();
        expect(peerCMetrics.multiples.evRevenue.excludedReason).toMatch(/Enterprise Value could not be computed/);

        // P/E and P/S are still valid for peer C even though other multiples are excluded
        expect(peerCMetrics.multiples.pe.value).toBe(20);
        expect(peerCMetrics.multiples.ps.value).toBe(2);
    });

    it("computes peer statistics only from valid observations", () => {
        expect(result.peerStatistics.pe.count).toBe(2); // A, C (B excluded)
        expect(result.peerStatistics.pe.median).toBe(20);
        expect(result.peerStatistics.pe.excludedPeers).toEqual([
            { ticker: "PEERB", reason: expect.stringMatching(/Net Income is zero or negative/) },
        ]);

        expect(result.peerStatistics.evEbitda.count).toBe(2); // A, B (C excluded)
        expect(result.peerStatistics.evEbitda.median).toBe(11); // (9 + 13) / 2

        expect(result.peerStatistics.evRevenue.count).toBe(2); // A, B (C excluded)
        expect(result.peerStatistics.evRevenue.median).toBeCloseTo(2.425);

        expect(result.peerStatistics.pb.count).toBe(2); // A, B (C excluded)
        expect(result.peerStatistics.pb.median).toBe(4);

        expect(result.peerStatistics.ps.count).toBe(3); // A, B, C all valid
        expect(result.peerStatistics.ps.median).toBe(2);
    });

    it("does not compute percentiles when fewer than 4 peer observations exist", () => {
        expect(result.peerStatistics.pe.p25).toBeNull();
        expect(result.peerStatistics.pe.p75).toBeNull();
    });

    it("applies the median peer statistic to the target for each multiple", () => {
        expect(result.impliedValuations.pe.impliedEquityValue).toBe(10000); // 20 * 500
        expect(result.impliedValuations.pe.impliedValuePerShare).toBe(100);

        expect(result.impliedValuations.evEbitda.impliedEnterpriseValue).toBe(11000); // 11 * 1000
        expect(result.impliedValuations.evEbitda.netDebt).toBe(1000); // 2000 - 1000
        expect(result.impliedValuations.evEbitda.impliedEquityValue).toBe(10000);
        expect(result.impliedValuations.evEbitda.impliedValuePerShare).toBe(100);

        expect(result.impliedValuations.evRevenue.impliedValuePerShare).toBeCloseTo(111.25);

        expect(result.impliedValuations.pb.impliedValuePerShare).toBe(100); // 4 * 2500 / 100

        expect(result.impliedValuations.ps.impliedValuePerShare).toBe(100); // 2 * 5000 / 100
    });

    it("builds a valuation range across every applicable methodology", () => {
        expect(result.valuationRange.methodologiesApplied).toBe(5);
        expect(result.valuationRange.low).toBe(100);
        expect(result.valuationRange.high).toBeCloseTo(111.25);
        expect(result.valuationRange.median).toBe(100);
    });

    it("does not automatically average or pick the highest implied value as a single verdict", () => {
        expect(result.valuationRange).not.toHaveProperty("recommendedValue");
        expect(result.valuationRange).not.toHaveProperty("average");
    });
});

describe("comps.engine calculateComps - missing diluted shares", () => {
    it("makes every methodology inapplicable and yields an empty valuation range", () => {
        const noSharesTarget = { ...target, dilutedShares: null };
        const result = calculateComps({ target: noSharesTarget, peers: [peerA, peerB, peerC], statistic: "median" });

        Object.values(result.impliedValuations).forEach((valuation) => {
            expect(valuation.isApplicable).toBe(false);
            expect(valuation.impliedValuePerShare).toBeNull();
        });

        expect(result.valuationRange.methodologiesApplied).toBe(0);
        expect(result.valuationRange.low).toBeNull();
        expect(result.valuationRange.high).toBeNull();
        expect(result.valuationRange.median).toBeNull();
    });
});

describe("comps.engine calculateComps - statistic selection", () => {
    it("produces a different implied valuation when the mean is selected instead of the median", () => {
        const medianResult = calculateComps({ target, peers: [peerA, peerB, peerC], statistic: "median" });
        const meanResult = calculateComps({ target, peers: [peerA, peerB, peerC], statistic: "mean" });

        // ps peer values [2, 2.4, 2] -> mean (2.1333) differs from median (2)
        expect(meanResult.impliedValuations.ps.selectedPeerStatistic).toBeCloseTo(2.1333, 3);
        expect(medianResult.impliedValuations.ps.selectedPeerStatistic).toBe(2);
        expect(meanResult.impliedValuations.ps.impliedValuePerShare).not.toBe(
            medianResult.impliedValuations.ps.impliedValuePerShare
        );
    });
});
