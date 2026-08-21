import Card from '../../ui/Card'
import StatCard from '../../ui/StatCard'
import HoldingImpactTable from './HoldingImpactTable'
import SectorImpactTable from './SectorImpactTable'
import SensitivityPanel from './SensitivityPanel'
import { formatMoney, formatPercent } from '../../../lib/compsFormat'
import { getSentimentTier } from '../../../lib/scoreTokens'

const ruleSummary = (rule) => {
  const target = rule.targetType === 'MARKET' ? 'Market' : rule.targetType === 'PORTFOLIO' ? 'Entire Portfolio' : rule.target
  return `${target}: ${rule.shockPercent >= 0 ? '+' : ''}${rule.shockPercent}%`
}

/**
 * Everything the sprint brief's "Result View" asks for: current vs
 * scenario value, absolute/percentage change, holding/sector attribution,
 * historical context, and assumptions - kept as visually separate blocks
 * so "what the scenario assumes" (Assumptions) is never confused with
 * "what actually happened" (Historical Context). See
 * research/finance/ScenarioAttribution.md.
 */
function ScenarioResult({ result, onAddToComparison, onRunSensitivity, sensitivityLoading }) {
  if (!result) return null

  const tier = getSentimentTier(typeof result.absoluteChangeUSD === 'number' ? result.absoluteChangeUSD >= 0 : null)
  const { assumptions, historicalContext } = result

  return (
    <div className="space-y-4">
      <Card
        title={result.scenario?.name || 'Scenario Result'}
        eyebrow="Hypothetical - not a forecast"
        action={
          onAddToComparison && (
            <button
              type="button"
              onClick={onAddToComparison}
              className="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-surface-sunken"
            >
              Add to Comparison
            </button>
          )
        }
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Current Portfolio Value" value={formatMoney(result.currentPortfolioValueUSD)} />
          <StatCard label="Scenario Portfolio Value" value={formatMoney(result.scenarioPortfolioValueUSD)} hex={tier.hex} />
          <StatCard label="Absolute Change" value={formatMoney(result.absoluteChangeUSD)} hex={tier.hex} />
          <StatCard label="Percentage Change" value={formatPercent(result.percentageChange)} hex={tier.hex} />
        </div>
      </Card>

      <HoldingImpactTable holdingImpact={result.holdingImpact} />
      <SectorImpactTable sectorImpact={result.sectorImpact} />

      {onRunSensitivity && (
        <SensitivityPanel rules={assumptions?.rules} onRun={onRunSensitivity} sensitivity={result.sensitivity} loading={sensitivityLoading} />
      )}

      <Card title="Historical Context" eyebrow="What actually happened - separate from the scenario above">
        {historicalContext?.available ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-ink-muted">Historical Volatility ({historicalContext.window})</dt>
                <dd className="mt-0.5 text-sm text-ink">{formatPercent(historicalContext.volatilityPercent)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-ink-muted">Historical Beta</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {typeof historicalContext.beta === 'number' ? historicalContext.beta.toFixed(2) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-ink-muted">Historical Max Drawdown</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {formatPercent(historicalContext.maxDrawdown?.maxDrawdownPercent)}
                  {historicalContext.maxDrawdown?.troughDate ? ` (trough ${historicalContext.maxDrawdown.troughDate})` : ''}
                </dd>
              </div>
            </div>
            <p className="mt-4 text-xs text-ink-muted">{historicalContext.note}</p>
          </>
        ) : (
          <p className="text-sm text-ink-muted">{historicalContext?.message || 'Historical context unavailable for the selected period.'}</p>
        )}
      </Card>

      {assumptions && (
        <Card title="Assumptions" eyebrow="Read this before interpreting the numbers above">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-ink-muted">Scenario Rules</dt>
              <dd className="mt-0.5 text-sm text-ink">{assumptions.rules?.map(ruleSummary).join(', ')}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-ink-muted">Portfolio Value Used</dt>
              <dd className="mt-0.5 text-sm text-ink">{formatMoney(assumptions.portfolioValueUSD)}</dd>
            </div>
            {typeof assumptions.betaUsed === 'number' && (
              <div>
                <dt className="text-xs font-medium text-ink-muted">Portfolio Beta Used</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {assumptions.betaUsed.toFixed(2)}
                  {typeof assumptions.betaCoveragePercent === 'number' && (
                    <span className="ml-1 text-xs text-ink-muted">({assumptions.betaCoveragePercent.toFixed(0)}% coverage)</span>
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-ink-muted">Data Timestamp</dt>
              <dd className="mt-0.5 text-sm text-ink">{new Date(assumptions.dataTimestamp).toLocaleString()}</dd>
            </div>
          </dl>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-ink-muted">
            {assumptions.methodologyNotes?.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          {assumptions.unpricedHoldingsExcluded?.length > 0 && (
            <p className="mt-2 text-xs text-ink-muted">
              Excluded (no live price): {assumptions.unpricedHoldingsExcluded.join(', ')}.
            </p>
          )}
        </Card>
      )}
    </div>
  )
}

export default ScenarioResult
