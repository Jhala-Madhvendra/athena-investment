/**
 * Alert display helpers - severity -> Badge tone, type -> readable label.
 * Alert titles/messages/whyItMatters are already deterministic English
 * sentences from the backend rule engine (alert.engine.js); this file only
 * maps enum values and numbers to display tokens, nothing is generated here.
 */

const SEVERITY_TONE = { INFO: 'neutral', MEDIUM: 'warning', HIGH: 'critical' };

const TYPE_LABELS = {
  MARKET: 'Market',
  FINANCIAL: 'Financial',
  BUSINESS: 'Business',
  VALUATION: 'Valuation',
  NEWS: 'News',
  PORTFOLIO: 'Portfolio',
};

export function severityTone(severity) {
  return SEVERITY_TONE[severity] || 'neutral';
}

export function typeLabel(type) {
  return TYPE_LABELS[type] || type;
}

export function formatMetricValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (typeof value !== 'number') return String(value);
  return value.toLocaleString(undefined, { maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2 });
}
