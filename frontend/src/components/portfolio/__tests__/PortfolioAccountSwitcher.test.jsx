import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PortfolioAccountSwitcher from '../PortfolioAccountSwitcher'
import { fetchJson } from '../../../lib/api'

vi.mock('../../../lib/api', () => ({ fetchJson: vi.fn() }))

afterEach(() => {
  vi.clearAllMocks()
})

describe('PortfolioAccountSwitcher', () => {
  it('fetches accounts on mount and reports the default account once resolved', async () => {
    fetchJson.mockResolvedValue({
      accounts: [
        { _id: 'acct-1', name: 'My Portfolio', isDefault: true },
        { _id: 'acct-2', name: 'Retirement', isDefault: false },
      ],
    })
    const onChange = vi.fn()

    render(<PortfolioAccountSwitcher onChange={onChange} />)

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('acct-1'))
    expect(screen.getByRole('option', { name: 'My Portfolio' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Retirement' })).toBeInTheDocument()
  })

  it('reports the selected account when the user switches accounts', async () => {
    fetchJson.mockResolvedValue({
      accounts: [
        { _id: 'acct-1', name: 'My Portfolio', isDefault: true },
        { _id: 'acct-2', name: 'Retirement', isDefault: false },
      ],
    })
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<PortfolioAccountSwitcher onChange={onChange} />)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('acct-1'))

    await user.selectOptions(screen.getByLabelText('Portfolio account'), 'acct-2')

    expect(onChange).toHaveBeenCalledWith('acct-2')
  })

  it('creates a new account and switches to it', async () => {
    fetchJson.mockResolvedValueOnce({ accounts: [{ _id: 'acct-1', name: 'My Portfolio', isDefault: true }] })
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<PortfolioAccountSwitcher onChange={onChange} />)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('acct-1'))

    await user.selectOptions(screen.getByLabelText('Portfolio account'), '__new__')

    const input = screen.getByPlaceholderText('Account name (e.g. Retirement)')
    await user.type(input, 'Retirement')

    fetchJson.mockResolvedValueOnce({ account: { _id: 'acct-2', name: 'Retirement' } })
    fetchJson.mockResolvedValueOnce({
      accounts: [
        { _id: 'acct-1', name: 'My Portfolio', isDefault: true },
        { _id: 'acct-2', name: 'Retirement', isDefault: false },
      ],
    })

    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(fetchJson).toHaveBeenCalledWith('/api/portfolio-accounts', { method: 'POST', body: JSON.stringify({ name: 'Retirement' }) })
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('acct-2'))
  })
})
