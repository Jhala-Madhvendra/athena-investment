import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssumptionField from '../AssumptionField';

// AssumptionField is a purely-controlled input (value/onChange come from
// props, no internal state) and these tests render it statically without a
// parent that re-renders on change - fireEvent.change sets the field's value
// in one atomic event, which is what exercises the conversion logic here.
// userEvent.type's per-keystroke events would fight the controlled value
// resetting to the unchanged `decimalValue` prop between keystrokes.

describe('AssumptionField - percent fields (the default)', () => {
  it('displays a decimal value as whole percent', () => {
    render(<AssumptionField id="revenueGrowth" label="Revenue Growth" decimalValue={0.08} onChange={() => {}} />);
    expect(screen.getByLabelText('Revenue Growth')).toHaveValue(8);
  });

  it('calls onChange with the decimal form when the user enters a whole percent', () => {
    const onChange = vi.fn();
    render(<AssumptionField id="taxRate" label="Tax Rate" decimalValue={0} onChange={onChange} />);

    // Regression guard: a silent factor-of-100 error here would corrupt every
    // downstream DCF number.
    fireEvent.change(screen.getByLabelText('Tax Rate'), { target: { value: '21' } });

    expect(onChange).toHaveBeenLastCalledWith(0.21);
  });

  it('calls onChange(null) when the field is cleared, rather than coercing to 0', async () => {
    const onChange = vi.fn();
    render(<AssumptionField id="ebitMargin" label="EBIT Margin" decimalValue={0.2} onChange={onChange} />);

    await userEvent.clear(screen.getByLabelText('EBIT Margin'));

    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('renders an empty input (not "0" or "NaN") when decimalValue is null', () => {
    render(<AssumptionField id="terminalGrowthRate" label="Terminal Growth Rate" decimalValue={null} onChange={() => {}} />);
    expect(screen.getByLabelText('Terminal Growth Rate')).toHaveValue(null);
  });

  it('shows the % unit suffix by default', () => {
    render(<AssumptionField id="wacc" label="WACC-ish" decimalValue={0.09} onChange={() => {}} />);
    expect(screen.getByText('%')).toBeInTheDocument();
  });
});

describe('AssumptionField - non-percent fields', () => {
  it('displays and returns beta as a raw multiplier, not a percent conversion', () => {
    const onChange = vi.fn();
    render(
      <AssumptionField id="beta" label="Beta" decimalValue={1.1} onChange={onChange} isPercent={false} unit="×" step={0.05} />
    );

    expect(screen.getByLabelText('Beta')).toHaveValue(1.1);

    fireEvent.change(screen.getByLabelText('Beta'), { target: { value: '1.25' } });

    expect(onChange).toHaveBeenLastCalledWith(1.25);
  });

  it('passes the raw parsed number through unrounded (rounding is the caller\'s job, e.g. DCFAssumptionsForm for forecastYears)', () => {
    const onChange = vi.fn();
    render(<AssumptionField id="forecastYears" label="Forecast Years" decimalValue={5} onChange={onChange} isPercent={false} unit="yrs" step={1} />);

    fireEvent.change(screen.getByLabelText('Forecast Years'), { target: { value: '6.7' } });

    expect(onChange).toHaveBeenLastCalledWith(6.7);
  });
});

describe('AssumptionField - source labeling', () => {
  it('renders a SourceBadge when a source is provided', () => {
    render(<AssumptionField id="revenueGrowth" label="Revenue Growth" decimalValue={0.08} onChange={() => {}} source="derived" />);
    expect(screen.getByText('Derived')).toBeInTheDocument();
  });

  it('renders no badge when no source is provided', () => {
    render(<AssumptionField id="revenueGrowth" label="Revenue Growth" decimalValue={0.08} onChange={() => {}} />);
    expect(screen.queryByText('Derived')).not.toBeInTheDocument();
    expect(screen.queryByText('Default')).not.toBeInTheDocument();
  });

  it('renders the note text when provided', () => {
    render(
      <AssumptionField
        id="revenueGrowth"
        label="Revenue Growth"
        decimalValue={0.08}
        onChange={() => {}}
        note="4-year historical revenue CAGR."
      />
    );
    expect(screen.getByText('4-year historical revenue CAGR.')).toBeInTheDocument();
  });
});
