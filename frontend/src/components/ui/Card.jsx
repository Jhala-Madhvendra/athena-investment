/**
 * Base card container shared by every page - replaces the old
 * .financial-analysis__card / .ba-card ad-hoc styles with one component.
 */
function Card({ title, eyebrow, action, children, className = '', padded = true }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || eyebrow || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>
            )}
            {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export default Card;
