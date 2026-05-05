import { useMemo } from 'react'
import { MYSQL_LAYOUT } from '../config/mysql'

export default function InfoPanel({ events, currentEvent, currentIndex }) {
  const stats = useMemo(() => {
    const byCat = {}
    const dts = []
    events.forEach(e => {
      byCat[e.cat] = (byCat[e.cat] || 0) + 1
      if (e.dt && e.dt > 0) dts.push(e.dt)
    })
    const catOrder = ['conn', 'sql', 'innodb', 'undo', 'redo', 'binlog', 'data', 'lock', 'misc']
    const catList = catOrder.filter(c => byCat[c]).map(c => ({ cat: c, count: byCat[c] }))
    dts.sort((a,b)=>a-b)
    const lat = dts.length ? {
      p50: dts[Math.floor(dts.length * 0.5)],
      p99: dts[Math.floor(dts.length * 0.99)],
      max: dts[dts.length - 1],
    } : null
    return { byCat: catList, total: events.length, lat }
  }, [events])

  const catLabel = {
    conn: '连接', sql: 'SQL', innodb: 'InnoDB',
    undo: 'Undo', redo: 'Redo', binlog: 'Binlog',
    data: 'Data', lock: '锁', misc: '杂项',
  }

  const evLabel = {
    recv: '接收请求', parse: '解析SQL', optimize: '优化',
    exec: '执行', lock_wait: '等待锁',
    undo_write: '写入Undo', undo_read: '读取Undo',
    redo_prepare: 'Redo Prepare', redo_commit: 'Redo Commit',
    binlog_write: '写Binlog', binlog_read: '恢复Binlog',
    flush_dirty: '刷脏页', page_read: '读页面',
    start: '连接建立', cleaning: '清理',
    commit: '事务提交',
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '0 4px' }}>
      <div style={{ fontSize: '0.9rem', color: '#667eea', fontWeight: 600, marginBottom: 10 }}>
        📊 MySQL 状态
      </div>

      <div style={{ background: 'rgba(30,41,59,0.6)', borderRadius: 8, padding: 10, marginBottom: 10,
        border: '1px solid rgba(102,126,234,0.2)' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>MySQL 8.4.0</div>
        {[
          ['事件总数', String(stats.total)],
          ['当前索引', `#${currentIndex}`],
          ['当前事件', currentEvent ? (evLabel[currentEvent.ev] || currentEvent.ev) : '-'],
          ['事件类型', currentEvent?.ev || '-'],
          ['所属分类', currentEvent?.cat ? (catLabel[currentEvent.cat] || currentEvent.cat) : '-'],
          ['线程状态', currentEvent?.ts_state || '-'],
          ['线程模式', currentEvent?.thr || 'thread-per-conn'],
          ['连接ID', currentEvent?.cid != null ? String(currentEvent.cid) : '-'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.78rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ color: '#94a3b8' }}>{k}</span>
            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* 2PC 上下文 */}
      {currentEvent?.xid != null && (
        <div style={{ background: 'rgba(249,115,22,0.1)', borderRadius: 8, padding: 10, marginBottom: 10,
          border: '1px solid rgba(249,115,22,0.3)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fb923c', marginBottom: 4 }}>🔄 事务上下文</div>
          {[
            ['XID', String(currentEvent.xid)],
            ['LSN', currentEvent.lsn != null ? String(currentEvent.lsn) : '-'],
            ['Binlog Pos', currentEvent.binlog_pos != null ? String(currentEvent.binlog_pos) : '-'],
            ['Undo No', currentEvent.undo_no != null ? String(currentEvent.undo_no) : '-'],
            ['表', currentEvent.table || '-'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.75rem' }}>
              <span style={{ color: '#94a3b8' }}>{k}</span>
              <span style={{ color: '#fdba74', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* 分类分布 */}
      <div style={{ fontSize: '0.85rem', color: '#667eea', fontWeight: 600, marginBottom: 6 }}>📈 分类分布</div>
      <div style={{ background: 'rgba(30,41,59,0.6)', borderRadius: 8, padding: 10, border: '1px solid rgba(102,126,234,0.2)' }}>
        {stats.byCat.map(({ cat, count }) => {
          const color = MYSQL_LAYOUT.catColors[cat] || '#64748b'
          return (
            <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.78rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                {catLabel[cat] || cat}
              </span>
              <span style={{ color: '#e2e8f0' }}>{count}</span>
            </div>
          )
        })}
      </div>

      {stats.lat && (
        <>
          <div style={{ fontSize: '0.85rem', color: '#f97316', fontWeight: 600, marginTop: 10, marginBottom: 6 }}>
            ⏱ 时延统计
          </div>
          <div style={{ background: 'rgba(30,41,59,0.6)', borderRadius: 8, padding: 10, border: '1px solid rgba(249,115,22,0.2)' }}>
            {[
              ['P50', `${stats.lat.p50.toFixed(0)}μs`],
              ['P99', `${stats.lat.p99.toFixed(0)}μs`],
              ['Max', `${stats.lat.max.toFixed(0)}μs`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.78rem' }}>
                <span style={{ color: '#94a3b8' }}>{k}</span>
                <span style={{ color: '#fb923c', fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
