# MySQL 可视化前端 — React + D3.js

MySQL 8.4.0 运行时追踪的前端可视化面板。

## 快速启动

```bash
cd /opt/mysql-8.4.0/openclaw-visualization/frontend/react-app
npx vite --host 0.0.0.0 --port 8083
# 浏览器 → http://localhost:8083/
```

## 项目结构

```
react-app/
├── public/data/
│   └── trace-mysql.jsonl      # 默认加载的 trace 数据文件
├── src/
│   ├── App.jsx                # 主应用（架构图/B+ 树 Tab 切换）
│   ├── App.css                # 样式
│   ├── main.jsx               # 入口
│   ├── config/mysql.js        # 组件布局配置 + 边映射
│   ├── hooks.js               # 数据加载/播放/筛选 hook
│   └── components/
│       ├── NodeBox.jsx        # 单个组件节点渲染
│       ├── FlowEdge.jsx       # 粒子动画边 + 流量方向
│       ├── NodeGraph.jsx      # 架构图 SVG 布局引擎
│       ├── InfoPanel.jsx      # 事件详情面板（含事务/锁/MVCC/隐藏指针等卡片）
│       ├── Timeline.jsx       # 事件时间线
│       └── BtreeCanvas.jsx    # B+ 树可视化（D3.js 树形布局）
├── dist/                      # 构建产物（vite build）
├── index.html
├── vite.config.js
└── package.json
```

## 数据格式

trace 数据为 JSONL 格式（每行一个 JSON 对象），位于 `public/data/trace-mysql.jsonl`。

### 基础事件

```json
{"cat":"innodb","ev":"commit","ts":1715000000123,
 "from":"innodb","to":"innodb",
 "cid":1,"tid":100}
```

### B+ 树事件

```json
{"cat":"btree","ev":"btree_search","ts":1715000000123,
 "from":"btree","to":"btree",
 "index":"idx_name","type":"secondary","table":"btree_test/t",
 "page_no":6,"level":2,"n_recs":2,"child_pg":104}
```

### 回表事件

```json
{"cat":"btree","ev":"back_to_table","ts":1715000000123,
 "from":"row","to":"btree",
 "index":"idx_name","table":"btree_test/t"}
```

## 两个视图

### 1. 🏗 架构图（默认）

水平布局展示 MySQL 内部组件流水线：

```
Client → Connector → SQL Layer [Parser→Optmizer→Executor] → Storage I/F → InnoDB → Data
                                                                          ↓         ↓
                                                                       Binlog    Undo/Redo/MVCC
```

- **粒子动画边**：事件在组件间流动时播放动画
- **事件时间线**：底部水平滚动条
- **InfoPanel**：左侧详细事件信息面板（事务上下文/锁等待/MVCC 快照/隐藏指针/时延）

### 2. 🌲 B+ 树

D3.js 树形布局展示 InnoDB B+ 索引树。

**功能：**
- 多棵树水平并排（每索引一棵）
- 聚簇索引 🔵蓝色 ／ 二级索引 🟢绿色
- 节点显示：页号 | 层级 | 记录数 | 内部 key 值 | 子页指针
- 搜索路径高亮（彩色描边）
- 回表箭头（↩ 从二级索引叶子指向聚簇索引根）
- 节点 hover 弹窗：页元数据、记录列表、槽位目录、空闲空间占比

**节点结构（140×78px）：**

```
┌──────────────────────────┐
│  P6 · L2 · 2行           │  ← 页号 · 层级 · 记录数
│  ↘ user_281 → P104       │  ← 非叶子: 节点指针
│  ↘ user_83310 → P103     │  ← key → 子页面
│  …                        │
│  ▓▓▓▓▓░░░░░░ 30% free   │  ← 槽位/空闲空间指示
└──────────────────────────┘
```

**系统表过滤：** 默认只显示用户表（`btree_test/t`）的索引树，跳过 `mysql/*` 系统表噪声。

## 数据加载

1. 运行 MySQL 查询生成 trace（详见 `trace-instrumentation-guide.md`）
2. ```bash
   cp /tmp/mysql-trace-clean.jsonl public/data/trace-mysql.jsonl
   ```
3. 页面刷新后自动加载

页面的路径输入框可以手动输入其他数据文件路径。

## 播放控件

| 控件 | 功能 |
|------|------|
| 📂 加载 | 重新加载 trace 数据 |
| ⏸ 暂停/▶️ 播放 | 事件动画播放控制 |
| ⏮ 重播 | 回到第一个事件 |
| 0.5x / 1x / 2x / 4x | 播放速度 |
| 🔁 循环 | 是否循环播放 |

## 事件筛选

InfoPanel 下方可选分类过滤：client / conn / sql / binlog / innodb / undo / redo / data / lock / mvcc / row / btree

## 配置（config/mysql.js）

组件布局定义：

```javascript
export const components = [
  { id:'client', label:'Client', x:-285, y:0, icon:'🔌' },
  { id:'connector', label:'Connector', x:-180, y:0, icon:'🔗' },
  { id:'parser', label:'Parser', x:-80, y:-10, icon:'🔍', group:'sql_layer' },
  { id:'optimizer', label:'Optmizer', x:-80, y:10, icon:'⚡', group:'sql_layer' },
  { id:'executor', label:'Executor', x:-80, y:30, icon:'🏃', group:'sql_layer' },
  // ...
]
```

## 构建

```bash
# 生产构建
npx vite build
# 产物 dist/ 可直接部署
```

## 依赖

- React 18
- D3.js 7（树形布局 + 选择集）
- Vite 6（开发服务器 + 构建）

## 开发扩展

### 添加新事件类型
1. 在 `config/mysql.js` 的 `edgeMap` 中添加 `from→to` 映射和颜色
2. 在 C++ 源码对应位置加 `TRACE_EVENT_FLOW` 宏
3. 重新编译部署

### 添加新前端组件
1. 在 `components/` 创建 `.jsx` 文件
2. 在 `config/mysql.js` 的 `components` 数组中添加定义
3. 在 `hooks.js` 的 `edgeMap` 添加流入/流出映射
