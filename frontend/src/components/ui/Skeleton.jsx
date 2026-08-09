/**
 * Loading placeholder matching the shape of the content it stands in for -
 * replaces the plain "Loading..." text across every data-fetching page.
 */
function Skeleton({ variant = 'text', count = 3, className = '' }) {
  const items = Array.from({ length: count });

  if (variant === 'card') {
    return (
      <div className={`animate-pulse rounded-xl border border-border bg-surface-raised p-5 shadow-sm ${className}`}>
        <div className="mb-3 h-3 w-1/3 rounded bg-surface-sunken" />
        <div className="h-7 w-2/3 rounded bg-surface-sunken" />
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`animate-pulse space-y-2 ${className}`}>
        {items.map((_, i) => (
          <div key={i} className="h-6 w-full rounded bg-surface-sunken" />
        ))}
      </div>
    );
  }

  return (
    <div className={`animate-pulse space-y-2 ${className}`}>
      {items.map((_, i) => (
        <div key={i} className="h-4 rounded bg-surface-sunken" style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  );
}

export default Skeleton;
