# 日报记录台公开样例

这是一个可直接部署到 GitHub Pages 的日报记录静态模板仓库，默认展示脱敏样例数据，适合公开演示、复制二次使用、验证 AI 写入流程。

## 你能直接用它做什么

- 记录每日计划、待办、完成情况
- 按日、月、季度、年度查看汇总
- 在今日页和汇总页之间直接切换
- 支持一句话录入、批量写入、字段录入
- 支持导入和导出 JSON / Excel
- 支持 AI 生成月报、季报、年报摘要与 PPT 提示词
- 在设置中直接下载 Skill / MCP 对接文件，给 Codex、QClaw 或本地代理使用

## 公开版与私人版建议

公开版建议只放样例或脱敏数据，方便分享。
真实工作记录建议复制本仓库后部署为私人版，并将完整数据保存在自己的仓库中。

## 部署方式

### GitHub Pages

最简单，推荐直接使用。

1. 创建一个新仓库
2. 上传整个项目目录
3. 打开仓库的 `Settings -> Pages`
4. Source 选择 `Deploy from a branch`
5. 分支选择 `main`
6. 目录选择 `/ (root)`

### Vercel

- Framework Preset 选 `Other`
- Build Command 留空
- Output Directory 填 `.`

### Cloudflare Pages

- Framework preset 选 `None`
- Build command 留空
- Build output directory 填 `.`

## 目录说明

- `index.html` 页面结构
- `styles.css` 主样式
- `enhancements.css` 补充样式
- `app.js` 主逻辑
- `enhancements-v2.js` 访问控制、导入导出整合、Skill/MCP 下载等增强逻辑
- `data/seed-data.js` 公开样例数据
- `data/live-data.js` 共享写入数据文件
- `live-sync.js` 当前域名、路由和模式配置
- `skill-sync.md` 在线 Skill 路由说明
- `mcp-sync.json` 在线 MCP 路由说明
- `skills/daily-report-sync/SKILL.md` 本地 Skill 示例
- `skills/daily-report-deploy/SKILL.md` 部署 Skill 示例
- `docs/integration-spec.md` AI / MCP 写入规范

## AI 写入入口

页面设置里可以直接下载两类文件：

- `Skill`：给 Codex / QClaw 按统一规则写入数据
- `MCP`：给本地代理、脚本或自动化程序读取字段规范和合并规则

真实写入目标文件是：

- `data/live-data.js`

## 注意

这是静态站点。
页面本身负责展示、筛选和本地录入体验；如果要让 AI 远程持续写入仓库数据，建议配合本地脚本、GitHub 仓库更新流程，或你自己的 MCP / Skill 代理来完成。
