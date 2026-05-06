# MySQL 可视化追踪 — 埋点操作指南

**最后更新**: 2026-05-06

## 概述

在 MySQL 8.4.0 源码中增加了 JSONL trace 埋点系统，运行时通过 `--trace-file` 参数输出事件流。
前端可视化系统（React + D3.js）在 `localhost:8083` 提供实时动画播放。

## 数据流全景

```
Client
  │ (recv SQL 文本)
  ▼
Connector
  │ (parse SQL)
  ▼
Parser
  │ (optimize 执行计划)
  ▼
Optimizer
  │ (exec: SELECT/INSERT/UPDATE/DELETE)
  ▼
Executor ────→ Binlog (binlog_write)
  │
  ▼
Storage Interface
  │ (ha_write_row → InnoDB)
  ▼
InnoDB
  ├──→ Undo Log       (undo_write)    ──→ MVCC read_view / read_done / purge
  ├──→ Redo Log       (redo_prepare / redo_commit)
  └──→ Data Pages     (page_read / flush_dirty)

  Lock System (lock_wait)
  B+ Tree     (btree_search / back_to_table)
  MVCC        (read_view / read_done / purge)
  Row Pointers (hidden_ptrs)
```

## 编译

### 前置条件

```bash
# 已经在 cmake 阶段启用了 ccache
cmake .. -DCMAKE_CXX_COMPILER_LAUNCHER=ccache -DCMAKE_INSTALL_PREFIX=/opt/mysql-8.4-custom
```

### 增量编译

```bash
cd /opt/mysql-8.4.0/build

# 先删旧的 mysqld，确保链接产物新
rm -f runtime_output_directory/mysqld

# 用 screen 跑，避免 exec 超时
screen -S mysql-link -dm bash -c 'make -j2 mysqld > /tmp/mysql-link.log 2>&1'
```

- 只改 `.cc` 文件：ccache 命中 → 几秒编译 + 3~5 分钟链接
- 改 `trace_log.h`：重编所有引用的 `.cc` 文件（~30 个），约 2~3 分钟 ccached 编译 + 5 分钟链接
- **绝对避免修改 `mysqld.h`**：导致 1200+ 文件全量重编

### 安装

```bash
cp build/runtime_output_directory/mysqld /opt/mysql-8.4-custom/bin/mysqld
```

## 启动 MySQL

```bash
# 先 kill 旧进程
sudo pkill mysqld; sleep 1

# 启动（以独立数据目录避免锁冲突）
/opt/mysql-8.4-custom/bin/mysqld --user=admin \
  --basedir=/opt/mysql-8.4-custom \
  --datadir=/opt/mysql-8.4-custom/data \
  --socket=/tmp/mysql.sock --port=3306 \
  --skip-grant-tables \
  --trace-file=/tmp/mysql-trace.jsonl \
  --daemonize
```

## 执行 SQL 测试

### 基础 SQL

```bash
/opt/mysql-8.4-custom/bin/mysql -S /tmp/mysql.sock -u root
```

```sql
CREATE DATABASE testdb;
USE testdb;
CREATE TABLE t1 (id INT PRIMARY KEY, val VARCHAR(100));
INSERT INTO t1 VALUES (1, 'hello'), (2, 'world');
UPDATE t1 SET val = 'updated' WHERE id = 1;
DELETE FROM t1 WHERE id = 2;
SELECT * FROM t1;
```

### B+ 树测试（多索引）

```sql
CREATE DATABASE btree_test;
USE btree_test;

-- 多索引表
CREATE TABLE t (
  id int NOT NULL AUTO_INCREMENT,
  val int DEFAULT NULL,
  name varchar(32) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_val (val),
  KEY idx_name (name)
) ENGINE=InnoDB;

-- 大量数据以产生 3 层 B+ 树
-- 约 400K 行 → PRIMARY 2 层, idx_name 3 层, idx_val 2 层
INSERT INTO t (val, name) VALUES
  (FLOOR(RAND() * 10000000), CONCAT('user_', id)),
  ...
```

## 查看 Trace

