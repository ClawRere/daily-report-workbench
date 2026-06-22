(() => {
  const SETTINGS_KEY = "daily-report-settings-v2";
  const PRIMARY_STORAGE_KEY = "daily-report-workbench-v8";
  const LEGACY_STORAGE_KEYS = [
    "daily-report-workbench-v7",
    "daily-report-workbench-v6",
    "daily-report-workbench-v5",
    "daily-report-workbench-v4",
    "daily-report-workbench"
  ];

  function normalizeDate(value) {
    if (!value) return todayStr();
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    if (/^\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}$/.test(text)) {
      const parts = text.split(/[\/.-]/).map(Number);
      return `${parts[0]}-${pad(parts[1])}-${pad(parts[2])}`;
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? todayStr() : formatDate(date);
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function todayStr() {
    return formatDate(new Date());
  }

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

  function readStoredAppData() {
    for (const key of [PRIMARY_STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
      const value = readJson(key);
      if (value?.tasks?.length || value?.focusDate) return value;
    }
    return null;
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 2200);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fingerprint(task) {
    return [
      normalizeDate(task.date),
      normalizeText(task.project).toLowerCase(),
      normalizeText(task.title).toLowerCase(),
      normalizeDate(task.dueDate || task.date)
    ].join("__");
  }

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizeTask(task) {
    const date = normalizeDate(task.date);
    const dueDate = normalizeDate(task.dueDate || date);
    const status = normalizeText(task.status) || (date > todayStr() ? "planned" : "done");
    const completedDate = status === "done" ? normalizeDate(task.completedDate || date) : "";

    return {
      id: task.id || createId(),
      date,
      dueDate,
      completedDate,
      project: normalizeText(task.project) || "日常事务",
      title: normalizeText(task.title) || "未命名任务",
      status,
      priority: normalizeText(task.priority) || "中",
      category: normalizeText(task.category) || "综合事务",
      plan: normalizeText(task.plan),
      notes: normalizeText(task.notes),
      source: normalizeText(task.source) || "manual",
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function sortTasks(tasks) {
    return [...tasks].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      const aUpdated = a.updatedAt || a.createdAt || "";
      const bUpdated = b.updatedAt || b.createdAt || "";
      if (aUpdated !== bUpdated) return aUpdated < bUpdated ? 1 : -1;
      return a.title.localeCompare(b.title, "zh-CN");
    });
  }

  function persistTasks(mergedTasks) {
    const stored = readStoredAppData() || {};
    const next = {
      ...stored,
      tasks: mergedTasks,
      focusDate: stored.focusDate || todayStr(),
      scope: stored.scope || "day",
      summaryMode: stored.summaryMode || "date",
      calendarCollapsed: typeof stored.calendarCollapsed === "boolean" ? stored.calendarCollapsed : true
    };
    window.localStorage.setItem(PRIMARY_STORAGE_KEY, JSON.stringify(next));
  }

  function mergeTasks(existingTasks, incomingTasks) {
    const map = new Map(existingTasks.map((task) => [fingerprint(task), normalizeTask(task)]));
    incomingTasks.map(normalizeTask).forEach((task) => {
      const key = fingerprint(task);
      const current = map.get(key);
      map.set(key, current ? { ...current, ...task, id: current.id } : task);
    });
    return sortTasks([...map.values()]);
  }

  function parseJsonArrayFromString(input) {
    const text = String(input || "").trim();
    if (!text) return [];
    const unwrapped = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    const start = unwrapped.indexOf("[");
    const end = unwrapped.lastIndexOf("]");
    const jsonText = start >= 0 && end >= start ? unwrapped.slice(start, end + 1) : unwrapped;
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed) ? parsed : [];
  }

  function parseImportFile(file, text) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".json")) {
      const payload = JSON.parse(text);
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload.tasks)) return payload.tasks;
      throw new Error("invalid-json");
    }
    throw new Error("unsupported-text-import");
  }

  async function importAnyFile(file) {
    if (!file) return;
    try {
      let tasks = [];
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".json")) {
        tasks = parseImportFile(file, await file.text());
      } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        if (typeof XLSX === "undefined") throw new Error("xlsx-missing");
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
        tasks = parseExcelRows(rows);
      } else {
        throw new Error("unsupported-file");
      }

      if (!tasks.length) {
        showToast("未识别到可导入任务");
        return;
      }

      const stored = readStoredAppData();
      const existingTasks = Array.isArray(stored?.tasks) ? stored.tasks : [];
      const merged = mergeTasks(existingTasks, tasks);
      persistTasks(merged);
      showToast(`已导入 ${tasks.length} 条任务，请刷新页面查看`);
    } catch (error) {
      console.error(error);
      showToast("导入失败，请检查文件格式");
    }
  }

  function parseExcelRows(rows) {
    if (!Array.isArray(rows) || !rows.length) return [];
    const header = rows[0].map((cell) => normalizeText(cell));
    const body = rows.slice(1).filter((row) => row.some((cell) => normalizeText(cell)));

    const dateIndex = findHeaderIndex(header, ["录入日期", "日期", "date"]);
    const dueDateIndex = findHeaderIndex(header, ["计划完成日期", "dueDate", "截止日期"]);
    const completedDateIndex = findHeaderIndex(header, ["实际完成日期", "completedDate", "完成日期"]);
    const projectIndex = findHeaderIndex(header, ["项目", "project"]);
    const titleIndex = findHeaderIndex(header, ["任务事项", "标题", "title"]);
    const statusIndex = findHeaderIndex(header, ["完成情况", "状态", "status"]);
    const priorityIndex = findHeaderIndex(header, ["等级", "紧急程度", "priority"]);
    const categoryIndex = findHeaderIndex(header, ["分类", "category"]);
    const planIndex = findHeaderIndex(header, ["计划说明", "plan"]);
    const notesIndex = findHeaderIndex(header, ["备注", "notes"]);

    return body.map((row) => ({
      date: row[dateIndex] || todayStr(),
      dueDate: row[dueDateIndex] || row[dateIndex] || todayStr(),
      completedDate: row[completedDateIndex] || "",
      project: row[projectIndex] || "日常事务",
      title: row[titleIndex] || "未命名任务",
      status: normalizeImportStatus(row[statusIndex]),
      priority: normalizeImportPriority(row[priorityIndex]),
      category: row[categoryIndex] || "综合事务",
      plan: row[planIndex] || "",
      notes: row[notesIndex] || "",
      source: "import-any"
    }));
  }

  function findHeaderIndex(header, aliases) {
    return header.findIndex((cell) => aliases.some((alias) => String(cell).toLowerCase().includes(String(alias).toLowerCase())));
  }

  function normalizeImportStatus(value) {
    const text = normalizeText(value).toLowerCase();
    if (["done", "已完成", "完成"].includes(text)) return "done";
    if (["pending", "进行中"].includes(text)) return "pending";
    if (["planned", "待办", "计划"].includes(text)) return "planned";
    if (["delayed", "已逾期", "逾期"].includes(text)) return "delayed";
    if (["paused", "暂停", "任务暂停"].includes(text)) return "paused";
    if (["abandoned", "放弃", "放弃任务"].includes(text)) return "abandoned";
    return "done";
  }

  function normalizeImportPriority(value) {
    const text = normalizeText(value);
    if (["高", "高优先", "高优先级", "紧急"].includes(text)) return "高";
    if (["普通", "一般", "低"].includes(text)) return "普通";
    return "中";
  }

  function exportStoredJson() {
    const stored = readStoredAppData() || {};
    const payload = {
      exportedAt: new Date().toISOString(),
      focusDate: stored.focusDate || todayStr(),
      scope: stored.scope || "day",
      summaryMode: stored.summaryMode || "date",
      tasks: Array.isArray(stored.tasks) ? stored.tasks : []
    };
    downloadFile(`日报记录-${todayStr()}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function exportStoredExcel() {
    if (typeof XLSX === "undefined") {
      showToast("当前页面未加载 Excel 导出组件");
      return;
    }

    const stored = readStoredAppData() || {};
    const tasks = Array.isArray(stored.tasks) ? stored.tasks : [];
    const rows = tasks.map((task) => ({
      录入日期: task.date,
      计划完成日期: task.dueDate || "",
      实际完成日期: task.completedDate || "",
      项目: task.project,
      任务事项: task.title,
      完成情况: task.status,
      等级: task.priority,
      分类: task.category,
      计划说明: task.plan,
      备注: task.notes,
      来源: task.source
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "任务清单");
    XLSX.writeFile(workbook, `日报记录-${todayStr()}.xlsx`);
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

  function bindSettingsIntegration() {
    const skillText = document.getElementById("integration-skill-link");
    const mcpText = document.getElementById("integration-mcp-link");
    const copySkillBtn = document.getElementById("copy-skill-link-btn");
    const copyMcpBtn = document.getElementById("copy-mcp-link-btn");

    if (skillText) skillText.value = window.REPORT_SKILL_LINK || "";
    if (mcpText) mcpText.value = window.REPORT_MCP_LINK || "";

    copySkillBtn?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(skillText?.value || "");
        showToast("Skill 说明已复制");
      } catch {
        showToast("复制失败，请手动复制");
      }
    });

    copyMcpBtn?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(mcpText?.value || "");
        showToast("MCP 规范已复制");
      } catch {
        showToast("复制失败，请手动复制");
      }
    });
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
    const existingSize = existingTasks.length;
    if (merged.length !== existingSize || JSON.stringify(existingTasks) !== JSON.stringify(merged)) {
      persistTasks(merged);
    }
  }

  function hideLegacyImportExport() {
    [
      "export-excel-btn",
      "export-json-btn",
      "import-json-input",
      "import-excel-input"
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === "INPUT") {
        el.disabled = true;
      }
      const parentLabel = el.closest("label");
      if (parentLabel) parentLabel.classList.add("hidden");
      else el.classList.add("hidden");
    });
  }

  function init() {
    mergeLiveDataIntoStorage();
    hideLegacyImportExport();
    bindSettingsIntegration();
    bindUnifiedImportExport();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
