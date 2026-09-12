jest.mock("../simulation.service", () => ({ loadOwnedPortfolio: jest.fn(), getSyntheticPortfolio: jest.fn() }));
jest.mock("../simulation.analytics.service", () => ({ getSimulationAnalytics: jest.fn() }));
jest.mock("../../models/company.model", () => ({ find: jest.fn() }));
jest.mock("../../market/market.service", () => ({ getCurrentMarketData: jest.fn() }));
jest.mock("../../portfolio/portfolio.scenario.service", () => {
    const actual = jest.requireActual("../../portfolio/portfolio.scenario.service");
    return {
        ...actual,
        runScenarioAgainstContext: jest.fn(actual.runScenarioAgainstContext),
    };
});

const Company = require("../../models/company.model");
const marketService = require("../../market/market.service");
const simulationService = require("../simulation.service");
const simulationAnalyticsService = require("../simulation.analytics.service");
const realScenarioService = require("../../portfolio/portfolio.scenario.service");
const simulationScenarioService = require("../simulation.scenario.service");

const chainableSelectLean = (docs) => ({ select: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })) });

const enrichedHolding = (ticker, currentValueUSD) => ({ ticker, currentValueUSD });

afterEach(() => {
    jest.clearAllMocks();
});

describe("loadSyntheticScenarioContext", () => {
    it("returns hasHoldings: false for a portfolio with no priced holdings", async () => {
        simulationService.loadOwnedPortfolio.mockResolvedValue({ _id: "p1", holdings: [] });
        simulationService.getSyntheticPortfolio.mockResolvedValue({ holdings: [] });

        const context = await simulationScenarioService.loadSyntheticScenarioContext("user1", "p1");

        expect(context.hasHoldings).toBe(false);
        expect(Company.find).not.toHaveBeenCalled();
    });

    it("builds contextHoldings with sector/industry/beta for priced positions", async () => {
        simulationService.loadOwnedPortfolio.mockResolvedValue({ _id: "p1" });
        simulationService.getSyntheticPortfolio.mockResolvedValue({
            holdings: [enrichedHolding("AAPL", 6000), enrichedHolding("MSFT", 4000)],
        });
        Company.find.mockReturnValue(chainableSelectLean([{ ticker: "AAPL", sector: "Technology", industry: "Hardware" }]));
        marketService.getCurrentMarketData.mockImplementation((ticker) =>
            Promise.resolve({ riskMetrics: { beta: ticker === "AAPL" ? 1.3 : null } })
        );

        const context = await simulationScenarioService.loadSyntheticScenarioContext("user1", "p1");

        expect(context.hasHoldings).toBe(true);
        expect(context.currentPortfolioValueUSD).toBe(10000);
        const aapl = context.holdings.find((h) => h.ticker === "AAPL");
        expect(aapl.sector).toBe("Technology");
        expect(aapl.beta).toBe(1.3);
        expect(aapl.weightPercent).toBeCloseTo(60, 5);
    });
});

describe("runSyntheticScenario", () => {
    it("returns an empty response without calling the real scenario engine when there are no priced holdings", async () => {
        simulationService.loadOwnedPortfolio.mockResolvedValue({ _id: "p1" });
        simulationService.getSyntheticPortfolio.mockResolvedValue({ holdings: [] });

        const result = await simulationScenarioService.runSyntheticScenario("user1", "p1", {
            name: "Bear",
            rules: [{ targetType: "PORTFOLIO", shockPercent: -10 }],
            window: "1y",
        });

        expect(result.currentPortfolioValueUSD).toBe(0);
        expect(realScenarioService.runScenarioAgainstContext).not.toHaveBeenCalled();
    });

    it("delegates the actual shock math to the real, unmodified runScenarioAgainstContext", async () => {
        simulationService.loadOwnedPortfolio.mockResolvedValue({ _id: "p1" });
        simulationService.getSyntheticPortfolio.mockResolvedValue({ holdings: [enrichedHolding("AAPL", 10000)] });
        Company.find.mockReturnValue(chainableSelectLean([]));
        marketService.getCurrentMarketData.mockResolvedValue({ riskMetrics: { beta: 1 } });
        simulationAnalyticsService.getSimulationAnalytics.mockResolvedValue({ isEmpty: true });

        const rules = [{ targetType: "PORTFOLIO", shockPercent: -20 }];
        const result = await simulationScenarioService.runSyntheticScenario("user1", "p1", { name: "Bear", rules, window: "1y" });

        expect(realScenarioService.runScenarioAgainstContext).toHaveBeenCalledTimes(1);
        expect(result.scenarioPortfolioValueUSD).toBeCloseTo(8000, 5);
        expect(result.assumptions.methodologyNotes).toContain(realScenarioService.HYPOTHETICAL_DISCLAIMER);
    });

    it("lifts historical context from simulation.analytics.service without recomputing it", async () => {
        simulationService.loadOwnedPortfolio.mockResolvedValue({ _id: "p1" });
        simulationService.getSyntheticPortfolio.mockResolvedValue({ holdings: [enrichedHolding("AAPL", 10000)] });
        Company.find.mockReturnValue(chainableSelectLean([]));
        marketService.getCurrentMarketData.mockResolvedValue({ riskMetrics: { beta: 1 } });
        simulationAnalyticsService.getSimulationAnalytics.mockResolvedValue({
            isEmpty: false,
            window: "1 Year",
            risk: { volatilityPercent: 22, beta: 1.1, maxDrawdown: -15 },
            performance: { benchmark: { ticker: "SPY" } },
        });

        const result = await simulationScenarioService.runSyntheticScenario("user1", "p1", {
            name: "Bear",
            rules: [{ targetType: "PORTFOLIO", shockPercent: -20 }],
            window: "1y",
        });

        expect(result.historicalContext.available).toBe(true);
        expect(result.historicalContext.volatilityPercent).toBe(22);
    });
});

describe("compareSyntheticScenarios", () => {
    it("runs every scenario against the same, once-loaded context", async () => {
        simulationService.loadOwnedPortfolio.mockResolvedValue({ _id: "p1" });
        simulationService.getSyntheticPortfolio.mockResolvedValue({ holdings: [enrichedHolding("AAPL", 10000)] });
        Company.find.mockReturnValue(chainableSelectLean([]));
        marketService.getCurrentMarketData.mockResolvedValue({ riskMetrics: { beta: 1 } });
        simulationAnalyticsService.getSimulationAnalytics.mockResolvedValue({ isEmpty: true });

        const result = await simulationScenarioService.compareSyntheticScenarios("user1", "p1", {
            scenarios: [
                { name: "Bear", rules: [{ targetType: "PORTFOLIO", shockPercent: -20 }] },
                { name: "Bull", rules: [{ targetType: "PORTFOLIO", shockPercent: 20 }] },
            ],
            window: "1y",
        });

        expect(simulationService.getSyntheticPortfolio).toHaveBeenCalledTimes(1);
        expect(result.comparisonTable).toHaveLength(2);
        expect(result.comparisonTable[0].name).toBe("Bear");
    });
});
