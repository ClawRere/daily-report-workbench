window.REPORT_SKILL_LINK = [
  "Skill 名称：daily-report-sync",
  "用途：让 Codex / QClaw 直接按固定格式写入日报数据文件。",
  "推荐说法：",
  "请使用 daily-report-sync skill，把以下任务写入日报：",
  "2026-06-22 | POPEYES | 数据核对 | done | 高 | 数据处理 | 计划说明 | 备注",
  "写入目标：data/live-data.js",
  "写入规则：若同日期+项目+标题重复则更新，否则新增。"
].join("\n");

window.REPORT_MCP_LINK = [
  "MCP 写入规范：",
  "1. 调用方输出结构化数组 JSON。",
  "2. 每项字段：date,dueDate,completedDate,project,title,status,priority,category,plan,notes。",
  "3. 将数据追加或合并到 data/live-data.js 的 window.LIVE_DATA 数组。",
  "4. 前端加载顺序：seed-data.js -> live-data.js；展示时两者合并。",
  "5. 合并键建议：date + project + title + dueDate。"
].join("\n");
