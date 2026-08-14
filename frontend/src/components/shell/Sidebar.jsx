import { useEffect, useRef, useState } from 'react';
import { NavLink, useMatch, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSpreadsheet,
  BarChart3,
  Activity,
  LineChart,
  Calculator,
  Sparkles,
  Search,
  Loader2,
  X,
  ListChecks,
  Wallet,
} from 'lucide-react';

const SEARCH_DEBOUNCE_MS = 250;

/** Ticker-independent pages - not nested under /financials/:ticker, so they use absolute `to` paths. */
const GLOBAL_NAV_ITEMS = [
  { key: 'watchlist', label: 'Watchlist', to: '/watchlist', icon: ListChecks },
  { key: 'portfolio', label: 'Portfolio', to: '/portfolio', icon: Wallet },
];

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', to: 'overview', icon: LayoutDashboard },
  { key: 'financial-statements', label: 'Financial Statements', to: 'financial-statements', icon: FileSpreadsheet },
  { key: 'financial-analysis', label: 'Financial Analysis', to: 'financial-analysis', icon: BarChart3 },
  { key: 'business-analysis', label: 'Business Analysis', to: 'business-analysis/overview', icon: Activity },
  { key: 'market-intelligence', label: 'Market Intelligence', to: 'market-intelligence', icon: LineChart },
  { key: 'valuation', label: 'Valuation', to: 'valuation', icon: Calculator },
  { key: 'ai-research', label: 'AI Research', to: 'ai-research', icon: Sparkles },
];

/**
 * Ticker/company search. Debounces free-text against the already-imported
 * company list (/api/company/search) for an instant suggestions dropdown;
 * picking a suggestion routes straight to its ticker. Enter with nothing
 * highlighted falls back to /api/company/resolve, which can import a brand
 * new ticker from Yahoo Finance that isn't in the dropdown yet.
 */
function CompanySearch({ onNavigate }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return undefined;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/company/search?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        setSuggestions(response.ok ? data.companies || [] : []);
        setIsOpen(true);
        setHighlightedIndex(-1);
      } catch (searchError) {
        if (searchError.name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, apiBaseUrl]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goToTicker = (ticker) => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    navigate(`/financials/${encodeURIComponent(ticker)}/overview`);
    onNavigate?.();
  };

  const resolveFreeText = async (text) => {
    setError('');
    setIsResolving(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/company/resolve?q=${encodeURIComponent(text)}`);
      const rawText = await response.text();
      let data;

      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error(rawText || 'Unable to resolve company.');
      }

      if (!response.ok) {
        throw new Error(data.message || 'Unable to resolve company.');
      }

      goToTicker(data.ticker);
    } catch (resolveError) {
      setError(resolveError.message);
    } finally {
      setIsResolving(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isResolving) return;

    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setError('Enter a ticker or company name.');
      return;
    }

    if (isOpen && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
      goToTicker(suggestions[highlightedIndex].ticker);
      return;
    }

    resolveFreeText(normalizedQuery);
  };

  const handleKeyDown = (event) => {
    if (!isOpen || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit} role="search" className="px-4">
        <label htmlFor="ticker-input" className="sr-only">
          Search ticker or company name
        </label>
        <div className="relative">
          {isSearching || isResolving ? (
            <Loader2
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 animate-spin text-navy-ink-muted"
              aria-hidden="true"
            />
          ) : (
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-navy-ink-muted"
              aria-hidden="true"
            />
          )}
          <input
            id="ticker-input"
            type="text"
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              setError('');
              if (!value.trim()) {
                setSuggestions([]);
                setIsOpen(false);
                setIsSearching(false);
              } else {
                setIsSearching(true);
              }
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) setIsOpen(true);
            }}
            placeholder="AAPL, Wipro, Eternal…"
            aria-label="Search ticker or company name"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls="ticker-suggestions"
            aria-activedescendant={highlightedIndex >= 0 ? `ticker-suggestion-${highlightedIndex}` : undefined}
            autoComplete="off"
            className="w-full rounded-lg border border-navy-border bg-navy-800 py-2 pr-3 pl-9 text-sm text-white placeholder:text-navy-ink-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
          />
        </div>
      </form>

      {isOpen && (
        <ul
          id="ticker-suggestions"
          role="listbox"
          className="absolute top-full right-4 left-4 z-10 mt-1.5 max-h-72 overflow-y-auto rounded-lg border border-navy-border bg-navy-800 py-1 shadow-lg"
        >
          {suggestions.length > 0 ? (
            suggestions.map((company, index) => (
              <li key={company.ticker} role="option" id={`ticker-suggestion-${index}`} aria-selected={index === highlightedIndex}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => goToTicker(company.ticker)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                    index === highlightedIndex ? 'bg-navy-700 text-white' : 'text-navy-ink-muted hover:bg-navy-700 hover:text-white'
                  }`}
                >
                  <span className="min-w-0 truncate">{company.name}</span>
                  <span className="ml-2 shrink-0 text-xs font-semibold text-brand-500">{company.ticker}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-xs text-navy-ink-muted">
              {isSearching ? 'Searching…' : 'No saved matches — press Enter to search all markets.'}
            </li>
          )}
        </ul>
      )}

      {error && <p className="mt-1.5 px-4 text-xs font-medium text-serious">{error}</p>}
    </div>
  );
}