```bash
# 实时监控
tail -f /tmp/mysql-trace.jsonl | python3 -m json.tool

# 统计事件分布
python3 -c "
import json
cats = {}
for line in open('/tmp/mysql-trace.jsonl'):
    d = json.loads(line)
    cat = d.get('cat','?')
    ev = d.get('ev','?')
    cats.setdefault(cat, {}).setdefault(ev, 0)
    cats[cat][ev] += 1
for cat, evs in sorted(cats.items()):
    print(f'{cat}:')
    for ev, n in sorted(evs.items()):
        print(f'  {ev}: {n}')
    print(f'  合计: {sum(evs.values())}')
"

# 修剪 trace（去掉 InnoDB 启动的大量 page_read 噪声）
python3 -c "
import json
lines = [json.loads(l) for l in open('/tmp/mysql-trace.jsonl')]
start_idx = next(i for i, d in enumerate(lines) if d.get('ev') == 'start')
clean = lines[start_idx:]
with open('/tmp/mysql-trace-clean.jsonl', 'w') as f:
    for d in clean:
        f.write(json.dumps(d, ensure_ascii=False) + '\n')
print(f'Trimmed from {len(lines)} → {len(clean)} events')
"
```

## 在前端查看

```bash
# 复制到前端数据目录
cp /tmp/mysql-trace-clean.jsonl \
  /opt/mysql-8.4.0/openclaw-visualization/frontend/react-app/public/data/trace-mysql.jsonl

# 打开浏览器
open http://localhost:8083/
```

## 完整埋点清单（19 个事件 / 13 个分类）

### 连接层 (cat: client / conn)

| 事件 | 源码文件 | 函数 | from → to | 字段说明 |
|------|----------|------|-----------|----------|
| `start` | `sql/sql_connect.cc` | `thd_prepare_connection` | external → client | |
| `recv` | `sql/sql_parse.cc` | `dispatch_command → COM_QUERY` | client → connector | `input`: SQL 原文 |
| `cleaning` | `sql/sql_connect.cc` | `end_connection` | connector → external | |

### SQL 层 (cat: sql)

| 事件 | 源码文件 | 函数 | from → to | 字段说明 |
|------|----------|------|-----------|----------|
| `parse` | `sql/sql_parse.cc` | `mysql_execute_command` | connector → parser | `input`: SQL 原文 |
| `optimize` | `sql/sql_optimizer.cc` | `JOIN::optimize` | parser → optimizer | |
| `exec` | `sql/handler.cc` | `handler::ha_write_row` | executor → storage_if | `table`: 表名, `input`: 操作类型 |

### Binlog (cat: binlog)

| 事件 | 源码文件 | 函数 | from → to |
|------|----------|------|-----------|
| `binlog_write` | `sql/binlog.cc` | `MYSQL_BIN_LOG::write_transaction` | executor → binlog |

### InnoDB 事务 (cat: innodb)

| 事件 | 源码文件 | 函数 | from → to |
|------|----------|------|-----------|
| `redo_prepare` | `ha_innodb.cc` | `innobase_xa_prepare` | innodb → redo |
| `commit` | `ha_innodb.cc` | `innobase_commit` | innodb → innodb |
| `redo_commit` | `ha_innodb.cc` | `innobase_commit` 内 | innodb → redo |

### Undo (cat: undo)

| 事件 | 源码文件 | 函数 | from → to |
|------|----------|------|-----------|
| `undo_write` | `trx0rec.cc` | `trx_undo_report_row_operation` | innodb → undo |

### Redo (cat: redo)

| 事件 | 源码文件 | 函数 | from → to |
|------|----------|------|-----------|
| `redo_prepare` | `ha_innodb.cc` | `innobase_xa_prepare` | innodb → redo |
| `redo_commit` | `ha_innodb.cc` | `innobase_commit` 内 | innodb → redo |

### 数据页 (cat: data)

| 事件 | 源码文件 | 函数 | from → to |
|------|----------|------|-----------|
| `page_read` | `buf0rea.cc` | `buf_read_page` | data → innodb |
| `flush_dirty` | `buf0flu.cc` | `buf_flush_page` | innodb → data |

### 锁 (cat: lock)

| 事件 | 源码文件 | 函数 | from → to | 字段说明 |
|------|----------|------|-----------|----------|
| `lock_wait` | `lock0wait.cc` | `lock_wait_suspend_thread` | innodb → lock | |

### MVCC (cat: mvcc) ⭐新增

| 事件 | 源码文件 | 函数 | from → to | 字段说明 |
|------|----------|------|-----------|----------|
| `read_view` | `trx0trx.cc` | `trx_assign_read_view` | innodb → mvcc | `trx_id`: 事务 ID, `n_recs`: 视图大小 |
| `read_done` | `trx0trx.cc` | `view_close` (4 处) | mvcc → innodb | |
| `purge` | `trx0purge.cc` | `trx_purge` | mvcc → undo | `n_purged`: 清理记录数, `thr`: "background" |

