(function () {
  const PRIMARY_STORAGE_KEY = "daily-report-workbench-v8";
  const SETTINGS_KEY = "daily-report-settings-v2";
  const ACCESS_SESSION_KEY = "daily-report-access-session";
  const DEFAULT_ACCESS_PASSWORD = "";
  const DEFAULT_TRUSTED_IPS = [];
  const CONFIG = window.REPORT_SYNC_CONFIG || {};

  function normalizeText(value) {
    return String(value || "").replace(/[\u3000]/g, " ").trim();
  }

  function readJson(key) {
    try {
      const value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  function todayStr() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    window.clearTimeout(showToast.__timer);
    showToast.__timer = window.setTimeout(() => {
      toast.classList.add("hidden");
    }, 2200);
  }

  function parseTrustedIps(input) {
    if (Array.isArray(input)) {
      return [...new Set(input.map((item) => normalizeText(item)).filter(Boolean))];
    }

    return [...new Set(normalizeText(input).split(/[；;，,\n\r]+/).map((item) => normalizeText(item)).filter(Boolean))];
  }

  function readSettings() {
    const current = readJson(SETTINGS_KEY) || {};
    return {
      ...current,
      accessEnabled: current.accessEnabled ?? false,
      accessPassword: current.accessPassword || DEFAULT_ACCESS_PASSWORD,
      trustedIps: parseTrustedIps(current.trustedIps?.length ? current.trustedIps : DEFAULT_TRUSTED_IPS),
      baseUrl: current.baseUrl || "",
      apiKey: current.apiKey || "",
      model: current.model || ""
    };
  }

  function writeSettings(next) {
    const current = readSettings();
    const merged = {
      ...current,
      ...next,
      trustedIps: parseTrustedIps(next.trustedIps ?? current.trustedIps)
    };
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    return merged;
  }

  function ensureSettingsDefaults() {
    const current = readSettings();
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
  }

  function readStoredAppData() {
    const keys = [
      PRIMARY_STORAGE_KEY,
      "daily-report-workbench-v7",
      "daily-report-workbench-v6",
      "daily-report-workbench-v5",
      "daily-report-workbench-v4",
      "daily-report-workbench"
    ];

    for (const key of keys) {
      const value = readJson(key);
      if (value?.tasks?.length) return value;
    }

    return null;
  }

  function persistTasks(tasks, extra = {}) {
    const stored = readStoredAppData() || {};
    window.localStorage.setItem(
      PRIMARY_STORAGE_KEY,
      JSON.stringify({
        ...stored,
        ...extra,
        tasks
      })
    );
  }

  function mergeTasks(existing, incoming) {
    const keyFields = CONFIG.mergeKey || ["date", "project", "title", "dueDate"];
    const map = new Map();

    const makeKey = (task) =>
      keyFields
        .map((field) => normalizeText(task?.[field]))
        .join("__")
        .toLowerCase();

    existing.forEach((task) => {
      map.set(makeKey(task), task);
    });

    incoming.forEach((task) => {
      const key = makeKey(task);
      const previous = map.get(key) || {};
      map.set(key, {
        ...previous,
        ...task,
        source: task.source || previous.source || "live-data"
      });
    });

    return [...map.values()].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return normalizeText(a.title).localeCompare(normalizeText(b.title), "zh-CN");
    });
  }

  function getEffectiveOrigin() {
    const liveOrigin = normalizeText(window.location.origin);
    if (liveOrigin && liveOrigin !== "null" && !liveOrigin.startsWith("file:")) return liveOrigin;
    return normalizeText(CONFIG.defaultOrigin) || "";
  }

  function getEffectiveHostname() {
    const host = normalizeText(window.location.hostname);
    if (host && host !== "localhost" && host !== "127.0.0.1") return host;
    return normalizeText(CONFIG.domain) || host;
  }

  function joinUrl(base, path) {
    const cleanBase = String(base || "").replace(/\/+$/, "");
    const cleanPath = String(path || "").replace(/^\/+/, "");
    return cleanBase ? `${cleanBase}/${cleanPath}` : cleanPath;
  }

  function buildSkillDoc(settings) {
    const origin = getEffectiveOrigin();
    const hostname = getEffectiveHostname();
    const skillUrl = origin ? joinUrl(origin, CONFIG.skillRoute || "skill-sync.md") : "";
    const mcpUrl = origin ? joinUrl(origin, CONFIG.mcpRoute || "mcp-sync.json") : "";
    const ipText = (settings.trustedIps || []).join("; ") || "";

    return [
      "---",
      "name: daily-report-sync",
      "description: 将工作日报任务直接写入日报记录台的数据文件，适用于 Codex、QClaw 或本地代理。",
      "---",
      "",
      "# Daily Report Sync",
      "",
      "## 服务信息",
      `- 页面域名：${hostname || ""}`,
      `- 访问地址：${origin || ""}`,
      `- Skill 路由：${skillUrl}`,
      `- MCP 路由：${mcpUrl}`,
      `- 免密 IP：${ipText || "未设置"}`,
      `- 模型接口：${normalizeText(settings.baseUrl) || "未设置"}`,
      `- OpenAI 兼容路径：${joinUrl(normalizeText(settings.baseUrl) || origin || "", CONFIG.modelPath || "/chat/completions")}`,
      `- 目标文件：${CONFIG.targetFile || "data/live-data.js"}`,
      `- 数据对象：${CONFIG.dataGlobal || "window.LIVE_DATA"}`,
      `- 合并键：${(CONFIG.mergeKey || ["date", "project", "title", "dueDate"]).join(" + ")}`,
      "",
      "## 对接方式",
      "1. 读取目标文件中的 window.LIVE_DATA 数组。",
      "2. 将输入内容整理为标准任务数组。",
      "3. 以 date + project + title + dueDate 作为唯一键进行更新或新增。",
      "4. 将结果回写到 data/live-data.js。",
      "5. 若 status=done 且 completedDate 为空，则自动补为 date。",
      "6. 若部署在静态站点，真正写入应由本地 AI、脚本或 MCP 代理在仓库内完成。",
      "",
      "## 字段要求",
      "- date: 录入日期，格式 YYYY-MM-DD",
      "- dueDate: 计划完成日期，格式 YYYY-MM-DD",
      "- completedDate: 实际完成日期，格式 YYYY-MM-DD，可空",
      "- project: 项目名称",
      "- title: 事项名称",
      "- status: planned | pending | done | delayed | paused | abandoned",
      "- priority: 高 | 中 | 普通",
      "- category: 需求沟通 | 产品设计 | 数据处理 | 测试上线 | 会议出差 | 招聘培训 | 行政协同 | AI探索 | 综合事务 | 休假",
      "- plan: 计划说明，可空",
      "- notes: 备注，可空",
      "",
      "## 建议输入",
      "单条：2026-06-22 | 北辰家居 | 客户问题处理 | done | 高 | 综合事务 | | ",
      "批量：多行同格式，或先写日期再写编号事项。"
    ].join("\n");
  }

  function buildMcpDoc(settings) {
    const origin = getEffectiveOrigin();
    const hostname = getEffectiveHostname();
    return JSON.stringify(
      {
        name: "daily-report-sync",
        type: "workspace-file-contract",
        app: CONFIG.appName || "日报记录台",
        service: {
          domain: hostname || "",
          origin: origin || "",
          skillRoute: origin ? joinUrl(origin, CONFIG.skillRoute || "skill-sync.md") : "",
          mcpRoute: origin ? joinUrl(origin, CONFIG.mcpRoute || "mcp-sync.json") : "",
          trustedIps: settings.trustedIps || []
        },
        storage: {
          targetFile: CONFIG.targetFile || "data/live-data.js",
          globalName: CONFIG.dataGlobal || "window.LIVE_DATA",
          mergeKey: CONFIG.mergeKey || ["date", "project", "title", "dueDate"]
        },
        interface: {
          name: "mergeDailyReportTasks",
          description: "将任务数组合并并写入日报数据文件",
          input: {
            type: "array",
            itemFields: {
              date: "YYYY-MM-DD",
              dueDate: "YYYY-MM-DD",
              completedDate: "YYYY-MM-DD | 空字符串",
              project: "string",
              title: "string",
              status: ["planned", "pending", "done", "delayed", "paused", "abandoned"],
              priority: ["高", "中", "普通"],
              category: ["需求沟通", "产品设计", "数据处理", "测试上线", "会议出差", "招聘培训", "行政协同", "AI探索", "综合事务", "休假"],
              plan: "string",
              notes: "string"
            }
          },
          output: {
            ok: true,
            mergedCount: 0,
            targetFile: CONFIG.targetFile || "data/live-data.js"
          }
        },
        notes: [
          "这是给 AI、本地自动化或代理使用的写入规范，不是在线公网写接口。",
          "如果部署在静态站点，页面只负责展示；真正写入仍由本地代理或 AI 在仓库内更新数据文件。",
          "推荐先读取路由说明，再按 mergeKey 执行追加或更新。"
        ]
      },
      null,
      2
    );
  }

  function refreshIntegrationDocs() {
    const settings = readSettings();
    window.REPORT_SKILL_LINK = buildSkillDoc(settings);
    window.REPORT_MCP_LINK = buildMcpDoc(settings);
  }

  function bindSettingsIntegration() {
    const downloadSkillBtn = document.getElementById("download-skill-btn");
    const downloadMcpBtn = document.getElementById("download-mcp-btn");
    const openSettingsBtn = document.getElementById("open-settings-btn");
    const trustedIpsInput = document.getElementById("settings-trusted-ips");
    const baseUrlInput = document.getElementById("settings-base-url");

    refreshIntegrationDocs();

    downloadSkillBtn?.addEventListener("click", () => {
      refreshIntegrationDocs();
      downloadFile("daily-report-sync.skill.md", window.REPORT_SKILL_LINK || "", "text/markdown;charset=utf-8");
      showToast("Skill 文件已下载");
    });

    downloadMcpBtn?.addEventListener("click", () => {
      refreshIntegrationDocs();
      downloadFile("daily-report-mcp.json", window.REPORT_MCP_LINK || "", "application/json;charset=utf-8");
      showToast("MCP 规范已下载");
    });

    openSettingsBtn?.addEventListener("click", () => {
      window.setTimeout(() => {
        fillAccessSettingsForm();
        applyBranding();
        refreshIntegrationDocs();
      }, 0);
    });

    [trustedIpsInput, baseUrlInput].forEach((element) => {
      element?.addEventListener("input", () => window.setTimeout(refreshIntegrationDocs, 0));
    });

    window.__refreshIntegrationDocs = refreshIntegrationDocs;
    window.__fillAccessSettingsForm = fillAccessSettingsForm;
  }

  function exportStoredJson() {
    const stored = readStoredAppData() || {};
    const payload = {
      tasks: stored.tasks || [],
      exportedAt: new Date().toISOString()
    };
    downloadFile(`日报记录-${todayStr()}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function exportStoredExcel() {
    const stored = readStoredAppData() || {};
    const tasks = Array.isArray(stored.tasks) ? stored.tasks : [];
    if (!window.XLSX) {
      showToast("当前环境缺少 Excel 组件");
      return;
    }

    const rows = tasks.map((task) => ({
      录入日期: task.date || "",
      计划完成日期: task.dueDate || "",
      实际完成日期: task.completedDate || "",
      项目: task.project || "",
      事务: task.title || "",
      完成情况: task.status || "",
      重要程度: task.priority || "",
      分类: task.category || "",
      计划: task.plan || "",
      备注: task.notes || "",
      来源: task.source || ""
    }));

    const workbook = window.XLSX.utils.book_new();
    const sheet = window.XLSX.utils.json_to_sheet(rows.length ? rows : [{ 提示: "暂无数据" }]);
    window.XLSX.utils.book_append_sheet(workbook, sheet, "日报记录");
    window.XLSX.writeFile(workbook, `日报记录-${todayStr()}.xlsx`);
  }

  async function importAnyFile(file) {
    if (!file) return;
    const name = normalizeText(file.name).toLowerCase();

    if (name.endsWith(".json")) {
      const text = await file.text();
      const parsed = JSON.parse(text || "{}");
      const tasks = Array.isArray(parsed) ? parsed : Array.isArray(parsed.tasks) ? parsed.tasks : [];
      persistTasks(tasks, { importedAt: new Date().toISOString() });
      showToast("JSON 已导入");
      window.location.reload();
      return;
    }

    if ((name.endsWith(".xlsx") || name.endsWith(".xls")) && window.XLSX) {
      const buffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = window.XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
      const tasks = rows.map((row, index) => ({
        id: `import-${Date.now()}-${index}`,
        date: normalizeText(row["录入日期"] || row.date) || todayStr(),
        dueDate: normalizeText(row["计划完成日期"] || row.dueDate || row["录入日期"] || row.date) || todayStr(),
        completedDate: normalizeText(row["实际完成日期"] || row.completedDate),
        project: normalizeText(row["项目"] || row.project),
        title: normalizeText(row["事务"] || row["任务"] || row.title),
        status: normalizeText(row["完成情况"] || row.status) || "done",
        priority: normalizeText(row["重要程度"] || row.priority) || "中",
        category: normalizeText(row["分类"] || row.category) || "综合事务",
        plan: normalizeText(row["计划"] || row.plan),
        notes: normalizeText(row["备注"] || row.notes),
        source: "excel-import"
      }));
      persistTasks(tasks, { importedAt: new Date().toISOString() });
      showToast("Excel 已导入");
      window.location.reload();
      return;
    }

    showToast("暂不支持该文件类型");
  }

  function bindUnifiedImportExport() {
    const importBtn = document.getElementById("unified-import-btn");
    const exportBtn = document.getElementById("unified-export-btn");
    const importInput = document.getElementById("import-any-input");
    const exportModal = document.getElementById("export-modal");
    const closeExportBtn = document.getElementById("close-export-btn");
    const exportJsonBtn = document.getElementById("export-json-direct-btn");
    const exportExcelBtn = document.getElementById("export-excel-direct-btn");

    importBtn?.addEventListener("click", () => importInput?.click());
    importInput?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (file) await importAnyFile(file);
      event.target.value = "";
    });

    exportBtn?.addEventListener("click", () => exportModal?.classList.remove("hidden"));
    closeExportBtn?.addEventListener("click", () => exportModal?.classList.add("hidden"));
    exportModal?.addEventListener("click", (event) => {
      if (event.target === exportModal) exportModal.classList.add("hidden");
    });

    exportJsonBtn?.addEventListener("click", () => {
      exportStoredJson();
      exportModal?.classList.add("hidden");
      showToast("JSON 已导出");
    });

    exportExcelBtn?.addEventListener("click", () => {
      exportStoredExcel();
      exportModal?.classList.add("hidden");
      showToast("Excel 已导出");
    });
  }

  function mergeLiveDataIntoStorage() {
    const liveData = Array.isArray(window.LIVE_DATA) ? window.LIVE_DATA : [];
    if (!liveData.length) return;
    const stored = readStoredAppData() || {};
    const existingTasks = Array.isArray(stored.tasks) ? stored.tasks : [];
    const merged = mergeTasks(existingTasks, liveData.map((item) => ({ ...item, source: item.source || "live-data" })));
    if (JSON.stringify(existingTasks) !== JSON.stringify(merged)) {
      persistTasks(merged);
    }
  }

  function hideLegacyImportExport() {
    ["export-excel-btn", "export-json-btn", "import-json-input", "import-excel-input"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === "INPUT") el.disabled = true;
      const parentLabel = el.closest("label");
      if (parentLabel) parentLabel.classList.add("hidden");
      else el.classList.add("hidden");
    });
  }

  function bindScrollTop() {
    const button = document.getElementById("scroll-top-btn");
    if (!button) return;

    const toggle = () => {
      button.classList.toggle("hidden", window.scrollY < 320);
    };

    button.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    window.addEventListener("scroll", toggle, { passive: true });
    toggle();
  }

  function fillAccessSettingsForm() {
    const settings = readSettings();
    const enabledInput = document.getElementById("settings-access-enabled");
    const passwordInput = document.getElementById("settings-access-password");
    const trustedIpsInput = document.getElementById("settings-trusted-ips");

    if (enabledInput) enabledInput.checked = Boolean(settings.accessEnabled);
    if (passwordInput) passwordInput.value = settings.accessPassword || DEFAULT_ACCESS_PASSWORD;
    if (trustedIpsInput) trustedIpsInput.value = (settings.trustedIps || []).join("\n");
  }

  function bindSettingsSave() {
    const saveBtn = document.getElementById("save-settings-btn");
    if (!saveBtn) return;

    fillAccessSettingsForm();

    saveBtn.addEventListener("click", () => {
      window.setTimeout(async () => {
        const enabledInput = document.getElementById("settings-access-enabled");
        const passwordInput = document.getElementById("settings-access-password");
        const trustedIpsInput = document.getElementById("settings-trusted-ips");

        const current = readSettings();
        const next = writeSettings({
          accessEnabled: Boolean(enabledInput?.checked),
          accessPassword: normalizeText(passwordInput?.value) || current.accessPassword || DEFAULT_ACCESS_PASSWORD,
          trustedIps: parseTrustedIps(trustedIpsInput?.value || current.trustedIps)
        });

        window.localStorage.removeItem(ACCESS_SESSION_KEY);
        refreshIntegrationDocs();
        await applyAccessControl(next);
      }, 0);
    });
  }

  function applyBranding() {
    const sampleMode = Boolean(CONFIG.sampleMode);
    const brandTitle = document.getElementById("brand-title");
    const hero = document.getElementById("sample-hero");
    const heroBadge = document.getElementById("sample-hero-badge");
    const heroTitle = document.getElementById("sample-hero-title");
    const heroText = document.getElementById("sample-hero-text");

    if (brandTitle) {
      brandTitle.textContent = sampleMode ? "日报记录台 · 公开样例" : "日报记录台 · 私人版";
    }

    if (hero) {
      hero.classList.toggle("hidden", !sampleMode);
    }

    if (heroBadge) heroBadge.textContent = sampleMode ? "公开样例" : "私人工作台";
    if (heroTitle) heroTitle.textContent = sampleMode ? "可直接复制部署的日报模板" : "个人日报记录与汇总工作台";
    if (heroText) {
      heroText.textContent = sampleMode
        ? "这里展示的是脱敏样例数据，方便公开预览、复制仓库和验证功能；真实工作记录建议部署私人版。"
        : "这里保留完整工作数据，适合日常录入、追踪、汇总和 AI 生成月报、季报、年报。";
    }
  }

  function isLocalBypass() {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return protocol === "file:" || hostname === "localhost" || hostname === "127.0.0.1";
  }

  function readAccessSession() {
    const session = readJson(ACCESS_SESSION_KEY);
    return session && session.host === (window.location.host || window.location.pathname) ? session : null;
  }

  function writeAccessSession(mode) {
    window.localStorage.setItem(
      ACCESS_SESSION_KEY,
      JSON.stringify({
        mode,
        host: window.location.host || window.location.pathname,
        grantedAt: new Date().toISOString()
      })
    );
  }

  function setAuthStatus(text, kind = "") {
    const status = document.getElementById("auth-status");
    if (!status) return;
    status.textContent = text;
    status.dataset.kind = kind;
  }

  function unlockAccess(mode = "session") {
    const overlay = document.getElementById("auth-overlay");
    if (overlay) overlay.classList.add("hidden");
    document.body.classList.remove("modal-open");
    writeAccessSession(mode);
  }

  function lockAccess(message) {
    const overlay = document.getElementById("auth-overlay");
    if (overlay) overlay.classList.remove("hidden");
    document.body.classList.add("modal-open");
    setAuthStatus(message || "请输入访问密码", "warn");
  }

  function isIpv4(value) {
    return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(String(value || "").trim());
  }

  async function detectPublicIp() {
    const urls = ["https://api.ipify.org?format=json", "https://api64.ipify.org?format=json"];

    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) continue;
        const json = await response.json();
        if (isIpv4(json.ip)) return json.ip;
      } catch {
        // ignore
      }
    }

    return "";
  }

  function detectLanIps() {
    return new Promise((resolve) => {
      const result = new Set();
      const RTCPeer = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
      if (!RTCPeer) {
        resolve([]);
        return;
      }

      const pc = new RTCPeer({ iceServers: [] });
      pc.createDataChannel("detect-ip");
      pc.onicecandidate = (event) => {
        const candidate = event.candidate?.candidate || "";
        const match = candidate.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
        if (match && isIpv4(match[1])) result.add(match[1]);
      };

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => null)
        .finally(() => {
          window.setTimeout(() => {
            pc.close();
            resolve([...result]);
          }, 1200);
        });
    });
  }

  async function detectClientIpCandidates() {
    const candidates = new Set();
    const hostname = normalizeText(window.location.hostname);
    if (isIpv4(hostname)) candidates.add(hostname);

    const [publicIp, lanIps] = await Promise.all([detectPublicIp(), detectLanIps()]);
    if (isIpv4(publicIp)) candidates.add(publicIp);
    (lanIps || []).forEach((ip) => {
      if (isIpv4(ip)) candidates.add(ip);
    });

    return [...candidates];
  }

  async function applyAccessControl(settings = readSettings()) {
    const passwordInput = document.getElementById("auth-password-input");
    if (passwordInput) passwordInput.value = "";

    if (isLocalBypass()) {
      unlockAccess("local-bypass");
      return;
    }

    if (!settings.accessEnabled) {
      unlockAccess("disabled");
      return;
    }

    if (readAccessSession()) {
      unlockAccess("session");
      return;
    }

    lockAccess("正在检测免密 IP...");
    const trustedIps = new Set(parseTrustedIps(settings.trustedIps));
    const candidates = await detectClientIpCandidates();
    const matched = candidates.find((ip) => trustedIps.has(ip));

    if (matched) {
      setAuthStatus(`已识别免密 IP：${matched}`);
      unlockAccess("trusted-ip");
      return;
    }

    const candidateText = candidates.length ? `已检测到：${candidates.join("、")}` : "未识别到当前 IP，可直接输入密码进入。";
    lockAccess(`未命中免密 IP。${candidateText}`);
  }

  function bindAccessControl() {
    const submitBtn = document.getElementById("auth-submit-btn");
    const passwordInput = document.getElementById("auth-password-input");

    const submit = async () => {
      const settings = readSettings();
      if (normalizeText(passwordInput?.value) === normalizeText(settings.accessPassword || DEFAULT_ACCESS_PASSWORD)) {
        setAuthStatus("密码正确，正在进入...");
        unlockAccess("password");
        showToast("已进入日报系统");
        return;
      }
      lockAccess("密码错误，请重新输入");
      if (passwordInput) passwordInput.value = "";
      passwordInput?.focus();
    };

    submitBtn?.addEventListener("click", submit);
    passwordInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    });
  }


  function bindSampleHeroClose() {
    const btn = document.getElementById("close-sample-hero-btn");
    const hero = document.getElementById("sample-hero");
    if (!btn || !hero) return;
    const dismissed = window.localStorage.getItem("sample-hero-dismissed");
    if (dismissed) hero.classList.add("hidden");
    btn.addEventListener("click", () => {
      hero.classList.add("hidden");
      window.localStorage.setItem("sample-hero-dismissed", "1");
    });
  }

  function init() {
    ensureSettingsDefaults();
    mergeLiveDataIntoStorage();
    hideLegacyImportExport();
    applyBranding();
    bindSettingsIntegration();
    bindUnifiedImportExport();
    bindScrollTop();
    bindSampleHeroClose();
    bindSettingsSave();
    bindAccessControl();
    applyAccessControl();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

