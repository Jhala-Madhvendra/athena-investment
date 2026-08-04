class FinancialStatementsProvider {
    async getAnnualFinancialStatements(ticker) {
        throw new Error(
            "getAnnualFinancialStatements must be implemented by a financial statements provider."
        );
    }
}

module.exports = FinancialStatementsProvider;
