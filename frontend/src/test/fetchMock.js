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
 * Routes a mocked global.fetch for the Comparable Companies tab's
 * endpoints. Checked most-specific first, since `/available-peers/live-search`
 * contains `/available-peers`, which in turn contains the generic `/comps`.
 *
 * @param {object} responses - { availablePeers, liveSearch, comps, financialsImport }
 *   Each value is either a JSON body (200 OK) or { status, body } for an
 *   error (see errorResponse). `undefined` leaves that endpoint hanging.
 *   `financialsImport` covers the "Import Financials" action on an
 *   unavailable peer (POST /api/financials/import/:ticker).
 */
export function mockCompsFetch(responses) {
  const resolveFor = (url) => {
    if (url.includes('/api/financials/import/')) return responses.financialsImport;
    if (url.includes('/comps/available-peers/live-search')) return responses.liveSearch;
    if (url.includes('/comps/available-peers')) return responses.availablePeers;
    if (url.includes('/comps')) return responses.comps;
    throw new Error(`mockCompsFetch: no mock registered for ${url}`);
  };

  globalThis.fetch = vi.fn((url) => {
    // A response may be a function of the full URL (including query string) rather than a
    // fixed body, so a single endpoint can return different results for different queries -
    // e.g. an empty candidate list only when `?q=` is present, to exercise the live-search fallback.
    const resolved = resolveFor(url);
    const entry = typeof resolved === 'function' ? resolved(url) : resolved;
    if (entry === undefined) {
      return new Promise(() => {}); // never resolves - simulates still-loading
    }
    if (entry && entry.__error) {
      return Promise.resolve(jsonResponse(entry.status ?? 500, entry.body ?? { message: 'Request failed.' }));
    }
    return Promise.resolve(jsonResponse(200, entry));
  });
}

/**
 * Routes a mocked global.fetch for the DCF Valuation tab's four endpoints.
 * Distinguished by URL suffix, most-specific first, since /dcf/scenarios
 * and /dcf/sensitivity both contain "/dcf".
 *
 * @param {object} responses - { defaults, dcf, scenarios, sensitivity }
 *   Each value is either a JSON body (200 OK) or { status, body } for an error
 *   (see errorResponse). `undefined` leaves that endpoint hanging (loading state).
 */
/**
 * Routes a mocked global.fetch for the AI Research tab. GET and POST both
 * hit the exact same /api/ai/:ticker/research-report URL, so this
 * distinguishes by HTTP method rather than URL substring.
 *
 * @param {object} responses - { get, generate }
 *   Each value is either a JSON body (200 OK) or { status, body } for an
 *   error (see errorResponse). `undefined` leaves that call hanging.
 */
export function mockAiFetch(responses) {
  globalThis.fetch = vi.fn((url, options = {}) => {
    const method = options.method || 'GET';
    const entry = method === 'POST' ? responses.generate : responses.get;
    if (entry === undefined) {
      return new Promise(() => {}); // never resolves - simulates still-loading
    }
    if (entry && entry.__error) {
      return Promise.resolve(jsonResponse(entry.status ?? 500, entry.body ?? { message: 'Request failed.' }));
    }
    return Promise.resolve(jsonResponse(200, entry));
  });
}

/**
 * Routes a mocked global.fetch for the News & Events tab's three endpoints.
 * Checked most-specific first, since `/refresh` and `/categories` both
 * contain the base `/api/news/:ticker` path.
 *
 * @param {object} responses - { articles, categories, refresh }
 *   Each value is either a JSON body (200 OK) or { status, body } for an
 *   error (see errorResponse). `undefined` leaves that endpoint hanging.
 */
export function mockNewsFetch(responses) {
  const resolveFor = (url) => {
    if (url.includes('/refresh')) return responses.refresh;
    if (url.includes('/categories')) return responses.categories;
    return responses.articles;
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

/**
 * Routes a mocked global.fetch for the Earnings tab - a single
 * GET /api/earnings/:ticker endpoint, so this just resolves/rejects every
 * call with the same response.
 *
 * @param {object|{__error:true}} response - a JSON body (200 OK) or
 *   errorResponse(...). Pass `undefined` to leave the request hanging
 *   (loading state).
 */
export function mockEarningsFetch(response) {
  globalThis.fetch = vi.fn(() => {
    if (response === undefined) {
      return new Promise(() => {}); // never resolves - simulates still-loading
    }
    if (response && response.__error) {
      return Promise.resolve(jsonResponse(response.status ?? 500, response.body ?? { message: 'Request failed.' }));
    }
    return Promise.resolve(jsonResponse(200, response));
  });
}

/**
 * Routes a mocked global.fetch for the Industry tab's endpoints. Checked
 * most-specific first, since `/discover/import`, `/discover`, and `/peers`
 * all contain the base `/api/industry/:ticker` path.
 *
 * @param {object} responses - { industry, peers, discover, discoverImport }
 *   Each value is either a JSON body (200 OK) or { status, body } for an
 *   error (see errorResponse). `undefined` leaves that endpoint hanging.
 */
export function mockIndustryFetch(responses) {
  const resolveFor = (url) => {
    if (url.includes('/discover/import')) return responses.discoverImport;
    if (url.includes('/discover')) return responses.discover;
    if (url.includes('/peers')) return responses.peers;
    return responses.industry;
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

/**
 * `savedScenarios` covers SavedScenariosSection's GET /dcf/saved, fired
 * unconditionally on mount alongside /dcf/defaults - defaults to an empty
 * list when not provided so existing callers that don't care about this
 * feature don't need to opt in explicitly. Checked before the generic
 * `/dcf` case, same as /dcf/scenarios and /dcf/sensitivity above.
 */
export function mockValuationFetch(responses) {
  const resolveFor = (url) => {
    if (url.includes('/dcf/defaults')) return responses.defaults;
    if (url.includes('/dcf/saved')) return responses.savedScenarios ?? { scenarios: [] };
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
