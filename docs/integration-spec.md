# 日报写入规范

## 一、目标

让 Codex / QClaw 可以不通过页面表单，直接把日报任务写入项目数据文件，并在页面中自动展示。

## 二、写入文件

统一写入：
- `data/live-data.js`

文件格式：

```js
window.LIVE_DATA = [
  {
    id: "live-20260622-1",
    date: "2026-06-22",
    dueDate: "2026-06-22",
    completedDate: "2026-06-22",
    project: "POPEYES",
    title: "数据核对",
    status: "done",
    priority: "高",
    category: "数据处理",
    plan: "",
    notes: "",
    source: "skill-sync"
  }
];
```

## 三、字段要求

- `date`：录入日期
- `dueDate`：计划完成日期
- `completedDate`：实际完成日期
- `project`：项目名称
- `title`：事务内容
- `status`：完成状态
- `priority`：紧急程度
- `category`：分类
- `plan`：计划说明
- `notes`：备注
- `source`：建议固定为 `skill-sync`

## 四、唯一键

建议按以下组合判断是否重复：

- `date + project + title + dueDate`

若重复：更新
若不重复：新增

## 五、适合直接对 Codex / QClaw 说的话

### 单条

```text
请使用 daily-report-sync skill，把以下任务写入日报：
2026-06-22 | POPEYES | 数据核对 | done | 高 | 数据处理 | | 
```

### 批量

```text
请使用 daily-report-sync skill，把以下任务批量写入日报：
2026-06-22 | 欧派 | 客户问题处理 | done | 高 | 综合事务 | | 
2026-06-22 | 德克士 | PRD更新 | pending | 中 | 产品设计 | 明天完成 | 等确认
```

## 六、MCP 规范

如果以后通过 MCP 服务写入，建议请求体直接传数组：

```json
[
  {
    "date": "2026-06-22",
    "dueDate": "2026-06-22",
    "completedDate": "2026-06-22",
    "project": "POPEYES",
    "title": "数据核对",
    "status": "done",
    "priority": "高",
    "category": "数据处理",
    "plan": "",
    "notes": ""
  }
]
```

服务端只需负责：
1. 读 `data/live-data.js`
2. 合并记录
3. 重写文件
