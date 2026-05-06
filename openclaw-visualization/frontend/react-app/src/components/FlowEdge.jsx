function edgeEndpoints(f, t) {
  const dx = t.x - f.x, dy = t.y - f.y
  const angle = Math.atan2(dy, dx), pad = 34
  return {
    x1: f.x + Math.cos(angle) * pad,
    y1: f.y + Math.sin(angle) * pad,
    x2: t.x - Math.cos(angle) * pad,
    y2: t.y - Math.sin(angle) * pad,
  }
}

export default function FlowEdge({ edge, components, active, activeColor, traceFrom, traceTo }) {
  const f = components.find(c => c.id === edge.from)
  const t = components.find(c => c.id === edge.to)
  if (!f || !t) return null
  const pts = edgeEndpoints(f, t)

  // 自环边（同一组件）→ 跳过画线
  if (edge.from === edge.to) return null

  // 跳过背景组件的边
  if (f.bg || t.bg) return null

  return (
    <g>
      <line x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
        stroke="#30363d" strokeWidth={1.5}
        markerEnd="url(#arrow)" />
      {active && (
        <>
          <line x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
            stroke={activeColor} strokeWidth={3} strokeDasharray="8 6" opacity={0.85}>
            <animate attributeName="stroke-dashoffset" from="0" to="-28" dur="0.5s" repeatCount="indefinite" />
          </line>
          <line x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
            stroke={activeColor} strokeWidth={6} opacity={0.12}>
            <animate attributeName="opacity" values="0.08;0.2;0.08" dur="0.6s" repeatCount="indefinite" />
          </line>
          {[0, 0.25, 0.5, 0.75].map((off, i) => (
            <circle r={3} fill={activeColor} key={i}>
              <animateMotion dur="0.5s" repeatCount="indefinite" begin={`${i * 0.12}s`}
                path={`M${pts.x1},${pts.y1} L${pts.x2},${pts.y2}`} />
            </circle>
          ))}
          {/* from/to 标签 */}
          {traceFrom && traceTo && (
            <>
              <text x={(pts.x1 + pts.x2) / 2} y={(pts.y1 + pts.y2) / 2 - 8}
                textAnchor="middle" dominantBaseline="middle"
                fill={activeColor} fontSize={7} fontWeight={600}
                opacity={0.8}>
                {traceFrom} → {traceTo}
              </text>
            </>
          )}
        </>
      )}
    </g>
  )
}
