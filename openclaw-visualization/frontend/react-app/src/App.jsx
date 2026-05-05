import { useState, useCallback, useEffect, useRef } from 'react'
import { useTraceData } from './hooks'
import { MYSQL_LAYOUT } from './config/mysql'
import NodeGraph from './components/NodeGraph'
import InfoPanel from './components/InfoPanel'
import Timeline from './components/Timeline'
import './App.css'

export default function App() {
  const [url, setUrl] = useState('/data/trace-mysql.jsonl')
  const { events, loading, error } = useTraceData(url)
  const [speed, setSpeed] = useState(1)
  const [filterCat, setFilterCat] = useState('all')
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [loopMode, setLoopMode] = useState(false)
  const timerRef = useRef(null)

  const currentEvent = currentIndex >= 0 && currentIndex < events.length ? events[currentIndex] : null

  // 自动播放
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
    setPlaying(false); setCurrentIndex(-1)
  }, [])

  const onSeek = useCallback((idx) => {
    setCurrentIndex(idx); setPlaying(false)
  }, [])

  const { evToComponent } = MYSQL_LAYOUT
  const highlightComp = currentEvent ? evToComponent[currentEvent.ev] : null
  const activeEdge = !!(currentEvent && MYSQL_LAYOUT.evToEdge[currentEvent.ev])

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部控制栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
        background: '#161b22', borderBottom: '1px solid #30363d' }}>
        <span style={{ fontWeight: 700, color: '#667eea', fontSize: '0.95rem' }}>MySQL 可视化</span>
        <span style={{ color: '#64748b', fontSize: '0.7rem' }}>/ 单节点</span>
        <div style={{ flex: 1 }} />

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

        <div style={{ width: 1, height: 20, background: '#30363d' }} />
        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>过滤:</span>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 4, padding: '3px', fontSize: '0.75rem' }}>
          <option value="all">全部</option>
          {Object.keys(MYSQL_LAYOUT.catColors).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* 主体 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* SVG 节点图 */}
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

        {/* 右侧面板 */}
        <div style={{ width: 280, borderLeft: '1px solid #30363d', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* InfoPanel */}
          <div style={{ flex: 1, overflow: 'auto', padding: 12, borderBottom: '1px solid #30363d' }}>
            {!loading && !error && (
              <InfoPanel events={events} currentEvent={currentEvent} currentIndex={currentIndex} />
            )}
          </div>
          {/* Timeline */}
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            {!loading && !error && (
              <Timeline events={events} currentIndex={currentIndex} onSeek={onSeek} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const btnStyle = {
  background: 'transparent', border: '1px solid #30363d', borderRadius: 4,
  color: '#e2e8f0', padding: '3px 8px', cursor: 'pointer', fontSize: '0.75rem'
}
