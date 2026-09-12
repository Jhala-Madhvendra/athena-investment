jest.mock("../aiReportUsage.model", () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));

const AiReportUsage = require("../aiReportUsage.model");
const aiQuotaService = require("../aiQuota.service");
const env = require("../../config/env");

const selectLean = (result) => ({ select: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(result)) })) });

afterEach(() => {
    jest.clearAllMocks();
});

describe("getUsage", () => {
    it("reports 0 used when no usage document exists yet this period", async () => {
        AiReportUsage.findOne.mockReturnValue(selectLean(null));

        const result = await aiQuotaService.getUsage("user1");

        expect(result.used).toBe(0);
        expect(result.limit).toBe(env.aiReportMonthlyQuota);
        expect(result.remaining).toBe(env.aiReportMonthlyQuota);
        expect(result.periodKey).toBe(aiQuotaService.getPeriodKey());
    });

    it("reports the stored count and remaining", async () => {
        AiReportUsage.findOne.mockReturnValue(selectLean({ count: 2 }));

        const result = await aiQuotaService.getUsage("user1");

        expect(result.used).toBe(2);
        expect(result.remaining).toBe(env.aiReportMonthlyQuota - 2);
    });

    it("never reports negative remaining even if usage somehow exceeds the limit", async () => {
        AiReportUsage.findOne.mockReturnValue(selectLean({ count: env.aiReportMonthlyQuota + 3 }));

        const result = await aiQuotaService.getUsage("user1");

        expect(result.remaining).toBe(0);
    });
});

describe("consumeIfAvailable", () => {
    it("ensures the period document exists, then increments and allows when under the cap", async () => {
        AiReportUsage.findOneAndUpdate
            .mockResolvedValueOnce({}) // step 1: ensure-exists upsert
            .mockResolvedValueOnce({ count: 1 }); // step 2: conditional increment

        const result = await aiQuotaService.consumeIfAvailable("user1");

        expect(result).toEqual({ allowed: true, used: 1, limit: env.aiReportMonthlyQuota });
        expect(AiReportUsage.findOneAndUpdate).toHaveBeenNthCalledWith(
            2,
            { userId: "user1", periodKey: aiQuotaService.getPeriodKey(), count: { $lt: env.aiReportMonthlyQuota } },
            { $inc: { count: 1 } },
            { new: true }
        );
    });

    it("denies without incrementing when already at the cap", async () => {
        AiReportUsage.findOneAndUpdate
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce(null); // conditional increment matched nothing - at cap

        const result = await aiQuotaService.consumeIfAvailable("user1");

        expect(result).toEqual({ allowed: false, used: env.aiReportMonthlyQuota, limit: env.aiReportMonthlyQuota });
    });

    it("swallows a duplicate-key race on the ensure-exists step and still proceeds to the conditional increment", async () => {
        const duplicateKeyError = Object.assign(new Error("duplicate key"), { code: 11000 });
        AiReportUsage.findOneAndUpdate.mockRejectedValueOnce(duplicateKeyError).mockResolvedValueOnce({ count: 1 });

        const result = await aiQuotaService.consumeIfAvailable("user1");

        expect(result.allowed).toBe(true);
    });

    it("re-throws a non-duplicate-key error from the ensure-exists step", async () => {
        AiReportUsage.findOneAndUpdate.mockRejectedValueOnce(new Error("connection lost"));

        await expect(aiQuotaService.consumeIfAvailable("user1")).rejects.toThrow("connection lost");
    });
});
