import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScenarioBuilder from '../ScenarioBuilder'

const baseProps = (overrides = {}) => ({
  name: 'Bear Case',
  onNameChange: vi.fn(),
  rules: [],
  onRulesChange: vi.fn(),
  presets: [],
  onLoadPreset: vi.fn(),
  benchmark: '',
  onBenchmarkChange: vi.fn(),
  window: '1y',
  onWindowChange: vi.fn(),
  onRun: vi.fn(),
  running: false,
  ...overrides,
})

/**
 * Regression test for a real bug: a user loaded the Bear Case preset (which
 * already has a "Sector: Technology -25%" rule), then added a second
 * "Sector: Technology -45%" rule via the builder. The builder accepted it
 * silently, and the duplicate was only caught at submit time by the
 * backend's validator with a raw, backend-flavored error message
 * ("rules[3] duplicates an earlier rule..."). The builder must now catch
 * this itself, immediately, with a message that names the conflicting rule.
 */
describe('ScenarioBuilder - duplicate rule prevention', () => {
  it('rejects adding a second SECTOR rule for the same sector already in the list', async () => {
    const user = userEvent.setup()
    const onRulesChange = vi.fn()
    const existingRules = [
      { targetType: 'MARKET', target: null, shockPercent: -15 },
      { targetType: 'SECTOR', target: 'Technology', shockPercent: -25 },
      { targetType: 'SECTOR', target: 'Financial Services', shockPercent: -10 },
    ]

    render(<ScenarioBuilder {...baseProps({ rules: existingRules, onRulesChange })} />)

    // Target type already defaults to Sector - just fill in the duplicate sector and a shock.
    await user.type(screen.getByLabelText('Sector', { exact: true }), 'Technology')
    await user.type(screen.getByLabelText(/shock %/i), '-45')
    await user.click(screen.getByRole('button', { name: /add rule/i }))

    expect(screen.getByText(/already exists/i)).toBeInTheDocument()
    expect(onRulesChange).not.toHaveBeenCalled()
  })

  it('treats an ASSET rule as a duplicate of an existing one regardless of ticker casing', async () => {
    const user = userEvent.setup()
    const onRulesChange = vi.fn()
    const existingRules = [{ targetType: 'ASSET', target: 'AAPL', shockPercent: -30 }]

    render(<ScenarioBuilder {...baseProps({ rules: existingRules, onRulesChange })} />)

    await user.selectOptions(screen.getByLabelText('Target'), 'ASSET')
    await user.type(screen.getByLabelText(/ticker/i), 'aapl')
    await user.type(screen.getByLabelText(/shock %/i), '-50')
    await user.click(screen.getByRole('button', { name: /add rule/i }))

    expect(screen.getByText(/already exists/i)).toBeInTheDocument()
    expect(onRulesChange).not.toHaveBeenCalled()
  })

  it('still allows adding a non-duplicate rule alongside existing ones', async () => {
    const user = userEvent.setup()
    const onRulesChange = vi.fn()
    const existingRules = [{ targetType: 'SECTOR', target: 'Technology', shockPercent: -25 }]

    render(<ScenarioBuilder {...baseProps({ rules: existingRules, onRulesChange })} />)

    await user.type(screen.getByLabelText('Sector', { exact: true }), 'Healthcare')
    await user.type(screen.getByLabelText(/shock %/i), '5')
    await user.click(screen.getByRole('button', { name: /add rule/i }))

    expect(onRulesChange).toHaveBeenCalledWith([
      { targetType: 'SECTOR', target: 'Technology', shockPercent: -25 },
      { targetType: 'SECTOR', target: 'Healthcare', shockPercent: 5 },
    ])
  })

  it('does not flag a rule as a duplicate of itself while editing it', async () => {
    const user = userEvent.setup()
    const onRulesChange = vi.fn()
    const existingRules = [{ targetType: 'SECTOR', target: 'Technology', shockPercent: -25 }]

    render(<ScenarioBuilder {...baseProps({ rules: existingRules, onRulesChange })} />)

    await user.click(screen.getByRole('button', { name: /edit rule/i }))
    // The shock field should now be pre-filled with -25 - change it and save.
    const shockInput = screen.getByLabelText(/shock %/i)
    await user.clear(shockInput)
    await user.type(shockInput, '-30')
    await user.click(screen.getByRole('button', { name: /save rule/i }))

    expect(onRulesChange).toHaveBeenCalledWith([{ targetType: 'SECTOR', target: 'Technology', shockPercent: -30 }])
  })
})
