import { useState, useEffect } from 'react'

const EMPTY_STATE = { items: [], loading: true }

export default function DemoPanel({ onLoadDemo }) {
  const [state, setState] = useState(EMPTY_STATE)
  const [activeId, setActiveId] = useState(null)
  const [expanded, setExpanded] = useState(true)

  // ── 动态加载 manifest.json ──
  useEffect(() => {
    fetch('/demos/manifest.json')
      .then(r => r.json())
      .then(items => setState({ items, loading: false }))
      .catch(err => {
        console.error('DemoPanel: manifest load failed', err)
        setState({ items: [], loading: false })
      })
  }, [])

  // ── 点击演示按钮 ──
  const handleClick = (item) => {
    setActiveId(item.file)
    // 传文件名给 App，由 App 设置 URL → useTraceData 自动加载
    onLoadDemo(item)
  }

  const { items, loading } = state

  return (
    <div style={styles.wrapper}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <span style={{ fontSize: '1.1rem' }}>⏱</span>
        <span style={styles.headerText}>SQL 演示</span>
        <span style={styles.count}>{items.length}</span>
        <span style={styles.toggle}>{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div style={styles.list}>
          {loading && <div style={styles.loading}>加载演示列表…</div>}
          {!loading && items.length === 0 && (
            <div style={styles.loading}>暂无演示数据</div>
          )}
          {items.map((item, idx) => {
            const icon = item._icon || '📋'
            const color = item._color || '#64748b'
            const title = item._title || `演示 ${idx + 1}`
            const desc = item._desc || ''
            const tags = item._tags || []
            const sql = item._sql || ''
            const isActive = activeId === item.file

            return (
              <div
                key={item.file}
                style={{
                  ...styles.card,
                  borderColor: isActive ? color : 'transparent',
                  background: isActive ? `${color}15` : '#1e293b',
                }}
                onClick={() => handleClick(item)}
              >
                {/* 标题行 */}
                <div style={styles.cardHead}>
                  <span style={{ fontSize: '1rem' }}>{icon}</span>
                  <span style={styles.cardTitle}>{title}</span>
                  <span style={{ ...styles.badge, background: color }}>
                    {item._type?.startsWith('select') ? 'SELECT'
                      : item._type?.startsWith('insert') ? 'INSERT'
                      : item._type?.startsWith('update') ? 'UPDATE'
                      : item._type?.startsWith('delete') ? 'DELETE'
                      : 'SQL'}
                  </span>
                  <span style={styles.countBadge}>{item._n_events || '?'} 事件</span>
                </div>

                {/* SQL */}
                {sql && (
                  <div style={styles.sqlLine}>{sql}</div>
                )}

                {/* 描述 */}
                {desc && <div style={styles.cardDesc}>{desc}</div>}

                {/* 标签 */}
                {tags.length > 0 && (
                  <div style={styles.tags}>
                    {tags.map((tag, i) => (
                      <span key={i} style={styles.tag}>{tag}</span>
                    ))}
                    {item._n_btree > 0 && (
                      <span style={styles.tag}>🌲 B+树 {item._n_btree}步</span>
                    )}
                    {item._n_backtable > 0 && (
                      <span style={{ ...styles.tag, background: '#1e3a5f' }}>↩ 回表 {item._n_backtable}次</span>
                    )}
                    {item._n_undo > 0 && (
                      <span style={{ ...styles.tag, background: '#3b1f1f' }}>📝 undo {item._n_undo}</span>
                    )}
                    {item._n_hiddenptr > 0 && (
                      <span style={{ ...styles.tag, background: '#1a3a1a' }}>🔗 版本链</span>
                    )}
                  </div>
                )}

                {/* 分类统计 */}
                {Object.keys(item).filter(k => k.startsWith('_cat_')).length > 0 && (
                  <div style={styles.catLine}>
                    {Object.entries(item)
                      .filter(([k]) => k.startsWith('_cat_'))
                      .filter(([_, v]) => v > 0)
                      .map(([k, v]) => (
                        <span key={k} style={styles.cat}>{k.replace('_cat_', '')}({v})</span>
                      ))
                    }
                  </div>
                )}
              </div>
            )
          })}

          {/* 添加提示 */}
          {!loading && (
            <div style={styles.addHint}>
              新增演示 → 添加 .jsonl 到 public/demos/ 并更新 manifest.json
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 样式 ──
const styles = {
  wrapper: {
    background: '#0f172a',
    borderRadius: 10,
    border: '1px solid #334155',
    overflow: 'hidden',
    minWidth: 280,
    maxWidth: 360,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 14px',
    cursor: 'pointer',
    borderBottom: '1px solid #1e293b',
    userSelect: 'none',
  },
  headerText: {
    flex: 1,
    color: '#e2e8f0',
    fontWeight: 700,
    fontSize: '0.95rem',
    letterSpacing: 1,
  },
  count: {
    background: '#1e293b',
    color: '#64748b',
    padding: '0 7px',
    borderRadius: 8,
    fontSize: '0.7rem',
    fontWeight: 700,
  },
  toggle: {
    color: '#64748b',
    fontSize: '0.8rem',
  },
  loading: {
    padding: 16,
    color: '#94a3b8',
    fontSize: '0.85rem',
  },
  list: {
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxHeight: 420,
    overflowY: 'auto',
  },
  card: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  cardTitle: {
    color: '#e2e8f0',
    fontWeight: 600,
    fontSize: '0.85rem',
    flex: 1,
  },
  badge: {
    padding: '1px 6px',
    borderRadius: 4,
    color: 'white',
    fontSize: '0.65rem',
    fontWeight: 700,
  },
  countBadge: {
    color: '#64748b',
    fontSize: '0.65rem',
    whiteSpace: 'nowrap',
  },
  sqlLine: {
    color: '#a78bfa',
    fontSize: '0.65rem',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginBottom: 2,
  },
  cardDesc: {
    color: '#94a3b8',
    fontSize: '0.7rem',
    lineHeight: 1.4,
    marginBottom: 4,
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 3,
  },
  tag: {
    padding: '1px 5px',
    borderRadius: 3,
    background: '#1e293b',
    color: '#cbd5e1',
    fontSize: '0.6rem',
  },
  catLine: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 3,
  },
  cat: {
    padding: '0 4px',
    borderRadius: 2,
    background: '#0d1117',
    color: '#64748b',
    fontSize: '0.55rem',
  },
  addHint: {
    textAlign: 'center',
    color: '#334155',
    fontSize: '0.6rem',
    padding: '6px 8px',
  },
}
