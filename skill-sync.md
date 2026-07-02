---
name: daily-report-sync
description: 将工作日报任务直接写入日报记录台的数据文件，适用于 Codex、QClaw 或本地代理。
---

# Daily Report Sync

## 服务信息
- 页面域名：`example-daily-report.pages.dev`
- 访问地址：`https://example-daily-report.pages.dev`
- Skill 路由：`https://example-daily-report.pages.dev/skill-sync.md`
- MCP 路由：`https://example-daily-report.pages.dev/mcp-sync.json`
- 免密 IP：`未预置`
- 目标文件：`data/live-data.js`
- 数据对象：`window.LIVE_DATA`
- 接口约定：`mergeDailyReportTasks`
- OpenAI 兼容路径：`base_url + /chat/completions`

## 对接方式
1. 读取 `data/live-data.js` 中的 `window.LIVE_DATA` 数组。
2. 将输入整理为标准任务数组。
3. 以 `date + project + title + dueDate` 作为唯一键进行更新或新增。
4. 将结果回写到 `data/live-data.js`。
5. 若 `status=done` 且 `completedDate` 为空，则自动补为 `date`。
6. 当前站点为静态部署，真正写入建议由本地 AI、脚本或 MCP 代理在仓库内完成。

## 字段要求
- `date`: 录入日期，格式 `YYYY-MM-DD`
- `dueDate`: 计划完成日期，格式 `YYYY-MM-DD`
- `completedDate`: 实际完成日期，格式 `YYYY-MM-DD`，可空
- `project`: 项目名称
- `title`: 事项名称
- `status`: `planned | pending | done | delayed | paused | abandoned`
- `priority`: `高 | 中 | 普通`
- `category`: `需求沟通 | 产品设计 | 数据处理 | 测试上线 | 会议出差 | 招聘培训 | 行政协同 | AI探索 | 综合事务 | 休假`
- `plan`: 计划说明，可空
- `notes`: 备注，可空

## 建议输入
单条：`2026-06-22 | 北辰家居 | 客户问题处理 | done | 高 | 综合事务 | 已同步周会 | `

批量：多行同格式，或先写日期再写编号事项。

## 说明
如需当前站点的最新模型地址、路由或其他运行配置，请优先在页面“设置”中下载最新 Skill 文件。
