import { formatRatio } from '../../lib/earningsFormat'

/**
 * Neutral earnings-quality observations (Net Income vs. FCF, Revenue vs.
 * profit growth, Debt vs. cash flow) plus FCF Conversion - all computed
 * deterministically by backend/earnings/earnings.calculator.js, never by
 * an LLM. Observations are already full sentences from the backend; this
 * component only lays them out, it does not editorialize further.
 */
function EarningsQualitySection({ observations, fcfConversion }) {
  const hasObservations = Array.isArray(observations) && observations.length > 0

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">FCF Conversion</p>
        {fcfConversion?.available ? (
          <div className="mt-1.5">
            <p className="text-lg font-semibold tabular-nums text-ink">{formatRatio(fcfConversion.value)}</p>
            {fcfConversion.caveat && <p className="mt-1 text-xs text-ink-muted">{fcfConversion.caveat}</p>}
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-ink-muted">Not available.</p>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Observations</p>
        {hasObservations ? (
          <ul className="mt-1.5 space-y-2">
            {observations.map((observation) => (
              <li key={observation.type} className="text-sm text-ink-secondary">
                {observation.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-sm text-ink-muted">Not enough comparable data to generate earnings-quality observations.</p>
        )}
      </div>
    </div>
  )
}

export default EarningsQualitySection
