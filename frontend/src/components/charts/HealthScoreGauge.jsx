import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';

/**
 * Health score (0-100, single ratio against a limit) as a radial Meter -
 * fill carries severity, track is a lighter step of the same ramp.
 */
function HealthScoreGauge({ score, hex, hexLight, size = 200 }) {
  const data = [{ value: score, fill: hex }];

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <RadialBarChart
        width={size}
        height={size}
        cx="50%"
        cy="50%"
        innerRadius="72%"
        outerRadius="100%"
        barSize={size * 0.13}
        data={data}
        startAngle={90}
        endAngle={-270}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar
          background={{ fill: hexLight }}
          dataKey="value"
          cornerRadius={size * 0.065}
          angleAxisId={0}
          isAnimationActive={false}
        />
      </RadialBarChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl leading-none font-bold text-slate-900">{Math.round(score)}</span>
        <span className="mt-1 text-xs font-medium text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

export default HealthScoreGauge;
