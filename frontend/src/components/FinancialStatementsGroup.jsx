import { useParams } from 'react-router-dom'
import Tabs from './ui/Tabs'
import StatementTable from './StatementTable'

const SUBTABS = [
  { key: 'income-statement', label: 'Income Statement', statementKey: 'incomeStatement' },
  { key: 'balance-sheet', label: 'Balance Sheet', statementKey: 'balanceSheet' },
  { key: 'cash-flow', label: 'Cash Flow', statementKey: 'cashFlow' },
]

/**
 * "Financial Statements" tab: groups Income Statement/Balance Sheet/Cash Flow
 * under one nav entry with sub-tabs, mirroring BusinessAnalysis.jsx's own
 * subtab pattern (one parent route + :subtab param) rather than three
 * separate top-level tabs.
 */
function FinancialStatementsGroup() {
  const { ticker, subtab } = useParams()
  const activeSubtab = SUBTABS.find((t) => t.key === subtab) || SUBTABS[0]

  return (
    <div className="space-y-6">
      <Tabs
        items={SUBTABS.map((t) => ({
          key: t.key,
          label: t.label,
          to: `/financials/${ticker}/financial-statements/${t.key}`,
          end: true,
        }))}
      />
      <StatementTable statementKey={activeSubtab.statementKey} />
    </div>
  )
}

export default FinancialStatementsGroup
