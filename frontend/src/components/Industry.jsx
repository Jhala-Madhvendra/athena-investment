import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Factory } from 'lucide-react';
import Card from './ui/Card';
import Skeleton from './ui/Skeleton';
import ErrorState from './ui/ErrorState';
import EmptyState from './ui/EmptyState';
import StatCard from './ui/StatCard';
import IndustryComparisonTable from './industry/IndustryComparisonTable';
import StrengthsWeaknesses from './industry/StrengthsWeaknesses';
import PositioningBars from './industry/PositioningBars';
import PotentialPeersTable from './industry/PotentialPeersTable';

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const fetchJson = async (url, signal) => {
  const response = await fetch(url, { signal });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || 'Request failed.');
    error.status = response.status;
    throw error;
  }
  return data;
};

/**
 * Industry & Sector Intelligence tab. Answers "how does this company
 * compare with the industry it operates in?" using Athena's own tracked
 * company database as the reference universe (see backend/industry/) -
 * distinct from Sprint 7's user-selected Comps peer set, and never claims
 * to be a complete industry census (see the `universe` note rendered
 * below). Two independent fetches (main payload + peer suggestions) so a
 * slow/failed peer-discovery call never blocks the benchmark tables.
 */
function Industry() {
  const { ticker } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [peersData, setPeersData] = useState(null);
  const [peersError, setPeersError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError('');
      setData(null);
      setPeersData(null);
      setPeersError('');

      try {
        const result = await fetchJson(`${apiBaseUrl}/api/industry/${encodeURIComponent(ticker)}`, controller.signal);
        setData(result);
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }

      try {
        const peers = await fetchJson(`${apiBaseUrl}/api/industry/${encodeURIComponent(ticker)}/peers`, controller.signal);
        setPeersData(peers);
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setPeersError(requestError.message);
        }
      }
    };

    load();
    return () => controller.abort();
  }, [ticker]);

  /**
   * Pre-fills the Comps peer picker with this suggestion (navigation state
   * only) - it is NOT added to any calculation here. The user still has to
   * review it on the Comps tab and explicitly click Calculate; see
   * ComparableCompanies.jsx's handling of location.state.suggestedPeer.
   */
  const useForComps = (peer) => {
    navigate(`/financials/${encodeURIComponent(ticker)}/valuation/comps`, {
      state: { suggestedPeer: { ticker: peer.ticker, name: peer.name } },
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="card" count={1} />
        <Skeleton variant="table" count={5} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Couldn't load industry intelligence"
        message={`${error} Import financial statements for ${ticker?.toUpperCase()} before viewing industry comparisons.`}
      />
    );
  }

  if (!data) {
    return <EmptyState icon={Factory} title="No industry data available" message={`No data is available for ${ticker?.toUpperCase()} yet.`} />;
  }

  const combinedComparison = [...data.growthComparison, ...data.profitabilityComparison, ...data.valuationComparison];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink">Industry &amp; Sector Intelligence</h2>
        <p className="mt-1 text-sm text-ink-muted">
          How {data.company || ticker?.toUpperCase()} compares with the industry it operates in, using Athena&apos;s own tracked
          company database as the reference universe. This is analytical context, not an investment recommendation.
        </p>
      </div>

      <Card title="Industry Overview">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Sector" value={data.sector || '—'} small />
          <StatCard label="Industry" value={data.industry || '—'} small />
          <StatCard label="Benchmark Universe" value={`${data.universe.size} ${data.universe.size === 1 ? 'company' : 'companies'}`} sublabel={data.universe.level !== 'none' ? `${data.universe.level} level` : undefined} />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-muted">{data.universe.note}</p>
      </Card>

      <Card title="Company vs Industry" eyebrow="Median-based benchmark">
        <IndustryComparisonTable entries={combinedComparison} />
      </Card>

      <Card title="Relative Positioning" eyebrow="Percentile within the reference universe">
        <PositioningBars positioning={data.positioning} />
      </Card>

      <Card title="Relative Strengths &amp; Weaknesses">
        <StrengthsWeaknesses strengths={data.strengths} weaknesses={data.weaknesses} />
      </Card>

      <Card title="Potential Peers" eyebrow="Suggestions only - not the Comps peer set">
        {peersError && <p className="text-sm text-critical">{peersError}</p>}
        {!peersError && !peersData && <Skeleton variant="table" count={3} />}
        {!peersError && peersData && (
          <>
            <PotentialPeersTable peers={peersData.peers} onUseForComps={useForComps} />
            <p className="mt-3 text-xs leading-relaxed text-ink-muted">{peersData.limitation}</p>
          </>
        )}
      </Card>

      <div className="rounded-lg border border-warning/30 bg-warning-light/40 p-4">
        <p className="text-xs leading-relaxed text-ink-secondary">{data.methodology}</p>
        <p className="mt-2 text-xs leading-relaxed text-ink-secondary">{data.disclaimer}</p>
        <p className="mt-1 text-xs text-ink-muted">
          Financial period: FY{data.dataFreshness?.financialPeriod ?? '—'}
          {data.dataFreshness?.marketDataAsOf
            ? ` · Market data as of ${new Date(data.dataFreshness.marketDataAsOf).toLocaleString()}`
            : ''}
        </p>
      </div>
    </div>
  );
}

export default Industry;
