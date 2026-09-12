jest.mock("../../identity/identity.model", () => ({ find: jest.fn() }));
jest.mock("../../ai/portfolioDigest.service", () => ({
    getOrGenerateDigest: jest.fn(),
    NoHoldingsError: class NoHoldingsError extends Error {
        constructor() {
            super("No portfolio holdings to summarize yet.");
            this.name = "NoHoldingsError";
        }
    },
}));
jest.mock("../../notifications/notification.service", () => ({ sendToUser: jest.fn() }));

const User = require("../../identity/identity.model");
const portfolioDigestService = require("../../ai/portfolioDigest.service");
const notificationService = require("../../notifications/notification.service");
const { runPortfolioDigestsForAllUsers } = require("../portfolioDigestJob");

const chainableLean = (docs) => ({ lean: jest.fn(() => Promise.resolve(docs)) });

afterEach(() => {
    jest.clearAllMocks();
});

describe("runPortfolioDigestsForAllUsers", () => {
    it("queries only users who opted into digestEnabled", async () => {
        User.find.mockReturnValue(chainableLean([]));

        await runPortfolioDigestsForAllUsers();

        expect(User.find).toHaveBeenCalledWith({ "notificationPreferences.digestEnabled": true });
    });

    it("generates (or reuses) a digest per opted-in user and delivers it", async () => {
        User.find.mockReturnValue(chainableLean([{ _id: "u1" }]));
        portfolioDigestService.getOrGenerateDigest.mockResolvedValue({ narrative: "Your portfolio was up this week." });
        notificationService.sendToUser.mockResolvedValue([]);

        const result = await runPortfolioDigestsForAllUsers();

        expect(portfolioDigestService.getOrGenerateDigest).toHaveBeenCalledWith("u1");
        expect(notificationService.sendToUser).toHaveBeenCalledWith(
            { _id: "u1" },
            expect.objectContaining({ message: "Your portfolio was up this week." })
        );
        expect(result).toEqual({ usersChecked: 1, digestsSent: 1 });
    });

    it("skips a user with no holdings without logging it as a failure, and keeps going", async () => {
        User.find.mockReturnValue(chainableLean([{ _id: "u1" }, { _id: "u2" }]));
        portfolioDigestService.getOrGenerateDigest
            .mockRejectedValueOnce(new portfolioDigestService.NoHoldingsError())
            .mockResolvedValueOnce({ narrative: "ok" });
        notificationService.sendToUser.mockResolvedValue([]);

        const result = await runPortfolioDigestsForAllUsers();

        expect(result).toEqual({ usersChecked: 2, digestsSent: 1 });
    });

    it("does not let one user's unexpected failure block the rest", async () => {
        User.find.mockReturnValue(chainableLean([{ _id: "u1" }, { _id: "u2" }]));
        portfolioDigestService.getOrGenerateDigest
            .mockRejectedValueOnce(new Error("LLM provider down"))
            .mockResolvedValueOnce({ narrative: "ok" });
        notificationService.sendToUser.mockResolvedValue([]);

        const result = await runPortfolioDigestsForAllUsers();

        expect(result).toEqual({ usersChecked: 2, digestsSent: 1 });
    });
});
