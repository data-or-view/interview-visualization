import { useState, useEffect, useRef, useCallback } from 'react'

export function useTraceData(url) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true); setError(null)
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text() })
      .then(text => {
        const lines = text.trim().split('\n').filter(Boolean)
        const parsed = lines.map((l, i) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
        // 过滤掉 meta 事件（演示描述头，不在可视化中展示）
        .filter(d => d.cat !== 'meta')
        setEvents(parsed)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [url])

  return { events, loading, error }
}

export function usePlayback(events, { speed = 1, loop = false } = {}) {
  const [playing, setPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const timerRef = useRef(null)

  const reset = useCallback(() => {
    setPlaying(false); setCurrentIndex(-1); clearInterval(timerRef.current)
  }, [])

  useEffect(() => {
    if (!playing || events.length === 0) return
    const dt = events[0].dt || 100
    const baseInterval = Math.max(50, dt * (speed > 0 ? 1 / speed : 1))
    const interval = Math.min(baseInterval, 500)

    setCurrentIndex(0)
    timerRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= events.length - 1) {
          if (loop) { return 0 }
          else { clearInterval(timerRef.current); setPlaying(false); return prev }
        }
        return prev + 1
      })
    }, interval)
    return () => clearInterval(timerRef.current)
  }, [playing, events, speed, loop])

  return { playing, setPlaying, currentIndex, setCurrentIndex, reset }
}

export function useFilter(events, filterCat) {
  const indices = events.reduce((acc, e, i) => {
    if (filterCat === 'all' || e.cat === filterCat) acc.push(i)
    return acc
  }, [])
  return indices
}
