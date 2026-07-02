from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "data" / "seed-data.js"

SAMPLE_TASKS = [
    {
        "id": "sample-001",
        "date": "2026-06-23",
        "dueDate": "2026-06-23",
        "completedDate": "2026-06-23",
        "project": "北辰家居",
        "title": "月度客户反馈整理",
        "category": "综合事务",
        "priority": "高",
        "status": "done",
        "plan": "沉淀重点问题与处理建议",
        "notes": "已同步到周会纪要",
        "source": "sample",
    },
    {
        "id": "sample-002",
        "date": "2026-06-23",
        "dueDate": "2026-06-24",
        "completedDate": "",
        "project": "星桥餐饮",
        "title": "投放配置 PRD 更新",
        "category": "产品设计",
        "priority": "中",
        "status": "pending",
        "plan": "补齐配置字段和审批流程",
        "notes": "待业务确认口径",
        "source": "sample",
    },
    {
        "id": "sample-003",
        "date": "2026-06-22",
        "dueDate": "2026-06-22",
        "completedDate": "2026-06-25",
        "project": "云帆数据",
        "title": "门店数据异常排查",
        "category": "数据处理",
        "priority": "高",
        "status": "done",
        "plan": "定位采集缺口并补数",
        "notes": "属于历史逾期完成样例",
        "source": "sample",
    },
    {
        "id": "sample-004",
        "date": "2026-06-21",
        "dueDate": "2026-06-21",
        "completedDate": "",
        "project": "山海出行",
        "title": "活动页面样式优化",
        "category": "产品设计",
        "priority": "中",
        "status": "delayed",
        "plan": "优化移动端首屏展示",
        "notes": "当前逾期样例",
        "source": "sample",
    },
]


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(SAMPLE_TASKS, ensure_ascii=False, indent=2)
    OUTPUT.write_text(f"window.SEED_DATA = {payload};\n", encoding="utf-8")
    print(f"seed tasks: {len(SAMPLE_TASKS)}")
    print(f"output: {OUTPUT}")


if __name__ == "__main__":
    main()
