import { useState, useCallback, useEffect, useRef } from 'react'
import { useTraceData } from './hooks'
import { MYSQL_LAYOUT } from './config/mysql'
import NodeGraph from './components/NodeGraph'
import InfoPanel from './components/InfoPanel'
import Timeline from './components/Timeline'
import BtreeCanvas from './components/BtreeCanvas'
import DemoPanel from './components/DemoPanel'
import './App.css'

export default function App() {
  const [url, setUrl] = useState('/data/trace-mysql.jsonl')
  const { events, loading, error } = useTraceData(url)
  const [speed, setSpeed] = useState(1)
  const [filterCat, setFilterCat] = useState('all')
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [loopMode, setLoopMode] = useState(true)
  const [viewMode, setViewMode] = useState('arch') // 'arch' | 'btree'
  const [demoSql, setDemoSql] = useState('')
  const [demoInfo, setDemoInfo] = useState(null)

  const handleLoadDemo = useCallback((meta) => {
    setDemoSql(meta._sql || '')
    setDemoInfo(meta)
    setUrl('/demos/' + meta.file)
    setCurrentIndex(-1)
    setPlaying(true)
    // Auto-switch view: SELECT demos → B+ tree, DML → architecture
    if (meta._type && meta._type.startsWith('select')) {
      setViewMode('btree')
    } else {
      setViewMode('arch')
    }
  }, [])

  // 自动播放
  useEffect(() => {
    if (events.length > 0 && !playing) {
      setPlaying(true)
    }
  }, [events.length])
  const timerRef = useRef(null)

  const currentEvent = currentIndex >= 0 && currentIndex < events.length ? events[currentIndex] : null

  useEffect(() => {
    if (!playing || events.length === 0) return
    const dt = currentEvent?.dt || 100
    const baseInterval = Math.max(50, dt * (1 / speed))
    const interval = Math.min(baseInterval, 300)

    timerRef.current = setTimeout(() => {
      setCurrentIndex(prev => {
        if (prev >= events.length - 1) {
          if (loopMode) return 0
          else { setPlaying(false); return prev }
        }
        return prev + 1
      })
    }, interval)
    return () => clearTimeout(timerRef.current)
  }, [playing, currentIndex, events, speed, loopMode, currentEvent])

  const onPlayToggle = useCallback(() => {
    if (!playing && currentIndex >= events.length - 1) setCurrentIndex(-1)
    setPlaying(p => !p)
  }, [playing, currentIndex, events.length])

  const onReset = useCallback(() => {
    setCurrentIndex(-1)
    if (!playing) setPlaying(true)
  }, [playing])

  const onSeek = useCallback((idx) => {
    setCurrentIndex(idx); setPlaying(false)
  }, [])

  const { evToComponent } = MYSQL_LAYOUT
  const highlightComp = currentEvent ? evToComponent[currentEvent.ev] : null
  const activeEdge = !!(currentEvent && MYSQL_LAYOUT.evToEdge[currentEvent.ev])

  const tabStyle = (active) => ({
    background: active ? '#30363d' : 'transparent',
    border: '1px solid #30363d', borderRadius: 4,
    color: active ? '#e2e8f0' : '#64748b',
    padding: '3px 10px', cursor: 'pointer', fontSize: '0.75rem'
  })

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部控制栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
        background: '#161b22', borderBottom: '1px solid #30363d' }}>
        <span style={{ fontWeight: 700, color: '#667eea', fontSize: '0.95rem' }}>MySQL 可视化</span>
        <button onClick={() => setViewMode('arch')} style={tabStyle(viewMode === 'arch')}>
          🏗 架构图
        </button>
        <button onClick={() => setViewMode('btree')} style={tabStyle(viewMode === 'btree')}>
          🌲 B+ 树
        </button>
        <div style={{ width: 1, height: 20, background: '#30363d' }} />

        {/* Demo SQL 展示条 */}
        {demoSql && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#1e293b', borderRadius: 6, padding: '2px 10px',
            border: '1px solid #2d3748', flex: 1, maxWidth: 500, minWidth: 200,
          }}>
            <span style={{ color: '#667eea', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {demoInfo?.title?.slice(0, 8) || 'SQL'}
            </span>
            <code style={{
              color: '#e2e8f0', fontSize: '0.72rem', fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{demoSql}</code>
            <button onClick={() => { setDemoSql(''); setDemoInfo(null); setUrl('/data/trace-mysql.jsonl') }}
              style={{ ...btnStyle, padding: '1px 6px', fontSize: '0.65rem', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              ✕ 清除
            </button>
          </div>
        )}

        <div style={{ width: 1, height: 20, background: '#30363d' }} />

        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>数据:</span>
        <input value={url} onChange={e => setUrl(e.target.value)}
          style={{ width: 200, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4,
            padding: '3px 6px', color: '#e2e8f0', fontSize: '0.75rem' }} />
        <button onClick={() => setUrl(u => u + '')} style={btnStyle}>📂 加载</button>

        <div style={{ width: 1, height: 20, background: '#30363d' }} />
        <button onClick={onPlayToggle} disabled={events.length === 0} style={{ ...btnStyle, opacity: events.length ? 1 : 0.4 }}>
          {playing ? '⏸ 暂停' : '▶ 播放'}
        </button>
        <button onClick={onReset} style={btnStyle}>⏮ 重播</button>
        <select value={speed} onChange={e => setSpeed(Number(e.target.value))}
          style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 4, padding: '3px', fontSize: '0.75rem' }}>
          {[0.5, 1, 2, 4].map(v => <option key={v} value={v}>{v}x</option>)}
        </select>
        <button onClick={() => setLoopMode(l => !l)} style={{ ...btnStyle, background: loopMode ? '#30363d' : 'transparent' }}>
          {loopMode ? '🔁 循环' : '🔁 单次'}
        </button>

        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
          {events.length} 事件 | {events.length > 0 ? `${((currentIndex + 1) / events.length * 100).toFixed(1)}%` : '0%'}
        </span>
      </div>

      {/* 主体 */}
      {viewMode === 'arch' ? (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: 8, borderRight: '1px solid #30363d', overflow: 'auto' }}>
            <DemoPanel onLoadDemo={handleLoadDemo} />
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loading ? (
              <span style={{ color: '#64748b' }}>加载中...</span>
            ) : error ? (
              <span style={{ color: '#ef4444' }}>加载失败: {error}</span>
            ) : (
              <NodeGraph currentEvent={currentEvent} highlightComp={highlightComp}
                activeEdge={activeEdge} />
            )}
          </div>
          <div style={{ width: 280, borderLeft: '1px solid #30363d', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'auto', padding: 12, borderBottom: '1px solid #30363d' }}>
              {!loading && !error && (
                <InfoPanel events={events} currentEvent={currentEvent} currentIndex={currentIndex} />
              )}
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              {!loading && !error && (
                <Timeline events={events} currentIndex={currentIndex} onSeek={onSeek} />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: 8, borderRight: '1px solid #30363d', overflow: 'auto' }}>
            <DemoPanel onLoadDemo={handleLoadDemo} />
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <span style={{ color: '#64748b', padding: 40, display: 'block' }}>加载中...</span>
            ) : error ? (
              <span style={{ color: '#ef4444', padding: 40, display: 'block' }}>加载失败: {error}</span>
            ) : (
              <BtreeCanvas events={events} currentIndex={currentIndex} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const btnStyle = {
  background: 'transparent', border: '1px solid #30363d', borderRadius: 4,
  color: '#e2e8f0', padding: '3px 8px', cursor: 'pointer', fontSize: '0.75rem'
}
