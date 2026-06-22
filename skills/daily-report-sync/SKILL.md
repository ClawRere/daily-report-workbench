---
name: daily-report-sync
description: Write or update daily report task records for the local daily-report app. Use when the user asks Codex/QClaw to directly record completed work, plans,补录 tasks, or batch-write structured daily tasks into the report system. Target file is data/live-data.js, and records must follow the app schema.
---

# Daily Report Sync

Write task data into `data/live-data.js` so the daily report app can load it directly.

## Target

Always update:
- `data/live-data.js`

Do not write user-entered tasks only into browser local storage when the request is for shared/project data sync.

## Record Schema

Each task object should contain:
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

## Allowed Values

`status`:
- `planned`
- `pending`
- `done`
- `delayed`
- `paused`
- `abandoned`

`priority`:
- `高`
- `中`
- `普通`

Recommended categories:
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

## Merge Rule

Treat this as the logical unique key:
- `date + project + title + dueDate`

If a matching record exists, update it.
If no match exists, append a new record.

## Source Value

Use:
- `source: "skill-sync"`

## File Format

Keep file content as:

```js
window.LIVE_DATA = [
  ...records
];
```

## Workflow

1. Read current `data/live-data.js`.
2. Parse existing `window.LIVE_DATA` array.
3. Normalize incoming records.
4. Merge by the unique key.
5. Rewrite `data/live-data.js`.
6. Preserve ASCII JS syntax and valid UTF-8 file content.

## Input Examples

Single line:
- `2026-06-22 | POPEYES | 数据核对 | done | 高 | 数据处理 | 完成6月核对 | 无`

Batch lines:
- `2026-06-22 | 欧派 | 客户问题处理 | done | 高 | 综合事务 | |`
- `2026-06-22 | 德克士 | PRD更新 | pending | 中 | 产品设计 | 明天完成 | 等确认`

## Notes

If `completedDate` is missing and `status=done`, set it to `date`.
If `dueDate` is missing, default it to `date`.
If `plan` or `notes` is missing, use empty string.
