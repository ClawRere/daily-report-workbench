# 日报记录台

这是一个可直接部署到 GitHub Pages、Vercel、Cloudflare Pages 的静态日报工具。

## 当前能力

- 今日页 / 汇总页单页切换
- 支持按日、月、季度、年查看
- 支持按项目 / 按日期汇总
- 支持一句话录入、批量录入、字段录入
- 支持 JSON / Excel 导入导出
- 支持 AI 总结、PPT 提示词
- 支持通过 `data/live-data.js` 做共享任务写入
- 支持在“设置”中直接复制 Codex / QClaw 的 skill / MCP 接入说明

## 部署方式

### 1. GitHub Pages

最推荐。

- 新建 GitHub 仓库
- 上传整个项目目录
- 在仓库 `Settings -> Pages`
- Source 选择 `Deploy from a branch`
- 分支选 `main`
- 目录选 `/ (root)`

### 2. Vercel

- 导入仓库
- Framework 选 `Other`
- Build Command 留空
- Output Directory 填 `.`

### 3. Cloudflare Pages

- 连接 Git 仓库
- Framework preset 选 `None`
- Build command 留空
- Build output directory 填 `.`

## 共享写入

共享数据文件：
- `data/live-data.js`

相关文档：
- `docs/integration-spec.md`
- `skills/daily-report-sync/SKILL.md`
- `skills/daily-report-deploy/SKILL.md`

## 目录说明

- `index.html` 页面结构
- `styles.css` 主样式
- `app.js` 主逻辑
- `enhancements.js` 增强逻辑
- `data/seed-data.js` 初始数据
- `data/live-data.js` 共享写入数据
- `live-sync.js` 设置页里的集成说明文本
- `skills/` 本地可复用 skill
- `docs/integration-spec.md` 写入规范
