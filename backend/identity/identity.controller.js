const identityService = require("./identity.service");

const createIdentity = async (req, res, next) => {
    try {
        const { token, userId } = await identityService.issueIdentity();

        return res.status(201).json({ token, userId });
    } catch (error) {
        return next(error);
    }
};

module.exports = { createIdentity };
