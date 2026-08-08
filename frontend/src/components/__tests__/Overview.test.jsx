import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import Overview from '../Overview';
import { renderWithShellContext } from '../../test/renderWithRouter';
import { mockDashboardFetch, errorResponse } from '../../test/fetchMock';
import {
  companyFixture,
  quoteFixture,
  performanceFixture,
  analysisFixture,
  ratiosFixture,
  financialStatementsFixture,
} from '../../test/fixtures';

const fullSuccess = {
  company: companyFixture,
  quote: quoteFixture,
  performance: performanceFixture,
  analysis: analysisFixture,
  ratios: ratiosFixture,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Overview - loading state', () => {
  it('shows loading skeletons before any data resolves', () => {
    mockDashboardFetch({}); // every endpoint hangs
    renderWithShellContext(<Overview />, { financialStatements: financialStatementsFixture });

    // Section titles render immediately (static markup); their content is still loading
    expect(screen.getByText('Financial Health')).toBeInTheDocument();
    expect(screen.getByText('Business Performance')).toBeInTheDocument();
    expect(screen.queryByText('Apple Inc.')).not.toBeInTheDocument();
  });
});

describe('Overview - successful rendering', () => {
  it('renders company header, health score, business performance, market performance, and insights', async () => {
    mockDashboardFetch(fullSuccess);
    renderWithShellContext(<Overview />, { financialStatements: financialStatementsFixture });

    await waitFor(() => expect(screen.getByText('Apple Inc.')).toBeInTheDocument());
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('313.33', { exact: false })).toBeInTheDocument();

    expect(await screen.findByText('48')).toBeInTheDocument(); // health score
    expect(screen.getByText('Weak')).toBeInTheDocument();
    expect(screen.getByText('1.81%')).toBeInTheDocument(); // Revenue CAGR

    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('Debt')).toBeInTheDocument();

    expect(await screen.findByText('+36.62%')).toBeInTheDocument(); // 1Y return
    expect(screen.getByText('35.97')).toBeInTheDocument(); // P/E

    expect(screen.getByText('Profit Margin')).toBeInTheDocument(); // insight category badge
  });

  it('appends a market-derived observation to Key Insights when the stock is near its 52-week high', async () => {
    mockDashboardFetch(fullSuccess);
    renderWithShellContext(<Overview />, { financialStatements: financialStatementsFixture });

    expect(await screen.findByText(/moved up/i)).toBeInTheDocument();
    expect(screen.getByText('Market Position')).toBeInTheDocument();
  });
});

describe('Overview - missing/partial data', () => {
  it('shows an error state for the header when company data fails, without blocking the rest of the page', async () => {
    mockDashboardFetch({
      ...fullSuccess,
      company: errorResponse(404, 'Company not found.'),
    });
    renderWithShellContext(<Overview />, { financialStatements: financialStatementsFixture });

    expect(await screen.findByText("Couldn't load company profile")).toBeInTheDocument();
    // Other sections still render successfully
    expect(await screen.findByText('48')).toBeInTheDocument();
  });

  it('degrades Financial Health gracefully when ratios are unavailable (health score still shows)', async () => {
    mockDashboardFetch({
      ...fullSuccess,
      ratios: errorResponse(500, 'Ratio service unavailable.'),
    });
    renderWithShellContext(<Overview />, { financialStatements: financialStatementsFixture });

    expect(await screen.findByText('48')).toBeInTheDocument(); // health score unaffected
    await waitFor(() => {
      // ROE card falls back to em dash instead of crashing or showing stale data
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });
  });

  it('shows "Price unavailable" in the header and an error in Market Performance when market data fails', async () => {
    mockDashboardFetch({
      ...fullSuccess,
      quote: errorResponse(502, 'Yahoo Finance request failed.'),
      performance: errorResponse(502, 'Yahoo Finance request failed.'),
    });
    renderWithShellContext(<Overview />, { financialStatements: financialStatementsFixture });

    await waitFor(() => expect(screen.getByText('Apple Inc.')).toBeInTheDocument());
    expect(await screen.findByText('Price unavailable')).toBeInTheDocument();
    expect(await screen.findByText("Couldn't load market performance")).toBeInTheDocument();
  });

  it('does not crash when every endpoint fails (total API failure)', async () => {
    const fail = errorResponse(500, 'Internal Server Error');
    mockDashboardFetch({ company: fail, quote: fail, performance: fail, analysis: fail, ratios: fail });
    renderWithShellContext(<Overview />, { financialStatements: financialStatementsFixture });

    expect(await screen.findByText("Couldn't load company profile")).toBeInTheDocument();
    expect(await screen.findByText("Couldn't load financial health")).toBeInTheDocument();
    expect(await screen.findByText("Couldn't load insights")).toBeInTheDocument();
    // Page shell (section titles) still renders - no uncaught exception
    expect(screen.getByText('Business Performance')).toBeInTheDocument();
  });

  it('shows an empty state when analysis succeeds but produces no insights and there is no notable market movement', async () => {
    mockDashboardFetch({
      ...fullSuccess,
      analysis: { ...analysisFixture, insights: [] },
      performance: { performance: { '1M': 0, '3M': 0, '6M': 0, '1Y': 1, '5Y': 2 } },
      quote: { ...quoteFixture, price: { ...quoteFixture.price, current: 280 } }, // mid-range, not near 52wk high/low
    });
    renderWithShellContext(<Overview />, { financialStatements: financialStatementsFixture });

    expect(await screen.findByText('No notable insights')).toBeInTheDocument();
  });
});

describe('Overview - navigation', () => {
  it('renders drill-down links to every detail tab', async () => {
    mockDashboardFetch(fullSuccess);
    renderWithShellContext(<Overview />, { financialStatements: financialStatementsFixture });

    await waitFor(() => expect(screen.getByText('Apple Inc.')).toBeInTheDocument());

    expect(screen.getByRole('link', { name: /Financial Statements/ })).toHaveAttribute(
      'href',
      '/financials/AAPL/financial-statements'
    );
    expect(screen.getByRole('link', { name: /Financial Analysis/ })).toHaveAttribute(
      'href',
      '/financials/AAPL/financial-analysis'
    );
    expect(screen.getByRole('link', { name: /Business Analysis/ })).toHaveAttribute(
      'href',
      '/financials/AAPL/business-analysis/overview'
    );
    expect(screen.getByRole('link', { name: /Market Intelligence/ })).toHaveAttribute(
      'href',
      '/financials/AAPL/market-intelligence'
    );
    expect(screen.getByRole('link', { name: /View full breakdown/ })).toHaveAttribute(
      'href',
      '/financials/AAPL/business-analysis/overview'
    );
  });
});
