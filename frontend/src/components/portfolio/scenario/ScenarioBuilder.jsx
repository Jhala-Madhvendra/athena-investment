import { useState } from 'react'
import { Plus, X, Pencil, Play } from 'lucide-react'
import Card from '../../ui/Card'
import Badge from '../../ui/Badge'

const TARGET_TYPE_OPTIONS = [
  { value: 'ASSET', label: 'Asset (ticker)' },
  { value: 'INDUSTRY', label: 'Industry' },
  { value: 'SECTOR', label: 'Sector' },
  { value: 'MARKET', label: 'Market (beta-based)' },
  { value: 'PORTFOLIO', label: 'Entire Portfolio' },
]

const needsTarget = (targetType) => targetType === 'ASSET' || targetType === 'INDUSTRY' || targetType === 'SECTOR'

const targetPlaceholder = (targetType) => {
  if (targetType === 'ASSET') return 'e.g. AAPL'
  if (targetType === 'INDUSTRY') return 'e.g. Consumer Electronics'
  if (targetType === 'SECTOR') return 'e.g. Technology'
  return ''
}

const ruleLabel = (rule) => {
  if (rule.targetType === 'MARKET') return 'Market'
  if (rule.targetType === 'PORTFOLIO') return 'Entire Portfolio'
  return `${rule.targetType === 'ASSET' ? '' : `${rule.targetType.charAt(0)}${rule.targetType.slice(1).toLowerCase()}: `}${rule.target}`
}

const emptyDraft = { targetType: 'SECTOR', target: '', shockPercent: '' }

/**
 * Multi-factor scenario rule editor. Each rule is {targetType, target,
 * shockPercent} - the exact shape POST /api/portfolio/scenarios/run
 * expects (see portfolio.scenario.validator.js). This component only
 * collects and edits rules; it never computes anything - Athena's product
 * principle that scenario math lives only in the deterministic backend
 * engine, never duplicated in the UI.
 */
