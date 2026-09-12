const mongoose = require("mongoose");
const portfolioAccountService = require("./portfolioAccount.service");
const { sendServiceError } = require("../utils/httpErrors");

const isValidObjectId = (id) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

const list = async (req, res) => {
    try {
        const accounts = await portfolioAccountService.listAccounts(req.userId);
        return res.status(200).json({ accounts });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const create = async (req, res) => {
    try {
        const account = await portfolioAccountService.createAccount(req.userId, { name: req.body?.name });
        return res.status(201).json({ account });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const rename = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "A valid account id is required." });
        }

        const account = await portfolioAccountService.renameAccount(req.userId, id, { name: req.body?.name });
        return res.status(200).json({ account });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const remove = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "A valid account id is required." });
        }

        await portfolioAccountService.deleteAccount(req.userId, id);
        return res.status(200).json({ message: "Portfolio account removed." });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

module.exports = { list, create, rename, remove };
