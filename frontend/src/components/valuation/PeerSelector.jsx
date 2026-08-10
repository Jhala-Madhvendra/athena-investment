import { useEffect, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { formatMoney } from '../../lib/compsFormat';

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Peer search + selection. Candidates come from
 * GET /:ticker/comps/available-peers - companies already known to Athena,
 * NOT an automatically-computed "these are comparable" list (see
 * research/finance/PeerSelection.md). The `limitation` string the API
 * returns is rendered verbatim so the user never mistakes this for a
 * recommendation engine.
 *
 * When the local search comes up empty, a distinct "Search Yahoo Finance"
 * action (GET .../available-peers/live-search) lets the user pull in a
 * company Athena hasn't seen yet - a single live call on explicit request,
 * never fired per keystroke like the debounced local search above.
 */
function PeerSelector({ ticker, currency, selectedPeers, onAdd, onRemove }) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [limitation, setLimitation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [liveCandidate, setLiveCandidate] = useState(null);
  const [liveSearching, setLiveSearching] = useState(false);
  const [liveError, setLiveError] = useState('');

  // Resets the live-search result/error whenever the query or target changes, without an
  // effect - an effect calling setState synchronously in its body just to mirror a render-time
  // prop/state change causes an avoidable extra render (react-hooks/set-state-in-effect).
  // This is React's documented "adjust state during render" pattern instead.
  const [lastResetKey, setLastResetKey] = useState(`${ticker}:${query}`);
  const resetKey = `${ticker}:${query}`;
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setLiveCandidate(null);
    setLiveError('');
  }

  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const controller = new AbortController();

    const loadCandidates = async () => {
      setLoading(true);
      setError('');

      try {
        const trimmedQuery = query.trim();
        const url = `${apiBaseUrl}/api/valuation/${encodeURIComponent(ticker)}/comps/available-peers${
          trimmedQuery ? `?q=${encodeURIComponent(trimmedQuery)}` : ''
        }`;

        const response = await fetch(url, { signal: controller.signal });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load candidate peers.');
        }

        setCandidates(data.candidates || []);
        setLimitation(data.limitation || '');
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setCandidates([]);
          setError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(loadCandidates, query ? SEARCH_DEBOUNCE_MS : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [ticker, query, apiBaseUrl]);

  const searchLive = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return;
    }

    setLiveSearching(true);
    setLiveError('');
    setLiveCandidate(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/valuation/${encodeURIComponent(ticker)}/comps/available-peers/live-search?q=${encodeURIComponent(trimmedQuery)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to find that company.');
      }

      setLiveCandidate(data.candidate);
    } catch (requestError) {
      setLiveError(requestError.message);
    } finally {
      setLiveSearching(false);
    }
  };

  const selectedTickers = new Set(selectedPeers.map((peer) => peer.ticker));

  const renderCandidateRow = (candidate) => {
    const alreadySelected = selectedTickers.has(candidate.ticker);
    return (
      <div
        key={candidate.ticker}
        className="flex items-center justify-between gap-3 rounded-lg bg-surface-raised px-3 py-2"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {candidate.name} <span className="text-ink-muted">({candidate.ticker})</span>
          </p>
          <p className="truncate text-xs text-ink-muted">
            {candidate.industry || candidate.sector || 'Industry unavailable'} · Market Cap{' '}
            {formatMoney(candidate.marketCap, currency)} · Revenue{' '}
            {candidate.hasFinancialStatements ? formatMoney(candidate.revenue, currency) : 'not imported'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAdd(candidate)}
          disabled={alreadySelected}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:border-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {alreadySelected ? 'Added' : 'Add'}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {selectedPeers.length > 0 && (
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Selected Peers</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedPeers.map((peer) => (
              <span
                key={peer.ticker}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 py-1 pr-1.5 pl-3 text-sm font-medium text-brand-700"
              >
                {peer.name ? `${peer.name} (${peer.ticker})` : peer.ticker}
                <button
                  type="button"
                  onClick={() => onRemove(peer.ticker)}
                  className="rounded-full p-0.5 hover:bg-brand-500/20"
                  aria-label={`Remove ${peer.ticker} from peers`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <label htmlFor="peer-search" className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Add a Peer
        </label>
        <div className="relative mt-1.5">
          <input
            id="peer-search"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or ticker…"
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          />
          {loading && (
            <Loader2
              className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-ink-muted"
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      {error && <p className="text-xs font-medium text-critical">{error}</p>}

      <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-surface-sunken p-2">
        {!loading && candidates.length === 0 && !liveCandidate && (
          <div className="space-y-2 px-2 py-3">
            <p className="text-sm text-ink-muted">
              {query
                ? 'No matching companies found in Athena yet.'
                : 'No other companies are in Athena yet - search for one above.'}
            </p>
            {query.trim() && (
              <button
                type="button"
                onClick={searchLive}
                disabled={liveSearching}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:border-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {liveSearching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {liveSearching ? 'Searching Yahoo Finance…' : `Search Yahoo Finance for "${query.trim()}"`}
              </button>
            )}
            {liveError && <p className="text-xs font-medium text-critical">{liveError}</p>}
          </div>
        )}
        {liveCandidate && renderCandidateRow(liveCandidate)}
        {candidates.map(renderCandidateRow)}
      </div>

      {limitation && <p className="text-xs leading-relaxed text-ink-muted">{limitation}</p>}
    </div>
  );
}

export default PeerSelector;
