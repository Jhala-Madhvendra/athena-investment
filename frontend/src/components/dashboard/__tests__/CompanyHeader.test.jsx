import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompanyHeader from '../CompanyHeader';
import { companyFixture, quoteFixture } from '../../../test/fixtures';

describe('CompanyHeader', () => {
  it('renders company identity and price/change/market cap from full data', () => {
    render(<CompanyHeader company={companyFixture.company} quote={quoteFixture} />);

    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText(/NASDAQGS/)).toBeInTheDocument();
    expect(screen.getByText('313.33', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/\+0\.92/)).toBeInTheDocument(); // 313.33 - 312.41
  });

  it('shows "Loading price…" while the quote is still in flight', () => {
    render(<CompanyHeader company={companyFixture.company} quote={null} quoteLoading />);
    expect(screen.getByText('Loading price…')).toBeInTheDocument();
  });

  it('shows "Price unavailable" when the quote failed, not a stale/blank value', () => {
    render(<CompanyHeader company={companyFixture.company} quote={null} quoteError="Yahoo Finance request failed." />);
    expect(screen.getByText('Price unavailable')).toBeInTheDocument();
  });

  it('does not crash when company is entirely missing', () => {
    expect(() => render(<CompanyHeader company={null} quote={null} />)).not.toThrow();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows an "as of" staleness caption when the quote carries an asOf timestamp', () => {
    render(<CompanyHeader company={companyFixture.company} quote={{ ...quoteFixture, asOf: '2026-08-31T18:41:00.000Z' }} />);
    expect(screen.getByText(/As of .* · quotes may be delayed/)).toBeInTheDocument();
  });

  it('renders no staleness caption when the quote has no asOf timestamp', () => {
    render(<CompanyHeader company={companyFixture.company} quote={quoteFixture} />);
    expect(screen.queryByText(/quotes may be delayed/)).not.toBeInTheDocument();
  });
});
