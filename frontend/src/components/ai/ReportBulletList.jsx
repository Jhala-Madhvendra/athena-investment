import Badge from '../ui/Badge';

const TONE_LABELS = {
  good: 'Strength',
  critical: 'Risk',
  warning: 'Consideration',
  neutral: 'Data Gap',
};

/**
 * Strengths / Risks / Considerations / Data Gaps - each item is one
 * Athena-grounded bullet (ai.validator.js rejects empty entries), styled by
 * tone so Risks read as risk, Strengths read as strength, at a glance -
 * the sprint's "clearly distinguish FACT / INTERPRETATION / RISK" UX
 * requirement applied to these list sections.
 */
function ReportBulletList({ title, items, tone }) {
  if (!items || items.length === 0) {
    return null;
  }

  const borderColor = { good: 'border-l-good', critical: 'border-l-critical', warning: 'border-l-warning', neutral: 'border-l-border-strong' }[tone];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        <Badge tone={tone}>{TONE_LABELS[tone]}</Badge>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className={`rounded-md border border-border ${borderColor} border-l-[3px] bg-surface-sunken px-3 py-2 text-sm text-ink-secondary`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ReportBulletList;
