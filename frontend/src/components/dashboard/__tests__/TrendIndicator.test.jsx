import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrendIndicator from '../TrendIndicator';

describe('TrendIndicator', () => {
  it('renders "Improving" for an upward direction', () => {
    render(<TrendIndicator direction="↑" />);
    expect(screen.getByText('Improving')).toBeInTheDocument();
  });

  it('renders "Declining" for a downward direction', () => {
    render(<TrendIndicator direction="↓" />);
    expect(screen.getByText('Declining')).toBeInTheDocument();
  });

  it('falls back to "Unknown" for an unrecognized/missing direction', () => {
    render(<TrendIndicator direction={undefined} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('does not throw when invert is set on a declining direction', () => {
    expect(() => render(<TrendIndicator direction="↓" invert />)).not.toThrow();
    expect(screen.getByText('Declining')).toBeInTheDocument();
  });
});
