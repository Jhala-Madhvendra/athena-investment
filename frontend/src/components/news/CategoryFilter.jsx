/**
 * Category chip row. "All" plus every category that actually has at least
 * one stored article for this ticker - deliberately not the full fixed
 * category list, so a company with no Regulation/Legal news doesn't show a
 * dead filter. Counts come from GET /api/news/:ticker/categories.
 */
function CategoryFilter({ categories, active, onChange }) {
  const totalCount = categories.reduce((sum, entry) => sum + entry.count, 0)

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter news by category">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          active === null
            ? 'border-brand-500 bg-brand-500 text-white'
            : 'border-border bg-surface-raised text-ink-secondary hover:bg-surface-sunken'
        }`}
      >
        All ({totalCount})
      </button>
      {categories.map((entry) => (
        <button
          key={entry.category}
          type="button"
          onClick={() => onChange(entry.category)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            active === entry.category
              ? 'border-brand-500 bg-brand-500 text-white'
              : 'border-border bg-surface-raised text-ink-secondary hover:bg-surface-sunken'
          }`}
        >
          {entry.category} ({entry.count})
        </button>
      ))}
    </div>
  )
}

export default CategoryFilter
