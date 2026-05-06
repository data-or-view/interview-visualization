# MySQL 源码埋点 — 执行计划（最终版）

**创建时间**: 2026-05-06 01:15
**最后更新**: 2026-05-06 16:41

## 项目完成状态

| 阶段 | 状态 | 备注 |
|------|------|------|
| Phase 0: 合成数据验证 | ✅ 完成 | 70 条合成事件原型验证 |
| Phase 1: 基础 14 事件埋点 | ✅ 完成 | 编译 → 验证 → 1,322 事件 |
| Phase 1.5: Flow 格式升级 (from/to/input) | ✅ 完成 | 475 事件，11 种 flow 类型 |
| Phase 2: MVCC + Hidden Pointers | ✅ 完成 | +4 事件 (676 事件) |
| Phase 3: B+ 树追踪 | ✅ 完成 | +2 事件 (10K 事件) |
| Phase 4: B+ 树前端可视化 | ✅ 完成 | D3.js 树形布局 + 回表箭头 |
| Phase 5: 前端节点内容展示 | ✅ 完成 | 页面结构/记录/槽位可视化 |

## 总计

- **19 种事件类型**
- **13 个分类**（client/conn/sql/binlog/innodb/undo/redo/data/lock/mvcc/row/btree）
- **16 个文件修改**
- **前端 6 个自定义组件** (NodeBox/FlowEdge/NodeGraph/InfoPanel/Timeline/BtreeCanvas)

## 学习成果

### 编译技巧
- ccache + `make -j2`：增量编译仅数秒 + 链接 3~5 分钟
- 链接必须用 `screen` 绕过 exec 的 60s 超时
- `mysqld.h` 不可修改：1200+ 文件全量重编

### 埋点技术
- `__builtin_expect` 宏：trace 关闭时零开销
- `TRACE_EVENT_FLOW` / `TRACE_EVENT_FLOW_BG` / `TRACE_EVENT_FLOW_IN` 三种宏
- `json_escape()` 处理 SQL 中的特殊字符

### B+ 树
- InnoDB 16KB 页面，每条非叶子指针 ~14B → 约 1170 条/页
- 405K 行 → 2~3 层 B+ 树（idx_name 因键长较大而为 3 层）
- 4 层需约 200 万行
