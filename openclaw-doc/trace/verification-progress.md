# MySQL 埋点验证进度

**创建**: 2026-05-06 01:15
**最新更新**: 2026-05-06 16:41

## 源码修改状态（全部完成 ✅）

| # | 文件 | 操作 | 事件 | 状态 |
|---|------|------|------|------|
| 0 | `include/trace_log.h` | 新建 trace 宏 | — | ✅ |
| 1 | `sql/mysqld.cc` | 添加 `opt_trace_file` 变量 | — | ✅ |
| 2 | `sql/sys_vars.cc` | 注册 `--trace-file` sys_var | — | ✅ |
| 3 | `sql/sql_parse.cc` | 埋点 x2 | `recv`, `parse` | ✅ |
| 4 | `sql/sql_optimizer.cc` | 埋点 | `optimize` | ✅ |
| 5 | `sql/handler.cc` | 埋点 | `exec` | ✅ |
| 6 | `sql/binlog.cc` | 埋点 | `binlog_write` | ✅ |
| 7 | `sql/sql_connect.cc` | 埋点 x2 | `start`, `cleaning` | ✅ |
| 8 | `ha_innodb.cc` | 埋点 x3 | `redo_prepare`, `commit`, `redo_commit` | ✅ |
| 9 | `trx0rec.cc` | 埋点 | `undo_write` | ✅ |
| 10 | `buf0rea.cc` | 埋点 | `page_read` | ✅ |
| 11 | `buf0flu.cc` | 埋点 | `flush_dirty` | ✅ |
| 12 | `lock0wait.cc` | 埋点 | `lock_wait` | ✅ |
| 13 | `trx0trx.cc` | 埋点 x2 (⭐new) | `read_view`, `read_done` | ✅ |
| 14 | `trx0purge.cc` | 埋点 (⭐new) | `purge` | ✅ |
| 15 | `btr0cur.cc` | 埋点 (⭐new) | `hidden_ptrs`, `btree_search` | ✅ |
| 16 | `row0sel.cc` | 埋点 x2 (⭐new) | `btree_search` (聚簇), `back_to_table` | ✅ |

## 构建历史

| 构建 | 二进制 | 大小 | 时间 | 内容 |
|------|--------|------|------|------|
| v1 | 原始 14 事件埋点 | 228MB | 01:50 | 基础 14 事件 |
| v2 | from/to/input 改造 | 219MB | 14:18 | Flow 格式升级 |
| v3 | MVCC + HiddenPtrs | 219MB | 14:49 | +4 新事件 |
| v4 | B+ 树埋点 | 219MB | 15:39 | +2 新事件 (btree_search, back_to_table) |

## 事件总览（19 事件 / 13 分类）

### Phase 1: 基础追踪（14 事件，2 月 6 日 01:50 首次验证）

| 分类 | 事件 | 源文件 | 说明 |
|------|------|--------|------|
| client | `start` | sql_connect.cc | 连接建立 |
| conn | `recv` | sql_parse.cc | 收到 SQL |
| sql | `parse` | sql_parse.cc | SQL 解析 |
| sql | `optimize` | sql_optimizer.cc | 执行计划 |
| innodb | `exec` | handler.cc | 写入行 |
| undo | `undo_write` | trx0rec.cc | Undo 日志 |
| redo | `redo_prepare` | ha_innodb.cc | 2PC Prepare |
| binlog | `binlog_write` | binlog.cc | Binlog 写入 |
| redo | `redo_commit` | ha_innodb.cc | 2PC Commit |
| innodb | `commit` | ha_innodb.cc | 事务提交 |
| data | `flush_dirty` | buf0flu.cc | 刷脏页 |
| data | `page_read` | buf0rea.cc | 缺页读 |
| lock | `lock_wait` | lock0wait.cc | 行锁等待 |
| conn | `cleaning` | sql_connect.cc | 连接清理 |

### Phase 2: MVCC + Hidden Pointers（+4 事件，14:49 首次验证）

| 分类 | 事件 | 源文件 | 说明 |
|------|------|--------|------|
| mvcc | `read_view` | trx0trx.cc | 一致性读快照创建 |
| mvcc | `read_done` | trx0trx.cc | 快照释放 |
| mvcc | `purge` | trx0purge.cc | 后台清理 Undo |
| row | `hidden_ptrs` | btr0cur.cc | 行隐藏指针更新 |

### Phase 3: B+ 树追踪（+2 事件，15:39 首次验证）

| 分类 | 事件 | 源文件 | 说明 |
|------|------|--------|------|
| btree | `btree_search` | btr0cur.cc | B+ 树层级下降/叶子到达 |
| btree | `back_to_table` | row0sel.cc | 二级索引→聚簇索引回表 |

## 验证结果

### 基础追踪验证 ✅（1,322 事件）
- 4 个 SQL 语句测试：建库、建表、INSERT、SELECT、UPDATE、DELETE
- 全部 14 种事件类型均触发
- 输出格式正确，前端正常渲染

### Flow 格式验证 ✅（475 事件）
- 11 种 flow 类型全部带正确的 from/to
- `recv` + `parse` 带 `input`（SQL 原文 json_escape）
- `exec` 带 `table` + `input: "write_row"`
- 前端水平布局展示 from→to 边

### MVCC + Hidden Pointers 验证 ✅（676 事件）
- 12 个分类触发，含 read_view / read_done / purge / hidden_ptrs
- purge 标记 thr="background"
- hidden_ptrs 正确输出 old_trx_id / new_trx_id
- 前端新增 👁️ MVCC / 📍 Row Ptrs 组件

### B+ 树验证 ✅（109 事件修剪后）
- `btree_test.t` 表：405,016 行，3 个索引

| 索引 | 类型 | 层级 | Root 页 | 说明 |
|------|------|------|---------|------|
| PRIMARY | 聚簇索引 | 2 层 | P4 (1010 recs) | 根→~10 个叶子页 |
| idx_name | 二级索引 | **3 层** | P6 (2 recs) | 根→内部页→~15 个叶子页 |
| idx_val | 二级索引 | 2 层 | P5 (524 recs) | 根→~3 个叶子页 |

- **8027 btree_search 事件** + **176 back_to_table 事件** 正确捕获
- 前端 D3.js 树形可视化：聚簇索引蓝色、二级索引绿色，搜索路径高亮，回表虚线箭头

## 已知问题

### 编译
- LTO 链接 bug（MySQL 8.4.0 自身 PFS）：`-fno-lto` 跳过
- `mysqld.h` 含 1200 文件，改它触发全量重编
- exec 60s 超时无法直接编译：用 `screen -S <name> -dm bash -c 'cmd'` 绕过

### trace
- 10K 事件循环缓冲区：大插入可能冲掉前面事件
- 启动阶段 ~2500 条 `page_read`：需 Python 修剪（截取第一个 `start` 事件之后）
- `parse` 事件的 `query` 含双引号破坏 JSON：已用 `json_escape()` 处理

### B+ 树
- `btr_cur_search_to_nth_level` 只能捕获搜索路径上的页面（不是全树扫描）
- `innodb_space` 不可用：无法获取完整的页面级别 key 分布
- FORCE INDEX 导致回表不触发（小表查询全表扫描）
