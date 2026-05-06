import { MYSQL_LAYOUT } from '../config/mysql'
import NodeBox from './NodeBox'
import FlowEdge from './FlowEdge'

export default function NodeGraph({ currentEvent, highlightComp, activeEdge, queueLen }) {
  const { components, edges, catColors, evToComponent, evToEdge } = MYSQL_LAYOUT

  const comp = currentEvent ? evToComponent[currentEvent.ev] : null
  const edge = currentEvent ? evToEdge[currentEvent.ev] : null
  const cat = currentEvent?.cat
  const color = cat ? (catColors[cat] || '#64748b') : '#64748b'

  const traceFrom = currentEvent?.from
  const traceTo = currentEvent?.to

  return (
    <svg viewBox={MYSQL_LAYOUT.viewBox} style={{ width: '100%', height: '100%' }}>
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8" fill="#30363d" />
        </marker>
        <marker id="arrow-active" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8" fill={color} />
        </marker>
      </defs>

      {/* 框架 */}
      {MYSQL_LAYOUT.frameRect && (
        <rect {...MYSQL_LAYOUT.frameRect} fill="rgba(30,41,59,0.3)" stroke="#30363d" strokeWidth={1} rx={12} />
      )}

      {/* 标题 */}
      <text x={0} y={parseFloat(MYSQL_LAYOUT.viewBox.split(' ')[1]) - 8} 
        textAnchor="middle" fill="#64748b" fontSize={11}>
        {MYSQL_LAYOUT.title}
      </text>

      {/* 边 */}
      {edges.map(e => (
        <FlowEdge key={`${e.from}-${e.to}`}
          edge={e} components={components}
          active={activeEdge && edge && edge.from === e.from && edge.to === e.to}
          activeColor={color}
          traceFrom={traceFrom} traceTo={traceTo} />
      ))}

      {/* 节点 */}
      {components.map(c => (
        <NodeBox key={c.id} comp={c}
          highlight={highlightComp && comp === c.id} />
      ))}
    </svg>
  )
}
