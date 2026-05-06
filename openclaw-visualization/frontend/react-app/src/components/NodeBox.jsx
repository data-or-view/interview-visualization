export default function NodeBox({ comp, highlight }) {
  const isSmall = comp.size === 'small'
  const isBg = comp.bg === true
  const w = isSmall ? 40 : (isBg ? 110 : 60)
  const h = isSmall ? 20 : (isBg ? 70 : 28)
  const hasThr = comp.thr && comp.thr.length > 0

  // Background container (SQL Layer parent)
  if (isBg) {
    return (
      <g opacity={0.35}>
        <rect x={comp.x - w / 2} y={comp.y - h / 2}
          width={w} height={h} rx={8}
          fill="none" stroke={comp.color} strokeWidth={1} strokeDasharray="4 3" />
        <text x={comp.x} y={comp.y - h / 2 + 12}
          textAnchor="middle" dominantBaseline="middle"
          fill={comp.color} fontSize={8} fontWeight={600} opacity={0.5}>
          {comp.label}
        </text>
      </g>
    )
  }

  return (
    <g>
      {highlight && (
        <rect x={comp.x - w / 2 - 4} y={comp.y - h / 2 - 4}
          width={w + 8} height={h + 8} rx={8}
          fill="none" stroke={comp.color} strokeWidth={2} opacity={0.5}>
          <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.2s" repeatCount="indefinite" />
        </rect>
      )}
      <rect x={comp.x - w / 2} y={comp.y - h / 2}
        width={w} height={h} rx={6}
        fill={highlight ? comp.color + '33' : '#1e293b'}
        stroke={highlight ? comp.color : '#30363d'}
        strokeWidth={highlight ? 2.5 : 1}>
        {highlight && (
          <animate attributeName="stroke-width" values="2.5;3.5;2.5" dur="1s" repeatCount="indefinite" />
        )}
      </rect>
      {isSmall ? (
        // Small component (Lock) — icon only
        <text x={comp.x} y={comp.y + 1}
          textAnchor="middle" dominantBaseline="middle"
          fill="#e2e8f0" fontSize={10}>
          {comp.icon}
        </text>
      ) : (
        <>
          <text x={comp.x} y={comp.y + (hasThr ? -3 : 2)}
            textAnchor="middle" dominantBaseline="middle"
            fill="#e2e8f0" fontSize={10} fontWeight={600}>
            {comp.icon} {comp.label}
          </text>
          {hasThr && (
            <text x={comp.x} y={comp.y + 12}
              textAnchor="middle" dominantBaseline="middle"
              fill="#64748b" fontSize={7} fontWeight={400}>
              {comp.thr}
            </text>
          )}
        </>
      )}
    </g>
  )
}
