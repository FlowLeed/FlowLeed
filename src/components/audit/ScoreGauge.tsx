interface ScoreGaugeProps {
  score: number;
  size?: number;
  label?: string;
}

const gradeFor = (score: number) => {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
};

export const scoreColor = (score: number) => {
  if (score >= 80) return 'hsl(142 71% 45%)';   // green
  if (score >= 60) return 'hsl(38 92% 50%)';    // amber
  return 'hsl(0 84% 60%)';                       // red
};

export const ScoreGauge = ({ score, size = 180, label }: ScoreGaugeProps) => {
  const clamped = Math.max(0, Math.min(100, score || 0));
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (clamped / 100) * circ;
  const color = scoreColor(clamped);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-4xl font-bold leading-none" style={{ color }}>{gradeFor(clamped)}</span>
          <span className="mt-1 text-xs text-muted-foreground">{clamped}/100</span>
        </div>
      </div>
      {label && <div className="mt-2 text-sm text-muted-foreground text-center">{label}</div>}
    </div>
  );
};
