import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import Valuation from '../Valuation';
import { renderWithShellContext } from '../../test/renderWithRouter';
import { mockValuationFetch, errorResponse } from '../../test/fetchMock';
import { defaultsFixture, dcfResultFixture, scenariosFixture, sensitivityFixture } from '../../test/valuationFixtures';

const fullSuccess = {
  defaults: defaultsFixture,
  dcf: dcfResultFixture,
  scenarios: scenariosFixture,
  sensitivity: sensitivityFixture,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Valuation - loading and error states', () => {
  it('shows a loading skeleton before defaults resolve', () => {
    mockValuationFetch({}); // defaults hangs
    renderWithShellContext(<Valuation />, { path: 'valuation' });

    expect(screen.queryByText('DCF Valuation')).not.toBeInTheDocument();
  });

  it('shows an error state when defaults fail to load (e.g. no financial statements imported)', async () => {
    mockValuationFetch({ defaults: errorResponse(404, 'No financial statements are available for AAPL.') });
    renderWithShellContext(<Valuation />, { path: 'valuation' });

    expect(await screen.findByText("Couldn't load valuation data")).toBeInTheDocument();
    expect(screen.getByText(/No financial statements are available/)).toBeInTheDocument();
  });
});

describe('Valuation - defaults rendering', () => {
  it('renders Historical Financials and pre-fills the assumptions form with labeled values', async () => {
    mockValuationFetch(fullSuccess);
    renderWithShellContext(<Valuation />, { path: 'valuation' });

    expect(await screen.findByText('DCF Valuation')).toBeInTheDocument();
    expect(screen.getByText('FY 2025')).toBeInTheDocument();

    // Pre-filled from defaults: 0.05 -> 5 (whole percent display)
    expect(screen.getByLabelText('Revenue Growth')).toHaveValue(5);
    expect(screen.getByLabelText('EBIT Margin')).toHaveValue(20);
    // Beta is not a percent field
    expect(screen.getByLabelText('Beta')).toHaveValue(1.1);
    // preTaxCostOfDebt has no default - field starts empty
    expect(screen.getByLabelText('Pre-Tax Cost of Debt')).toHaveValue(null);

    // Source labeling: at least one of each tier is visibly distinguished
    // (risk-free rate, beta, and market value of equity are all "market" -> multiple badges expected)
    expect(screen.getAllByText('Live Market Data').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Illustrative — Not Live Data').length).toBeGreaterThan(0); // ERP / terminal growth
    expect(screen.getByText('Enter a Value')).toBeInTheDocument(); // pre-tax cost of debt
  });
});

describe('Valuation - form validation', () => {
  it('blocks submission and shows inline errors when a required field (e.g. pre-tax cost of debt) is empty, without calling the calculation endpoints', async () => {
    mockValuationFetch(fullSuccess);
    renderWithShellContext(<Valuation />, { path: 'valuation' });

    await screen.findByText('DCF Valuation');
    fireEvent.click(screen.getByRole('button', { name: /Calculate DCF Valuation/i }));

    expect(await screen.findByText(/Pre-Tax Cost of Debt is required/i)).toBeInTheDocument();
    // Only the defaults GET should have fired - no POSTs
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('Valuation - full calculation', () => {
  const fillRequiredFieldAndSubmit = async () => {
    await screen.findByText('DCF Valuation');
    fireEvent.change(screen.getByLabelText('Pre-Tax Cost of Debt'), { target: { value: '4.5' } });
    fireEvent.click(screen.getByRole('button', { name: /Calculate DCF Valuation/i }));
  };

  it('renders WACC, FCFF Forecast, DCF Calculation, Market Price Comparison, Scenarios, and Sensitivity on success', async () => {
    mockValuationFetch(fullSuccess);
    renderWithShellContext(<Valuation />, { path: 'valuation' });

    await fillRequiredFieldAndSubmit();

    // "WACC" also appears as the WACC StatCard's own label inside the section -
    // target the Card's section heading specifically to avoid ambiguity.
    expect(await screen.findByRole('heading', { name: 'WACC' })).toBeInTheDocument();
    expect(screen.getByText('FCFF Forecast')).toBeInTheDocument();
    expect(screen.getByText('DCF Calculation')).toBeInTheDocument();
    expect(screen.getByText('Intrinsic Value Per Share')).toBeInTheDocument();
    // "19.97" legitimately appears twice: the main DCF result and the Base
    // Case scenario card (Base applies a zero delta, so they should match).
    expect(screen.getAllByText('19.97').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Market Price Comparison')).toBeInTheDocument();
    expect(screen.getByText(/highly sensitive to assumptions/i)).toBeInTheDocument();
    expect(screen.getByText('Bull / Base / Bear Scenarios')).toBeInTheDocument();
    expect(screen.getByText('Bear Case')).toBeInTheDocument();
    expect(screen.getByText('Bull Case')).toBeInTheDocument();
    expect(screen.getByText('Sensitivity Analysis')).toBeInTheDocument();
  });

  it('never renders a Buy/Sell/Strong Buy/Strong Sell recommendation anywhere on the page', async () => {
    mockValuationFetch(fullSuccess);
    renderWithShellContext(<Valuation />, { path: 'valuation' });

    await fillRequiredFieldAndSubmit();
    await screen.findByText('Market Price Comparison');

    const bodyText = document.body.textContent.replace(/Yield/gi, '');
    expect(bodyText).not.toMatch(/\bbuy\b|\bsell\b|strong buy|strong sell/i);
  });

  it('shows the base DCF result even when the scenarios call fails, isolating the failure to its own section', async () => {
    mockValuationFetch({
      ...fullSuccess,
      scenarios: errorResponse(500, 'Scenario calculation failed.'),
    });
    renderWithShellContext(<Valuation />, { path: 'valuation' });

    await fillRequiredFieldAndSubmit();

    expect(await screen.findByText('Intrinsic Value Per Share')).toBeInTheDocument();
    expect(screen.getByText('19.97')).toBeInTheDocument();
    expect(await screen.findByText('Scenario calculation failed.')).toBeInTheDocument();
    expect(screen.queryByText('Bear Case')).not.toBeInTheDocument();
    // Sensitivity, unaffected, still renders
    expect(await screen.findByText('Sensitivity Analysis')).toBeInTheDocument();
  });

  it('shows a calculation-error card and no result sections when the base DCF call itself fails', async () => {
    mockValuationFetch({
      ...fullSuccess,
      dcf: errorResponse(422, 'Terminal growth rate must be strictly less than WACC.'),
    });
    renderWithShellContext(<Valuation />, { path: 'valuation' });

    await fillRequiredFieldAndSubmit();

    await waitFor(() => expect(screen.getByText('Calculation Errors')).toBeInTheDocument());
    expect(screen.queryByText('Intrinsic Value Per Share')).not.toBeInTheDocument();
  });
});
