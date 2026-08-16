import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FindMoreCompanies from '../FindMoreCompanies';

const jsonResponse = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

const discoverFixture = {
  classificationLevel: 'industry',
  classificationValue: 'Consumer Electronics',
  candidates: [
    { ticker: '005930.KS', name: 'Samsung Electronics Co., Ltd.', exchange: 'KSC', marketCap: 300000000000 },
    { ticker: '6758.T', name: 'Sony Group Corporation', exchange: 'JPX', marketCap: 150000000000 },
  ],
  limitation: 'These companies are not yet tracked by Athena and have not been reviewed.',
  generatedAt: new Date().toISOString(),
};

/** Routes a mocked global.fetch by method + URL suffix for this component's two endpoints. */
const mockFetch = ({ discover, discoverImport } = {}) => {
  globalThis.fetch = vi.fn((url, options = {}) => {
    const method = options.method || 'GET';
    if (url.includes('/discover/import') && method === 'POST') {
      if (discoverImport === undefined) return new Promise(() => {});
      if (discoverImport.__error) return Promise.resolve(jsonResponse(discoverImport.status ?? 500, discoverImport.body));
      return Promise.resolve(jsonResponse(200, discoverImport));
    }
    if (url.includes('/discover')) {
      if (discover === undefined) return new Promise(() => {});
      if (discover.__error) return Promise.resolve(jsonResponse(discover.status ?? 500, discover.body));
      return Promise.resolve(jsonResponse(200, discover));
    }
    throw new Error(`mockFetch: no mock registered for ${method} ${url}`);
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FindMoreCompanies', () => {
  it('stays collapsed until the button is clicked, and does not fetch candidates until then', () => {
    mockFetch({ discover: discoverFixture });
    render(<FindMoreCompanies ticker="AAPL" onImported={vi.fn()} />);

    expect(screen.queryByText(/Potential companies/)).not.toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('loads and shows candidates when expanded', async () => {
    mockFetch({ discover: discoverFixture });
    render(<FindMoreCompanies ticker="AAPL" onImported={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /Find More Companies/i }));

    expect(await screen.findByText(/Samsung Electronics/)).toBeInTheDocument();
    expect(screen.getByText(/Sony Group Corporation/)).toBeInTheDocument();
    expect(screen.getByText(/Potential companies.*Consumer Electronics/)).toBeInTheDocument();
  });

  it('shows an error state when discovery fails, e.g. no classification available', async () => {
    mockFetch({ discover: { __error: true, status: 422, body: { message: 'AAPL has no sector or industry classification.' } } });
    render(<FindMoreCompanies ticker="AAPL" onImported={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /Find More Companies/i }));

    expect(await screen.findByText(/no sector or industry classification/)).toBeInTheDocument();
  });

  it('disables "Add Selected" until at least one company is checked', async () => {
    mockFetch({ discover: discoverFixture });
    render(<FindMoreCompanies ticker="AAPL" onImported={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Find More Companies/i }));
    await screen.findByText(/Samsung Electronics/);

    expect(screen.getByRole('button', { name: /Add Selected/i })).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox', { name: /Select Samsung/i }));
    expect(screen.getByRole('button', { name: /Add Selected \(1\)/i })).toBeEnabled();
  });

  it('"Select all" checks every candidate, and unchecks them all when clicked again', async () => {
    mockFetch({ discover: discoverFixture });
    render(<FindMoreCompanies ticker="AAPL" onImported={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Find More Companies/i }));
    await screen.findByText(/Samsung Electronics/);

    await userEvent.click(screen.getByRole('checkbox', { name: /Select all/i }));
    expect(screen.getByRole('button', { name: /Add Selected \(2\)/i })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: /Select Samsung/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Select Sony/i })).toBeChecked();

    await userEvent.click(screen.getByRole('checkbox', { name: /Select all/i }));
    expect(screen.getByRole('checkbox', { name: /Select Samsung/i })).not.toBeChecked();
  });

  it('imports the selected companies, shows the result, removes them from the list, and notifies the parent to refresh', async () => {
    const onImported = vi.fn();
    mockFetch({
      discover: discoverFixture,
      discoverImport: { imported: ['005930.KS'], partial: [], failed: [], generatedAt: new Date().toISOString() },
    });
    render(<FindMoreCompanies ticker="AAPL" onImported={onImported} />);
    await userEvent.click(screen.getByRole('button', { name: /Find More Companies/i }));
    await screen.findByText(/Samsung Electronics/);

    await userEvent.click(screen.getByRole('checkbox', { name: /Select Samsung/i }));
    await userEvent.click(screen.getByRole('button', { name: /Add Selected \(1\)/i }));

    expect(await screen.findByText(/Added 1 company: 005930\.KS/)).toBeInTheDocument();
    expect(screen.queryByText(/Samsung Electronics/)).not.toBeInTheDocument(); // removed from the candidate list
    expect(screen.getByText(/Sony Group Corporation/)).toBeInTheDocument(); // untouched
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
  });

  it('shows partial and failed results without claiming success for them', async () => {
    mockFetch({
      discover: discoverFixture,
      discoverImport: {
        imported: [],
        partial: [{ ticker: '005930.KS', companyImported: true, financialsImported: false, error: 'no data' }],
        failed: [{ ticker: '6758.T', companyImported: false, financialsImported: false, error: 'Company could not be found.' }],
        generatedAt: new Date().toISOString(),
      },
    });
    render(<FindMoreCompanies ticker="AAPL" onImported={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Find More Companies/i }));
    await screen.findByText(/Samsung Electronics/);
    await userEvent.click(screen.getByRole('checkbox', { name: /Select all/i }));
    await userEvent.click(screen.getByRole('button', { name: /Add Selected \(2\)/i }));

    expect(await screen.findByText(/couldn't fetch financial statements/i)).toBeInTheDocument();
    expect(screen.getByText(/Could not import: 6758\.T \(Company could not be found\.\)/)).toBeInTheDocument();
  });
});
