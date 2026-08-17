import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Card from './ui/Card';
import Skeleton from './ui/Skeleton';
import ErrorState from './ui/ErrorState';
import StatCard from './ui/StatCard';
import PeerSelector from './valuation/PeerSelector';
import StatisticSelector from './valuation/StatisticSelector';
import PeerComparisonTable from './valuation/PeerComparisonTable';
import PeerStatisticsTable from './valuation/PeerStatisticsTable';
import ImpliedValuationTable from './valuation/ImpliedValuationTable';
import ValuationRangeCard from './valuation/ValuationRangeCard';
import DCFComparisonCard from './valuation/DCFComparisonCard';
import { formatMoney } from '../lib/compsFormat';

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const MIN_PEERS = 2;

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
 * Comparable Company Analysis tab. Peer selection is entirely
 * user-controlled (see research/finance/PeerSelection.md) - Athena never
 * auto-selects peers or auto-runs a calculation. Nothing here is
 * persisted; every "Calculate" click recalculates from current stored
 * financials + a live market quote, same discipline as the DCF tab.
 */
function ComparableCompanies({ ticker, currency, dcfResult }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [targetInfo, setTargetInfo] = useState(null);
  const [targetInfoLoading, setTargetInfoLoading] = useState(true);
  const [targetInfoError, setTargetInfoError] = useState('');

  const [selectedPeers, setSelectedPeers] = useState([]);
  const [statistic, setStatistic] = useState('median');

  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [calcErrors, setCalcErrors] = useState([]);

  const [importingTicker, setImportingTicker] = useState(null);
  const [importErrors, setImportErrors] = useState({});

  useEffect(() => {
    const controller = new AbortController();

    const loadTargetInfo = async () => {
      setTargetInfoLoading(true);
      setTargetInfoError('');
      setSelectedPeers([]);
      setResult(null);
      setCalcErrors([]);

      try {
        const data = await fetchJson(
          `${apiBaseUrl}/api/valuation/${encodeURIComponent(ticker)}/comps/available-peers`,
          { signal: controller.signal }
        );
        setTargetInfo(data.target);
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setTargetInfoError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setTargetInfoLoading(false);
        }
      }
    };

    loadTargetInfo();
    return () => controller.abort();
  }, [ticker]);

  const addPeer = (candidate) => {
    setSelectedPeers((previous) =>
      previous.some((peer) => peer.ticker === candidate.ticker)
        ? previous
        : [...previous, { ticker: candidate.ticker, name: candidate.name }]
    );
  };

  /**
   * Sprint 13's Industry page can suggest a "potential peer" and route here
   * with it in navigation state (see Industry.jsx's useForComps). This only
   * pre-fills the picker via the same addPeer() a manual click would use -
   * the user still has to review it and explicitly click Calculate, so
   * nothing is auto-added to a Comps calculation (see Sprint 13's
   * "potential peers never automatically become the Comps peer set").
   * State is cleared immediately after being consumed so navigating back to
   * this tab (e.g. browser back button) doesn't re-add it.
   */
  useEffect(() => {
    const suggestedPeer = location.state?.suggestedPeer;
    if (!suggestedPeer) return;

    addPeer(suggestedPeer);
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const removePeer = (peerTicker) => {
    setSelectedPeers((previous) => previous.filter((peer) => peer.ticker !== peerTicker));
  };

  const handleCalculate = async () => {
    setCalculating(true);
    setCalcErrors([]);

    try {
      const data = await fetchJson(`${apiBaseUrl}/api/valuation/${encodeURIComponent(ticker)}/comps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peers: selectedPeers.map((peer) => peer.ticker), statistic }),
      });
      setResult(data);
    } catch (requestError) {
      setResult(null);
      setCalcErrors(requestError.errors && requestError.errors.length ? requestError.errors : [requestError.message]);
    } finally {
      setCalculating(false);
    }
  };

  /**
   * A peer can be added to the list without having its financial statements
   * imported (see research/engineering/PeerSelectionEngine.md - Athena never
   * auto-imports as a side effect of peer selection). This is the explicit,
   * one-click way to fix that for a peer the "Peer List Notes" flagged as
   * unavailable, without navigating away to its Financial Statements tab.
   * Reuses the same POST /api/financials/import/:ticker the Financial
   * Statements tab itself uses - no new import logic.
   */
  const importPeerFinancials = async (peerTicker) => {
    setImportingTicker(peerTicker);
    setImportErrors((previous) => ({ ...previous, [peerTicker]: '' }));

    try {
      await fetchJson(`${apiBaseUrl}/api/financials/import/${encodeURIComponent(peerTicker)}`, { method: 'POST' });
      await handleCalculate();
    } catch (requestError) {
      setImportErrors((previous) => ({ ...previous, [peerTicker]: requestError.message }));
    } finally {
      setImportingTicker(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink">Comparable Company Analysis</h2>
        <p className="mt-1 text-sm text-ink-muted">
          A relative valuation for {ticker?.toUpperCase()} — how the market is currently pricing companies you
          select as peers, applied to {ticker?.toUpperCase()}&apos;s own financials. This is not the same as, and is
          not a substitute for, the DCF intrinsic valuation.
        </p>
      </div>

      <Card title="Target Company">
        {targetInfoLoading && <Skeleton variant="text" count={2} />}
        {!targetInfoLoading && targetInfoError && <ErrorState title="Couldn't load target company" message={targetInfoError} />}
        {!targetInfoLoading && !targetInfoError && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Company" value={targetInfo?.name || ticker?.toUpperCase()} sublabel={targetInfo?.ticker} small />
            <StatCard label="Sector / Industry" value={targetInfo?.industry || targetInfo?.sector || '—'} small />
            <StatCard label="Market Cap" value={formatMoney(targetInfo?.marketCap, currency)} />
          </div>
        )}
      </Card>

      <Card title="Peer Selection">
        <div className="space-y-5">
          <PeerSelector ticker={ticker} selectedPeers={selectedPeers} onAdd={addPeer} onRemove={removePeer} />

          <div className="border-t border-border pt-5">
            <StatisticSelector value={statistic} onChange={setStatistic} />
          </div>

          {calcErrors.length > 0 && (
            <div className="rounded-lg border border-critical/20 bg-critical/5 p-4">
              <p className="text-sm font-semibold text-critical">Fix the following before calculating:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-secondary">
                {calcErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={handleCalculate}
            disabled={calculating || selectedPeers.length < MIN_PEERS}
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {calculating ? 'Calculating…' : 'Calculate Comparable Valuation'}
          </button>
          {selectedPeers.length < MIN_PEERS && (
            <p className="text-xs text-ink-muted">Select at least {MIN_PEERS} peers to run the analysis.</p>
          )}
        </div>
      </Card>

      {result && (
        <>
          {(result.notes?.length > 0 || result.unavailablePeers?.length > 0) && (
            <Card title="Peer List Notes" eyebrow="Review before reading results">
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-secondary">
                {result.notes?.map((note) => (
                  <li key={note}>{note}</li>
                ))}
                {result.unavailablePeers?.map((peer) => (
                  <li key={peer.ticker} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>
                      {peer.ticker}: {peer.reason}
                    </span>
                    {peer.reason?.includes('No financial statements are available') && (
                      <button
                        type="button"
                        onClick={() => importPeerFinancials(peer.ticker)}
                        disabled={importingTicker === peer.ticker}
                        className="rounded-md border border-border px-2 py-0.5 text-xs font-semibold text-ink-secondary transition-colors hover:border-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {importingTicker === peer.ticker ? 'Importing…' : 'Import Financials'}
                      </button>
                    )}
                    {importErrors[peer.ticker] && (
                      <span className="text-xs font-medium text-critical">{importErrors[peer.ticker]}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card
            title="Peer Comparison & Trading Multiples"
            eyebrow={result.targetFiscalYear ? `Financials through FY ${result.targetFiscalYear}` : undefined}
            padded={false}
          >
            <div className="p-5">
              <PeerComparisonTable target={result.target} peers={result.peers} />
            </div>
          </Card>

          <Card title="Peer Statistics" eyebrow="Min / Max / Mean / Median / P25 / P75">
            <PeerStatisticsTable peerStatistics={result.peerStatistics} statistic={result.statistic} />
          </Card>

          <Card title="Implied Valuation" eyebrow="Peer multiple applied to the target">
            <ImpliedValuationTable impliedValuations={result.impliedValuations} currency={currency} />
          </Card>

          <Card title="Valuation Range">
            <ValuationRangeCard
              valuationRange={result.valuationRange}
              currentMarketPrice={result.currentMarketPrice}
              currency={currency}
            />
          </Card>

          <Card title="DCF vs. Comparable Company Valuation">
            <DCFComparisonCard
              dcfResult={dcfResult}
              compsValuationRange={result.valuationRange}
              compsCurrentMarketPrice={result.currentMarketPrice}
              currency={currency}
            />
          </Card>

          <div className="rounded-lg border border-warning/30 bg-warning-light/40 p-4">
            <p className="text-xs leading-relaxed text-ink-secondary">{result.disclaimer}</p>
            <p className="mt-1 text-xs text-ink-muted">
              Calculated {new Date(result.calculatedAt).toLocaleString()}
              {result.marketDataAsOf ? ` · Market data as of ${new Date(result.marketDataAsOf).toLocaleString()}` : ''}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default ComparableCompanies;
