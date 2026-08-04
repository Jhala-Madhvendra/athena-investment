const FinancialStatementsProvider = require("./financialStatementsProvider");

class YahooFinanceProvider extends FinancialStatementsProvider {
    async getAnnualFinancialStatements(ticker) {
        const normalizedTicker = ticker.trim().toUpperCase();
        const { cookie, crumb } = await this.getAuthentication();
        const url = new URL(
            `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(normalizedTicker)}`
        );

        url.searchParams.set("symbol", normalizedTicker);
        url.searchParams.set("type", annualStatementTypes.join(","));
        url.searchParams.set("period1", "493590046");
        url.searchParams.set("period2", String(Math.floor(Date.now() / 1000)));
        url.searchParams.set("crumb", crumb);

        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 AthenaFinance/1.0",
                Accept: "application/json",
                Cookie: cookie,
            },
        });

        if (!response.ok) {
            throw new Error(
                `Yahoo Finance request failed for ${normalizedTicker} with status ${response.status}.`
            );
        }

        const yahooResponse = await response.json();

        if (yahooResponse.timeseries?.error) {
            throw new Error(
                yahooResponse.timeseries.error.description ||
                    `Yahoo Finance could not find ${normalizedTicker}.`
            );
        }

        if (!yahooResponse.timeseries?.result?.length) {
            throw new Error(`Yahoo Finance returned no financial statements for ${normalizedTicker}.`);
        }

        return yahooResponse;
    }

    async getAuthentication() {
        const headers = {
            "User-Agent": "Mozilla/5.0 AthenaFinance/1.0",
        };
        const cookieResponse = await fetch("https://fc.yahoo.com", {
            headers,
            redirect: "manual",
        });
        const rawCookie = cookieResponse.headers.getSetCookie
            ? cookieResponse.headers.getSetCookie()[0]
            : cookieResponse.headers.get("set-cookie");
        const cookie = rawCookie?.split(";")[0];

        if (!cookie) {
            throw new Error("Yahoo Finance authentication cookie could not be retrieved.");
        }

        const crumbResponse = await fetch(
            "https://query1.finance.yahoo.com/v1/test/getcrumb",
            { headers: { ...headers, Cookie: cookie } }
        );

        if (!crumbResponse.ok) {
            throw new Error("Yahoo Finance authentication crumb could not be retrieved.");
        }

        const crumb = await crumbResponse.text();

        if (!crumb) {
            throw new Error("Yahoo Finance returned an empty authentication crumb.");
        }

        return { cookie, crumb };
    }
}

const annualStatementTypes = [
    "annualTotalRevenue",
    "annualCostOfRevenue",
    "annualGrossProfit",
    "annualOperatingExpense",
    "annualOperatingIncome",
    "annualPretaxIncome",
    "annualTaxProvision",
    "annualNetIncome",
    "annualBasicEPS",
    "annualDilutedEPS",
    "annualCashCashEquivalentsAndShortTermInvestments",
    "annualTotalAssets",
    "annualTotalLiabilitiesNetMinorityInterest",
    "annualTotalDebt",
    "annualStockholdersEquity",
    "annualTotalCurrentAssets",
    "annualTotalCurrentLiabilities",
    "annualAccountsReceivable",
    "annualOperatingCashFlow",
    "annualCapitalExpenditure",
    "annualInvestingCashFlow",
    "annualFinancingCashFlow",
    "annualFreeCashFlow",
];

module.exports = YahooFinanceProvider;
