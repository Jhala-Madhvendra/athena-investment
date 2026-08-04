const mongoose = require("mongoose");

const financialsSchema = new mongoose.Schema(
    {
        fiscalYear: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },
        revenue: {
            type: Number,
            required: true,
        },
        netIncome: {
            type: Number,
            required: true,
        },
        eps: {
            type: Number,
            required: true,
        },
    },
    { _id: false }
);

const companySchema = new mongoose.Schema(
    {
        ticker: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
            match: /^[A-Z0-9.-]+$/,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        exchange: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },
        sector: {
            type: String,
            trim: true,
        },
        industry: {
            type: String,
            trim: true,
        },
        country: {
            type: String,
            trim: true,
        },
        currency: {
            type: String,
            trim: true,
            uppercase: true,
        },
        website: {
            type: String,
            trim: true,
        },
        marketCap: {
            type: Number,
        },
        employees: {
            type: Number,
            min: 0,
        },
        description: {
            type: String,
            trim: true,
        },
        logo: {
            type: String,
            trim: true,
        },
        financials: financialsSchema,
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Company", companySchema);
