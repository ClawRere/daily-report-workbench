window.REPORT_SYNC_CONFIG = {
  appName: "日报记录台",
  defaultOrigin: "https://example-daily-report.pages.dev",
  domain: "example-daily-report.pages.dev",
  trustedIps: [],
  targetFile: "data/live-data.js",
  dataGlobal: "window.LIVE_DATA",
  mergeKey: ["date", "project", "title", "dueDate"],
  skillRoute: "skill-sync.md",
  mcpRoute: "mcp-sync.json",
  modelPath: "/chat/completions",
  sampleMode: true
};

window.REPORT_SKILL_LINK = "";
window.REPORT_MCP_LINK = "";
