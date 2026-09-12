const identityService = require("./identity.service");
const { validateSignupInput, validateLoginInput, validatePreferencesInput } = require("./identity.validator");
const { BEARER_PATTERN } = require("./identity.middleware");
const { sendServiceError } = require("../utils/httpErrors");

const createIdentity = async (req, res, next) => {
    try {
        const { token, userId } = await identityService.issueIdentity();

        return res.status(201).json({ token, userId });
    } catch (error) {
        return next(error);
    }
};

/** Not requireIdentity-gated - a brand-new visitor has no token yet. If one IS present, it's used to resolve an existing anonymous session to upgrade in place; a missing/invalid header just means "no session to upgrade," never a hard failure. */
const signup = async (req, res) => {
    const validation = validateSignupInput(req.body || {});
    if (!validation.isValid) {
        return res.status(400).json({ message: "Invalid request.", errors: validation.errors });
    }

    try {
        const header = req.get("authorization") || "";
        const match = header.match(BEARER_PATTERN);
        const existingUserId = match ? await identityService.resolveUserIdByToken(match[1]) : null;

        const result = await identityService.signup({ ...validation.normalized, existingUserId });
        return res.status(201).json(result);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const login = async (req, res) => {
    const validation = validateLoginInput(req.body || {});
    if (!validation.isValid) {
        return res.status(400).json({ message: "Invalid request.", errors: validation.errors });
    }

    try {
        const result = await identityService.login(validation.normalized);
        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const logout = async (req, res) => {
    try {
        await identityService.logout(req.userId);
        return res.status(200).json({ message: "Logged out." });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const me = async (req, res) => {
    try {
        const identity = await identityService.getIdentity(req.userId);
        return res.status(200).json(identity);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const updatePreferences = async (req, res) => {
    const validation = validatePreferencesInput(req.body || {});
    if (!validation.isValid) {
        return res.status(400).json({ message: "Invalid request.", errors: validation.errors });
    }

    try {
        const notificationPreferences = await identityService.updatePreferences(req.userId, validation.normalized);
        return res.status(200).json({ notificationPreferences });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

module.exports = { createIdentity, signup, login, logout, me, updatePreferences };
