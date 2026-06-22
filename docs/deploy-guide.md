# 部署说明

## 推荐顺序

1. GitHub Pages
2. Vercel
3. Cloudflare Pages

## GitHub Pages

适合当前这个静态项目，最简单。

步骤：
1. 初始化 Git 仓库
2. 推送到 GitHub
3. 仓库设置里开启 Pages
4. 选择 `main` 分支和根目录

## Vercel

- Framework Preset: `Other`
- Build Command: 留空
- Output Directory: `.`

## Cloudflare Pages

- Framework preset: `None`
- Build command: 留空
- Build output directory: `.`

## 数据同步说明

为了让 Codex / QClaw 可以直接写入任务，项目新增：
- `data/live-data.js`
- `skills/daily-report-sync/SKILL.md`
- `skills/daily-report-deploy/SKILL.md`
- `docs/integration-spec.md`

页面启动后会把 `seed-data.js` 和 `live-data.js` 一起合并到本地展示数据中。
