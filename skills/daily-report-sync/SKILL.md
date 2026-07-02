---
name: daily-report-sync
description: 将工作日报任务直接写入日报记录台的数据文件，适用于 Codex、QClaw 或本地自动化代理。
---

# Daily Report Sync

把任务写入 `data/live-data.js`，供日报记录台页面直接加载。

## 服务信息

- 页面域名：`example-daily-report.pages.dev`
- 访问地址：`https://example-daily-report.pages.dev`
- Skill 路由：`https://example-daily-report.pages.dev/skill-sync.md`
- MCP 路由：`https://example-daily-report.pages.dev/mcp-sync.json`
- 默认免密 IP：`未预置`
- 数据文件：`data/live-data.js`
- 数据对象：`window.LIVE_DATA`

## 记录字段

每条任务对象包含：

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

## 允许值

`status`：

- `planned`
- `pending`
- `done`
- `delayed`
- `paused`
- `abandoned`

`priority`：

- `高`
- `中`
- `普通`

推荐 `category`：

- `需求沟通`
- `产品设计`
- `数据处理`
- `测试上线`
- `会议出差`
- `招聘培训`
- `行政协同`
- `AI探索`
- `综合事务`
- `休假`

## 合并规则

逻辑唯一键：

- `date + project + title + dueDate`

若命中唯一键，则更新原记录。
若未命中唯一键，则新增记录。

## 推荐 source

- `skill-sync`

## 文件格式

保持文件结构为：

```js
window.LIVE_DATA = [
  ...records
];
```

## 工作流

1. 读取当前 `data/live-data.js`
2. 解析 `window.LIVE_DATA` 数组
3. 将输入任务标准化
4. 按唯一键合并
5. 回写 `data/live-data.js`
6. 如有部署流程，再触发仓库提交或自动部署

## 输入示例

单条：

- `2026-06-22 | 北辰家居 | 客户问题处理 | done | 高 | 综合事务 | 已同步周会 | 无`

批量：

- `2026-06-22 | 星桥餐饮 | PRD更新 | pending | 中 | 产品设计 | 明天完成 | 等确认`
- `2026-06-22 | 云帆数据 | 月报核对 | done | 中 | 数据处理 | | 已同步`

## 备注

- 若 `completedDate` 缺失且 `status=done`，自动补为 `date`
- 若 `dueDate` 缺失，自动补为 `date`
- 若 `plan` 或 `notes` 缺失，使用空字符串
- 如需最新域名、接口地址或运行配置，请优先读取在线 `skill-sync.md`
