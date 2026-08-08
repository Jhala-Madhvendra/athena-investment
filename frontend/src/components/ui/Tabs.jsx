import { NavLink } from 'react-router-dom';

/**
 * URL-synced tab bar - each tab is a real route (NavLink), so the active tab
 * is bookmarkable and back/forward navigation works per-tab.
 * items: [{ key, label, to, end? }]
 */
function Tabs({ items }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {items.map((item) => (
        <NavLink
          key={item.key}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
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
