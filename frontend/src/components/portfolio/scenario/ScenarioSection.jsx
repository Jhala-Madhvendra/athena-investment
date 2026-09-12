import { useEffect, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import SectionHeader from '../../ui/SectionHeader'
import EmptyState from '../../ui/EmptyState'
import ErrorState from '../../ui/ErrorState'
import ScenarioBuilder from './ScenarioBuilder'
import ScenarioResult from './ScenarioResult'
import ScenarioComparisonView from './ScenarioComparisonView'
import SaveScenarioButton from './SaveScenarioButton'
import SavedScenariosWatchlist from './SavedScenariosWatchlist'
import { fetchJson } from '../../../lib/api'

/**
 * Portfolio -> Scenario Analysis. A self-contained, fetch-on-demand section
 * (same shape as PortfolioAnalyticsSection) appended to the Portfolio page -
 * scenario math never runs client-side, this component only builds the
 * request and renders the deterministic backend response. See
 * research/product/AdvancedScenarioProductDesign.md.
 */
function ScenarioSection({ holdingsCount }) {
  const [presets, setPresets] = useState([])
  const [presetsError, setPresetsError] = useState('')

  const [name, setName] = useState('Custom Scenario')
  const [rules, setRules] = useState([])
  const [benchmark, setBenchmark] = useState('')
  const [window_, setWindow] = useState('1y')

  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')

  const [sensitivityLoading, setSensitivityLoading] = useState(false)

  const [pendingScenarios, setPendingScenarios] = useState([])
  const [compareResult, setCompareResult] = useState(null)
  const [compareError, setCompareError] = useState('')
  const [comparing, setComparing] = useState(false)

  const [watchRefreshKey, setWatchRefreshKey] = useState(0)

  useEffect(() => {
    if (holdingsCount === 0) return undefined

    const controller = new AbortController()
    const load = async () => {
      try {
        const data = await fetchJson('/api/portfolio/scenarios/presets', undefined, controller.signal)
        setPresets(data.presets || [])
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setPresetsError(requestError.message)
      }
    }
    load()
    return () => controller.abort()
  }, [holdingsCount])

  const runScenario = async (overrides = {}) => {
    setRunning(overrides.sensitivity ? false : true)
    if (overrides.sensitivity) setSensitivityLoading(true)
    setRunError('')

    const body = {
      name,
      rules,
      benchmark: benchmark.trim() || undefined,
      window: window_,
      sensitivity: overrides.sensitivity ?? undefined,
    }

    try {
      const data = await fetchJson('/api/portfolio/scenarios/run', { method: 'POST', body: JSON.stringify(body) })
      setResult(data)
    } catch (requestError) {
      setRunError(requestError.errors?.join(' ') || requestError.message)
    } finally {
      setRunning(false)
      setSensitivityLoading(false)
    }
  }

  const handleLoadPreset = (preset) => {
    setName(preset.name)
    setRules(preset.rules.map((rule) => ({ ...rule })))
    setResult(null)
  }

  const handleAddToComparison = () => {
    if (!result) return
    setPendingScenarios((prev) => {
      const withoutSameName = prev.filter((s) => s.name !== name)
      return [...withoutSameName, { name, rules }]
    })
    setCompareResult(null)
  }

  const handleRemoveFromComparison = (scenarioName) => {
    setPendingScenarios((prev) => prev.filter((s) => s.name !== scenarioName))
    setCompareResult((prev) => (prev ? { ...prev, comparisonTable: prev.comparisonTable.filter((s) => s.name !== scenarioName) } : prev))
  }

  const handleCompare = async () => {
    setComparing(true)
    setCompareError('')
    try {
      const data = await fetchJson('/api/portfolio/scenarios/compare', {
        method: 'POST',
        body: JSON.stringify({ scenarios: pendingScenarios, benchmark: benchmark.trim() || undefined, window: window_ }),
      })
      setCompareResult(data)
    } catch (requestError) {
      setCompareError(requestError.errors?.join(' ') || requestError.message)
    } finally {
      setComparing(false)
    }
  }

  if (holdingsCount === 0) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Scenario Analysis" description="Model hypothetical shocks against your current holdings." />
        <EmptyState
          icon={FlaskConical}
          title="No scenarios yet"
          message="Add holdings to your portfolio to build and run a scenario."
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Scenario Analysis"
        description="Model hypothetical shocks against your current holdings - not a forecast."
      />

      {presetsError && <p className="text-xs text-critical">Couldn't load presets: {presetsError}</p>}

      <ScenarioBuilder
        name={name}
        onNameChange={setName}
        rules={rules}
        onRulesChange={(next) => {
          setRules(next)
          setResult(null)
        }}
        presets={presets}
        onLoadPreset={handleLoadPreset}
        benchmark={benchmark}
        onBenchmarkChange={setBenchmark}
        window={window_}
        onWindowChange={setWindow}
        onRun={() => runScenario()}
        running={running}
      />

      {runError && <ErrorState title="Couldn't run scenario" message={runError} />}

      <ScenarioResult
        result={result}
        onAddToComparison={handleAddToComparison}
        onRunSensitivity={(sensitivity) => runScenario({ sensitivity })}
        sensitivityLoading={sensitivityLoading}
      />

      {result && (
        <SaveScenarioButton
          name={name}
          rules={rules}
          benchmark={benchmark.trim()}
          window={window_}
          defaultThresholdPercent={result.percentageChange}
          onSaved={() => setWatchRefreshKey((k) => k + 1)}
        />
      )}

      <SavedScenariosWatchlist refreshKey={watchRefreshKey} />

      {pendingScenarios.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-sunken/50 px-4 py-3 text-sm">
          <span className="text-ink-muted">Ready to compare:</span>
          {pendingScenarios.map((s) => (
            <span key={s.name} className="rounded-full border border-border bg-surface-raised px-2.5 py-1 text-xs font-semibold text-ink">
              {s.name}
            </span>
          ))}
          <button
            type="button"
            onClick={handleCompare}
            disabled={pendingScenarios.length < 2 || comparing}
            className="ml-auto rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {comparing ? 'Comparing…' : pendingScenarios.length < 2 ? 'Add one more to compare' : 'Compare'}
          </button>
        </div>
      )}

      {compareError && <ErrorState title="Couldn't compare scenarios" message={compareError} />}

      {compareResult && (
        <ScenarioComparisonView
          comparisonList={compareResult.comparisonTable}
          onRemove={handleRemoveFromComparison}
          onClear={() => {
            setPendingScenarios([])
            setCompareResult(null)
          }}
        />
      )}

      <p className="text-xs text-ink-muted">
        Scenario analysis models hypothetical assumptions you control - it is not a forecast, prediction, or investment
        recommendation.
      </p>
    </div>
  )
}

export default ScenarioSection
