import { vi } from 'vitest';

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

/**
 * Routes a mocked global.fetch by URL substring so Overview's five
 * concurrent requests each resolve/reject independently, matching how the
 * real endpoints behave. Pass `undefined` for an endpoint to leave it
 * "hanging" (never resolves) - useful for asserting a loading state.
 *
 * @param {object} responses - { company, quote, performance, analysis, ratios }
 *   Each value is either a JSON body (200 OK) or { status, body } for an error.
 */
export function mockDashboardFetch(responses) {
  const resolveFor = (url) => {
    if (url.includes('/api/market/') && url.includes('/performance')) return responses.performance;
    if (url.includes('/api/market/')) return responses.quote;
    if (url.includes('/api/analysis/')) return responses.analysis;
    if (url.includes('/api/ratios/')) return responses.ratios;
    if (url.includes('/api/company/')) return responses.company;
    throw new Error(`mockDashboardFetch: no mock registered for ${url}`);
  };

  globalThis.fetch = vi.fn((url) => {
    const entry = resolveFor(url);
    if (entry === undefined) {
      return new Promise(() => {}); // never resolves - simulates still-loading
    }
    if (entry && entry.__error) {
      return Promise.resolve(jsonResponse(entry.status ?? 500, entry.body ?? { message: 'Request failed.' }));
    }
    return Promise.resolve(jsonResponse(200, entry));
  });
}

export const errorResponse = (status, message) => ({ __error: true, status, body: { message } });

/**
 * Routes a mocked global.fetch for the DCF Valuation tab's four endpoints.
 * Distinguished by URL suffix, most-specific first, since /dcf/scenarios
 * and /dcf/sensitivity both contain "/dcf".
 *
 * @param {object} responses - { defaults, dcf, scenarios, sensitivity }
 *   Each value is either a JSON body (200 OK) or { status, body } for an error
 *   (see errorResponse). `undefined` leaves that endpoint hanging (loading state).
 */
export function mockValuationFetch(responses) {
  const resolveFor = (url) => {
    if (url.includes('/dcf/defaults')) return responses.defaults;
    if (url.includes('/dcf/scenarios')) return responses.scenarios;
    if (url.includes('/dcf/sensitivity')) return responses.sensitivity;
    if (url.includes('/dcf')) return responses.dcf;
    throw new Error(`mockValuationFetch: no mock registered for ${url}`);
  };

  globalThis.fetch = vi.fn((url) => {
    const entry = resolveFor(url);
    if (entry === undefined) {
      return new Promise(() => {}); // never resolves - simulates still-loading
    }
    if (entry && entry.__error) {
      return Promise.resolve(jsonResponse(entry.status ?? 500, entry.body ?? { message: 'Request failed.' }));
    }
    return Promise.resolve(jsonResponse(200, entry));
  });
}
