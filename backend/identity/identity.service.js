const crypto = require("crypto");
const User = require("./identity.model");

const TOKEN_BYTES = 32;

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

/**
 * Mints a new anonymous identity: a random bearer token plus the User record
 * that owns it. The raw token is only ever returned here - everywhere else
 * (including this module) only ever sees/stores its hash.
 */
const issueIdentity = async () => {
    const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
    const user = await User.create({ tokenHash: hashToken(token) });

    return { token, userId: user._id.toString() };
};

/**
 * Resolves a bearer token to a userId, or null if the token is missing/unknown.
 * This is the only path by which a request's identity is established - callers
 * must never accept a userId supplied directly by the client.
 */
const resolveUserIdByToken = async (token) => {
    if (typeof token !== "string" || token.trim().length === 0) {
        return null;
    }

    const user = await User.findOne({ tokenHash: hashToken(token.trim()) }).select("_id").lean();

    return user ? user._id.toString() : null;
};

module.exports = { issueIdentity, resolveUserIdByToken };
