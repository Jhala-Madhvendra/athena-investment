/**
 * Comps Input Mapper
 *
 * The only layer in the Comps domain that knows about Mongoose statement
 * documents, Company documents, and Yahoo-shaped market quotes. Converts
 * them into the flat, plain-object "company bundle" shape comps.engine.js
 * expects for a target or a peer - mirroring dcfInput.mapper.js's role for
 * the DCF domain.
 *
 * Uses only the LATEST reported financial statement (comps is a
 * point-in-time relative valuation - unlike DCF, there's no multi-year
 * forecast to build). `fiscalYear` and `marketDataAsOf` are carried
 * through so the API/UI can show the financial-statement period
 * separately from the market data timestamp (see DATA FRESHNESS in the
 * Sprint 7 brief) - the two are very often not the same date.
 */

/**
 * @param {object} params
 * @param {string} params.ticker
 * @param {object|null} params.company - Company document (name, sector, industry, etc.)
 * @param {object|null} params.latestStatement - most recent FinancialStatement document
 * @param {object|null} params.quote - live market quote from market.service.getCurrentMarketData
 * @returns {object} flat bundle: {ticker, name, currency, price, marketCap, revenue, netIncome, bookValue,
 *   ebitdaInputs: {operatingIncome, depreciationAndAmortization}, debt, cash, dilutedShares,
 *   fiscalYear, marketDataAsOf}
 */
const buildCompanyBundle = ({ ticker, company, latestStatement, quote }) => ({
    ticker,
    name: company?.name ?? null,
    sector: company?.sector ?? null,
    industry: company?.industry ?? null,
    // The live quote's currency (matches the live price/marketCap above) takes priority over the stored Company record's, same fallback order as price/marketCap themselves.
    currency: quote?.currency ?? company?.currency ?? null,
    price: quote?.price?.current ?? null,
    marketCap: quote?.price?.marketCap ?? null,
    revenue: latestStatement?.incomeStatement?.totalRevenue ?? null,
    netIncome: latestStatement?.incomeStatement?.netIncome ?? null,
    bookValue: latestStatement?.balanceSheet?.totalStockholderEquity ?? null,
    ebitdaInputs: {
        operatingIncome: latestStatement?.incomeStatement?.operatingIncome ?? null,
        depreciationAndAmortization: latestStatement?.cashFlow?.depreciationAndAmortization ?? null,
    },
    debt: latestStatement?.balanceSheet?.totalDebt ?? null,
    cash: latestStatement?.balanceSheet?.cashAndCashEquivalents ?? null,
    dilutedShares: latestStatement?.incomeStatement?.dilutedSharesOutstanding ?? null,
    fiscalYear: latestStatement?.year ?? null,
    marketDataAsOf: quote?.asOf ?? null,
});

module.exports = { buildCompanyBundle };
