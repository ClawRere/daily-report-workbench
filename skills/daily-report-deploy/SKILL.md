---
name: daily-report-deploy
description: Prepare and deploy the daily-report static app to GitHub Pages, Vercel, or Cloudflare Pages. Use when the user asks to create a repository, push code, configure static hosting, or generate deployment steps for this project.
---

# Daily Report Deploy

Deploy this project as a static site.

## Preferred Order

1. GitHub Pages
2. Vercel
3. Cloudflare Pages

## Project Type

This app is a static frontend site.
No build step is required.
Deploy root directory directly.

## GitHub Pages

Use repository root as publish directory.
Suggested workflow:
1. Initialize git if needed.
2. Create remote repository.
3. Push `main` branch.
4. Enable Pages from `main` and `/root`.

## Vercel

Framework preset:
- `Other`

Build command:
- empty

Output directory:
- `.`

## Cloudflare Pages

Framework preset:
- `None`

Build command:
- empty

Build output directory:
- `.`

## Required Checks Before Deploy

1. Confirm `index.html` exists in root.
2. Confirm static assets use relative paths.
3. Confirm no local absolute file paths are required at runtime.
4. Confirm shared task data file `data/live-data.js` is committed.

## Codex/QClaw Integration Reminder

When deployment is requested together with direct writing support, keep these files in repo:
- `data/live-data.js`
- `skills/daily-report-sync/SKILL.md`
- `skills/daily-report-deploy/SKILL.md`
- deployment docs in README or docs/