### 行隐藏指针 (cat: row) ⭐新增

| 事件 | 源码文件 | 函数 | from → to | 字段说明 |
|------|----------|------|-----------|----------|
| `hidden_ptrs` | `btr0cur.cc` | `row_upd_rec_sys_fields` 后 | row → innodb | `old_trx_id`: 旧事务 ID, `new_trx_id`: 新事务 ID, `roll_ptr`: Undo 回滚指针 |

- **注意**: 只有在聚簇索引上才写 DB_TRX_ID / DB_ROLL_PTR，代码中有 `index->is_clustered()` 保护
- 当 `thr` 为 NULL（DICT 操作）时，用 **三元运算保护** 避免 SIGSEGV

### B+ 树 (cat: btree) ⭐新增

| 事件 | 源码文件 | 函数 | from → to | 字段说明 |
|------|----------|------|-----------|----------|
| `btree_search` | `btr0cur.cc` | `btr_cur_search_to_nth_level` | btree → btree | `index`: 索引名, `type`: clustered/secondary, `table`: 表名, `page_no`: 当前页号, `level`: 层级(0=leaf), `n_recs`: 记录数, `child_pg`: 子页号(非 leaf 层) |
| `back_to_table` | `row0sel.cc` | `row_search_mvcc` (requires_clust_rec) | row → btree | |

**B+ 树埋点输出示例:**

```json
{"cat":"btree","ev":"btree_search","from":"btree","to":"btree",
 "index":"idx_name","type":"secondary","table":"btree_test/t",
 "page_no":6,"level":2,"n_recs":2,"child_pg":104}
```

**B+ 树说明:**
- `btr_cur_search_to_nth_level` 每层下降时发射一次 `btree_search`：含 `level`, `page_no`, `n_recs`, `child_pg`
- 到达 leaf (level==0) 时再发射一次，此时 `n_recs` 为叶子页实际记录数
- `row_search_mvcc` 在 `requires_clust_rec` 标签处发射 `back_to_table`：表示二级索引 → 聚簇索引的回表动作
- 宏使用 `TRACE_EVENT_FLOW_BG`（B+ 树搜索可能在后台线程执行，如 IBUF / DICT）

## JSONL 输出格式

### 基础格式

```json
{"cat":"innodb","ev":"commit","ts":1715000000123,
 "from":"innodb","to":"innodb",
 "cid":1,"tid":100,"thr":"thread-per-conn"}
```

### B+ 树格式

```json
{"cat":"btree","ev":"btree_search","ts":1715000000123,
 "from":"btree","to":"btree",
 "index":"idx_name","type":"secondary","table":"btree_test/t",
 "page_no":6,"level":2,"n_recs":2,"child_pg":104}
```

### 回表格式

```json
{"cat":"btree","ev":"back_to_table","ts":1715000000123,
 "from":"row","to":"btree",
 "index":"idx_name","table":"btree_test/t"}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `cat` | string | 分类 (client/conn/sql/binlog/innodb/undo/redo/data/lock/mvcc/row/btree) |
| `ev` | string | 事件名 |
| `ts` | int | 毫秒时间戳 |
| `from` | string | 来源组件 |
| `to` | string | 目标组件 |
| `input` | string (opt) | 输入数据(如 SQL 原文) |
| `cid` | int (opt) | 连接 ID |
| `tid` | int (opt) | 事务 ID |
| `thr` | string (opt) | 线程模式 (thread-per-conn / background) |
| `index` | string (btree) | 索引名 (如 `PRIMARY`, `idx_name`) |
| `type` | string (btree) | 索引类型 (clustered / secondary) |
| `table` | string (btree) | 表名 (如 `btree_test/t`) |
| `page_no` | int (btree) | 页面号 |
| `level` | int (btree) | B+ 树层级 (0=叶子) |
| `n_recs` | int (btree) | 页内记录数 |
| `child_pg` | int (btree, non-leaf) | 子页面号 |

## Trace 缓冲区

- **最大事件数**: ~10K 条（循环缓冲区）
- 大量 INSERT 可能冲掉之前的 btree 事件
- **建议**：大表插入前先清空 trace，或控制测试 SQL 的执行范围

## 关闭 Trace

不带 `--trace-file` 参数启动（默认关闭，`__builtin_expect` 优化后无性能影响），或：

```sql
SET GLOBAL trace_file = '';
```
