import { useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { statementTabs, formatValue } from '../lib/statementTabs'
import Card from './ui/Card'
import EmptyState from './ui/EmptyState'
import ErrorState from './ui/ErrorState'

function StatementTable({ statementKey }) {
  const { financialStatements, currency, ticker, financialStatementsError } = useOutletContext()
  const tab = statementTabs[statementKey]

  const years = useMemo(
    () => financialStatements.map((statement) => statement.year),
    [financialStatements],
  )

  if (financialStatementsError) {
    return (
      <ErrorState title="Couldn't load financial statements" message={financialStatementsError} />
    )
  }

  if (!financialStatements || financialStatements.length === 0) {
    return (
      <EmptyState
        title="No data yet"
        message={`No financial statements have been imported for ${ticker?.toUpperCase()} yet.`}
      />
    )
  }

  return (
    <Card
      title={tab.label}
      eyebrow={currency ? `Values in reported units (${currency})` : 'Values in reported units'}
      padded={false}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-sunken">
              <th scope="col" className="sticky left-0 bg-surface-sunken px-5 py-2.5 text-left font-semibold text-ink-secondary">
                Metric
              </th>
              {years.map((year) => (
                <th
                  key={year}
                  scope="col"
                  className="px-5 py-2.5 text-right font-semibold tabular-nums text-ink-secondary"
                >
                  FY {year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tab.rows.map(([field, label]) => (
              <tr key={field} className="border-b border-border last:border-0 hover:bg-surface-sunken/60">
                <th scope="row" className="sticky left-0 bg-surface-raised px-5 py-2.5 text-left font-medium text-ink-secondary">
                  {label}
                </th>
                {financialStatements.map((statement) => (
                  <td
                    key={`${statement.year}-${field}`}
                    className="px-5 py-2.5 text-right tabular-nums text-ink"
                  >
                    {formatValue(statement[statementKey]?.[field], field)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default StatementTable