function Logo() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600">
      <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
        <path d="M8 9.5 L5.5 4 L11 8 Z" fill="#fff" />
        <path d="M24 9.5 L26.5 4 L21 8 Z" fill="#fff" />
        <path
          d="M16 6c-4.7 0-8.5 3.8-8.5 8.5 0 3.7 2.4 6.8 5.7 8L11.8 27c-.2.6.4 1.1.9.8l3-1.8c.2 0 .2 0 .3 0l3 1.8c.6.3 1.2-.2.9-.8l-1.4-4.5c3.3-1.2 5.7-4.3 5.7-8C24.5 9.8 20.7 6 16 6z"
          fill="#fff"
        />
        <circle cx="12" cy="14.3" r="3.1" fill="#123a6e" />
        <circle cx="20" cy="14.3" r="3.1" fill="#123a6e" />
        <circle cx="12" cy="14.3" r="1.3" fill="#fff" />
        <circle cx="20" cy="14.3" r="1.3" fill="#fff" />
        <path d="M16 16.8 L14.3 19.2 L17.7 19.2 Z" fill="#cde2fb" />
      </svg>
    </span>
  );
}

/**
 * Persistent left nav rail: brand mark, ticker search, and the primary
 * section list — replaces the old top sticky Header + tab bar. Fixed on
 * desktop (lg+), an off-canvas drawer below that, driven by `mobileOpen`.
 */
function Sidebar({ mobileOpen = false, onClose }) {
  const match = useMatch('/financials/:ticker/*');
  const ticker = match?.params?.ticker || 'AAPL';

  const railContent = (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pt-6 pb-4">
      <div className="flex items-center justify-between px-4">
        <a href="/" className="flex min-w-0 items-center gap-2.5">
          <Logo />
          <span className="truncate text-base font-semibold tracking-tight text-white">Athena Finance</span>
        </a>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-navy-ink-muted hover:bg-navy-800 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <CompanySearch onNavigate={onClose} />

      <nav aria-label="Primary" className="flex-1 px-2.5">
        <ul className="mb-4 space-y-0.5 border-b border-navy-border pb-4">
          {GLOBAL_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <NavLink
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-navy-ink-muted hover:bg-navy-800 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>

        <p className="px-2 pb-2 text-xs font-semibold tracking-wide text-navy-ink-muted uppercase">
          {ticker.toUpperCase()} analysis
        </p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <NavLink
                  to={`/financials/${encodeURIComponent(ticker)}/${item.to}`}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-navy-ink-muted hover:bg-navy-800 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-4">
        <p className="text-xs leading-relaxed text-navy-ink-muted">
          Data for informational purposes only. Not investment advice.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-navy-border bg-navy-900 lg:block"
        aria-label="Sidebar"
      >
        {railContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/60" onClick={onClose} aria-hidden="true" />
          <aside
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-navy-border bg-navy-900 shadow-lg"
            aria-label="Sidebar"
          >
            {railContent}
          </aside>
        </div>
      )}
    </>
  );
}

export default Sidebar;
