jest.mock("../alert.model", () => ({
    find: jest.fn(),
    countDocuments: jest.fn(),
    findOneAndUpdate: jest.fn(),
    aggregate: jest.fn(),
}));

const mongoose = require("mongoose");
const Alert = require("../alert.model");
const repository = require("../alert.repository");

afterEach(() => {
    jest.clearAllMocks();
});

describe("findAlerts", () => {
    const chainableFind = (docs) => ({
        sort: jest.fn(() => ({ skip: jest.fn(() => ({ limit: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })) })) })),
    });

    it("always excludes dismissed alerts, even when no other filters are given", async () => {
        Alert.find.mockReturnValue(chainableFind([]));
        Alert.countDocuments.mockResolvedValue(0);

        await repository.findAlerts("user1", { page: 1, limit: 20 });

        expect(Alert.find).toHaveBeenCalledWith({ userId: "user1", isDismissed: false });
        expect(Alert.countDocuments).toHaveBeenCalledWith({ userId: "user1", isDismissed: false });
    });

    it("adds type/severity/ticker filters and translates unread into isRead", async () => {
        Alert.find.mockReturnValue(chainableFind([]));
        Alert.countDocuments.mockResolvedValue(0);

        await repository.findAlerts("user1", { page: 1, limit: 20, type: "MARKET", severity: "HIGH", ticker: "AAPL", unread: true });

        expect(Alert.find).toHaveBeenCalledWith({
            userId: "user1",
            isDismissed: false,
            type: "MARKET",
            severity: "HIGH",
            ticker: "AAPL",
            isRead: false,
        });
    });

    it("computes skip from page and limit", async () => {
        const findChain = chainableFind([]);
        Alert.find.mockReturnValue(findChain);
        Alert.countDocuments.mockResolvedValue(0);

        await repository.findAlerts("user1", { page: 3, limit: 10 });

        const sortChain = findChain.sort.mock.results[0].value;
        expect(sortChain.skip).toHaveBeenCalledWith(20); // (page 3 - 1) * limit 10
    });
});

describe("markRead / dismiss", () => {
    it("markRead scopes the update to {_id, userId} together", async () => {
        Alert.findOneAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: "a1", isRead: true }) });

        const result = await repository.markRead("user1", "a1");

        expect(Alert.findOneAndUpdate).toHaveBeenCalledWith({ _id: "a1", userId: "user1" }, { isRead: true }, { new: true });
        expect(result.isRead).toBe(true);
    });

    it("markRead returns null when nothing matched (not this user's alert)", async () => {
        Alert.findOneAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

        expect(await repository.markRead("user1", "a1")).toBeNull();
    });

    it("dismiss scopes the update to {_id, userId} together", async () => {
        Alert.findOneAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: "a1", isDismissed: true }) });

        await repository.dismiss("user1", "a1");

        expect(Alert.findOneAndUpdate).toHaveBeenCalledWith({ _id: "a1", userId: "user1" }, { isDismissed: true }, { new: true });
    });
});

describe("countUnread", () => {
    it("counts only unread, undismissed alerts for this user", async () => {
        Alert.countDocuments.mockResolvedValue(5);

        const count = await repository.countUnread("user1");

        expect(Alert.countDocuments).toHaveBeenCalledWith({ userId: "user1", isRead: false, isDismissed: false });
        expect(count).toBe(5);
    });
});

describe("countByTicker", () => {
    it("returns an empty map without querying when no tickers are given", async () => {
        const result = await repository.countByTicker("user1", []);

        expect(result).toEqual(new Map());
        expect(Alert.aggregate).not.toHaveBeenCalled();
    });

    it("casts userId to an ObjectId for the aggregate $match stage", async () => {
        Alert.aggregate.mockResolvedValue([{ _id: "AAPL", count: 3 }]);
        const userId = "507f1f77bcf86cd799439011";

        const result = await repository.countByTicker(userId, ["AAPL", "MSFT"]);

        const pipeline = Alert.aggregate.mock.calls[0][0];
        expect(pipeline[0].$match.userId).toBeInstanceOf(mongoose.Types.ObjectId);
        expect(pipeline[0].$match.userId.toString()).toBe(userId);
        expect(result.get("AAPL")).toBe(3);
        expect(result.has("MSFT")).toBe(false); // sparse - untracked/zero-alert tickers simply absent
    });
});
