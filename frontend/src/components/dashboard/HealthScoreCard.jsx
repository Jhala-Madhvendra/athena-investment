import Badge from '../ui/Badge';
import HealthScoreGauge from '../charts/HealthScoreGauge';
import { getScoreTier } from '../../lib/scoreTokens';

/**
 * Compact health-score summary (gauge + label/risk/explanation) for the
 * Overview page. Deliberately a standalone component rather than a shared
 * extraction from BusinessAnalysis.jsx's inline card - see engineering notes
 * on why BusinessAnalysis.jsx wasn't touched this sprint.
 */
function HealthScoreCard({ healthScore, size = 140 }) {
  const scoreTier = getScoreTier(healthScore.overall);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <HealthScoreGauge score={healthScore.overall} hex={scoreTier.hex} hexLight={scoreTier.hexLight} size={size} />
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <h3 className="text-lg font-bold text-ink">{healthScore.label}</h3>
        <p className="mt-1 text-sm text-ink-secondary">
          Risk Level: <Badge tone={scoreTier.className}>{healthScore.riskLevel}</Badge>
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{healthScore.explanation}</p>
      </div>
    </div>
  );
}

export default HealthScoreCard;
