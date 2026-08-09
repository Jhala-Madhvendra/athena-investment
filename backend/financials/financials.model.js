const mongoose = require("mongoose");

const incomeStatementSchema = new mongoose.Schema(
    {
        totalRevenue: Number,
        costOfRevenue: Number,
        grossProfit: Number,
        totalOperatingExpenses: Number,
        operatingIncome: Number,
        pretaxIncome: Number,
        taxProvision: Number,
        netIncome: Number,
        basicEPS: Number,
        dilutedEPS: Number,
        dilutedSharesOutstanding: Number,
    },
    { _id: false }
);

const balanceSheetSchema = new mongoose.Schema(
    {
        cashAndCashEquivalents: Number,
        totalAssets: Number,
        totalLiabilities: Number,
        totalDebt: Number,
        totalStockholderEquity: Number,
        currentAssets: Number,
        currentLiabilities: Number,
        accountsReceivable: Number,
    },
    { _id: false }
);

const cashFlowSchema = new mongoose.Schema(
    {
        operatingCashFlow: Number,
        capitalExpenditure: Number,
        investingCashFlow: Number,
        financingCashFlow: Number,
        freeCashFlow: Number,
        depreciationAndAmortization: Number,
    },
    { _id: false }
);

const financialStatementSchema = new mongoose.Schema(
    {
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
            index: true,
        },
        ticker: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            match: /^[A-Z0-9.-]+$/,
        },
        year: {
            type: Number,
            required: true,
            min: 1900,
        },
        incomeStatement: {
            type: incomeStatementSchema,
            required: true,
        },
        balanceSheet: {
            type: balanceSheetSchema,
            required: true,
        },
        cashFlow: {
            type: cashFlowSchema,
            required: true,
        },
        source: {
            type: String,
            required: true,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

financialStatementSchema.index({ ticker: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("FinancialStatement", financialStatementSchema);
