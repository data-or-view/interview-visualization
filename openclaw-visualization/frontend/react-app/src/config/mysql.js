/**
 * MySQL 单节点布局配置 — 水平排列 + SQL Layer 子组件展开
 * 主流水线: Client → Connector → [Parser→Optimizer→Executor] → Storage I/F → InnoDB → Data
 * 侧边日志: Binlog(Executor上方), Undo(InnoDB上方), Redo(InnoDB下方), Lock(InnoDB右下方)
 */
export const MYSQL_LAYOUT = {
  components: [
    // 主流水线
    { id: 'client',    label: 'Client',    x: -240, y: 0,   color: '#667eea',  icon: '🔌', thr: "" },
    { id: 'connector', label: 'Connector', x: -150, y: 0,   color: '#f59e0b',  icon: '🔗', thr: "thread-per-conn" },
    // SQL Layer 子组件（水平排列）
    { id: 'parser',    label: 'Parser',    x: -55,  y: -18, color: '#10b981',  icon: '🔍', thr: "thread-per-conn" },
    { id: 'optimizer', label: 'Optmizer',  x: -55,  y: 6,   color: '#34d399',  icon: '⚡', thr: "thread-per-conn" },
    { id: 'executor',  label: 'Executor',  x: -55,  y: 30,  color: '#6ee7b7',  icon: '🏃', thr: "thread-per-conn" },
    { id: 'storage_if',label: 'Storage I/F',x: 55,  y: 0,   color: '#3b82f6',  icon: '🔧', thr: "thread-per-conn" },
    { id: 'innodb',    label: 'InnoDB',    x: 145,  y: 0,   color: '#8b5cf6',  icon: '🗄️', thr: "thread-per-conn" },
    { id: 'data',      label: 'Data',      x: 235,  y: 0,   color: '#64748b',  icon: '💽', thr: "" },
    // 背景组件（SQL Layer 容器）
    { id: 'sql_layer', label: 'SQL Layer', x: -55,  y: 8,   color: '#10b981',  icon: '',   thr: "", bg: true },
    // 日志组件
    { id: 'binlog',    label: 'Binlog',    x: 55,   y: -45, color: '#f97316',  icon: '📋', thr: "" },
    { id: 'undo',      label: 'Undo',      x: 145,  y: -50, color: '#a855f7',  icon: '↩️', thr: "" },
    { id: 'redo',      label: 'Redo',      x: 145,  y: 55,  color: '#ef4444',  icon: '📝', thr: "" },
    { id: 'lock_mgr',  label: 'Lock',      x: 145,  y: 80,  color: '#ec4899',  icon: '🔒', thr: "", size: 'small' },
    { id: 'mvcc',      label: 'MVCC',      x: 55,   y: 55,  color: '#06b6d4',  icon: '👁️', thr: "", size: 'small' },
    { id: 'row_ptr',   label: 'Row Ptrs',  x: 145,  y: -75, color: '#f43f5e',  icon: '📍', thr: "", size: 'small' },
  ],

  edges: [
    // 主流水线
    { from: 'client',    to: 'connector' },
    { from: 'connector',  to: 'parser' },
    { from: 'parser',     to: 'optimizer' },
    { from: 'optimizer',  to: 'executor' },
    { from: 'executor',   to: 'storage_if' },
    { from: 'storage_if', to: 'innodb' },
    { from: 'innodb',     to: 'data' },
    { from: 'data',       to: 'innodb' },
    // 日志边
    { from: 'executor',   to: 'binlog' },
    { from: 'innodb',     to: 'undo' },
    { from: 'undo',       to: 'innodb' },
    { from: 'innodb',     to: 'redo' },
    { from: 'redo',       to: 'innodb' },
    { from: 'innodb',     to: 'lock_mgr' },
    // MVCC 边
    { from: 'innodb',     to: 'mvcc' },
    { from: 'mvcc',       to: 'innodb' },
    { from: 'mvcc',       to: 'undo' },
    // Hidden pointers 边
    { from: 'innodb',     to: 'row_ptr' },
    { from: 'row_ptr',    to: 'innodb' },
  ],

  catColors: {
    conn:   '#f59e0b',
    sql:    '#10b981',
    innodb: '#8b5cf6',
    binlog: '#f97316',
    undo:   '#a855f7',
    redo:   '#ef4444',
    data:   '#64748b',
    client: '#667eea',
    lock:   '#ec4899',
    mvcc:   '#06b6d4',
    row:    '#f43f5e',
    misc:   '#64748b',
  },

  evToComponent: {
    recv:          'connector',
    parse:         'parser',
    optimize:      'optimizer',
    exec:          'executor',
    lock_wait:     'lock_mgr',
    undo_write:    'undo',
    undo_read:     'undo',
    redo_prepare:  'redo',
    redo_commit:   'redo',
    binlog_write:  'binlog',
    binlog_read:   'binlog',
    flush_dirty:   'data',
    page_read:     'innodb',
    start:         'client',
    cleaning:      'connector',
    commit:        'innodb',
    read_view:     'mvcc',
    read_done:     'mvcc',
    purge:         'mvcc',
    hidden_ptrs:   'row_ptr',
  },

  evToEdge: {
    recv:         { from: 'client',    to: 'connector' },
    parse:        { from: 'connector',  to: 'parser' },
    optimize:     { from: 'parser',     to: 'optimizer' },
    exec:         { from: 'executor',   to: 'storage_if' },
    lock_wait:    { from: 'innodb',     to: 'lock_mgr' },
    undo_write:   { from: 'innodb',     to: 'undo' },
    undo_read:    { from: 'undo',       to: 'innodb' },
    redo_prepare: { from: 'innodb',     to: 'redo' },
    redo_commit:  { from: 'redo',       to: 'innodb' },
    binlog_write: { from: 'executor',   to: 'binlog' },
    binlog_read:  { from: 'binlog',     to: 'executor' },
    flush_dirty:  { from: 'innodb',     to: 'data' },
    page_read:    { from: 'data',       to: 'innodb' },
    start:        { from: 'client',     to: 'client' },
    cleaning:     { from: 'connector',  to: 'client' },
    commit:       { from: 'innodb',     to: 'innodb' },
    read_view:    { from: 'innodb',     to: 'mvcc' },
    read_done:    { from: 'mvcc',       to: 'innodb' },
    purge:        { from: 'mvcc',       to: 'undo' },
    hidden_ptrs:  { from: 'innodb',     to: 'row_ptr' },
  },

  viewBox: '-300 -80 600 190',
  frameRect: { x: -280, y: -65, width: 570, height: 160, rx: 12 },
  title: 'MySQL 8.4 (单节点, 水平组件流)',
}
