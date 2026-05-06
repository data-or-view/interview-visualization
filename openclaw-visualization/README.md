# MySQL 8.4.0 可视化追踪系统

MySQL 8.4.0 源码级埋点 + React/D3.js 前端可视化。

## 项目结构

```
/opt/mysql-8.4.0/
├── include/trace_log.h              # C++ trace 宏定义（核心）
├── sql/                              # Server 层（14 事件）
├── storage/innobase/                 # InnoDB 层（7 事件）
├── build/                            # 编译产物
├── openclaw-doc/                     # 项目文档
│   └── trace/
│       ├── trace-instrumentation-guide.md  # 埋点操作指南
│       ├── verification-progress.md        # 验证进度
│       └── execution-plan.md               # 执行计划
└── openclaw-visualization/
    └── frontend/react-app/           # React 前端（见下方）
```

## 全景

本系统通过 C++ 埋点捕获 MySQL 运行时内部状态，以 JSONL 格式输出，React 前端实时动画呈现。

### 埋点覆盖

| 层 | 事件数 | 覆盖范围 |
|------|--------|----------|
| 连接层 | 3 | start → recv → cleaning |
| SQL 层 | 3 | parse → optimize → exec |
| 事务层 | 5 | redo_prepare → redo_commit → commit / undo_write / binlog_write |
| 存储层 | 2 | page_read / flush_dirty |
| 锁 | 1 | lock_wait |
| MVCC | 3 | read_view → read_done / purge |
| B+ 树 | 2 | btree_search / back_to_table |
| 行指针 | 1 | hidden_ptrs |

### 启动方式

```bash
# MySQL 服务
/opt/mysql-8.4-custom/bin/mysqld --user=admin \
  --basedir=/opt/mysql-8.4-custom \
  --datadir=/opt/mysql-8.4-custom/data \
  --socket=/tmp/mysql.sock --port=3306 \
  --skip-grant-tables \
  --trace-file=/tmp/mysql-trace.jsonl \
  --daemonize

# 前端服务器（screen mysql-vite 中）
cd /opt/mysql-8.4.0/openclaw-visualization/frontend/react-app
npx vite --host 0.0.0.0 --port 8083

# 浏览器打开
http://localhost:8083/
```

## 事件流示意图

```
Client → Connector → [Parser→Optmizer→Executor] → Storage I/F → InnoDB → Data
                                                          ↕         ↕
                                                       Binlog    Undo / Redo
                                                                  Lock
                                                                  MVCC
                                                                  Row Ptrs
                                                                  B+ 树
```

详见 `frontend/react-app/README.md`。