function ScenarioBuilder({ name, onNameChange, rules, onRulesChange, presets, onLoadPreset, benchmark, onBenchmarkChange, window: windowValue, onWindowChange, onRun, running }) {
  const [draft, setDraft] = useState(emptyDraft)
  const [draftError, setDraftError] = useState('')
  const [editingIndex, setEditingIndex] = useState(null)

  const resetDraft = () => {
    setDraft(emptyDraft)
    setEditingIndex(null)
    setDraftError('')
  }

  const addOrUpdateRule = () => {
    setDraftError('')
    const shockPercent = Number(draft.shockPercent)
    if (draft.shockPercent === '' || Number.isNaN(shockPercent)) {
      setDraftError('Enter a shock percentage, e.g. -20.')
      return
    }
    if (needsTarget(draft.targetType) && !draft.target.trim()) {
      setDraftError(`Enter a ${draft.targetType.toLowerCase()} to target.`)
      return
    }

    const rule = {
      targetType: draft.targetType,
      // ASSET targets are uppercased to match how the backend normalizes tickers (portfolio.scenario.validator.js)
      // - comparing un-normalized input against existing rules below would miss a real duplicate like "aapl" vs "AAPL".
      target: needsTarget(draft.targetType) ? (draft.targetType === 'ASSET' ? draft.target.trim().toUpperCase() : draft.target.trim()) : null,
      shockPercent,
    }

    // A second rule with the same (targetType, target) is ambiguous under the precedence model - the backend
    // rejects it outright at submit time, so catch it here instead and let the user fix it immediately.
    const duplicateIndex = rules.findIndex(
      (r, i) => i !== editingIndex && r.targetType === rule.targetType && r.target === rule.target
    )
    if (duplicateIndex !== -1) {
      setDraftError(
        `A rule for ${ruleLabel(rule)} already exists - edit or remove it above instead of adding another.`
      )
      return
    }

    if (editingIndex !== null) {
      onRulesChange(rules.map((r, i) => (i === editingIndex ? rule : r)))
    } else {
      onRulesChange([...rules, rule])
    }
    resetDraft()
  }

  const startEdit = (index) => {
    const rule = rules[index]
    setDraft({ targetType: rule.targetType, target: rule.target || '', shockPercent: String(rule.shockPercent) })
    setEditingIndex(index)
    setDraftError('')
  }

  const removeRule = (index) => {
    onRulesChange(rules.filter((_, i) => i !== index))
    if (editingIndex === index) resetDraft()
  }

  return (
    <Card title="Scenario Builder" eyebrow="Define one or more hypothetical shocks">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="scenario-name" className="mb-1 block text-xs font-medium text-ink-muted">
              Scenario name
            </label>
            <input
              id="scenario-name"
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="scenario-benchmark" className="mb-1 block text-xs font-medium text-ink-muted">
              Benchmark (optional)
            </label>
            <input
              id="scenario-benchmark"
              type="text"
              value={benchmark}
              onChange={(e) => onBenchmarkChange(e.target.value)}
              placeholder="Auto"
              className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="scenario-window" className="mb-1 block text-xs font-medium text-ink-muted">
              Historical context window
            </label>
            <select
              id="scenario-window"
              value={windowValue}
              onChange={(e) => onWindowChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
            >
              {['1m', '3m', '6m', '1y', '5y'].map((w) => (
                <option key={w} value={w}>
                  {w.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {presets?.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-ink-muted">Presets - hypothetical, editable after loading</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => onLoadPreset(preset)}
                  title={preset.description}
                  className="rounded-full border border-border bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:border-brand-500 hover:text-brand-600"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border bg-surface-sunken/50 p-3">
          <p className="mb-2 text-xs font-medium text-ink-muted">{editingIndex !== null ? 'Edit rule' : 'Add rule'}</p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="rule-target-type" className="mb-1 block text-xs text-ink-muted">
                Target
              </label>
              <select
                id="rule-target-type"
                value={draft.targetType}
                onChange={(e) => setDraft((prev) => ({ ...prev, targetType: e.target.value, target: '' }))}
                className="rounded-lg border border-border bg-surface-raised px-2.5 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
              >
                {TARGET_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {needsTarget(draft.targetType) && (
              <div>
                <label htmlFor="rule-target" className="mb-1 block text-xs text-ink-muted">
                  {draft.targetType === 'ASSET' ? 'Ticker' : draft.targetType.charAt(0) + draft.targetType.slice(1).toLowerCase()}
                </label>
                <input
                  id="rule-target"
                  type="text"
                  value={draft.target}
                  onChange={(e) => setDraft((prev) => ({ ...prev, target: e.target.value }))}
                  placeholder={targetPlaceholder(draft.targetType)}
                  className="w-40 rounded-lg border border-border bg-surface-raised px-2.5 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                />
              </div>
            )}
            <div>
              <label htmlFor="rule-shock" className="mb-1 block text-xs text-ink-muted">
                Shock %
              </label>
              <input
                id="rule-shock"
                type="number"
                step="any"
                value={draft.shockPercent}
                onChange={(e) => setDraft((prev) => ({ ...prev, shockPercent: e.target.value }))}
                placeholder="-20"
                className="w-24 rounded-lg border border-border bg-surface-raised px-2.5 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={addOrUpdateRule}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {editingIndex !== null ? 'Save Rule' : 'Add Rule'}
            </button>
            {editingIndex !== null && (
              <button
                type="button"
                onClick={resetDraft}
                className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-surface-sunken"
              >
                Cancel
              </button>
            )}
          </div>
          {draftError && <p className="mt-2 text-xs text-critical">{draftError}</p>}
        </div>

        {rules.length === 0 ? (
          <p className="text-sm text-ink-muted">No rules yet - add at least one shock, or load a preset, to run a scenario.</p>
        ) : (
          <div>
            <p className="mb-2 text-xs font-medium text-ink-muted">
              Your rules ({rules.length}) - click <Pencil className="inline h-3 w-3" aria-hidden="true" /> to edit,{' '}
              <X className="inline h-3 w-3" aria-hidden="true" /> to remove
            </p>
            <div className="flex flex-wrap gap-2">
              {rules.map((rule, index) => (
                <span
                  key={`${rule.targetType}-${rule.target}-${index}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-1.5 text-sm text-ink"
                >
                  <Badge tone={rule.shockPercent < 0 ? 'critical' : rule.shockPercent > 0 ? 'good' : 'neutral'}>
                    {ruleLabel(rule)}
                  </Badge>
                  <span className="font-semibold tabular-nums">
                    {rule.shockPercent >= 0 ? '+' : ''}
                    {rule.shockPercent}%
                  </span>
                  <button type="button" onClick={() => startEdit(index)} aria-label={`Edit rule ${ruleLabel(rule)}`} className="text-ink-muted hover:text-ink">
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => removeRule(index)} aria-label={`Remove rule ${ruleLabel(rule)}`} className="text-ink-muted hover:text-critical">
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-3">
          <p className="text-xs text-ink-muted">
            A holding matched by more than one rule uses only the most specific rule (Asset &gt; Industry &gt; Sector &gt; Market &gt;
            Portfolio-wide) - shocks are never stacked or multiplied.
          </p>
          <button
            type="button"
            onClick={onRun}
            disabled={rules.length === 0 || running}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            {running ? 'Running…' : 'Run Scenario'}
          </button>
        </div>
      </div>
    </Card>
  )
}

export default ScenarioBuilder
