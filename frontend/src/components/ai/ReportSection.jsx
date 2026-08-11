import EvidencePanel from './EvidencePanel';

/**
 * One narrative section of the AI research report (Executive Summary,
 * Company Overview, Business Performance, ...). Labeled "AI Interpretation"
 * and paired with an EvidencePanel so the report never reads as an
 * unattributed claim - the prose is Athena's AI reading the FACT layer
 * (the underlying metrics, shown as evidence chips), not the source of the
 * numbers itself. Deliberately not styled like a chat bubble - this is a
 * research report section, not a conversation turn.
 */
function ReportSection({ title, text, evidence }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-700 uppercase">
          AI Interpretation
        </span>
      </div>
      <p className="text-sm leading-relaxed text-ink-secondary">{text}</p>
      <EvidencePanel paths={evidence} />
    </div>
  );
}

export default ReportSection;
