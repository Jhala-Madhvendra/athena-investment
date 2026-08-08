import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import StatementTable from '../StatementTable';
import { renderWithShellContext } from '../../test/renderWithRouter';
import { financialStatementsFixture } from '../../test/fixtures';

describe('StatementTable', () => {
  it('renders the statement table when financial statements are present', () => {
    renderWithShellContext(<StatementTable statementKey="incomeStatement" />, {
      financialStatements: financialStatementsFixture,
      path: 'financial-statements/income-statement',
    });

    expect(screen.getByText('Income Statement')).toBeInTheDocument();
    expect(screen.getByText('FY 2025')).toBeInTheDocument();
  });

  it('shows its own empty state instead of crashing when there are no financial statements yet', () => {
    // Regression test for the Sprint 5 shell-gating fix: a company with a
    // profile but zero imported statements must still be able to reach this
    // tab (previously the parent shell blocked the Outlet entirely).
    renderWithShellContext(<StatementTable statementKey="incomeStatement" />, {
      financialStatements: [],
      ticker: 'ZZZZ',
      path: 'financial-statements/income-statement',
    });

    expect(screen.getByText('No data yet')).toBeInTheDocument();
    expect(screen.getByText(/ZZZZ/)).toBeInTheDocument();
  });

  it('shows an error state (not the empty state) when the statements fetch itself failed', () => {
    // Regression test: a ticker like an ETF where /api/financials returns a
    // hard error (not just an empty array, e.g. a 422 "no statements
    // available") must surface that error here specifically, without
    // blocking the parent shell from rendering other tabs.
    renderWithShellContext(<StatementTable statementKey="incomeStatement" />, {
      financialStatements: [],
      financialStatementsError: 'No annual financial statements were returned by the financial data provider.',
      ticker: 'SPY',
      path: 'financial-statements/income-statement',
    });

    expect(screen.getByText("Couldn't load financial statements")).toBeInTheDocument();
    expect(screen.getByText(/No annual financial statements were returned/)).toBeInTheDocument();
    expect(screen.queryByText('No data yet')).not.toBeInTheDocument();
  });
});
