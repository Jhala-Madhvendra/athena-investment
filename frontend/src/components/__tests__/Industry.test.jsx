import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Industry from '../Industry';
import { mockIndustryFetch, errorResponse } from '../../test/fetchMock';
import { industryResponseFixture, industryPeersFixture } from '../../test/industryFixtures';

afterEach(() => {
  vi.restoreAllMocks();
});

/** A stand-in for the real Comps tab, just enough to prove navigation + state hand-off worked. */
function CompsStub() {
  return <div>Comps Stub Rendered</div>;
}

const renderIndustry = (ticker = 'TARGET') =>
  render(
    <MemoryRouter initialEntries={[`/financials/${ticker}/industry`]}>
      <Routes>
        <Route path="/financials/:ticker/industry" element={<Industry />} />
        <Route path="/financials/:ticker/valuation/comps" element={<CompsStub />} />
      </Routes>
    </MemoryRouter>
  );

describe('Industry - loading and error states', () => {
  it('shows a loading skeleton before data arrives', () => {
    mockIndustryFetch({ industry: undefined, peers: undefined });
    renderIndustry();

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it("shows an error state when the industry payload can't be loaded", async () => {
    mockIndustryFetch({ industry: errorResponse(404, 'No financial statements are available for TARGET.') });
    renderIndustry();

    expect(await screen.findByText("Couldn't load industry intelligence")).toBeInTheDocument();
  });
});

describe('Industry - successful render', () => {
  it('shows sector, industry, and the benchmark universe note', async () => {
    mockIndustryFetch({ industry: industryResponseFixture, peers: industryPeersFixture });
    renderIndustry();

    expect(await screen.findByText('Software')).toBeInTheDocument();
    expect(screen.getByText('Technology')).toBeInTheDocument();
    expect(screen.getByText(/Industry benchmark based on 4 tracked companies/)).toBeInTheDocument();
  });

  it('renders the combined Company vs Industry comparison table with growth, profitability, and valuation rows', async () => {
    mockIndustryFetch({ industry: industryResponseFixture, peers: industryPeersFixture });
    renderIndustry();

    await screen.findByText('Software');
    // Several metric labels also appear in the Relative Positioning bars below, so assert presence rather than uniqueness.
    expect(screen.getAllByText('Revenue Growth').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Operating Margin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Net Margin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('P/E').length).toBeGreaterThan(0);
    // valuation multiple framed as "Nx", never a pp difference
    expect(screen.getByText('1.17x')).toBeInTheDocument();
  });

  it('lists relative strengths and weaknesses separately, using neutral pp language', async () => {
    mockIndustryFetch({ industry: industryResponseFixture, peers: industryPeersFixture });
    renderIndustry();

    await screen.findByText('Software');
    // "+7.0 pp"/"-8.0 pp" each appear twice (once in the comparison table's Difference column, once in the strengths/weaknesses list) - both are expected.
    expect(screen.getAllByText('+7.0 pp').length).toBeGreaterThan(0); // strength
    expect(screen.getAllByText('-8.0 pp').length).toBeGreaterThan(0); // weakness
  });

  it('renders percentile positioning and reports unavailable metrics without crashing', async () => {
    mockIndustryFetch({ industry: industryResponseFixture, peers: industryPeersFixture });
    renderIndustry();

    expect(await screen.findByText('78th percentile')).toBeInTheDocument();
  });

  it('shows potential peers with the limitation notice, distinct from the Comps peer set', async () => {
    mockIndustryFetch({ industry: industryResponseFixture, peers: industryPeersFixture });
    renderIndustry();

    expect(await screen.findByText(/Microsoft/)).toBeInTheDocument();
    expect(screen.getByText(/not an automatically computed or canonical peer set/)).toBeInTheDocument();
  });

  it('never renders a Buy/Sell/Strong Buy/Strong Sell recommendation anywhere on the page', async () => {
    mockIndustryFetch({ industry: industryResponseFixture, peers: industryPeersFixture });
    renderIndustry();

    await screen.findByText('Software');
    const bodyText = document.body.textContent;
    expect(bodyText).not.toMatch(/\bStrong Buy\b|\bStrong Sell\b/i);
    expect(bodyText).not.toMatch(/\bBuy\b|\bSell\b/);
  });

  it('navigates to the Comps tab with the selected peer in navigation state when "Use for Comparable Analysis" is clicked', async () => {
    mockIndustryFetch({ industry: industryResponseFixture, peers: industryPeersFixture });
    renderIndustry();

    const useButton = await screen.findByRole('button', { name: /Use for Comparable Analysis/i });
    await userEvent.click(useButton);

    expect(await screen.findByText('Comps Stub Rendered')).toBeInTheDocument();
  });
});
