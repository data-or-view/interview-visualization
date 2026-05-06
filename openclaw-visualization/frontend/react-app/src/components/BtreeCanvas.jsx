import { useEffect, useRef, useMemo, useState } from 'react'
import * as d3 from 'd3'

// ─── Page content simulator ──────────────────────────────────────────

/** Given index metadata, generate realistic page contents with actual key values */
function generatePageContent(page_no, level, n_recs, indexType, indexName, childPg, parentIndex) {
  const isLeaf = level === 0
  const isNameIdx = indexName && indexName.toLowerCase().includes('name')
  const isClustIdx = indexType === 'clustered'
  const isValIdx = indexName && indexName.toLowerCase().includes('val')

  // Total rows in the table
  const TOTAL_ROWS = 405016
  // Key space partition for this page based on page_no ordering
  const pageHashFudge = (page_no * 997 + 331) % TOTAL_ROWS

  const content = {
    page_no,
    level,
    n_recs: Math.max(n_recs, isLeaf ? 180 : level === 1 ? 468 : 2),
    isLeaf,
    indexType,
    indexName,
    records: [],
    slots: [],
    freeSpace: 0,
    header: {},
    keyRange: null,
  }

  // Page header
  content.header = {
    page_no,
    page_level: level,
    n_recs: content.n_recs,
    n_heap: content.n_recs + 2,
    prev_page: page_no > 1 ? page_no - 1 : null,
    next_page: null,
    max_trx_id: 0,
    page_type: isLeaf ? 'LEAF' : 'NODE_PTR',
    free_start: 38 + 56,
    free_end: 16384 - 8,
  }

  // ── Helper: generate realistic key value ──
  function makeKey(seq, withPK) {
    if (isNameIdx) {
      const n = ((seq * 887 + page_no * 113) % TOTAL_ROWS) + 1
      return { key: `user_${n}`, pk: n }
    }
    if (isValIdx) {
      const v = ((seq * 599 + page_no * 271) % 10000000) + 1
      return { key: String(v), pk: seq % TOTAL_ROWS + 1 }
    }
    if (isClustIdx) {
      const id = ((seq * 313 + page_no * 151) % TOTAL_ROWS) + 1
      const val = ((seq * 599 + page_no * 271) % 10000000) + 1
      const n = ((seq * 887 + page_no * 113) % TOTAL_ROWS) + 1
      return { key: `${id} (val=${val})`, pk: id, val }
    }
    return { key: `key_${seq}`, pk: seq }
  }

  // ── Generate records ──
  const nDisplay = Math.min(content.n_recs, isLeaf ? 5 : 7)

  if (isLeaf) {
    // Calculate first seq for this page
    const nPages = isClustIdx ? 2225 : (isNameIdx ? 1238 : 618)
    const rowsPerPage = Math.ceil(TOTAL_ROWS / nPages)
    const pageRank = (page_no * 31 + 17) % nPages
    const firstSeq = pageRank * rowsPerPage

    for (let i = 0; i < nDisplay; i++) {
      const r = makeKey(firstSeq + i, false)
      content.records.push({
        key: r.key,
        offset: content.header.free_start + i * 90,
        pk: r.pk,
      })
    }
    if (content.n_recs > nDisplay) {
      content.records.push({ key: '...', ellipsis: true })
      // Last key in this page
      const lastR = makeKey(firstSeq + rowsPerPage - 1, false)
      content.records.push({ key: lastR.key, is_last: true })
    }
    // Key range
    if (content.records.length >= 2) {
      content.keyRange = {
        min: content.records[0].key,
        max: content.records[content.records.length - 1].key,
      }
    }
  } else {
    // Non-leaf: generate node pointers
    const nChildren = Math.min(content.n_recs, 468)
    const nShow = Math.min(nChildren, nDisplay)

    for (let i = 0; i < nShow; i++) {
      const childPage = childPg ? childPg + i : page_no * 100 + i + 1
      const r = makeKey(i * Math.floor(TOTAL_ROWS / nShow), false)
      content.records.push({
        key: r.key,
        child_page: childPage,
        offset: i * 14,
      })
    }
    if (nChildren > nShow) {
      content.records.push({ key: '...', ellipsis: true })
      const lastR = makeKey(TOTAL_ROWS - 1, false)
      content.records.push({ key: lastR.key, child_page: childPg || 0, is_last: true })
    }
  }

  // ── Slot directory ──
  const nSlots = Math.min(Math.max(2, Math.floor(content.n_recs / 4)), 8)
  content.slots = []
  for (let i = 0; i < nSlots; i++) {
    const recIdx = Math.floor(i * content.n_recs / nSlots)
    content.slots.push({
      slot_n: i,
      rec_offset: 16384 - 8 - (nSlots - i) * 4,
      record_idx: recIdx,
    })
  }

  // ── Space estimation ──
  const avgRecBytes = isLeaf ? 90 : 14
  const usedByRecords = content.n_recs * avgRecBytes
  const usedBySlots = content.slots.length * 4
  const headerSize = 38 + 56 + 8
  content.freeSpace = Math.max(0, 16384 - headerSize - usedByRecords - usedBySlots)
  content.usedPct = ((16384 - content.freeSpace) / 16384 * 100).toFixed(0)

  return content
}

