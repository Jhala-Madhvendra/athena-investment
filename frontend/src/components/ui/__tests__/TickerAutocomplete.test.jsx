import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TickerAutocomplete from '../TickerAutocomplete'
import { fetchJson } from '../../../lib/api'

vi.mock('../../../lib/api', () => ({ fetchJson: vi.fn() }))

afterEach(() => {
  vi.clearAllMocks()
})

const renderInput = (initialValue = '') => {
  let currentValue = initialValue
  const onChange = vi.fn((next) => {
    currentValue = next
    rerenderWithValue(currentValue)
  })
  const utils = render(<TickerAutocomplete value={currentValue} onChange={onChange} ariaLabel="Ticker" />)
  function rerenderWithValue(next) {
    utils.rerender(<TickerAutocomplete value={next} onChange={onChange} ariaLabel="Ticker" />)
  }
  return { ...utils, onChange, rerenderWithValue }
}

describe('TickerAutocomplete', () => {
  it('shows a dropdown of company matches while typing and selecting one commits its ticker', async () => {
    fetchJson.mockResolvedValue({ companies: [{ name: 'Indian Oil Corporation', ticker: 'IOC.NS', exchange: 'NSE' }] })
    const user = userEvent.setup()
    const { onChange } = renderInput()

    await user.type(screen.getByLabelText('Ticker'), 'Indian Oil')

    const option = await screen.findByRole('button', { name: /Indian Oil Corporation/i })
    await user.click(option)

    expect(onChange).toHaveBeenCalledWith('IOC.NS')
  })

  it('resolves free text to a ticker on blur when no suggestion was picked', async () => {
    fetchJson.mockImplementation((path) => {
      if (path.startsWith('/api/company/search')) return Promise.resolve({ companies: [] })
      if (path.startsWith('/api/company/resolve')) return Promise.resolve({ ticker: 'IOC.NS' })
      return Promise.reject(new Error(`unexpected path ${path}`))
    })
    const user = userEvent.setup()
    const { onChange } = renderInput()

    await user.type(screen.getByLabelText('Ticker'), 'Indian Oil')
    await user.tab()

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('IOC.NS'))
  })

  it('leaves the typed text untouched when resolution fails, so the surrounding form validation still applies', async () => {
    fetchJson.mockImplementation((path) => {
      if (path.startsWith('/api/company/search')) return Promise.resolve({ companies: [] })
      if (path.startsWith('/api/company/resolve')) return Promise.reject(new Error('Company name or ticker could not be resolved.'))
      return Promise.reject(new Error(`unexpected path ${path}`))
    })
    const user = userEvent.setup()
    const { onChange } = renderInput()

    await user.type(screen.getByLabelText('Ticker'), 'zzz not a company')
    const callsFromTyping = onChange.mock.calls.length
    await user.tab()

    await waitFor(() => expect(fetchJson).toHaveBeenCalledWith(expect.stringContaining('/api/company/resolve')))
    expect(onChange.mock.calls.length).toBe(callsFromTyping)
  })
})
