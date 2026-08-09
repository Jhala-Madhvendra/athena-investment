import { Menu } from 'lucide-react';
import { useMatch } from 'react-router-dom';

const SECTION_LABELS = {
  overview: 'Overview',
  'financial-statements': 'Financial Statements',
  'financial-analysis': 'Financial Analysis',
  'business-analysis': 'Business Analysis',
  'market-intelligence': 'Market Intelligence',
  valuation: 'Valuation',
};

/**
 * Slim top strip: mobile nav trigger + a breadcrumb naming the active
 * ticker/section, so the page always has orientation even though the
 * primary nav now lives in the sidebar rather than a top tab bar.
 */
function TopBar({ onOpenNav }) {
  const match = useMatch('/financials/:ticker/:section/*');
  const ticker = match?.params?.ticker;
  const section = SECTION_LABELS[match?.params?.section] || null;

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-raised/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenNav}
        className="-ml-1.5 rounded-md p-1.5 text-ink-secondary hover:bg-surface-sunken hover:text-ink lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {ticker && (
        <p className="min-w-0 truncate text-sm text-ink-muted">
          <span className="font-semibold text-ink">{ticker.toUpperCase()}</span>
          {section && (
            <>
              <span className="mx-1.5 text-ink-muted/50">/</span>
              {section}
            </>
          )}
        </p>
      )}
    </header>
  );
}

export default TopBar;
