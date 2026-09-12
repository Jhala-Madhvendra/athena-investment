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
            portfolioId: isValidObjectId(req.body?.portfolioId) ? req.body.portfolioId : undefined,
        });

        return res.status(201).json({ transaction });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const MAX_IMPORT_ROWS = 500;

/**
 * POST /import - bulk-creates transactions from a client-parsed CSV (see
 * frontend/src/lib/csvImport.js). Reuses transactionService.addTransaction
 * per row - no new validation or negative-holdings logic, just repeated
 * calls to the same path a single manual entry already goes through.
 * Rows are replayed in chronological order (not file order) since
 * addTransaction's negative-holdings check depends on the ledger state left
 * by prior inserts - a SELL that's chronologically valid but appears before
 * its BUY in the file would otherwise be rejected. Results are reported
 * back in the file's original order so the frontend preview table and the
 * response line up row-for-row.
 */
const importTransactions = async (req, res) => {
    const rows = Array.isArray(req.body?.transactions) ? req.body.transactions : null;
    if (!rows || rows.length === 0) {
        return res.status(400).json({ message: "At least one transaction row is required." });
    }
    if (rows.length > MAX_IMPORT_ROWS) {
        return res.status(400).json({ message: `At most ${MAX_IMPORT_ROWS} transactions can be imported at once.` });
    }

    const portfolioId = isValidObjectId(req.body?.portfolioId) ? req.body.portfolioId : undefined;

    const indexed = rows.map((row, originalIndex) => ({ ...row, originalIndex }));
    const sorted = [...indexed].sort((a, b) => new Date(a.transactionDate) - new Date(b.transactionDate));

    const results = [];
    for (const row of sorted) {
        try {
            const ticker = await resolveTickerParam(typeof row.ticker === "string" ? row.ticker : "", companyService);
            const transaction = await transactionService.addTransaction(req.userId, {
                ticker,
                type: row.type,
                quantity: row.quantity,
                price: row.price,
                transactionDate: row.transactionDate,
                portfolioId,
            });
            results.push({ originalIndex: row.originalIndex, success: true, transaction });
        } catch (error) {
            results.push({ originalIndex: row.originalIndex, success: false, message: error.message, errors: error.errors });
        }
    }

    results.sort((a, b) => a.originalIndex - b.originalIndex);
    results.forEach((result) => delete result.originalIndex);
    const imported = results.filter((result) => result.success).length;

    return res.status(200).json({ imported, failed: results.length - imported, results });
};

const getTransactions = async (req, res) => {
    try {
        const ticker = typeof req.query?.ticker === "string" ? req.query.ticker.trim().toUpperCase() : undefined;
        const portfolioId = isValidObjectId(req.query?.portfolioId) ? req.query.portfolioId : undefined;
        const transactions = await transactionService.getTransactions(req.userId, { ticker, portfolioId });
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

module.exports = { addTransaction, importTransactions, getTransactions, getTransaction, updateTransaction, deleteTransaction };
