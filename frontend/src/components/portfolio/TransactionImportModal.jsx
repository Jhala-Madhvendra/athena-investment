import { useState } from 'react'
import { Upload, X, CheckCircle2, XCircle } from 'lucide-react'
import Badge from '../ui/Badge'
import { fetchJson } from '../../lib/api'
import { parseCsv, mapRowsToTransactions } from '../../lib/csvImport'

const formatCurrency = (value) => (typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value)

/**
 * Upload -> client-side parse/preview -> submit. The backend re-validates
 * everything (ticker resolution, quantity/price/date rules, negative-
 * holdings) via the exact same path a single manual entry goes through
 * (transaction.controller.js's importTransactions) - this preview is a
 * convenience so obvious CSV problems (wrong column, unparseable date) are
 * caught before a round trip, not a second source of truth on validity.
 */
function TransactionImportModal({ portfolioId, onClose, onImported }) {
  const [rows, setRows] = useState([])
  const [parseErrors, setParseErrors] = useState([])
  const [fileName, setFileName] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [results, setResults] = useState(null)

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setResults(null)
    setSubmitError('')

    const text = await file.text()
    const { rows: parsedRows, parseErrors: errors } = mapRowsToTransactions(parseCsv(text))
    setRows(parsedRows)
    setParseErrors(errors)
  }

  const validRows = rows.filter((row) => row.valid)

  const handleImport = async () => {
    setSubmitting(true)
    setSubmitError('')

    try {
      const data = await fetchJson('/api/portfolio/transactions/import', {
        method: 'POST',
        body: JSON.stringify({
          transactions: validRows.map((row) => ({
            ticker: row.ticker,
            type: row.type,
            quantity: row.quantity,
            price: row.price,
            transactionDate: row.transactionDate,
          })),
          portfolioId,
        }),
      })
      setResults(data)
      if (data.imported > 0) onImported?.()
    } catch (requestError) {
      setSubmitError(requestError.errors?.join(' ') || requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 px-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-surface-raised p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">Import Transactions from CSV</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-muted hover:bg-surface-sunken hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {!results ? (
          <>
            <p className="mb-3 text-xs text-ink-muted">
              Expects columns for Ticker, Type (Buy/Sell), Quantity, Price, and Date - common header variants (Symbol,
              Action, Shares, Trade Date, ...) are recognized automatically.
            </p>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface-sunken/40 px-4 py-6 text-sm text-ink-secondary hover:bg-surface-sunken">
              <Upload className="h-4 w-4" aria-hidden="true" />
              {fileName || 'Choose a CSV file'}
              <input type="file" accept=".csv" onChange={handleFileChange} className="sr-only" />
            </label>

            {rows.length > 0 && (
              <>
                <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-surface-raised">
                      <tr className="border-b border-border text-xs font-semibold tracking-wide text-ink-muted uppercase">
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Ticker</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Quantity</th>
                        <th className="px-3 py-2">Price</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((row) => (
                        <tr key={row.row}>
                          <td className="px-3 py-2 tabular-nums text-ink-muted">{row.row}</td>
                          <td className="px-3 py-2 font-semibold text-ink">{row.ticker || '—'}</td>
                          <td className="px-3 py-2 text-ink">{row.type || '—'}</td>
                          <td className="px-3 py-2 tabular-nums text-ink">{row.quantity ?? '—'}</td>
                          <td className="px-3 py-2 tabular-nums text-ink">{formatCurrency(row.price)}</td>
                          <td className="px-3 py-2 tabular-nums text-ink">{row.transactionDate || '—'}</td>
                          <td className="px-3 py-2">
                            {row.valid ? (
                              <Badge tone="good">Ready</Badge>
                            ) : (
                              <Badge tone="critical">Skipped</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {parseErrors.length > 0 && (
                  <div className="mt-3 space-y-1 text-xs text-critical">
                    {parseErrors.map((error) => (
                      <p key={error.row}>Row {error.row}: {error.message}</p>
                    ))}
                  </div>
                )}

                <p className="mt-3 text-sm text-ink-muted">
                  {validRows.length} of {rows.length} row{rows.length === 1 ? '' : 's'} ready to import.
                </p>
              </>
            )}

            {submitError && <p className="mt-3 text-sm text-critical">{submitError}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-semibold text-ink-secondary hover:bg-surface-sunken"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={validRows.length === 0 || submitting}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Importing…' : `Import ${validRows.length} Transaction${validRows.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        ) : (
          <div>
            <p className="mb-3 text-sm text-ink">
              <span className="font-semibold text-good">{results.imported} imported</span>
              {results.failed > 0 && <span className="font-semibold text-critical"> · {results.failed} failed</span>}
            </p>
            <div className="max-h-72 overflow-y-auto space-y-2">
              {results.results.map((result, index) => (
                <div key={index} className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  {result.success ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" aria-hidden="true" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
                  )}
                  <span className="text-ink-secondary">
                    Row {index + 1}: {result.success ? 'Imported successfully.' : result.message}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TransactionImportModal
