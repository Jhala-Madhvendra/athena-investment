import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../Sidebar';
import { fetchJson } from '../../../lib/api';
import { notifyAlertsChanged } from '../../../lib/alertsBadge';

vi.mock('../../../lib/api', () => ({ fetchJson: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
});

const renderSidebar = () =>
  render(
    <MemoryRouter initialEntries={['/financials/AAPL/overview']}>
      <Sidebar />
    </MemoryRouter>
  );

/**
 * Regression test for the "sidebar badge never decreases" bug: Sidebar is
 * mounted once in App.jsx and never remounts as the user navigates to the
 * Alerts page and back, so it can only learn the unread count changed via
 * the alertsBadge.js pub/sub signal - not by re-rendering naturally.
 */
describe('Sidebar - unread alert badge', () => {
  it('fetches the unread count once on mount', async () => {
    fetchJson.mockResolvedValue({ count: 8 });
    renderSidebar();

    await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());
    expect(fetchJson).toHaveBeenCalledWith('/api/alerts/unread-count');
  });

  it('re-fetches and updates the badge when notifyAlertsChanged() fires (e.g. after reading an alert on the Alerts page)', async () => {
    fetchJson.mockResolvedValue({ count: 8 });
    renderSidebar();
    await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());

    fetchJson.mockClear();
    fetchJson.mockResolvedValue({ count: 7 });
    notifyAlertsChanged();

    await waitFor(() => expect(screen.getByText('7')).toBeInTheDocument());
    expect(fetchJson).toHaveBeenCalledWith('/api/alerts/unread-count');
  });

  it('hides the badge once the count reaches zero', async () => {
    fetchJson.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    renderSidebar();

    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

    notifyAlertsChanged();

    await waitFor(() => expect(screen.queryByText('1')).not.toBeInTheDocument());
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('unsubscribes on unmount, so a later notifyAlertsChanged() does not update an unmounted component', async () => {
    fetchJson.mockResolvedValue({ count: 8 });
    const { unmount } = renderSidebar();

    await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());
    unmount();

    const callsBeforeNotify = fetchJson.mock.calls.length;
    notifyAlertsChanged();

    expect(fetchJson.mock.calls.length).toBe(callsBeforeNotify); // no extra fetch triggered post-unmount
  });
});
