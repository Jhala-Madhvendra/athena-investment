import { useState } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import FinancialStatements from '../FinancialStatements';
import FinancialStatementsGroup from '../FinancialStatementsGroup';
import FinancialAnalysis from '../FinancialAnalysis';
import BusinessAnalysis from '../BusinessAnalysis';
import MarketIntelligence from '../MarketIntelligence';
import Overview from '../Overview';
import Valuation from '../Valuation';
import AIResearch from '../AIResearch';
import Earnings from '../Earnings';
import Industry from '../Industry';
import NewsEvents from '../NewsEvents';
import Watchlist from '../Watchlist';
import Portfolio from '../Portfolio';
import Alerts from '../Alerts';
import Screener from '../Screener';
import Simulator from '../Simulator';
import SimulatorPortfolio from '../simulator/SimulatorPortfolio';
import Account from '../Account';

/** Backward-compat redirect for the old flat statement URLs (pre-Sprint-5). */
function RedirectToStatement({ subtab }) {
  const { ticker } = useParams();
  return <Navigate to={`/financials/${ticker}/financial-statements/${subtab}`} replace />;
}

/**
 * The authenticated app's shell: Sidebar nav, TopBar, and every route that
 * assumes a logged-in-with-anonymous-token user browsing their own data.
 * Extracted out of App.jsx so a public, unauthenticated route (/share/:token)
 * can render without this nav chrome - a share-link recipient has no
 * Athena account and no reason to see Watchlist/Portfolio/Alerts links to
 * data that isn't theirs. See App.jsx for the top-level route split.
 */
function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <AuthProvider>
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-h-screen flex-col lg:pl-64 print:pl-0">
        <TopBar onOpenNav={() => setMobileNavOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Routes>
            <Route path="/" element={<Navigate to="/financials/AAPL/overview" replace />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/screener" element={<Screener />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/simulator/:portfolioId" element={<SimulatorPortfolio />} />
            <Route path="/account" element={<Account />} />
            <Route path="/financials/:ticker" element={<FinancialStatements />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<Overview />} />
              <Route path="financial-statements" element={<Navigate to="income-statement" replace />} />
              <Route path="financial-statements/:subtab" element={<FinancialStatementsGroup />} />
              <Route path="income-statement" element={<RedirectToStatement subtab="income-statement" />} />
              <Route path="balance-sheet" element={<RedirectToStatement subtab="balance-sheet" />} />
              <Route path="cash-flow" element={<RedirectToStatement subtab="cash-flow" />} />
              <Route path="financial-analysis" element={<FinancialAnalysis />} />
              <Route path="business-analysis" element={<Navigate to="overview" replace />} />
              <Route path="business-analysis/:subtab" element={<BusinessAnalysis />} />
              <Route path="market-intelligence" element={<MarketIntelligence />} />
              <Route path="valuation" element={<Navigate to="dcf" replace />} />
              <Route path="valuation/:subtab" element={<Valuation />} />
              <Route path="ai-research" element={<AIResearch />} />
              <Route path="earnings" element={<Earnings />} />
              <Route path="industry" element={<Industry />} />
              <Route path="news" element={<NewsEvents />} />
            </Route>
            <Route path="*" element={<Navigate to="/financials/AAPL/overview" replace />} />
          </Routes>
        </main>
      </div>
    </div>
    </AuthProvider>
  );
}

export default AppShell;
