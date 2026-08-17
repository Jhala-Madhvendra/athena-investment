import Card from '../ui/Card'
import { formatCorrelation, correlationCellStyle } from '../../lib/portfolioAnalyticsFormat'

/**
 * A single-hue intensity wash by |correlation|, never red/green - a high
 * correlation isn't "bad" in isolation (see Correlation.md), so color
 * encodes strength of relationship only, and sign is read from the number
 * itself. Requires >= 2 holdings, per EMPTY STATES in the sprint brief -
 * a 1x1 matrix would just be a company correlated with itself, which
 * isn't meaningful information.
 */
function CorrelationMatrix({ correlation }) {
  if (!correlation) return null

  if (!correlation.available) {
    return (
      <Card title="Correlation" eyebrow="How holdings move together">
        <p className="text-sm text-ink-muted">{correlation.reason}</p>
      </Card>
    )
  }

  const { tickers, matrix, observations } = correlation

  return (
    <Card title="Correlation" eyebrow="How holdings' historical returns move together" padded={false}>
      <div className="overflow-x-auto p-5">
        <table className="text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1" />
              {tickers.map((ticker) => (
                <th key={ticker} className="px-2 py-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  {ticker}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map((rowTicker) => (
              <tr key={rowTicker}>
                <th className="px-2 py-1 text-left text-xs font-semibold tracking-wide text-ink-muted uppercase">{rowTicker}</th>
                {tickers.map((colTicker) => {
                  const value = matrix[rowTicker]?.[colTicker] ?? null
                  const obs = observations?.[rowTicker]?.[colTicker]
                  return (
                    <td
                      key={colTicker}
                      className="min-w-16 rounded-md px-2 py-1.5 text-center tabular-nums text-ink"
                      style={correlationCellStyle(value)}
                      title={typeof obs === 'number' ? `${obs} overlapping trading days` : undefined}
                    >
                      {rowTicker === colTicker ? '—' : formatCorrelation(value)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-xs text-ink-muted">
          Computed from each pair's overlapping historical daily returns. A cell showing — either compares a ticker with
          itself or didn't have enough overlapping trading days to compute reliably.
        </p>
      </div>
    </Card>
  )
}

export default CorrelationMatrix
