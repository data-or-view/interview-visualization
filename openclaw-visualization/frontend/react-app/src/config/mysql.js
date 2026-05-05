/**
 * MySQL 单机布局配置 — 9 组件：Client → Connector → SQL Layer → Storage Interface → InnoDB → Data
 * 侧边: Binlog(SQL层), Undo/Redo(InnoDB层)
 */
export const MYSQL_LAYOUT = {
  components: [
    { id: 'client',   label: 'Client',   x: 0,   y: -130, color: '#667eea', icon: '🔌', thr: "" },
    { id: 'connector', label: 'Connector', x: 0, y: -75, color: '#f59e0b', icon: '🔗', thr: "thread-per-conn" },
    { id: 'sql_layer', label: 'SQL Layer', x: 0, y: -15, color: '#10b981', icon: '⚡', thr: "thread-per-conn" },
    { id: 'storage_if', label: 'Storage I/F', x: 0, y: 45, color: '#3b82f6', icon: '🔧', thr: "thread-per-conn" },
    { id: 'innodb',   label: 'InnoDB',   x: 0,   y: 105, color: '#8b5cf6', icon: '🗄️', thr: "thread-per-conn" },
    { id: 'data',     label: 'Data',     x: 0,   y: 175, color: '#64748b', icon: '💽', thr: "" },
    // 日志组件
    { id: 'binlog',   label: 'Binlog',   x: 72,  y: -15, color: '#f97316', icon: '📋', thr: "" },
    { id: 'undo',     label: 'Undo',     x: -72, y: 105, color: '#a855f7', icon: '↩️', thr: "" },
    { id: 'redo',     label: 'Redo',     x: 72,  y: 105, color: '#ef4444', icon: '📝', thr: "" },
  ],

  edges: [
    // 主流水线
    { from: 'client',   to: 'connector' },
    { from: 'connector', to: 'sql_layer' },
    { from: 'sql_layer', to: 'storage_if' },
    { from: 'storage_if', to: 'innodb' },
    { from: 'innodb',   to: 'data' },
    { from: 'data',     to: 'innodb' },
    // 日志
    { from: 'sql_layer', to: 'binlog' },
    { from: 'innodb',   to: 'undo' },
    { from: 'undo',     to: 'innodb' },
    { from: 'innodb',   to: 'redo' },
    { from: 'redo',     to: 'innodb' },
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
    misc:   '#64748b',
  },

  evToComponent: {
    recv:          'connector',
    parse:         'sql_layer',
    optimize:      'sql_layer',
    exec:          'innodb',
    lock_wait:     'innodb',
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
  },

  evToEdge: {
    recv:         { from: 'client',   to: 'connector' },
    parse:        { from: 'connector', to: 'sql_layer' },
    optimize:     { from: 'sql_layer', to: 'sql_layer' },
    exec:         { from: 'storage_if', to: 'innodb' },
    lock_wait:    { from: 'innodb',   to: 'innodb' },
    undo_write:   { from: 'innodb',   to: 'undo' },
    undo_read:    { from: 'undo',     to: 'innodb' },
    redo_prepare: { from: 'innodb',   to: 'redo' },
    redo_commit:  { from: 'redo',     to: 'innodb' },
    binlog_write: { from: 'sql_layer', to: 'binlog' },
    binlog_read:  { from: 'binlog',   to: 'sql_layer' },
    flush_dirty:  { from: 'innodb',   to: 'data' },
    page_read:    { from: 'data',     to: 'innodb' },
    start:        { from: 'client',   to: 'client' },
    cleaning:     { from: 'innodb',   to: 'connector' },
    commit:       { from: 'innodb',   to: 'innodb' },
  },

  viewBox: '-100 -160 220 380',
  frameRect: { x: -90, y: -150, width: 190, height: 360, rx: 12 },
  title: 'MySQL 8.4 (single-node, ...)',
}
