import { useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { statementTabs, formatValue } from '../lib/statementTabs'
import Card from './ui/Card'

function StatementTable({ statementKey }) {
  const { financialStatements, currency } = useOutletContext()
  const tab = statementTabs[statementKey]

  const years = useMemo(
    () => financialStatements.map((statement) => statement.year),
    [financialStatements],
  )

  return (
    <Card
      title={tab.label}
      eyebrow={currency ? `Values in reported units (${currency})` : 'Values in reported units'}
      padded={false}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th scope="col" className="px-5 py-2.5 text-left font-semibold text-slate-600">
                Metric
              </th>
              {years.map((year) => (
                <th
                  key={year}
                  scope="col"
                  className="px-5 py-2.5 text-right font-semibold text-slate-600 tabular-nums"
                >
                  FY {year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tab.rows.map(([field, label]) => (
              <tr key={field} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <th scope="row" className="px-5 py-2.5 text-left font-medium text-slate-700">
                  {label}
                </th>
                {financialStatements.map((statement) => (
                  <td
                    key={`${statement.year}-${field}`}
                    className="px-5 py-2.5 text-right tabular-nums text-slate-900"
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
