import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';

/**
 * Renders a component that expects both a :ticker route param and the
 * FinancialStatements shell's Outlet context (financialStatements, ticker,
 * currency) - the same context every real tab (Overview, StatementTable,
 * BusinessAnalysis, ...) is rendered under in the actual app.
 */
export function renderWithShellContext(
  element,
  {
    ticker = 'AAPL',
    financialStatements = [],
    currency = 'USD',
    financialStatementsError = '',
    path = 'overview',
  } = {}
) {
  return render(
    <MemoryRouter initialEntries={[`/financials/${ticker}/${path}`]}>
      <Routes>
        <Route
          path="/financials/:ticker"
          element={<Outlet context={{ ticker, financialStatements, currency, financialStatementsError }} />}
        >
          <Route path={path} element={element} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}
