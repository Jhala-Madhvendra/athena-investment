import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { formatMarketCap } from '../../lib/industryFormat';

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || 'Request failed.');
    error.errors = data.errors;
    throw error;
  }
  return data;
};

/**
 * "Find More Companies" - grows a too-small reference universe on demand by
 * searching Yahoo Finance's own classification data live (see
 * backend/industry/industry.discovery.js), rather than being limited to
 * only what's already in Athena's database (see IndustryAnalysis.md's
 * documented reference-universe limitation). Candidates are suggestions
 * only - nothing is imported until the user explicitly selects companies
 * and clicks "Add Selected".
 */
function FindMoreCompanies({ ticker, onImported }) {
  const [expanded, setExpanded] = useState(false);

  const [candidates, setCandidates] = useState(null);
  const [classification, setClassification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState(new Set());

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');

  const loadCandidates = async () => {
    setLoading(true);
    setError('');
    setImportResult(null);
    setImportError('');
    setSelected(new Set());

    try {
      const data = await fetchJson(`${apiBaseUrl}/api/industry/${encodeURIComponent(ticker)}/discover`);
      setCandidates(data.candidates);
      setClassification({ level: data.classificationLevel, value: data.classificationValue });
    } catch (requestError) {
      setError(requestError.message);
      setCandidates(null);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && candidates === null) {
      loadCandidates();
    }
  };

  const toggleCandidate = (candidateTicker) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(candidateTicker)) {
        next.delete(candidateTicker);
      } else {
        next.add(candidateTicker);
      }
      return next;
    });
  };

  const allSelected = candidates && candidates.length > 0 && selected.size === candidates.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set((candidates || []).map((candidate) => candidate.ticker)));
    }
  };

  const handleAddSelected = async () => {
    setImporting(true);
    setImportError('');
    setImportResult(null);

    try {
      const result = await fetchJson(`${apiBaseUrl}/api/industry/${encodeURIComponent(ticker)}/discover/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: Array.from(selected) }),
      });
      setImportResult(result);
      setCandidates((current) => (current || []).filter((candidate) => !selected.has(candidate.ticker)));
      setSelected(new Set());
      if (result.imported.length > 0) {
        onImported?.();
      }
    } catch (requestError) {
      setImportError(requestError.errors?.length ? requestError.errors.join(' ') : requestError.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-ink-secondary transition-colors hover:border-brand-500 hover:text-brand-600"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        Find More Companies
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {loading && (
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Searching for companies…
            </p>
          )}

          {!loading && error && <p className="text-sm text-critical">{error}</p>}

          {!loading && !error && candidates && candidates.length === 0 && (
            <p className="text-sm text-ink-muted">No additional companies were found for this classification.</p>
          )}

          {!loading && !error && candidates && candidates.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  Potential companies {classification ? `— ${classification.value}` : ''}
                </p>
                <label className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="h-3.5 w-3.5 rounded border-border" />
                  Select all
                </label>
              </div>

              <ul className="divide-y divide-border rounded-lg border border-border">
                {candidates.map((candidate) => (
                  <li key={candidate.ticker} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(candidate.ticker)}
                      onChange={() => toggleCandidate(candidate.ticker)}
                      className="h-4 w-4 shrink-0 rounded border-border"
                      aria-label={`Select ${candidate.name}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {candidate.name} <span className="text-xs text-ink-muted">({candidate.ticker})</span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-muted">{candidate.exchange || '—'}</span>
                    <span className="shrink-0 tabular-nums text-xs text-ink-muted">{formatMarketCap(candidate.marketCap)}</span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddSelected}
                  disabled={selected.size === 0 || importing}
                  className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {importing ? 'Adding…' : `Add Selected${selected.size > 0 ? ` (${selected.size})` : ''}`}
                </button>
                <p className="text-xs text-ink-muted">
                  Not yet reviewed - imports the company profile and financial statements so it can join this industry's reference
                  universe.
                </p>
              </div>
            </>
          )}

          {importError && <p className="text-sm text-critical">{importError}</p>}

          {importResult && (
            <div className="rounded-lg border border-border bg-surface-sunken p-3 text-sm">
              {importResult.imported.length > 0 && (
                <p className="text-good">
                  Added {importResult.imported.length} compan{importResult.imported.length === 1 ? 'y' : 'ies'}: {importResult.imported.join(', ')}
                </p>
              )}
              {importResult.partial.length > 0 && (
                <p className="mt-1 text-warning">
                  Imported but couldn&apos;t fetch financial statements (won&apos;t count toward the benchmark yet):{' '}
                  {importResult.partial.map((r) => r.ticker).join(', ')}
                </p>
              )}
              {importResult.failed.length > 0 && (
                <p className="mt-1 text-critical">Could not import: {importResult.failed.map((r) => `${r.ticker} (${r.error})`).join('; ')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FindMoreCompanies;
