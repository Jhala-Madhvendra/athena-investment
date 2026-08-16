import { describe, it, expect, afterEach, vi } from 'vitest';
import { render as renderRTL, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ComparableCompanies from '../ComparableCompanies';
import { mockCompsFetch, errorResponse } from '../../test/fetchMock';
import { availablePeersFixture, compsResultFixture } from '../../test/compsFixtures';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * ComparableCompanies now reads react-router's useLocation/useNavigate
 * (Sprint 13's Industry -> Comps "Use for Comparable Analysis" hand-off),
 * so every render needs a Router ancestor - a plain MemoryRouter is enough
 * since the component takes its ticker/currency/dcfResult via props, not
 * route params or outlet context.
 */
const render = (ui) => renderRTL(<MemoryRouter>{ui}</MemoryRouter>);

/** Adds the first two "Add"-labeled candidates in the currently-rendered peer list (PEERA then PEERB, per the fixture order). */
const addFirstTwoCandidates = () => {
  fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);
  fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);
};

describe('ComparableCompanies - target and peer selection', () => {
  it('shows the target company snapshot from the available-peers endpoint', async () => {
    mockCompsFetch({ availablePeers: availablePeersFixture });
    render(<ComparableCompanies ticker="TARGET" currency="USD" dcfResult={null} />);

    expect(await screen.findByText('Target Co')).toBeInTheDocument();
    expect(screen.getByText('Software')).toBeInTheDocument();
  });

  it('lists candidate peers and never fabricates a market cap/revenue for one with no imported statements', async () => {
    mockCompsFetch({ availablePeers: availablePeersFixture });
    render(<ComparableCompanies ticker="TARGET" currency="USD" dcfResult={null} />);

    expect(await screen.findByText(/Peer A Corp/)).toBeInTheDocument();
    const peerCRow = screen.getByText(/Peer C Inc/).closest('div');
    expect(within(peerCRow).getByText(/not imported/)).toBeInTheDocument();
  });

  it('lets the user add and remove peers, and requires at least 2 before Calculate is enabled', async () => {
    mockCompsFetch({ availablePeers: availablePeersFixture });
    render(<ComparableCompanies ticker="TARGET" currency="USD" dcfResult={null} />);

    await screen.findByText(/Peer A Corp/);
    const calculateButton = screen.getByRole('button', { name: /Calculate Comparable Valuation/i });
    expect(calculateButton).toBeDisabled();

    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);
    expect(calculateButton).toBeDisabled(); // only 1 peer so far

    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);
    expect(calculateButton).not.toBeDisabled();

    // Remove one peer -> back below the minimum
    fireEvent.click(screen.getAllByLabelText(/Remove .* from peers/)[0]);
    expect(calculateButton).toBeDisabled();
  });

  it('shows the peer-discovery limitation notice, not a claim of automatic comparability', async () => {
    mockCompsFetch({ availablePeers: availablePeersFixture });
    render(<ComparableCompanies ticker="TARGET" currency="USD" dcfResult={null} />);

    expect(await screen.findByText(/not an automatically computed set of comparable companies/)).toBeInTheDocument();
  });

  it('offers a live Yahoo Finance search when no local candidates match, and lets the user add the result', async () => {
    mockCompsFetch({
      // Empty candidate list only for a non-empty query, so typing "Realme" reproduces the
      // "no matching companies found" gap the live-search fallback exists to fill.
      availablePeers: (url) =>
        url.includes('q=Realme') ? { ...availablePeersFixture, candidates: [] } : availablePeersFixture,
      liveSearch: {
        candidate: {
          ticker: 'REALME',
          name: 'Realme Mobile',
          sector: 'Technology',
          industry: 'Consumer Electronics',
          marketCap: 500,
          revenue: null,
          hasFinancialStatements: false,
        },
        limitation: availablePeersFixture.limitation,
      },
    });
    render(<ComparableCompanies ticker="TARGET" currency="USD" dcfResult={null} />);

    await screen.findByText(/Peer A Corp/);
    fireEvent.change(screen.getByLabelText('Add a Peer'), { target: { value: 'Realme' } });

    const liveSearchButton = await screen.findByRole('button', { name: /Search Yahoo Finance for "Realme"/ });
    fireEvent.click(liveSearchButton);

    expect(await screen.findByText(/Realme Mobile/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText(/Realme Mobile \(REALME\)/)).toBeInTheDocument();
  });
});