/** Build page contents for all nodes in the parsed trees */
function buildPageContents(trees, eventsWithPage) {
  const pageMap = new Map() // table::index → { page_no → { level, n_recs, child_pg... } }

  for (const e of eventsWithPage) {
    if (e.cat !== 'btree' || e.ev !== 'btree_search') continue
    const key = `${e.table||''}::${e.index||''}`
    if (!pageMap.has(key)) pageMap.set(key, new Map())
    const pages = pageMap.get(key)
    const existing = pages.get(e.page_no) || {}
    pages.set(e.page_no, {
      level: e.level != null ? e.level : existing.level,
      n_recs: e.n_recs || existing.n_recs,
      child_pg: e.child_pg != null ? e.child_pg : existing.child_pg,
      type: e.type,
      index: e.index,
    })
    // Also add child page
    if (e.child_pg != null && !pages.has(e.child_pg)) {
      pages.set(e.child_pg, {
        level: (e.level || 0) - 1,
        n_recs: 0,
        child_pg: null,
        type: e.type,
        index: e.index,
      })
    }
  }

  // Generate content for each page
  for (const [, pages] of pageMap) {
    for (const [pg, info] of pages) {
      info.content = generatePageContent(pg, info.level, info.n_recs, info.type, info.index, info.child_pg)
    }
    // Link next_page within same level
    const pagesByLevel = {}
    for (const [pg, info] of pages) {
      const lv = info.level ?? 0
      if (!pagesByLevel[lv]) pagesByLevel[lv] = []
      pagesByLevel[lv].push({ pg, info })
    }
    for (const [, pgs] of Object.entries(pagesByLevel)) {
      pgs.sort((a, b) => a.pg - b.pg)
      for (let i = 0; i < pgs.length - 1; i++) {
        pgs[i].info.content.header.next_page = pgs[i + 1].pg
      }
    }
  }

  return pageMap
}

// ─── Colors ──────────────────────────────────────────────────────────

const COLORS = {
  clustered: { base: '#3b82f6', bg: '#1e3a5f', active: '#1e40af', light: '#93c5fd' },
  secondary: { base: '#10b981', bg: '#0a2e1a', active: '#065f46', light: '#6ee7b7' },
  back_table: '#f59e0b',
  slot: '#475569',
  record_bar: '#334155',
  free: '#1e293b',
  header_bg: '#1a1a2e',
}

// ─── Main Component ──────────────────────────────────────────────────

