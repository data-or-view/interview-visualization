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
    data: 'Data', lock: '锁', mvcc: 'MVCC',
    row: 'Row Ptrs', misc: '杂项',
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
    read_view: '创建快照', read_done: '释放快照',
    purge: '清理旧版本',
    hidden_ptrs: '隐藏指针更新',
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
          ['输入来源', currentEvent?.from || '-'],
          ['输出目标', currentEvent?.to || '-'],
          ['线程状态', currentEvent?.ts_state || '-'],
          ['线程模式', currentEvent?.thr || 'thread-per-conn'],
          ['连接ID', currentEvent?.cid != null ? String(currentEvent.cid) : '-'],
          ['事务ID', currentEvent?.trx_id != null ? String(currentEvent.trx_id) : '-'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.78rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ color: '#94a3b8' }}>{k}</span>
            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{v}</span>
          </div>
        ))}
        {/* input 字段 */}
        {currentEvent?.input && (
          <div style={{ marginTop: 6, padding: '6px 8px', background: 'rgba(30,41,59,0.8)', borderRadius: 6, border: '1px solid rgba(102,126,234,0.15)' }}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 3 }}>输入数据 (input)</div>
            <div style={{ fontSize: '0.7rem', color: '#e2e8f0', wordBreak: 'break-all', fontFamily: 'monospace', maxHeight: 60, overflow: 'auto' }}>
              {currentEvent.input.length > 200 ? currentEvent.input.slice(0, 200) + '...' : currentEvent.input}
            </div>
          </div>
        )}
      </div>

      {/* 锁信息卡片 */}
      {currentEvent?.ev === 'lock_wait' && (
        <div style={{ background: 'rgba(236,72,153,0.1)', borderRadius: 8, padding: 10, marginBottom: 10,
          border: '1px solid rgba(236,72,153,0.4)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ec4899', marginBottom: 4 }}>
            🔒 锁等待
          </div>
          <div style={{ fontSize: '0.75rem', color: '#f472b6' }}>
            等待获取行锁，当前被其他事务持有
          </div>
        </div>
      )}

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

      {/* 隐藏指针卡片 (hidden_ptrs) */}
      {currentEvent?.ev === 'hidden_ptrs' && (
        <div style={{ background: 'rgba(244,63,94,0.1)', borderRadius: 8, padding: 10, marginBottom: 10,
          border: '1px solid rgba(244,63,94,0.4)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f43f5e', marginBottom: 4 }}>
            📍 隐藏指针更新
          </div>
          {[
            ['数据表', currentEvent.table || '-'],
            ['旧 DB_TRX_ID', currentEvent.old_trx_id != null ? String(currentEvent.old_trx_id) : '-'],
            ['新 DB_TRX_ID', currentEvent.new_trx_id != null ? String(currentEvent.new_trx_id) : '-'],
            ['DB_ROLL_PTR', currentEvent.roll_ptr != null ? String(currentEvent.roll_ptr) : '-'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.75rem' }}>
              <span style={{ color: '#94a3b8' }}>{k}</span>
              <span style={{ color: '#fca5a5', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <div style={{ fontSize: '0.7rem', color: '#fb7185', marginTop: 6, borderTop: '1px solid rgba(244,63,94,0.2)', paddingTop: 6 }}>
            DB_TRX_ID 记录最后修改该行的事务 ID，DB_ROLL_PTR 指向 Undo 日志中的旧版本
          </div>
        </div>
      )}

      {/* MVCC 上下文 (read_view / read_done / purge) */}
      {currentEvent?.cat === 'mvcc' && (
        <div style={{ background: 'rgba(6,182,212,0.1)', borderRadius: 8, padding: 10, marginBottom: 10,
          border: '1px solid rgba(6,182,212,0.4)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#22d3ee', marginBottom: 4 }}>
            👁️ MVCC 上下文
          </div>
          {[
            ['操作', evLabel[currentEvent.ev] || currentEvent.ev],
            ['事务 ID', currentEvent.trx_id != null ? String(currentEvent.trx_id) : '-'],
            ['批大小', currentEvent.batch_size != null ? String(currentEvent.batch_size) : '-'],
            ['线程数', currentEvent.n_threads != null ? String(currentEvent.n_threads) : '-'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.75rem' }}>
              <span style={{ color: '#94a3b8' }}>{k}</span>
              <span style={{ color: '#67e8f9', fontWeight: 600 }}>{v}</span>
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
