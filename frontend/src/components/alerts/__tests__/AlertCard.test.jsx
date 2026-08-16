import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AlertCard from '../AlertCard'

const alertFixture = (overrides = {}) => ({
  _id: 'alert-1',
  ticker: 'AAPL',
  type: 'FINANCIAL',
  severity: 'HIGH',
  title: 'Operating margin declined',
  message: 'Operating margin declined from 32.1% to 28.7%.',
  whyItMatters: 'The decline indicates pressure on operating profitability.',
  previousValue: 32.1,
  currentValue: 28.7,
  percentChange: -3.4,
  evidencePeriod: 'FY2025 -> FY2026',
  source: 'FY2026 financial statements',
  triggeredAt: new Date().toISOString(),
  isRead: false,
  isDismissed: false,
  ...overrides,
})

const renderCard = (alert, handlers = {}) =>
  render(
    <MemoryRouter>
      <AlertCard alert={alert} onRead={handlers.onRead ?? vi.fn()} onDismiss={handlers.onDismiss ?? vi.fn()} dismissing={false} />
    </MemoryRouter>
  )

describe('AlertCard - collapsed state', () => {
  it('shows what happened, but not why it matters or the evidence, until expanded', () => {
    renderCard(alertFixture())

    expect(screen.getByText('Operating margin declined from 32.1% to 28.7%.')).toBeInTheDocument()
    expect(screen.queryByText('The decline indicates pressure on operating profitability.')).not.toBeInTheDocument()
  })

  it('shows an unread indicator only for an unread alert', () => {
    const { rerender } = renderCard(alertFixture({ isRead: false }))
    expect(screen.getByLabelText('Unread')).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <AlertCard alert={alertFixture({ isRead: true })} onRead={vi.fn()} onDismiss={vi.fn()} dismissing={false} />
      </MemoryRouter>
    )
    expect(screen.queryByLabelText('Unread')).not.toBeInTheDocument()
  })
})

describe('AlertCard - expanding', () => {
  it('reveals why-it-matters and the evidence fields on expand', () => {
    renderCard(alertFixture())

    fireEvent.click(screen.getByLabelText('Expand alert details'))

    expect(screen.getByText('The decline indicates pressure on operating profitability.')).toBeInTheDocument()
    expect(screen.getByText('FY2025 -> FY2026')).toBeInTheDocument()
    expect(screen.getByText('View Company')).toBeInTheDocument()
  })

  it('calls onRead when expanding an unread alert', () => {
    const onRead = vi.fn()
    renderCard(alertFixture({ isRead: false }), { onRead })
    fireEvent.click(screen.getByLabelText('Expand alert details'))
    expect(onRead).toHaveBeenCalledWith('alert-1')
  })

  it('does not call onRead when expanding an already-read alert', () => {
    const onRead = vi.fn()
    renderCard(alertFixture({ isRead: true }), { onRead })
    fireEvent.click(screen.getByLabelText('Expand alert details'))
    expect(onRead).not.toHaveBeenCalled()
  })
})

describe('AlertCard - dismiss', () => {
  it('calls onDismiss with the alert id when the dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    renderCard(alertFixture(), { onDismiss })

    fireEvent.click(screen.getByLabelText('Dismiss alert'))

    expect(onDismiss).toHaveBeenCalledWith('alert-1')
  })
})