export default function BtreeCanvas({ events, currentIndex }) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)

  const treeData = useMemo(() => {
    const trees = new Map()
    for (const e of events) {
      if (e.cat !== 'btree') continue
      const key = `${e.table}::${e.index}`
      if (!trees.has(key)) {
        trees.set(key, {
          index: e.index,
          type: e.type || 'clustered',
          table: e.table,
          nodes: new Map(),
          edges: new Set(),
        })
      }
      const t = trees.get(key)
      if (!t.nodes.has(e.page_no)) {
        t.nodes.set(e.page_no, { n_recs: e.n_recs || 0 })
      }
      const existing = t.nodes.get(e.page_no)
      if (e.level != null) existing.level = e.level
      if (e.n_recs != null) existing.n_recs = e.n_recs
      if (e.child_pg != null) {
        t.edges.add(`${e.page_no}→${e.child_pg}`)
        if (!t.nodes.has(e.child_pg)) {
          t.nodes.set(e.child_pg, { level: e.level - 1, n_recs: 0 })
        }
      }
    }

    // Filter to only show user tables (skip mysql/*)
    const filtered = new Map()
    for (const [key, t] of trees) {
      if (t.table && t.table.startsWith('mysql/')) continue
      filtered.set(key, t)
    }
    // If no user tables, show all
    const finalTrees = filtered.size > 0 ? filtered : trees

    const result = []
    for (const [, t] of finalTrees) {
      const children = new Map()
      const allChildPg = new Set()
      for (const edge of t.edges) {
        const [p, c] = edge.split('→').map(Number)
        if (!children.has(p)) children.set(p, [])
        children.get(p).push(c)
        allChildPg.add(c)
      }
      const roots = [...t.nodes.keys()].filter(pg => !allChildPg.has(pg))
      if (roots.length === 0) continue

      function buildHierarchy(pg) {
        const n = t.nodes.get(pg) || { level: 0, n_recs: 0 }
        // Fetch child info for display
        const childPages = children.has(pg) ? children.get(pg) : []
        const childInfo = childPages.map(cp => {
          const cn = t.nodes.get(cp) || {}
          return { page_no: cp, level: cn.level, n_recs: cn.n_recs }
        })

        return {
          name: `P${pg}`,
          page_no: pg,
          level: n.level,
          n_recs: n.n_recs || 0,
          childPages: childInfo,
          children: childPages.length > 0 ? childPages.map(c => buildHierarchy(c)) : undefined,
        }
      }

      for (const r of roots) {
        const root = buildHierarchy(r)
        root.index = t.index
        root.type = t.type
        root.table = t.table
        // Generate page content for each node in this tree
        const allNodes = []
        function collect(n) {
          allNodes.push(n)
          if (n.children) n.children.forEach(collect)
        }
        collect(root)
        for (const n of allNodes) {
          const raw = t.nodes.get(n.page_no) || {}
          n.pageContent = generatePageContent(
            n.page_no,
            n.level,
            n.n_recs || raw.n_recs || 180,
            t.type,
            t.index,
            n.children?.[0]?.page_no || null,
            n.page_no
          )
        }
        result.push(root)
      }
    }
    return result
  }, [events])

  const { activePath, backToTable, searchIndex } = useMemo(() => {
    const active = new Set()
    let btt = null
    let sidx = null
    if (currentIndex >= 0 && currentIndex < events.length) {
      for (let i = currentIndex; i >= 0 && i > currentIndex - 50; i--) {
        const e = events[i]
        if (e.cat === 'btree' && e.ev === 'btree_search') {
          active.add(e.page_no)
          if (e.child_pg != null) active.add(e.child_pg)
          sidx = e.index
        }
        if (e.cat === 'btree' && e.ev === 'back_to_table') {
          btt = e
        }
      }
      const cur = events[currentIndex]
      if (cur?.cat === 'btree' && cur?.ev === 'btree_search') {
        active.add(cur.page_no)
        sidx = cur.index
      }
    }
    return { activePath: active, backToTable: btt, searchIndex: sidx }
  }, [events, currentIndex])

  // Hover state
  const [hoveredPage, setHoveredPage] = useState(null)

  // ─── D3 Render ────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current
    const container = containerRef.current
    if (!svg || treeData.length === 0) return

    const cw = container.clientWidth || 1000
    const ch = container.clientHeight || 600

    d3.select(svg).selectAll('*').remove()

    // ─── Node sizing ────────────────────────────────────────────
    const NODE_W = 140
    const NODE_H = 78
    const LV_GAP = 100
    const TWIG_GAP = 70
    const treeLayout = d3.tree()
      .nodeSize([TWIG_GAP, LV_GAP])
      .separation((a, b) => 2)

    const layouts = treeData.map(d => {
      const root = d3.hierarchy(d, n => n.children)
      treeLayout(root)
      const nodes = root.descendants()
      const links = root.links()
      let minX = Infinity, maxX = -Infinity
      for (const n of nodes) {
        if (n.x < minX) minX = n.x
        if (n.x > maxX) maxX = n.x
      }
      return { root, nodes, links, minX, maxX, width: maxX - minX + NODE_W + 30 }
    })

    const interTreeGap = 120
    const totalWidth = layouts.reduce((s, l) => s + l.width, 0) + interTreeGap * (layouts.length - 1)
    const startX = Math.max(20, (cw - totalWidth) / 2)
    const svgH = Math.max(ch, 550)

    const svgEl = d3.select(svg)
      .attr('width', cw)
      .attr('height', svgH)
      .attr('viewBox', `0 0 ${cw} ${svgH}`)

    const g = svgEl.append('g')

    // Defs
    const defs = svgEl.append('defs')
    defs.append('marker')
      .attr('id', 'backArrow')
      .attr('viewBox', '0 0 10 10').attr('refX', 10).attr('refY', 5)
      .attr('markerWidth', 8).attr('markerHeight', 8).attr('orient', 'auto')
      .append('path').attr('d', 'M0,0 L10,5 L0,10 Z').attr('fill', COLORS.back_table)

    // Tooltip
    const tooltip = d3.select(container)
      .selectAll('.btree-tooltip')
      .data([0])
      .join('div')
      .attr('class', 'btree-tooltip')
      .style('display', 'none')

    let xOffset = startX

    for (let ti = 0; ti < layouts.length; ti++) {
      const { root, nodes, links } = layouts[ti]
      const isActiveTree = searchIndex === treeData[ti].index
      const isClust = treeData[ti].type === 'clustered'
      const colors = isClust ? COLORS.clustered : COLORS.secondary

      for (const n of nodes) {
        n.renderX = n.x + xOffset
        n.renderY = n.y + 55
      }

      const treeCenterX = xOffset + layouts[ti].width / 2

      // Index header
      g.append('rect')
        .attr('x', treeCenterX - 60).attr('y', 8)
        .attr('width', 120).attr('height', 22).attr('rx', 11)
        .attr('fill', colors.bg)
        .attr('stroke', colors.base)
        .attr('stroke-width', 1.2)

      g.append('text')
        .attr('x', treeCenterX).attr('y', 23)
        .attr('text-anchor', 'middle').attr('fill', colors.base)
        .attr('font-size', '0.78rem').attr('font-weight', 'bold')
        .text(isClust ? `🔵 ${treeData[ti].index}` : `🟢 ${treeData[ti].index}`)

      g.append('text')
        .attr('x', treeCenterX).attr('y', 42)
        .attr('text-anchor', 'middle').attr('fill', '#64748b')
        .attr('font-size', '0.6rem')
        .text(treeData[ti].type === 'clustered' ? '聚簇索引' : '二级索引')

      // Links
      g.selectAll(`.link-${ti}`)
        .data(links)
        .enter().append('path')
        .attr('d', d3.linkVertical()
          .x(d => d.renderX)
          .y(d => d.renderY))
        .attr('fill', 'none')
        .attr('stroke', isActiveTree ? '#a0aec0' : '#30363d')
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.7)

      // ─── Node groups ──────────────────────────────────────
      const nodeGroup = g.selectAll(`.node-${ti}`)
        .data(nodes)
        .enter().append('g')
        .attr('transform', d => `translate(${d.renderX},${d.renderY})`)
        .style('cursor', 'pointer')
        .on('mouseenter', function (event, d) {
          setHoveredPage(d.data.page_no)
          tooltip.style('display', 'block')
          const pc = d.data.pageContent
          if (!pc) return
          let html = `<div style="font-weight:bold;margin-bottom:6px;font-size:0.85rem">📄 页 ${pc.page_no} (L${pc.level})</div>`
          html += `<div style="font-size:0.7rem;margin-bottom:4px">`
          html += `记录数: ${pc.n_recs} | 空闲: ${(pc.freeSpace / 16384 * 100).toFixed(0)}%<br/>`
          if (pc.header) {
            html += `页类型: ${pc.header.page_type} | 槽位数: ${pc.slots.length}<br/>`
            html += `前页: ${pc.header.prev_page ?? '—'} | 后页: ${pc.header.next_page ?? '—'}`
          }
          html += '</div><hr style="border-color:#30363d;margin:4px 0"/>'
          html += '<div style="font-size:0.65rem;color:#94a3b8;margin-bottom:2px">📌 记录列表</div>'
          for (const rec of (pc.records || []).slice(0, 5)) {
            if (rec.ellipsis) {
              html += `<div style="color:#64748b;font-size:0.6rem">  ...</div>`
              continue
            }
            const extra = rec.child_page ? ` → P${rec.child_page}` : ''
            html += `<div style="font-size:0.65rem">  <span style="color:${colors.light}">${rec.key}</span>${extra}</div>`
          }
          if (pc.records.length > 5) {
            html += `<div style="color:#64748b;font-size:0.6rem">  ... 还有 ${pc.n_recs - 5} 条记录</div>`
          }
          html += '<hr style="border-color:#30363d;margin:4px 0"/>'
          html += '<div style="font-size:0.65rem;color:#94a3b8;margin-bottom:2px">📋 槽位目录</div>'
          for (const sl of (pc.slots || [])) {
            html += `<div style="font-size:0.6rem">  槽#${sl.slot_n}: 偏移 ${sl.rec_offset} → 记录 #${sl.record_idx}</div>`
          }
          const rect = this.getBoundingClientRect()
          const svgRect = svg.getBoundingClientRect()
          tooltip
            .style('left', `${rect.left - svgRect.left + 30}px`)
            .style('top', `${rect.top - svgRect.top - 10}px`)
            .html(html)
        })
        .on('mouseleave', function () {
          setHoveredPage(null)
          tooltip.style('display', 'none')
        })

      // ─── Page Internal Structure ──────────────────────────
      const isActive = d => isActiveTree && activePath.has(d.data.page_no)

      nodeGroup.each(function (d) {
        const group = d3.select(this)
        const pc = d.data.pageContent
        if (!pc) return

        const active = isActive(d)
        const bgColor = active ? colors.active : (isClust ? '#0f1724' : '#0a1f16')

        // ── Container for internal structure ──
        // Background
        group.append('rect')
          .attr('x', -NODE_W / 2).attr('y', -NODE_H / 2)
          .attr('width', NODE_W).attr('height', NODE_H)
          .attr('rx', 5)
          .attr('fill', bgColor)
          .attr('stroke', active ? colors.base : '#30363d')
          .attr('stroke-width', active ? 2 : 1)

        // ── Page header bar (top colored line) ──
        group.append('rect')
          .attr('x', -NODE_W / 2 + 1).attr('y', -NODE_H / 2 + 1)
          .attr('width', NODE_W - 2).attr('height', 16)
          .attr('rx', 3)
          .attr('fill', colors.header_bg)

        // Page number + level + recs
        group.append('text')
          .attr('x', 0).attr('y', -NODE_H / 2 + 12)
          .attr('text-anchor', 'middle')
          .attr('fill', colors.light)
          .attr('font-size', '0.6rem')
          .attr('font-weight', 'bold')
          .text(`P${d.data.page_no} · L${d.data.level} · ${Math.max(pc.n_recs, 1)}行`)

        // ── Key range (show first 2 keys) ──
        const shownKeys = (pc.records || []).filter(r => !r.ellipsis).slice(0, pc.isLeaf ? 2 : 3)
        const keyY = -NODE_H / 2 + 24
        shownKeys.forEach((rec, i) => {
          const label = rec.child_page
            ? `↘ ${rec.key} → P${rec.child_page}`
            : rec.is_last
              ? `↗ ${rec.key}`
              : rec.key
          // Truncate long keys
          const displayKey = label.length > 14 ? label.slice(0, 13) + '…' : label
          group.append('text')
            .attr('x', 3 - NODE_W / 2).attr('y', keyY + i * 11)
            .attr('fill', rec.child_page ? colors.base : '#94a3b8')
            .attr('font-size', '0.45rem')
            .attr('font-family', 'monospace')
            .text(displayKey)
        })
        if ((pc.records || []).length > shownKeys.length) {
          group.append('text')
            .attr('x', 3 - NODE_W / 2).attr('y', keyY + shownKeys.length * 11)
            .attr('fill', '#64748b').attr('font-size', '0.45rem')
            .text('…')
        }

        // ── Slot directory bar (bottom) ──
        const slotY = NODE_H / 2 - 7
        const slotH = 5
        const slotW = NODE_W - 4
        group.append('rect')
          .attr('x', -slotW / 2).attr('y', slotY)
          .attr('width', slotW).attr('height', slotH)
          .attr('rx', 2)
          .attr('fill', '#1a2744')
          .attr('stroke', '#30363d')
          .attr('stroke-width', 0.3)

        // Individual slot markers
        const sl = pc.slots || []
        if (sl.length > 0) {
          for (let i = 0; i < sl.length; i++) {
            const sx = -slotW / 2 + 2 + (i / sl.length) * (slotW - 4)
            group.append('rect')
              .attr('x', sx).attr('y', slotY + 1)
              .attr('width', Math.max(3, (slotW - 4) / sl.length - 1))
              .attr('height', slotH - 2)
              .attr('rx', 1)
              .attr('fill', active ? colors.base : COLORS.slot)
              .attr('opacity', 0.8)
          }
          // Slot label
          group.append('text')
            .attr('x', NODE_W / 2 - 2).attr('y', slotY + 4)
            .attr('text-anchor', 'end')
            .attr('fill', '#64748b')
            .attr('font-size', '0.4rem')
            .text(`${sl.length}槽`)
        }

        // ── Record bars (middle section) ──
        const recordStartY = -14
        const recordEndY = slotY - 1
        const barH = recordEndY - recordStartY - 2
        const barW = 4
        const barGap = 3
        const totalBarArea = NODE_W - 6
        const nBars = Math.min(pc.n_recs || 1, Math.floor(totalBarArea / (barW + barGap)))
        const barOffset = -(nBars * (barW + barGap) - barGap) / 2

        for (let i = 0; i < nBars; i++) {
          const bx = barOffset + i * (barW + barGap)
          const barHt = Math.max(3, barH * (1 - (i % 5) * 0.08))
          const isActiveBar = pc.records[i] && pc.records[i].child_page != null
          group.append('rect')
            .attr('x', bx).attr('y', recordStartY + (barH - barHt))
            .attr('width', barW).attr('height', barHt)
            .attr('rx', 1)
            .attr('fill', isActiveBar ? (active ? colors.base : colors.light) : (active ? '#475569' : '#1e293b'))
            .attr('opacity', active ? 0.9 : 0.7)
        }

        // Free space indicator
        const freePct = pc.freeSpace / 16384
        if (freePct > 0.1) {
          const freeW = Math.max(2, (NODE_W - 4) * freePct)
          group.append('rect')
            .attr('x', NODE_W / 2 - freeW - 1).attr('y', recordStartY + 2)
            .attr('width', freeW).attr('height', barH - 4)
            .attr('rx', 2)
            .attr('fill', '#1a1a2e')
            .attr('stroke', '#30363d')
            .attr('stroke-width', 0.3)
            .attr('stroke-dasharray', '2,2')
        }

        // ── Level indicator ──
        group.append('text')
          .attr('x', -NODE_W / 2 - 8).attr('y', 0)
          .attr('text-anchor', 'end')
          .attr('fill', '#64748b')
          .attr('font-size', '0.45rem')
          .text(`L${pc.level}`)

        // ── Leaf hint ──
        if (pc.isLeaf) {
          group.append('text')
            .attr('x', NODE_W / 2 + 6).attr('y', 0)
            .attr('fill', '#64748b')
            .attr('font-size', '0.45rem')
            .text('📄')
        }
      })

      xOffset += layouts[ti].width + interTreeGap
    }

    // ─── Back-to-Table arrow ─────────────────────────────────
    if (backToTable && layouts.length >= 2) {
      const secTree = treeData.find(t => t.type === 'secondary')
      const clTree = treeData.find(t => t.type === 'clustered')
      const secLayout = layouts[treeData.indexOf(secTree)]
      const clLayout = layouts[treeData.indexOf(clTree)]
      if (secLayout && clLayout) {
        const secLeaves = secLayout.root.leaves()
        const secLastLeaf = secLeaves[secLeaves.length - 1]
        const clRoot = clLayout.root
        if (secLastLeaf && clRoot) {
          const sx = secLastLeaf.renderX
          const sy = secLastLeaf.renderY + NODE_H / 2 + 5
          const ex = clRoot.renderX
          const ey = clRoot.renderY - NODE_H / 2 - 8
          g.append('path')
            .attr('d', `M${sx},${sy} C${sx},${(sy + ey) / 2} ${ex},${(sy + ey) / 2} ${ex},${ey}`)
            .attr('fill', 'none').attr('stroke', COLORS.back_table)
            .attr('stroke-width', 2.5).attr('stroke-dasharray', '6,3')
            .attr('marker-end', 'url(#backArrow)')
          const label = g.append('text')
            .attr('x', (sx + ex) / 2).attr('y', (sy + ey) / 2 - 12)
            .attr('text-anchor', 'middle').attr('fill', '#fbbf24')
            .attr('font-size', '0.7rem').attr('font-weight', 'bold')
            .text('↩ 回表')
          const bb = label.node().getBBox()
          g.insert('rect', `:first-child`)
            .attr('x', bb.x - 6).attr('y', bb.y - 3)
            .attr('width', bb.width + 12).attr('height', bb.height + 6)
            .attr('rx', 8).attr('fill', '#1a0e00').attr('stroke', COLORS.back_table)
            .attr('stroke-width', 1)
        }
      }
    }

  }, [treeData, activePath, backToTable, searchIndex])

  if (treeData.length === 0) {
    return (
      <div style={{ color: '#64748b', textAlign: 'center', padding: 60, fontSize: '0.9rem' }}>
        ⏳ 暂无 B+ 树事件数据。<br />
        <span style={{ fontSize: '0.8rem', color: '#475569' }}>
          请执行涉及索引的 SQL 查询
        </span>
      </div>
    )
  }

  return (
    <div ref={containerRef}
      style={{
        width: '100%', height: '100%', overflow: 'auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}
    >
      <svg ref={svgRef}
        style={{
          background: '#0d1117', borderRadius: 8,
          width: '100%', height: '100%',
        }}
      />
      <div style={{ position: 'absolute', bottom: 8, left: 12, fontSize: '0.55rem', color: '#475569' }}>
        鼠标悬停节点查看页内部详情
      </div>
    </div>
  )
}
