import { describe, it, expect, afterEach, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import NewsEvents from '../NewsEvents'
import { renderWithShellContext } from '../../test/renderWithRouter'
import { mockNewsFetch, errorResponse } from '../../test/fetchMock'

const articleFixture = {
  _id: 'article-1',
  title: 'Apple reports record quarterly earnings',
  description: 'Apple posted revenue and EPS ahead of consensus.',
  url: 'https://example.com/apple-earnings',
  source: 'Reuters',
  publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  category: 'Earnings',
}

const successResponses = {
  articles: {
    ticker: 'AAPL',
    articles: [articleFixture],
    lastRefreshedAt: new Date().toISOString(),
    provider: 'yahoo',
  },
  categories: {
    ticker: 'AAPL',
    categories: [{ category: 'Earnings', count: 1 }],
    total: 1,
  },
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NewsEvents - loading state', () => {
  it('shows the page header immediately and a skeleton while articles are hanging', () => {
    mockNewsFetch({})
    renderWithShellContext(<NewsEvents />, { path: 'news' })

    expect(screen.getByText('News & Events')).toBeInTheDocument()
    expect(screen.queryByText(articleFixture.title)).not.toBeInTheDocument()
  })
})

describe('NewsEvents - successful rendering', () => {
  it('renders articles with category badge, source, and a working external link', async () => {
    mockNewsFetch(successResponses)
    renderWithShellContext(<NewsEvents />, { path: 'news' })

    expect(await screen.findByText(articleFixture.title)).toBeInTheDocument()
    expect(screen.getByText('Reuters')).toBeInTheDocument();
    expect(screen.getAllByText('Earnings').length).toBeGreaterThan(0)

    const link = screen.getByText(articleFixture.title).closest('a')
    expect(link).toHaveAttribute('href', articleFixture.url)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('renders category filter chips with counts from the categories endpoint', async () => {
    mockNewsFetch(successResponses)
    renderWithShellContext(<NewsEvents />, { path: 'news' })

    expect(await screen.findByRole('button', { name: 'All (1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Earnings (1)' })).toBeInTheDocument()
  })

  it('refetches articles filtered by category when a chip is clicked', async () => {
    mockNewsFetch(successResponses)
    renderWithShellContext(<NewsEvents />, { path: 'news' })

    const chip = await screen.findByRole('button', { name: 'Earnings (1)' })
    fireEvent.click(chip)

    await waitFor(() => {
      const lastCall = globalThis.fetch.mock.calls.find(([url]) => url.includes('category=Earnings'))
      expect(lastCall).toBeTruthy()
    })
  })
})

describe('NewsEvents - empty and error states', () => {
  it('shows an empty state when no articles are found', async () => {
    mockNewsFetch({
      articles: { ticker: 'AAPL', articles: [], lastRefreshedAt: null, provider: 'yahoo' },
      categories: { ticker: 'AAPL', categories: [], total: 0 },
    })
    renderWithShellContext(<NewsEvents />, { path: 'news' })

    expect(await screen.findByText('No news found')).toBeInTheDocument()
  })

  it('shows an error state when the news request fails', async () => {
    mockNewsFetch({
      articles: errorResponse(502, 'News provider unavailable.'),
      categories: { ticker: 'AAPL', categories: [], total: 0 },
    })
    renderWithShellContext(<NewsEvents />, { path: 'news' })

    expect(await screen.findByText("Couldn't load news")).toBeInTheDocument()
    expect(screen.getByText('News provider unavailable.')).toBeInTheDocument()
  })
})

describe('NewsEvents - development provider notice', () => {
  it('shows a mock-data warning when the backend is running the mock provider', async () => {
    mockNewsFetch({
      articles: { ...successResponses.articles, provider: 'mock' },
      categories: successResponses.categories,
    })
    renderWithShellContext(<NewsEvents />, { path: 'news' })

    expect(await screen.findByText(/Development mode/)).toBeInTheDocument()
  })
})

describe('NewsEvents - refresh', () => {
  it('triggers a POST refresh and reloads the article list', async () => {
    mockNewsFetch({ ...successResponses, refresh: { ticker: 'AAPL', inserted: 1, merged: 0, lastRefreshedAt: new Date().toISOString(), provider: 'yahoo' } })
    renderWithShellContext(<NewsEvents />, { path: 'news' })

    await screen.findByText(articleFixture.title)

    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }))

    await waitFor(() => {
      const refreshCall = globalThis.fetch.mock.calls.find(([url]) => url.includes('/refresh'))
      expect(refreshCall).toBeTruthy()
    })
  })

  it('shows an inline error when the refresh fails', async () => {
    mockNewsFetch({ ...successResponses, refresh: errorResponse(429, 'Too many requests.') })
    renderWithShellContext(<NewsEvents />, { path: 'news' })

    await screen.findByText(articleFixture.title)
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }))

    expect(await screen.findByText('Too many requests.')).toBeInTheDocument()
  })
})
