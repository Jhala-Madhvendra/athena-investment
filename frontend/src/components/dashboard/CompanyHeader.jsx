import Badge from '../ui/Badge';
import { formatValue } from '../../lib/statementTabs';

/**
 * Company identity + live price strip at the top of Overview.
 * Daily change is the one piece of arithmetic done client-side (current -
 * previousClose) - trivial display subtraction, not a duplicated financial
 * formula; every other figure here is read directly off an API response.
 */
function CompanyHeader({ company, quote, quoteLoading = false, quoteError = '' }) {
  const current = quote?.price?.current ?? null;
  const previousClose = quote?.price?.previousClose ?? null;
  const change = current !== null && previousClose !== null ? current - previousClose : null;
  const changePercent = change !== null && previousClose ? (change / previousClose) * 100 : null;
  const isPositive = change !== null && change >= 0;
  const currency = quote?.currency || company?.currency || '';

  const subtitle = [company?.exchange, company?.sector, company?.industry, company?.country]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-raised p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight text-ink">{company?.name || '—'}</h2>
          {company?.ticker && <Badge tone="neutral">{company.ticker}</Badge>}
        </div>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>

      <div className="shrink-0 text-left sm:text-right">
        {quoteLoading ? (
          <p className="text-sm text-ink-muted">Loading price…</p>
        ) : quoteError || current === null ? (
          <p className="text-sm text-ink-muted">Price unavailable</p>
        ) : (
          <>
            <p className="text-2xl font-bold tabular-nums text-ink">
              {current.toFixed(2)} <span className="text-sm font-medium text-ink-muted">{currency}</span>
            </p>
            {change !== null && (
              <p className={`text-sm font-semibold tabular-nums ${isPositive ? 'text-good' : 'text-critical'}`}>
                {isPositive ? '+' : ''}
                {change.toFixed(2)} ({isPositive ? '+' : ''}
                {changePercent.toFixed(2)}%)
              </p>
            )}
          </>
        )}
        <p className="mt-1 text-xs text-ink-muted">
          Market Cap: {quote?.price?.marketCap ? `${formatValue(quote.price.marketCap)} ${currency}` : '—'}
        </p>
      </div>
    </div>
  );
}

export default CompanyHeader;
