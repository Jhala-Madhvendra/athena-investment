import { useState } from 'react'
import Card from '../../ui/Card'
import { formatMoney, formatPercent } from '../../../lib/compsFormat'
import { getSentimentTier } from '../../../lib/scoreTokens'

const ruleLabel = (rule) => {
  if (rule.targetType === 'MARKET') return 'Market'
  if (rule.targetType === 'PORTFOLIO') return 'Entire Portfolio'
  return `${rule.targetType.charAt(0)}${rule.targetType.slice(1).toLowerCase()}: ${rule.target}`
}

const DEFAULT_SHOCK_VALUES = '-10, -15, -20, -25, -30'

/**
 * Flexes ONE rule's shock across a small set of values (deterministic,
 * "do not create a giant matrix" per the sprint brief) and shows the
 * resulting portfolio impact for each - the scenario-table pattern from
 * the brief (e.g. "Technology Shock | Portfolio Impact").
 */
function SensitivityPanel({ rules, onRun, sensitivity, loading }) {
  const [ruleIndex, setRuleIndex] = useState(0)
  const [shockValuesInput, setShockValuesInput] = useState(DEFAULT_SHOCK_VALUES)
  const [error, setError] = useState('')

  if (!rules || rules.length === 0) return null

  // Clamped rather than reset via an effect - the builder can shrink `rules`
  // (a rule removed) between renders, so the previously selected index might
  // now be out of range; this derives a valid selection without an extra
  // render pass.
  const selectedIndex = Math.min(ruleIndex, rules.length - 1)
  const selectedRule = rules[selectedIndex]
  const maxAbsImpact = sensitivity?.length
    ? Math.max(...sensitivity.map((row) => Math.abs(row.absoluteChangeUSD || 0)), 1)
    : 1

  const handleRun = () => {
    setError('')
    const shockValues = shockValuesInput
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((v) => !Number.isNaN(v))

    if (shockValues.length < 2 || shockValues.length > 5) {
      setError('Enter between 2 and 5 comma-separated shock percentages.')
      return
    }

    onRun({ targetType: selectedRule.targetType, target: selectedRule.target, shockValues })
  }

  return (
    <Card title="Sensitivity Analysis" eyebrow="Flex one rule across a small range of shocks">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="sensitivity-rule" className="mb-1 block text-xs text-ink-muted">
            Rule to flex
          </label>
          <select
            id="sensitivity-rule"
            value={selectedIndex}
            onChange={(e) => setRuleIndex(Number(e.target.value))}
            className="rounded-lg border border-border bg-surface-raised px-2.5 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
          >
            {rules.map((rule, index) => (
              <option key={`${rule.targetType}-${rule.target}-${index}`} value={index}>
                {ruleLabel(rule)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sensitivity-values" className="mb-1 block text-xs text-ink-muted">
            Shock values (%), comma-separated
          </label>
          <input
            id="sensitivity-values"
            type="text"
            value={shockValuesInput}
            onChange={(e) => setShockValuesInput(e.target.value)}
            className="w-56 rounded-lg border border-border bg-surface-raised px-2.5 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={loading}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Running…' : 'Run Sensitivity'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-critical">{error}</p>}

      {sensitivity?.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {sensitivity.map((row) => {
            const tier = getSentimentTier(typeof row.absoluteChangeUSD === 'number' ? row.absoluteChangeUSD >= 0 : null)
            const widthPercent = (Math.abs(row.absoluteChangeUSD || 0) / maxAbsImpact) * 100
            return (
              <div key={row.shockPercent} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 tabular-nums text-ink-secondary">
                  {row.shockPercent >= 0 ? '+' : ''}
                  {row.shockPercent}%
                </span>
                <div className="h-4 flex-1 rounded bg-surface-sunken">
                  <div className="h-4 rounded" style={{ width: `${widthPercent}%`, backgroundColor: tier.hex }} />
                </div>
                <span className="w-28 shrink-0 text-right tabular-nums text-ink">{formatMoney(row.absoluteChangeUSD)}</span>
                <span className="w-16 shrink-0 text-right tabular-nums text-ink-muted">{formatPercent(row.percentageChange)}</span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export default SensitivityPanel
