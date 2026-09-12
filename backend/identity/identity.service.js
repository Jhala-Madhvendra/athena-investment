const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("./identity.model");

const TOKEN_BYTES = 32;
const BCRYPT_COST_FACTOR = 12;

class EmailAlreadyRegisteredError extends Error {
    constructor() {
        super("An account with that email already exists.");
        this.name = "EmailAlreadyRegisteredError";
        this.statusCode = 409;
    }
}

class InvalidCredentialsError extends Error {
    constructor() {
        super("Invalid email or password.");
        this.name = "InvalidCredentialsError";
        this.statusCode = 401;
    }
}

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const generateToken = () => crypto.randomBytes(TOKEN_BYTES).toString("hex");

/**
 * Mints a new anonymous identity: a random bearer token plus the User record
 * that owns it. The raw token is only ever returned here - everywhere else
 * (including this module) only ever sees/stores its hash.
 */
const issueIdentity = async () => {
    const token = generateToken();
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

/** Backs GET /api/identity/me - lets the frontend know whether the caller is anonymous or a real, signed-up account, and pre-fill the notification preferences form. */
const getIdentity = async (userId) => {
    const user = await User.findById(userId).select("email notificationPreferences").lean();
    return {
        email: user?.email ?? null,
        isAnonymous: !user?.email,
        notificationPreferences: user?.notificationPreferences ?? null,
    };
};

/**
 * Creates or upgrades an account. If `existingUserId` names a genuinely
 * anonymous session (no email set yet), the SAME user document gains
 * credentials in place - same _id, same tokenHash, so every
 * Holding/Transaction/Dividend/Watchlist row already tied to that userId is
 * instantly the new account's data, with no migration. Otherwise (no prior
 * session, or that session already belongs to a signed-up account) a fresh
 * account is minted exactly like issueIdentity(), just with credentials
 * attached from the start.
 */
const signup = async ({ email, password, existingUserId }) => {
    const existingByEmail = await User.findOne({ email }).select("_id").lean();
    if (existingByEmail) {
        throw new EmailAlreadyRegisteredError();
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);

    const existingUser = existingUserId ? await User.findById(existingUserId).select("email").lean() : null;

    if (existingUser && !existingUser.email) {
        await User.findByIdAndUpdate(existingUserId, { email, passwordHash });
        return { userId: existingUserId, email };
    }

    const token = generateToken();
    const user = await User.create({ tokenHash: hashToken(token), email, passwordHash });
    return { userId: user._id.toString(), email, token };
};

/**
 * Re-mints the account's active token on success - this is what makes
 * logging in on a new device retire whatever token was active before
 * (single-active-session-per-account, not a session list; see
 * identity.model.js). Never distinguishes "no such email" from "wrong
 * password," and an anonymous-only account (no passwordHash) can never log
 * in, since anonymity was never given a password to check.
 */
const login = async ({ email, password }) => {
    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
        throw new InvalidCredentialsError();
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
        throw new InvalidCredentialsError();
    }

    const token = generateToken();
    user.tokenHash = hashToken(token);
    await user.save();

    return { userId: user._id.toString(), email: user.email, token };
};

/** Invalidates the caller's current token by overwriting it with a fresh one nobody is ever given - the credentials (email/passwordHash) stay put for the next login. */
const logout = async (userId) => {
    await User.findByIdAndUpdate(userId, { tokenHash: hashToken(generateToken()) });
};

/**
 * Partial update of notificationPreferences - only the fields present in
 * `updates` are touched, so e.g. toggling emailEnabled never clobbers an
 * already-configured slackWebhookUrl. See backend/notifications/ for how
 * these are consumed.
 */
const updatePreferences = async (userId, updates) => {
    const setFields = {};
    Object.entries(updates).forEach(([key, value]) => {
        setFields[`notificationPreferences.${key}`] = value;
    });

    const user = await User.findByIdAndUpdate(userId, { $set: setFields }, { new: true }).select("notificationPreferences").lean();
    return user.notificationPreferences;
};

module.exports = {
    issueIdentity,
    resolveUserIdByToken,
    getIdentity,
    signup,
    login,
    logout,
    updatePreferences,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
};
