import { useMemo } from 'react'
import { MYSQL_LAYOUT } from '../config/mysql'

const { catColors } = MYSQL_LAYOUT

export default function Timeline({ events, currentIndex, onSeek }) {
  const tracks = useMemo(() => {
    const t = {}
    events.forEach((evt, i) => {
      let from = 'client', to = 'connector'
      const c2t = {
        conn:   ['client', 'connector'],
        sql:    ['connector', 'sql_layer'],
        innodb: ['storage_if', 'innodb'],
        undo:   ['innodb', 'undo'],
        redo:   ['innodb', 'redo'],
        binlog: ['sql_layer', 'binlog'],
        data:   ['innodb', 'data'],
        lock:   ['storage_if', 'innodb'],
      }
      const m = c2t[evt.cat]
      if (m) { from = m[0]; to = m[1] }
      const key = `${from} → ${to}`
      if (!t[key]) t[key] = []
      t[key].push({ ...evt, _idx: i })
    })
    return Object.entries(t)
  }, [events])

  const trackOrder = [
    'client → connector', 'connector → sql_layer',
    'sql_layer → binlog',
    'storage_if → innodb', 'innodb → undo', 'innodb → redo',
    'innodb → data',
  ]

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ fontSize: '0.85rem', color: '#667eea', fontWeight: 600, marginBottom: 6 }}>
        📅 事件时间线
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {tracks.sort((a,b) => {
          const ai = trackOrder.indexOf(a[0])
          const bi = trackOrder.indexOf(b[0])
          return (ai >= 0 ? ai : 99) - (bi >= 0 ? bi : 99)
        }).map(([key, items]) => {
          const [from, to] = key.split(' → ')
          const color = catColors[items[0]?.cat] || '#64748b'
          return (
            <div key={key} style={{ background: 'rgba(30,41,59,0.4)', borderRadius: 4, padding: '4px 8px' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: 2 }}>{key}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {items.map(it => {
                  const isCurrent = it._idx === currentIndex
                  return (
                    <span key={it._idx} onClick={() => onSeek(it._idx)}
                      style={{
                        fontSize: '0.65rem', padding: '1px 4px', borderRadius: 3, cursor: 'pointer',
                        background: isCurrent ? color + '44' : 'rgba(255,255,255,0.05)',
                        color: isCurrent ? color : '#94a3b8',
                        border: isCurrent ? `1px solid ${color}` : '1px solid transparent',
                        fontWeight: isCurrent ? 700 : 400,
                      }}>
                      {it.ev} (#{it._idx})
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
