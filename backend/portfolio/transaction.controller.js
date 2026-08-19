const mongoose = require("mongoose");
const transactionService = require("./transaction.service");
const companyService = require("../services/company.service");
const { resolveTickerParam, sendServiceError } = require("../utils/httpErrors");

const isValidObjectId = (id) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

const addTransaction = async (req, res) => {
    try {
        const query = typeof req.body?.ticker === "string" ? req.body.ticker : "";
        const ticker = await resolveTickerParam(query, companyService);

        const transaction = await transactionService.addTransaction(req.userId, {
            ticker,
            type: req.body?.type,
            quantity: req.body?.quantity,
            price: req.body?.price,
            transactionDate: req.body?.transactionDate,
        });

        return res.status(201).json({ transaction });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const getTransactions = async (req, res) => {
    try {
        const ticker = typeof req.query?.ticker === "string" ? req.query.ticker.trim().toUpperCase() : undefined;
        const transactions = await transactionService.getTransactions(req.userId, { ticker });
        return res.status(200).json({ transactions });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const getTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "A valid transaction id is required." });
        }

        const transaction = await transactionService.getTransaction(req.userId, id);
        return res.status(200).json({ transaction });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const updateTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "A valid transaction id is required." });
        }

        const transaction = await transactionService.updateTransaction(req.userId, id, {
            type: req.body?.type,
            quantity: req.body?.quantity,
            price: req.body?.price,
            transactionDate: req.body?.transactionDate,
        });

        return res.status(200).json({ transaction });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const deleteTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "A valid transaction id is required." });
        }

        await transactionService.deleteTransaction(req.userId, id);

        return res.status(200).json({ message: "Transaction removed." });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

module.exports = { addTransaction, getTransactions, getTransaction, updateTransaction, deleteTransaction };
