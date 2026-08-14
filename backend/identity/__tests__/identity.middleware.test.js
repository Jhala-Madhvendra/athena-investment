jest.mock("../identity.service", () => ({ resolveUserIdByToken: jest.fn() }));

const identityService = require("../identity.service");
const { requireIdentity } = require("../identity.middleware");

const makeRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
};

afterEach(() => {
    jest.clearAllMocks();
});

describe("requireIdentity", () => {
    it("rejects a request with no Authorization header", async () => {
        const req = { get: () => undefined };
        const res = makeRes();
        const next = jest.fn();

        await requireIdentity(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
        expect(identityService.resolveUserIdByToken).not.toHaveBeenCalled();
    });

    it("rejects a malformed (non-Bearer) Authorization header", async () => {
        const req = { get: () => "Basic sometoken" };
        const res = makeRes();
        const next = jest.fn();

        await requireIdentity(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it("rejects an unrecognized token", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue(null);
        const req = { get: () => "Bearer bad-token" };
        const res = makeRes();
        const next = jest.fn();

        await requireIdentity(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it("sets req.userId and calls next for a valid token", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user42");
        const req = { get: () => "Bearer good-token" };
        const res = makeRes();
        const next = jest.fn();

        await requireIdentity(req, res, next);

        expect(req.userId).toBe("user42");
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });
});
