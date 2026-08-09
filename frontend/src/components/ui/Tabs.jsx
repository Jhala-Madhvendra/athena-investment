import { NavLink } from 'react-router-dom';

/**
 * URL-synced tab bar - each tab is a real route (NavLink), so the active tab
 * is bookmarkable and back/forward navigation works per-tab.
 * items: [{ key, label, to, end? }]
 */
function Tabs({ items }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface-sunken p-1">
      {items.map((item) => (
        <NavLink
          key={item.key}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `shrink-0 rounded-md px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-surface-raised text-ink shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

export default Tabs;
