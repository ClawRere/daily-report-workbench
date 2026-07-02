# 日报记录台接入规范

## 目标

让 Codex、QClaw、Skill、本地自动化或后续 MCP 代理，都能按统一规则把任务写入日报记录台的数据文件，并在页面中直接展示。

## 页面与路由

- 示例域名：`https://example-daily-report.pages.dev`
- Skill 路由：`https://example-daily-report.pages.dev/skill-sync.md`
- MCP 路由：`https://example-daily-report.pages.dev/mcp-sync.json`

本地打开 `file://` 时，也可以直接读取同目录下这两个文件：

- `skill-sync.md`
- `mcp-sync.json`

## 访问控制

- 默认不预置访问密码
- 默认不预置免密 IP
- 注意：当前站点是静态部署，页面中的密码与 IP 白名单属于前端轻量控制，不是服务端强鉴权。

## 数据写入目标

统一写入：

- `data/live-data.js`

文件结构保持为：

```js
window.LIVE_DATA = [
  {
    id: "task-001",
    date: "2026-06-22",
    dueDate: "2026-06-22",
    completedDate: "2026-06-22",
    project: "北辰家居",
    title: "客户问题处理",
    status: "done",
    priority: "高",
    category: "综合事务",
    plan: "",
    notes: "",
    source: "skill-sync"
  }
];
```

## 字段要求

每条任务建议包含以下字段：

- `id`
- `date`
- `dueDate`
- `completedDate`
- `project`
- `title`
- `status`
- `priority`
- `category`
- `plan`
- `notes`
- `source`

其中：

- `date`：录入日期，格式 `YYYY-MM-DD`
- `dueDate`：计划完成日期，格式 `YYYY-MM-DD`
- `completedDate`：实际完成日期，可为空
- `status`：`planned` / `pending` / `done` / `delayed` / `paused` / `abandoned`
- `priority`：`高` / `中` / `普通`
- `source`：推荐 `skill-sync`、`mcp-sync`、`manual`

## 合并规则

建议唯一键：

- `date + project + title + dueDate`

处理规则：

1. 若唯一键已存在，则更新原记录。
2. 若唯一键不存在，则新增记录。
3. 若 `status = done` 且 `completedDate` 为空，则自动补成 `date`。
4. 若 `dueDate` 为空，则自动补成 `date`。

## 推荐 Skill 写法

单条：

```text
请使用 daily-report-sync skill，把以下任务写入日报：
2026-06-22 | 北辰家居 | 客户问题处理 | done | 高 | 综合事务 | 已同步周会 | 无
```

批量：

```text
请使用 daily-report-sync skill，把以下任务批量写入日报：
2026-06-22 | 北辰家居 | 客户问题处理 | done | 高 | 综合事务 | |
2026-06-22 | 星桥餐饮 | PRD更新 | pending | 中 | 产品设计 | 明天完成 | 等确认
```

## 推荐 MCP / 代理写法

请求体直接传数组：

```json
[
  {
    "date": "2026-06-22",
    "dueDate": "2026-06-22",
    "completedDate": "2026-06-22",
    "project": "北辰家居",
    "title": "客户问题处理",
    "status": "done",
    "priority": "高",
    "category": "综合事务",
    "plan": "",
    "notes": ""
  }
]
```

代理侧只需负责：

1. 读取 `data/live-data.js`
2. 解析 `window.LIVE_DATA`
3. 按唯一键合并
4. 回写文件
5. 触发仓库提交或部署流程（如果有）

## 推荐落地方式

- 页面展示继续用静态站点部署
- 数据写入通过本地 AI、Skill、MCP 代理或仓库自动化完成
- 页面中的 Skill / MCP 区域用于生成可直接下载的说明文件与标准路由，方便 AI 自动读取

## 相关文件

- `skills/daily-report-sync/SKILL.md`
- `skill-sync.md`
- `mcp-sync.json`
- `data/live-data.js`