describe('ComparableCompanies - calculation results', () => {
  it('renders peer comparison, statistics, implied valuation, and valuation range on success', async () => {
    mockCompsFetch({ availablePeers: availablePeersFixture, comps: compsResultFixture });
    render(<ComparableCompanies ticker="TARGET" currency="USD" dcfResult={null} />);

    await screen.findByText(/Peer A Corp/);
    addFirstTwoCandidates();
    fireEvent.click(screen.getByRole('button', { name: /Calculate Comparable Valuation/i }));

    expect(await screen.findByText('Peer Comparison & Trading Multiples')).toBeInTheDocument();
    expect(screen.getByText('Peer Statistics')).toBeInTheDocument();
    expect(screen.getByText('Implied Valuation')).toBeInTheDocument();
    expect(screen.getByText('Valuation Range')).toBeInTheDocument();

    // EV/Revenue's implied value per share (111.25) appears in both the Implied Valuation table and the range's High tile
    expect(screen.getAllByText('111.25 USD').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "—" (never a fabricated 0) for a multiple excluded due to negative net income, with the reason on hover', async () => {
    mockCompsFetch({ availablePeers: availablePeersFixture, comps: compsResultFixture });
    render(<ComparableCompanies ticker="TARGET" currency="USD" dcfResult={null} />);

    await screen.findByText(/Peer A Corp/);
    addFirstTwoCandidates();
    fireEvent.click(screen.getByRole('button', { name: /Calculate Comparable Valuation/i }));

    const comparisonCard = (await screen.findByText('Peer Comparison & Trading Multiples')).closest('section');
    const peerBRow = within(comparisonCard).getByText('Peer B Corp').closest('tr');
    const dashCells = within(peerBRow).getAllByText('—');
    expect(dashCells.length).toBeGreaterThan(0);
    expect(dashCells[0]).toHaveAttribute('title', expect.stringContaining('Net Income is zero or negative'));
  });

  it('never renders a Buy/Sell/Strong Buy/Strong Sell recommendation anywhere on the page', async () => {
    mockCompsFetch({ availablePeers: availablePeersFixture, comps: compsResultFixture });
    render(<ComparableCompanies ticker="TARGET" currency="USD" dcfResult={null} />);

    await screen.findByText(/Peer A Corp/);
    addFirstTwoCandidates();
    fireEvent.click(screen.getByRole('button', { name: /Calculate Comparable Valuation/i }));

    await screen.findByText('Valuation Range');
    const bodyText = document.body.textContent;
    expect(bodyText).not.toMatch(/\bbuy\b|\bsell\b|strong buy|strong sell/i);
  });

  it('lets the user import financials for an unavailable peer directly from the notes card', async () => {
    mockCompsFetch({
      availablePeers: availablePeersFixture,
      comps: {
        ...compsResultFixture,
        unavailablePeers: [{ ticker: 'PEERC', reason: 'No financial statements are available for PEERC in Athena.' }],
      },
      financialsImport: { financialStatements: [] },
    });
    render(<ComparableCompanies ticker="TARGET" currency="USD" dcfResult={null} />);

    await screen.findByText(/Peer A Corp/);
    addFirstTwoCandidates();
    fireEvent.click(screen.getByRole('button', { name: /Calculate Comparable Valuation/i }));

    const importButton = await screen.findByRole('button', { name: 'Import Financials' });
    fireEvent.click(importButton);

    expect(await screen.findByText('Peer Comparison & Trading Multiples')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/financials/import/PEERC'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('does not offer an import shortcut for an unavailable peer excluded for a different reason', async () => {
    mockCompsFetch({
      availablePeers: availablePeersFixture,
      comps: {
        ...compsResultFixture,
        unavailablePeers: [{ ticker: 'PEERC', reason: 'Company PEERC was not found.' }],
      },
    });
    render(<ComparableCompanies ticker="TARGET" currency="USD" dcfResult={null} />);

    await screen.findByText(/Peer A Corp/);
    addFirstTwoCandidates();
    fireEvent.click(screen.getByRole('button', { name: /Calculate Comparable Valuation/i }));

    expect(await screen.findByText(/Company PEERC was not found/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import Financials' })).not.toBeInTheDocument();
  });

  it('shows a validation-error card and no result sections when the API rejects the request', async () => {
    mockCompsFetch({
      availablePeers: availablePeersFixture,
      comps: errorResponse(422, 'Comparable Company Analysis failed validation.'),
    });
    render(<ComparableCompanies ticker="TARGET" currency="USD" dcfResult={null} />);

    await screen.findByText(/Peer A Corp/);
    addFirstTwoCandidates();
    fireEvent.click(screen.getByRole('button', { name: /Calculate Comparable Valuation/i }));

    expect(await screen.findByText('Fix the following before calculating:')).toBeInTheDocument();
    expect(screen.queryByText('Valuation Range')).not.toBeInTheDocument();
  });
});

describe('ComparableCompanies - DCF comparison', () => {
  it('shows an empty state when no DCF result is available yet', async () => {
    mockCompsFetch({ availablePeers: availablePeersFixture, comps: compsResultFixture });
    render(<ComparableCompanies ticker="TARGET" currency="USD" dcfResult={null} />);

    await screen.findByText(/Peer A Corp/);
    addFirstTwoCandidates();
    fireEvent.click(screen.getByRole('button', { name: /Calculate Comparable Valuation/i }));

    expect(await screen.findByText('No DCF valuation to compare yet')).toBeInTheDocument();
  });

  it('compares DCF intrinsic value against the comps range when a DCF result is passed in', async () => {
    mockCompsFetch({ availablePeers: availablePeersFixture, comps: compsResultFixture });
    render(
      <ComparableCompanies
        ticker="TARGET"
        currency="USD"
        dcfResult={{ intrinsicValuePerShare: 145.5, currentMarketPrice: 100 }}
      />
    );

    await screen.findByText(/Peer A Corp/);
    addFirstTwoCandidates();
    fireEvent.click(screen.getByRole('button', { name: /Calculate Comparable Valuation/i }));

    expect(await screen.findByText('145.50 USD')).toBeInTheDocument();
    expect(screen.getByText('intrinsic valuation')).toBeInTheDocument();
    expect(screen.getByText('relative valuation')).toBeInTheDocument();
  });
});
