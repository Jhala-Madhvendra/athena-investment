/**
 * Full-width section title used between card groups on pages that aren't
 * entirely wrapped in a single Card (e.g. Overview) - keeps section typography
 * consistent with the h2/subtitle pattern already used inline across tabs.
 */
function SectionHeader({ title, description, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default SectionHeader;
