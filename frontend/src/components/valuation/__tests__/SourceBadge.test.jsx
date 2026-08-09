import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SourceBadge from '../SourceBadge';

describe('SourceBadge', () => {
  it.each([
    ['historical', 'Historical'],
    ['derived', 'Derived'],
    ['market', 'Live Market Data'],
    ['default', 'Default'],
    ['illustrative_default', 'Illustrative — Not Live Data'],
    ['required_user_input', 'Enter a Value'],
    ['unavailable', 'Unavailable'],
  ])('labels source "%s" as "%s"', (source, expectedLabel) => {
    render(<SourceBadge source={source} />);
    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });

  it('falls back to the Default label for an unrecognized or missing source', () => {
    render(<SourceBadge source="not_a_real_source" />);
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('never renders a live-data value with the same label as an illustrative one', () => {
    // Regression guard for the core product requirement: a live 10Y treasury
    // yield and a textbook 5% ERP must never look the same to the user.
    const market = render(<SourceBadge source="market" />);
    const illustrative = render(<SourceBadge source="illustrative_default" />);

    expect(market.container.textContent).not.toBe(illustrative.container.textContent);
  });
});
