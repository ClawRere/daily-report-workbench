(() => {
  const PRIMARY_STORAGE_KEY = "daily-report-workbench-v8";
  const LEGACY_STORAGE_KEYS = [
    "daily-report-workbench-v7",
    "daily-report-workbench-v6",
    "daily-report-workbench-v5",
    "daily-report-workbench-v4",
    "daily-report-workbench"
  ];
  const SETTINGS_KEY = "daily-report-settings-v2";
  const MODEL_SETTINGS_KEY = "daily-report-model-settings-v1";
  const PROMPT_SETTINGS_KEY = "daily-report-prompt-settings-v1";
  const ACCESS_SETTINGS_KEY = "daily-report-access-settings-v1";
  const ENTRY_SETTINGS_KEY = "daily-report-entry-settings-v1";
  const PLANS_KEY = "daily-report-plans-v1";
  const UPGRADE_KEY = "daily-report-upgrade-v3";

  const STATUS_OPTIONS = [
    { value: "planned", label: "待办" },
    { value: "pending", label: "进行中" },
    { value: "done", label: "已完成" },
    { value: "delayed", label: "已逾期" },
    { value: "paused", label: "任务暂停" },
    { value: "abandoned", label: "放弃任务" }
  ];
  const PRIORITY_OPTIONS = ["高", "中", "普通"];
  const ENTRY_DEFAULTS = {
    defaultEntryTab: "batch",
    defaultTaskStatus: "done",
    defaultPlanScope: "month"
  };
  const DEFAULT_SETTINGS = {
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4.1-mini",
    temperature: 0.2,
    prompt: [
      "你是一个中文工作日报整理助手。",
      "请把用户输入整理为严格 JSON 数组，不要输出解释、Markdown 或代码块。",
      "任务对象包含字段：date, dueDate, completedDate, project, title, status, priority, category, plan, notes。",
      "计划对象包含字段：kind, date, scope, project, parentTitle, title, status, priority, result, notes。",
      "日期统一使用 YYYY-MM-DD。",
      "status 只能是：planned, pending, done, delayed, paused, abandoned。",
      "priority 只能是：高, 中, 普通。",
      "如无明确分类，任务 category 用综合事务；计划 kind 固定为 plan。"
    ].join("\n")
  };

  let bound = false;
  let scheduled = false;


  function dispatchRefresh() {
    window.dispatchEvent(new CustomEvent("daily-report-refresh"));
  }
  function init() {
    if (bound) return;
    bound = true;
    bindEvents();
    scheduleRefresh();
  }

  function bindEvents() {
    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);
    document.addEventListener("change", handleChange, true);
    document.addEventListener("input", handleInput, true);
    window.addEventListener("hashchange", scheduleRefresh);
    window.addEventListener("load", scheduleRefresh);
  }

  function handleClick(event) {
    const button = event.target.closest("button, .seg-btn");
    if (!button) return;

    const id = button.id || "";
    const upgrade = readUpgrade();

    if (button.closest("#summary-mode-seg") && button.dataset.mode === "plan") {
      event.preventDefault();
      event.stopImmediatePropagation();
      writeUpgrade({ summaryModeOverride: "plan" });
      scheduleRefresh();
      return;
    }

    if (button.closest("#summary-mode-seg") && button.dataset.mode && button.dataset.mode !== "plan") {
      writeUpgrade({ summaryModeOverride: "" });
      window.setTimeout(scheduleRefresh, 0);
    }

    if (button.closest("#entry-kind-seg") && button.dataset.kind) {
      event.preventDefault();
      event.stopImmediatePropagation();
      writeUpgrade({ entryKind: button.dataset.kind });
      scheduleRefresh();
      return;
    }

    if (button.closest("#entry-tab-seg") && button.dataset.tab) {
      event.preventDefault();
      event.stopImmediatePropagation();
      writeUpgrade({ entryTab: button.dataset.tab });
      scheduleRefresh();
      return;
    }

    if (button.closest("#plan-scope-seg") && button.dataset.planScope) {
      event.preventDefault();
      event.stopImmediatePropagation();
      writeUpgrade({ planScope: button.dataset.planScope });
      scheduleRefresh();
      return;
    }

    if (id === "open-entry-btn") {
      window.setTimeout(applyEntryDefaults, 0);
      return;
    }

    if (id === "reset-form-btn") {
      window.setTimeout(applyTaskDefaultsIfNeeded, 0);
      return;
    }

    if (id === "reset-plan-form-btn") {
      event.preventDefault();
      resetPlanForm();
      return;
    }

    if (id === "undo-submit-btn") {
      event.preventDefault();
      event.stopImmediatePropagation();
      undoLastSubmission();
      return;
    }

    if (id === "restore-day-done-btn") {
      event.preventDefault();
      event.stopImmediatePropagation();
      restoreDayDone();
      return;
    }

    if (id === "clear-day-done-btn") {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearDayDone();
      return;
    }

    if (id === "project-bulk-apply-btn") {
      event.preventDefault();
      event.stopImmediatePropagation();
      applyProjectBulkRename();
      return;
    }


    if (id === "restore-deleted-btn") {
      event.preventDefault();
      event.stopImmediatePropagation();
      restoreDeletedTasks();
      return;
    }

    if (id === "purge-deleted-btn") {
      event.preventDefault();
      event.stopImmediatePropagation();
      purgeDeletedTasks();
      return;
    }
    if (id === "project-bulk-clear-btn") {
      event.preventDefault();
      event.stopImmediatePropagation();
      writeUpgrade({ selectedProjectTaskIds: [] });
      scheduleRefresh();
      return;
    }

    if (id === "save-model-settings-btn") {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveModelSettings();
      return;
    }

    if (id === "save-prompt-settings-btn") {
      event.preventDefault();
      event.stopImmediatePropagation();
      savePromptSettings();
      return;
    }

    if (id === "save-access-settings-btn") {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveAccessSettings();
      return;
    }

    if (id === "save-entry-settings-btn") {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveEntrySettings();
      return;
    }

    if (effectiveSummaryMode() === "plan" && ["generate-summary-btn", "ai-summary-btn", "ppt-prompt-btn"].includes(id)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (id === "generate-summary-btn") {
        generatePlanSummaryText();
      } else if (id === "ai-summary-btn") {
        generatePlanAiSummary(button);
      } else {
        generatePlanPptPrompt();
      }
      return;
    }

    if (upgrade.entryKind === "plan" && ["quick-line-btn", "quick-save-btn", "quick-ai-btn", "batch-local-btn", "batch-ai-btn"].includes(id)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (id === "quick-line-btn") {
        parsePlanQuickToForm();
      } else if (id === "quick-save-btn") {
        savePlanQuick();
      } else if (id === "quick-ai-btn") {
        savePlanQuickWithAI(button);
      } else if (id === "batch-local-btn") {
        savePlanBatch();
      } else {
        savePlanBatchWithAI(button);
      }
      return;
    }

    if (upgrade.entryKind === "task" && ["quick-save-btn", "batch-local-btn", "batch-ai-btn"].includes(id)) {
      startSubmissionTracker("task");
    }
  }

  function handleSubmit(event) {
    const form = event.target;
    const upgrade = readUpgrade();

    if (form?.id === "plan-form") {
      event.preventDefault();
      event.stopImmediatePropagation();
      submitPlanForm();
      return;
    }

    if (form?.id === "task-form" && upgrade.entryKind === "task") {
      startSubmissionTracker("task");
    }
  }

  function handleChange(event) {
    const target = event.target;
    if (!target) return;

    if (target.matches(".task-check[data-task-id]")) {
      const upgrade = readUpgrade();
      const current = new Set(upgrade.selectedProjectTaskIds || []);
      if (target.checked) current.add(target.dataset.taskId);
      else current.delete(target.dataset.taskId);
      writeUpgrade({ selectedProjectTaskIds: [...current] });
      return;
    }

    if (target.id === "task-date") {
      window.setTimeout(applyTaskDefaultsIfNeeded, 0);
    }

    scheduleRefresh();
  }

  function handleInput(event) {
    if (event.target?.id === "settings-trusted-ips") return;
    scheduleRefresh();
  }

  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(() => {
      scheduled = false;
      refreshUi();
    }, 0);
  }

  function refreshUi() {
    injectPlanModeButton();
    fillPlanSelects();
    refreshEntryUi();
    refreshSettingsFields();
    patchTaskDateBlocks();
    renderCustomSummaryPanels();
  }

  function injectPlanModeButton() {
    const seg = document.getElementById("summary-mode-seg");
    if (!seg) return;

    let button = seg.querySelector('[data-mode="plan"]');
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "seg-btn";
      button.dataset.mode = "plan";
      button.textContent = "按计划";
      seg.appendChild(button);
    }

    const mode = effectiveSummaryMode();
    seg.querySelectorAll(".seg-btn").forEach((item) => {
      item.classList.toggle("active", item.dataset.mode === mode);
    });
  }

  function refreshEntryUi() {
    const upgrade = readUpgrade();
    const entryModal = document.getElementById("entry-modal");
    if (!entryModal) return;

    document.querySelectorAll("#entry-kind-seg .seg-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.kind === upgrade.entryKind);
    });
    document.querySelectorAll("#entry-tab-seg .seg-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === upgrade.entryTab);
    });
    document.querySelectorAll("#plan-scope-seg .seg-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.planScope === upgrade.planScope);
    });

    const planScopeRow = document.getElementById("plan-scope-row");
    if (planScopeRow) planScopeRow.classList.toggle("hidden", upgrade.entryKind !== "plan");

    document.querySelectorAll(".entry-panel").forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.entryTab !== upgrade.entryTab);
    });

    const taskForm = document.getElementById("task-form");
    const planForm = document.getElementById("plan-form");
    if (taskForm) taskForm.classList.toggle("hidden", !(upgrade.entryKind === "task" && upgrade.entryTab === "field"));
    if (planForm) planForm.classList.toggle("hidden", !(upgrade.entryKind === "plan" && upgrade.entryTab === "field"));

    const title = document.getElementById("entry-modal-title");
    const subtitle = document.getElementById("entry-modal-subtitle");
    if (title) {
      title.textContent = upgrade.entryKind === "plan" ? "新增计划" : isEditingTask() ? "编辑任务" : "新增记录";
    }
    if (subtitle) {
      subtitle.textContent = upgrade.entryKind === "plan"
        ? "支持一句话、按规则批量、字段方式录入计划 / OKR"
        : isEditingTask()
          ? "可修改日期、完成日期、状态、备注后保存"
          : "支持一句话、按规则批量、字段录入，也支持独立录入计划";
    }

    const quick = document.getElementById("quick-line-input");
    const batch = document.getElementById("batch-input");
    if (quick) {
      quick.placeholder = upgrade.entryKind === "plan"
        ? "示例：6月OKR | 问卷项目 | URL检测上线测试 | 待办 | 高"
        : "示例：今天 北辰家居 客户问题整理 已完成 高";
    }
    if (batch) {
      batch.placeholder = upgrade.entryKind === "plan"
        ? "计划示例：\n6月OKR\n问卷项目：\n1、URL检测上线测试；\n2、短信审核流程排期；\n工单：\n1、AI行动工单评审；"
        : "任务示例：\\n2026/6/4\\n1、北辰家居客户问题处理；\\n2、云帆数据月报更新；";
    }
  }

  function refreshSettingsFields() {
    const modal = document.getElementById("settings-modal");
    if (!modal || modal.classList.contains("hidden")) return;

    const settings = readCombinedSettings();
    const modelInput = document.getElementById("settings-model");
    const promptInput = document.getElementById("settings-prompt");
    const baseUrlInput = document.getElementById("settings-base-url");
    const apiKeyInput = document.getElementById("settings-api-key");
    const tempInput = document.getElementById("settings-temperature");
    const accessEnabled = document.getElementById("settings-access-enabled");
    const accessPassword = document.getElementById("settings-access-password");
    const trustedIps = document.getElementById("settings-trusted-ips");
    const defaultEntryTab = document.getElementById("settings-default-entry-tab");
    const defaultTaskStatus = document.getElementById("settings-default-task-status");
    const defaultPlanScope = document.getElementById("settings-default-plan-scope");

    if (baseUrlInput && !baseUrlInput.dataset.upgradeHydrated) {
      baseUrlInput.value = settings.baseUrl || DEFAULT_SETTINGS.baseUrl;
      baseUrlInput.dataset.upgradeHydrated = "1";
    }
    if (apiKeyInput && !apiKeyInput.dataset.upgradeHydrated) {
      apiKeyInput.value = settings.apiKey || "";
      apiKeyInput.dataset.upgradeHydrated = "1";
    }
    if (modelInput && !modelInput.dataset.upgradeHydrated) {
      modelInput.value = settings.model || DEFAULT_SETTINGS.model;
      modelInput.dataset.upgradeHydrated = "1";
    }
    if (tempInput && !tempInput.dataset.upgradeHydrated) {
      tempInput.value = settings.temperature ?? DEFAULT_SETTINGS.temperature;
      tempInput.dataset.upgradeHydrated = "1";
    }
    if (promptInput && !promptInput.dataset.upgradeHydrated) {
      promptInput.value = settings.prompt || DEFAULT_SETTINGS.prompt;
      promptInput.dataset.upgradeHydrated = "1";
    }
    if (accessEnabled && !accessEnabled.dataset.upgradeHydrated) {
      accessEnabled.checked = Boolean(settings.accessEnabled);
      accessEnabled.dataset.upgradeHydrated = "1";
    }
    if (accessPassword && !accessPassword.dataset.upgradeHydrated) {
      accessPassword.value = settings.accessPassword || "";
      accessPassword.dataset.upgradeHydrated = "1";
    }
    if (trustedIps && !trustedIps.dataset.upgradeHydrated) {
      trustedIps.value = (settings.trustedIps || []).join("\n");
      trustedIps.dataset.upgradeHydrated = "1";
    }
    if (defaultEntryTab && !defaultEntryTab.dataset.upgradeHydrated) {
      defaultEntryTab.value = settings.defaultEntryTab || ENTRY_DEFAULTS.defaultEntryTab;
      defaultEntryTab.dataset.upgradeHydrated = "1";
    }
    if (defaultTaskStatus && !defaultTaskStatus.dataset.upgradeHydrated) {
      defaultTaskStatus.value = settings.defaultTaskStatus || ENTRY_DEFAULTS.defaultTaskStatus;
      defaultTaskStatus.dataset.upgradeHydrated = "1";
    }
    if (defaultPlanScope && !defaultPlanScope.dataset.upgradeHydrated) {
      defaultPlanScope.value = settings.defaultPlanScope || ENTRY_DEFAULTS.defaultPlanScope;
      defaultPlanScope.dataset.upgradeHydrated = "1";
    }
  }

  function applyEntryDefaults() {
    const settings = readCombinedSettings();
    writeUpgrade({
      entryKind: "task",
      entryTab: settings.defaultEntryTab || ENTRY_DEFAULTS.defaultEntryTab,
      planScope: settings.defaultPlanScope || ENTRY_DEFAULTS.defaultPlanScope
    });
    applyTaskDefaultsIfNeeded();
    resetPlanForm();
    scheduleRefresh();
  }

  function applyTaskDefaultsIfNeeded() {
    if (isEditingTask()) return;
    const settings = readCombinedSettings();
    const taskDate = document.getElementById("task-date");
    const taskDueDate = document.getElementById("task-due-date");
    const taskCompletedDate = document.getElementById("task-completed-date");
    const taskStatus = document.getElementById("task-status");
    const focusDate = currentFocusDate();
    if (!taskDate) return;
    if (!taskDate.value) taskDate.value = focusDate;
    if (!taskDueDate.value) taskDueDate.value = taskDate.value || focusDate;
    if (taskStatus) taskStatus.value = settings.defaultTaskStatus || ENTRY_DEFAULTS.defaultTaskStatus;
    if (taskCompletedDate) {
      taskCompletedDate.value = taskStatus?.value === "done" ? (taskDate.value || focusDate) : "";
    }
  }

  function fillPlanSelects() {
    const planStatus = document.getElementById("plan-status");
    const planPriority = document.getElementById("plan-priority");
    if (planStatus && !planStatus.options.length) {
      planStatus.innerHTML = STATUS_OPTIONS.map((item) => `<option value="${item.value}">${item.label}</option>`).join("");
      planStatus.value = "planned";
    }
    if (planPriority && !planPriority.options.length) {
      planPriority.innerHTML = PRIORITY_OPTIONS.map((item) => `<option value="${item}">${item}</option>`).join("");
      planPriority.value = "中";
    }
  }

  function resetPlanForm() {
    fillPlanSelects();
    const planDate = document.getElementById("plan-date");
    const planProject = document.getElementById("plan-project");
    const planParent = document.getElementById("plan-parent-title");
    const planTitle = document.getElementById("plan-title");
    const planStatus = document.getElementById("plan-status");
    const planPriority = document.getElementById("plan-priority");
    const planResult = document.getElementById("plan-result");
    const planNotes = document.getElementById("plan-notes");
    if (planDate) planDate.value = currentFocusDate();
    if (planProject) planProject.value = "";
    if (planParent) planParent.value = "";
    if (planTitle) planTitle.value = "";
    if (planStatus) planStatus.value = "planned";
    if (planPriority) planPriority.value = "中";
    if (planResult) planResult.value = "";
    if (planNotes) planNotes.value = "";
  }

  function submitPlanForm() {
    const plan = collectPlanFormData();
    if (!plan) return;
    const plans = readPlans();
    writePlans([plan, ...plans]);
    rememberSubmission("plan", [plan.id]);
    showToast("计划已保存");
    closeEntryModal();
    resetPlanForm();
    scheduleRefresh();
  }

  function collectPlanFormData() {
    fillPlanSelects();
    const upgrade = readUpgrade();
    const planDate = normalizeDate(document.getElementById("plan-date")?.value || currentFocusDate());
    const project = normalizeText(document.getElementById("plan-project")?.value);
    const parentTitle = normalizeText(document.getElementById("plan-parent-title")?.value);
    const title = normalizeText(document.getElementById("plan-title")?.value);
    const status = normalizeStatus(document.getElementById("plan-status")?.value || "planned");
    const priority = normalizePriority(document.getElementById("plan-priority")?.value || "中");
    const result = normalizeText(document.getElementById("plan-result")?.value);
    const notes = normalizeText(document.getElementById("plan-notes")?.value);

    if (!project || !parentTitle || !title) {
      showToast("请完整填写计划集、父目标、子计划项");
      return null;
    }

    return {
      id: createId("plan"),
      kind: "plan",
      date: planDate,
      scope: upgrade.planScope || ENTRY_DEFAULTS.defaultPlanScope,
      project,
      parentTitle,
      title,
      status,
      priority,
      result,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: "plan-form"
    };
  }

  function parsePlanQuickToForm() {
    const text = normalizeText(document.getElementById("quick-line-input")?.value);
    if (!text) {
      showToast("请先输入一句话内容");
      return;
    }
    const plan = parsePlanQuick(text);
    fillPlanForm(plan);
    writeUpgrade({ entryTab: "field", entryKind: "plan" });
    scheduleRefresh();
    showToast("已解析到计划表单");
  }

  function savePlanQuick() {
    const text = normalizeText(document.getElementById("quick-line-input")?.value);
    if (!text) {
      showToast("请先输入一句话内容");
      return;
    }
    const plan = parsePlanQuick(text);
    writePlans([plan, ...readPlans()]);
    rememberSubmission("plan", [plan.id]);
    showToast("已写入 1 条计划");
    scheduleRefresh();
  }

  async function savePlanQuickWithAI(button) {
    const text = normalizeText(document.getElementById("quick-line-input")?.value);
    if (!text) {
      showToast("请先输入一句话内容");
      return;
    }
    await withBusy(button, "解析中...", async () => {
      const plans = await parsePlansWithAI(text, true);
      if (!plans.length) {
        showToast("AI 未返回可写入计划");
        return;
      }
      fillPlanForm(plans[0]);
      writeUpgrade({ entryTab: "field", entryKind: "plan" });
      scheduleRefresh();
      showToast("AI 解析完成");
    });
  }

  function savePlanBatch() {
    const text = normalizeText(document.getElementById("batch-input")?.value);
    if (!text) {
      showToast("请先粘贴批量内容");
      return;
    }
    const plans = parsePlanBatch(text);
    if (!plans.length) {
      showToast("没有识别到可写入计划");
      return;
    }
    writePlans([...plans, ...readPlans()]);
    rememberSubmission("plan", plans.map((item) => item.id));
    showToast(`已写入 ${plans.length} 条计划`);
    scheduleRefresh();
  }

  async function savePlanBatchWithAI(button) {
    const text = normalizeText(document.getElementById("batch-input")?.value);
    if (!text) {
      showToast("请先粘贴批量内容");
      return;
    }
    await withBusy(button, "写入中...", async () => {
      const plans = await parsePlansWithAI(text, false);
      if (!plans.length) {
        showToast("AI 未返回可写入计划");
        return;
      }
      writePlans([...plans, ...readPlans()]);
      rememberSubmission("plan", plans.map((item) => item.id));
      showToast(`AI 已写入 ${plans.length} 条计划`);
      scheduleRefresh();
    });
  }

  function parsePlanQuick(text) {
    const upgrade = readUpgrade();
    const parts = text.split("|").map((item) => normalizeText(item)).filter(Boolean);
    const plan = {
      id: createId("plan"),
      kind: "plan",
      date: currentFocusDate(),
      scope: upgrade.planScope || ENTRY_DEFAULTS.defaultPlanScope,
      project: parts[0] || `计划-${currentScopeLabel()}`,
      parentTitle: parts[1] || "默认目标",
      title: parts[2] || text,
      status: normalizeStatus(parts[3] || "planned"),
      priority: normalizePriority(parts[4] || "中"),
      result: parts[5] || "",
      notes: parts[6] || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: "plan-quick"
    };

    if (!parts.length) {
      const segments = text.split(/\s+/).filter(Boolean);
      plan.title = segments.join(" ");
    }

    return plan;
  }

  function parsePlanBatch(text) {
    const upgrade = readUpgrade();
    const lines = String(text || "").split(/\r?\n/).map((line) => normalizeText(line)).filter(Boolean);
    if (!lines.length) return [];

    let scope = upgrade.planScope || ENTRY_DEFAULTS.defaultPlanScope;
    let project = "";
    let parentTitle = "默认目标";
    let activeDate = currentFocusDate();
    const plans = [];

    lines.forEach((line, index) => {
      const pureDate = parseLooseDate(line.replace(/[：:]/g, ""));
      if (pureDate && /^20\d{2}[\/\-.年]\d{1,2}[\/\-.月]\d{1,2}日?$/.test(line.replace(/\s+/g, ""))) {
        activeDate = pureDate;
        return;
      }

      const scopeMatch = line.match(/^(按日|按月|按季度|按年|日计划|月计划|季度计划|年计划)$/);
      if (scopeMatch) {
        scope = scopeLabelToValue(scopeMatch[1]) || scope;
        return;
      }

      if (!project && !/[:：]$/.test(line) && index === 0) {
        project = cleanupText(line);
        return;
      }

      if (/[:：]$/.test(line)) {
        parentTitle = cleanupText(line.replace(/[:：]+$/, "")) || parentTitle;
        if (!project) project = `计划-${currentScopeLabel()}`;
        return;
      }

      const title = cleanupIndexedLine(line);
      if (!title) return;
      if (!project) project = `计划-${currentScopeLabel()}`;

      plans.push({
        id: createId("plan"),
        kind: "plan",
        date: activeDate,
        scope,
        project,
        parentTitle,
        title,
        status: "planned",
        priority: inferPriority(title),
        result: "",
        notes: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: "plan-batch"
      });
    });

    return plans;
  }

  async function parsePlansWithAI(text, single) {
    const settings = readCombinedSettings();
    if (!normalizeText(settings.apiKey)) throw new Error("missing-api-key");
    const systemPrompt = [
      "你是中文 OKR / 计划整理助手。",
      "请把输入整理为 JSON 数组。",
      "只返回数组，不要解释。",
      "每项包含字段：date, scope, project, parentTitle, title, status, priority, result, notes。",
      "kind 固定为 plan。",
      "scope 只能是 day, month, quarter, year。",
      "status 只能是 planned, pending, done, delayed, paused, abandoned。",
      "priority 只能是 高, 中, 普通。"
    ].join("\n");
    const content = await callModel(settings, systemPrompt, text);
    const parsed = parseJsonArray(content);
    return parsed.map((item) => normalizePlan({
      ...item,
      kind: "plan",
      source: single ? "plan-quick-ai" : "plan-batch-ai"
    }));
  }

  function fillPlanForm(plan) {
    fillPlanSelects();
    document.getElementById("plan-date").value = normalizeDate(plan.date || currentFocusDate());
    document.getElementById("plan-project").value = plan.project || "";
    document.getElementById("plan-parent-title").value = plan.parentTitle || "默认目标";
    document.getElementById("plan-title").value = plan.title || "";
    document.getElementById("plan-status").value = normalizeStatus(plan.status || "planned");
    document.getElementById("plan-priority").value = normalizePriority(plan.priority || "中");
    document.getElementById("plan-result").value = plan.result || "";
    document.getElementById("plan-notes").value = plan.notes || "";
    writeUpgrade({ planScope: plan.scope || readUpgrade().planScope || ENTRY_DEFAULTS.defaultPlanScope });
  }

  function renderCustomSummaryPanels() {
    if (!isSummaryView()) {
      hideElement(document.getElementById("project-manager"));
      hideElement(document.getElementById("plan-summary"));
      return;
    }

    const mode = effectiveSummaryMode();
    const projectRoot = document.getElementById("project-summary");
    const planRoot = document.getElementById("plan-summary");
    const timelineRoot = document.getElementById("timeline-root");
    const projectManager = document.getElementById("project-manager");

    if (mode === "plan") {
      hideElement(projectRoot);
      hideElement(timelineRoot);
      hideElement(projectManager);
      showElement(planRoot);
      renderPlanSummary();
      return;
    }

    hideElement(planRoot);

    if (mode === "project") {
      showElement(projectRoot);
      hideElement(timelineRoot);
      showElement(projectManager);
      renderProjectSummaryCustom();
      return;
    }

    hideElement(projectManager);
    hideElement(projectRoot);
    showElement(timelineRoot);
  }

  function renderProjectSummaryCustom() {
    const root = document.getElementById("project-summary");
    if (!root) return;
    const range = getScopeRange(currentScope(), currentFocusDate());
    const tasks = getFilteredSummaryTasks(range);

    if (!tasks.length) {
      root.innerHTML = '<div class="empty">当前筛选条件下没有项目记录</div>';
      return;
    }

    const selectedIds = new Set(readUpgrade().selectedProjectTaskIds || []);
    const groups = buildProjectGroups(tasks, range);
    root.innerHTML = groups.map((group) => {
      const rows = group.days.flatMap((day) => {
        const dayItems = day.items;
        return dayItems.map((item, index) => {
          const displayStatus = formatTaskStatus(item.task, getEntryDisplayStatus(item.task, item.date));
          const overdueDot = displayStatus === "逾期完成" || getEntryDisplayStatus(item.task, item.date) === "delayed"
            ? '<span class="overdue-dot" style="display:inline-block;margin-right:2px"></span>' : "";
          return `
            <div class="project-line upgrade-project-line">
              <label class="task-select-wrap">
                <input class="task-check" type="checkbox" data-task-id="${escapeHtml(item.task.id)}" ${selectedIds.has(item.task.id) ? "checked" : ""} />
              </label>
              <span class="project-line-date ${index === 0 ? "" : "blank"}">${index === 0 ? escapeHtml(formatExactDate(day.date)) : ""}</span>
              <span class="project-line-title">${overdueDot}${escapeHtml(item.task.title)}</span>
              <span class="project-line-status${displayStatus === "逾期完成" || getEntryDisplayStatus(item.task, item.date) === "delayed" ? " project-line-overdue" : ""}">${escapeHtml(displayStatus)}</span>
              <span class="project-line-priority">${escapeHtml(item.task.priority)}</span>
            </div>
          `;
        });
      }).join("");

      return `
        <article class="project-card">
          <div class="project-card-head">
            <label class="project-check-all">
              <input type="checkbox" class="project-check-all-input" data-project="${escapeHtml(group.project)}" ${group.days.flatMap(d => d.items).every(item => selectedIds.has(item.task.id)) ? "checked" : ""} />
              <span class="project-name">${escapeHtml(group.project)}</span>
            </label>
            <div class="project-stats">${renderTaskStatsChips(group.stats, true)}</div>
          </div>
          <div class="project-card-body project-card-body-compact">
            <div class="project-line-head upgrade-project-head">
              <span>选中</span>
              <span>日期</span>
              <span>事务</span>
              <span>完成情况</span>
              <span>紧急程度</span>
            </div>
            <div class="project-day-list project-day-list-compact">${rows}</div>
          </div>
        </article>
      `;
    }).join("");
  }
  function renderPlanSummary() {
    const root = document.getElementById("plan-summary");
    if (!root) return;
    const range = getScopeRange(currentScope(), currentFocusDate());
    const plans = getFilteredPlans(range);
    const statsEl = document.getElementById("summary-stats");

    if (!plans.length) {
      root.innerHTML = '<div class="empty">当前范围没有计划记录，可在"+"中录入计划/OKR</div>';
      if (statsEl) statsEl.innerHTML = renderPlanStatsChips(emptyPlanStats(), true);
      return;
    }

    const stats = summarizePlans(plans);
    const overdueNow = plans.filter(p => p.status !== "done" && p.status !== "paused" && p.status !== "abandoned" && p.date < todayStr()).length;
    if (statsEl) {
      const extra = overdueNow > 0 ? `<span class="stat-chip stat-chip-alert" style="color:var(--red);font-weight:700">当前逾期 ${overdueNow}</span>` : "";
      statsEl.innerHTML = extra + renderPlanStatsChips(stats, true);
    }

    const groups = groupPlans(plans);
    root.innerHTML = groups.map((group) => {
      const groupOverdue = group.items.filter(p => p.status !== "done" && p.status !== "paused" && p.status !== "abandoned" && p.date < todayStr()).length;
      const overdueBadge = groupOverdue > 0 ? `<span class="badge badge-overdue-tag">逾期${groupOverdue}</span>` : "";
      return `
      <section class="plan-group">
        <div class="plan-group-head">
          <div class="plan-group-title">${escapeHtml(group.project)} ${overdueBadge}</div>
          <div class="project-stats">${renderPlanStatsChips(group.stats, false)}</div>
        </div>
        <div class="plan-parent-list">
          ${group.parents.map((parent) => {
            const doneCount = parent.items.filter(i => i.status === "done").length;
            const totalItems = parent.items.length;
            const progressText = totalItems > 0 ? `${doneCount}/${totalItems}` : "";
            return `
            <div class="plan-parent">
              <div class="plan-parent-title">
                <span class="plan-parent-name">${escapeHtml(parent.parentTitle)}</span>
                ${progressText ? `<span class="plan-parent-progress">${progressText}</span>` : ""}
              </div>
              <div class="plan-item-list">
                ${parent.items.map((item) => {
                  const isOverdue = item.status !== "done" && item.status !== "paused" && item.status !== "abandoned" && item.date < todayStr();
                  const overdueClass = isOverdue ? " plan-item-overdue" : "";
                  const completedOverdue = item.status === "done" && item.date < todayStr();
                  return `
                  <div class="plan-item${overdueClass}">
                    <div class="plan-item-main">
                      <div class="plan-item-title">
                        ${isOverdue ? '<span class="overdue-dot"></span>' : ""}
                        ${completedOverdue ? '<span class="overdue-dot completed-overdue-dot"></span>' : ""}
                        ${escapeHtml(item.title)}
                      </div>
                      <div class="plan-item-meta">
                        ${badge(item.scopeLabel, "date")}
                        ${badge(formatMonthLikeDate(item.date), "date")}
                        ${statusBadge(item.status)}
                        ${priorityBadge(item.priority)}
                      </div>
                      ${item.result ? `<div class="plan-item-result">结果：${escapeHtml(item.result)}</div>` : ""}
                      ${item.notes ? `<div class="plan-item-note">${escapeHtml(item.notes)}</div>` : ""}
                    </div>
                  </div>
                `;}).join("")}
              </div>
            </div>
          `;}).join("")}
        </div>
      </section>
    `;}).join("");
  }

  function generatePlanSummaryText() {
    const range = getScopeRange(currentScope(), currentFocusDate());
    const plans = getFilteredPlans(range);
    if (!plans.length) {
      showToast("当前范围没有计划记录");
      return;
    }
    const stats = summarizePlans(plans);
    const output = document.getElementById("summary-output");
    if (!output) return;
    const topProjects = summarizePlanProjects(plans);
    output.value = [
      `${range.label}计划汇总：已完成 ${stats.done} 项，进行中 ${stats.pending} 项，待办 ${stats.planned} 项，逾期 ${stats.delayed} 项，涉及 ${stats.projects} 个计划集。`,
      topProjects ? `重点计划：${topProjects}` : "",
      "可继续用于月报、季报、年报或 OKR 复盘。"
    ].filter(Boolean).join("\n");
  }

  async function generatePlanAiSummary(button) {
    const range = getScopeRange(currentScope(), currentFocusDate());
    const plans = getFilteredPlans(range);
    if (!plans.length) {
      showToast("当前范围没有计划记录");
      return;
    }
    const settings = readCombinedSettings();
    if (!normalizeText(settings.apiKey)) {
      showToast("请先在设置中填写 API Key");
      return;
    }
    await withBusy(button, "生成中...", async () => {
      const stats = summarizePlans(plans);
      const prompt = [
        `汇报周期：${range.label}`,
        `统计：完成 ${stats.done}，进行中 ${stats.pending}，待办 ${stats.planned}，逾期 ${stats.delayed}，计划集 ${stats.projects}`,
        "请输出：一、本期概览；二、重点目标推进；三、关键结果；四、风险项；五、下阶段建议；六、PPT大纲。",
        "原始计划：",
        plans.map((item) => `- ${item.project} | ${item.parentTitle} | ${item.title} | ${formatTaskStatus(item, item.status)} | ${item.priority} | ${item.result || ""} | ${item.notes || ""}`).join("\n")
      ].join("\n");
      const content = await callModel(settings, "你是中文 OKR / 汇报助手。输出专业、简洁、真实的中文汇报内容。", prompt);
      const output = document.getElementById("summary-output");
      if (output) {
        output.value = ["【AI总结】", String(content || "").trim(), "", "【PPT提示词】", buildPlanPptPromptText(range, plans, stats)].join("\n");
      }
      showToast("AI 总结已生成");
    });
  }

  function generatePlanPptPrompt() {
    const range = getScopeRange(currentScope(), currentFocusDate());
    const plans = getFilteredPlans(range);
    if (!plans.length) {
      showToast("当前范围没有计划记录");
      return;
    }
    const stats = summarizePlans(plans);
    const output = document.getElementById("summary-output");
    if (!output) return;
    output.value = buildPlanPptPromptText(range, plans, stats);
    showToast("PPT 提示词已生成");
  }

  function buildPlanPptPromptText(range, plans, stats) {
    return [
      `请基于以下计划记录，生成《${range.label}${scopeToReportLabel(currentScope())}工作汇报》PPT大纲。`,
      "要求：",
      "1. 使用中文，适合管理层汇报。",
      "2. 页数控制在 6-10 页。",
      "3. 先给目录，再给每页标题与 2-4 条要点。",
      "4. 重点突出目标推进、已完成结果、风险与延期、下一步计划。",
      "5. 不要编造信息。",
      `统计信息：完成 ${stats.done}，进行中 ${stats.pending}，待办 ${stats.planned}，逾期 ${stats.delayed}，计划集 ${stats.projects}`,
      "计划记录：",
      plans.map((item) => `- ${item.project} | ${item.parentTitle} | ${item.title} | ${formatTaskStatus(item, item.status)} | ${item.priority} | ${item.result || ""} | ${item.notes || ""}`).join("\n")
    ].join("\n");
  }

  function patchTaskDateBlocks() {
    patchTodayTaskDates();
    patchTimelineTaskDates();
  }

  function patchTodayTaskDates() {
    const appState = readAppState();
    if (!appState) return;
    const displayDate = normalizeDate(appState.focusDate || todayStr());
    const compareDate = displayDate > todayStr() ? displayDate : todayStr();
    const buckets = getVisibleBucketsForDate(readTasks(), displayDate);
    const todoTasks = sortVisibleTasks(buckets.active, compareDate, displayDate);
    const doneTasks = sortDoneTasks(buckets.done);
    applyDatesToCards(document.getElementById("todo-list"), todoTasks);
    applyDatesToCards(document.getElementById("done-list"), doneTasks);
  }

  function patchTimelineTaskDates() {
    if (!isSummaryView() || effectiveSummaryMode() !== "date") return;
    const root = document.getElementById("timeline-root");
    if (!root) return;
    const range = getScopeRange(currentScope(), currentFocusDate());
    const tasks = getFilteredSummaryTasks(range);
    const entries = tasks.flatMap((task) => getTaskTimelineDates(task, range).map((date) => ({ task, date }))).sort(compareSummaryEntries);
    const cards = root.querySelectorAll(".task-card .task-dates");
    cards.forEach((node, index) => {
      const entry = entries[index];
      if (!entry) return;
      node.innerHTML = renderTaskDatesCompact(entry.task);
    });
  }

  function applyDatesToCards(container, tasks) {
    if (!container) return;
    const blocks = container.querySelectorAll(".task-card .task-dates");
    blocks.forEach((node, index) => {
      const task = tasks[index];
      if (!task) return;
      node.innerHTML = renderTaskDatesCompact(task);
    });
  }

  function renderTaskDatesCompact(task) {
    const date = normalizeDate(task.date);
    const dueDate = normalizeDate(task.dueDate || date);
    const completedDate = task.completedDate ? normalizeDate(task.completedDate) : "";
    if (completedDate && date === dueDate && date === completedDate) {
      return badge(`完成 ${completedDate}`, "completed");
    }
    const items = [badge(`录入 ${date}`, "date")];
    if (dueDate) items.push(badge(`计划 ${dueDate}`, "due"));
    if (completedDate) items.push(badge(`完成 ${completedDate}`, "completed"));
    return items.join("");
  }

  function undoLastSubmission() {
    const upgrade = readUpgrade();
    const last = upgrade.lastSubmission;
    if (!last?.ids?.length) {
      showToast("没有可撤回的新增记录");
      return;
    }

    if (last.kind === "plan") {
      writePlans(readPlans().filter((item) => !last.ids.includes(item.id)));
    } else {
      writeTasks(readTasks().filter((item) => !last.ids.includes(item.id)));
    }

    writeUpgrade({ lastSubmission: null });
    showToast("已撤回本次新增");
    dispatchRefresh();
  }

  function restoreDayDone() {
    const appState = readAppState();
    const scope = normalizeText(appState?.scope) || "day";
    const focusDate = normalizeDate(appState?.focusDate || todayStr());
    const range = getScopeRange(scope, focusDate);
    const settings = readCombinedSettings();
    const tasks = readTasks();
    let count = 0;
    const next = tasks.map((task) => {
      if (task.status !== "done") return task;
      const taskDate = normalizeDate(task.date || "");
      const completedDate = normalizeDate(task.completedDate || "");
      const relevantDate = completedDate || taskDate;
      let inRange = false;
      if (scope === "day") inRange = relevantDate === range.start;
      else if (scope === "month") inRange = relevantDate.slice(0, 7) === range.start.slice(0, 7);
      else if (scope === "quarter") inRange = getQuarterKey(relevantDate) === getQuarterKey(range.start);
      else inRange = relevantDate.slice(0, 4) === range.start.slice(0, 4);
      if (!inRange) return task;
      count += 1;
      return {
        ...task,
        status: "pending",
        completedDate: "",
        updatedAt: new Date().toISOString()
      };
    });
    if (!count) {
      showToast(`${range.label}没有可恢复的完成任务`);
      return;
    }
    writeTasks(next);
    showToast(`已恢复 ${range.label} ${count} 条任务为待办`);
    dispatchRefresh();
  }

  function clearDayDone() {
    const appState = readAppState();
    const scope = normalizeText(appState?.scope) || "day";
    const focusDate = normalizeDate(appState?.focusDate || todayStr());
    const range = getScopeRange(scope, focusDate);
    const tasks = readTasks();
    let count = 0;
    const next = tasks.map((task) => {
      if (task.status === "deleted") return task;
      const taskDate = normalizeDate(task.date || "");
      let inRange = false;
      if (scope === "day") inRange = taskDate === range.start;
      else if (scope === "month") inRange = taskDate.slice(0, 7) === range.start.slice(0, 7);
      else if (scope === "quarter") inRange = getQuarterKey(taskDate) === getQuarterKey(range.start);
      else inRange = taskDate.slice(0, 4) === range.start.slice(0, 4);
      if (!inRange) return task;
      count += 1;
      return { ...task, status: "deleted", originalStatus: task.status, updatedAt: new Date().toISOString() };
    });
    if (!count) {
      showToast(`${range.label}没有可删除的任务`);
      return;
    }
    writeTasks(next);
    showToast(`已删除 ${range.label} ${count} 条任务`);
    dispatchRefresh();
  }

  function restoreDeletedTasks() {
    const tasks = readTasks();
    let count = 0;
    const next = tasks.map((task) => {
      if (task.status !== "deleted") return task;
      count += 1;
      const restored = task.originalStatus || "pending";
      return { ...task, status: restored, originalStatus: undefined, restored: true, updatedAt: new Date().toISOString() };
    });
    if (!count) { showToast("没有已删除的任务可恢复"); return; }
    writeTasks(next);
    showToast(`已恢复 ${count} 条任务`);
    dispatchRefresh();
  }

  function purgeDeletedTasks() {
    const tasks = readTasks();
    const before = tasks.length;
    const next = tasks.filter((task) => task.status !== "deleted");
    const count = before - next.length;
    if (!count) { showToast("没有已删除的任务"); return; }
    writeTasks(next);
    showToast(`已永久清除 ${count} 条任务`);
    dispatchRefresh();
  }

  function batchRestoreDeleted() {
    const appState = readAppState();
    const scope = normalizeText(appState?.scope) || "day";
    const focusDate = normalizeDate(appState?.focusDate || todayStr());
    const range = getScopeRange(scope, focusDate);
    const tasks = readTasks();
    let count = 0;
    const next = tasks.map((task) => {
      if (task.status !== "deleted") return task;
      const taskDate = normalizeDate(task.date || "");
      let inRange = false;
      if (scope === "day") inRange = taskDate === range.start;
      else if (scope === "month") inRange = taskDate.slice(0, 7) === range.start.slice(0, 7);
      else if (scope === "quarter") inRange = getQuarterKey(taskDate) === getQuarterKey(range.start);
      else inRange = taskDate.slice(0, 4) === range.start.slice(0, 4);
      if (!inRange) return task;
      count += 1;
      const restored = task.originalStatus || "pending";
      return { ...task, status: restored, originalStatus: undefined, restored: true, updatedAt: new Date().toISOString() };
    });
    if (!count) { showToast("当前范围内没有已删除的任务"); return; }
    writeTasks(next);
    showToast(`已恢复 ${count} 条任务`);
    dispatchRefresh();
  }

  function applyProjectBulkRename() {
    const selectEl = document.getElementById("project-bulk-select");
    const inputEl = document.getElementById("project-bulk-input");
    const project = normalizeText(selectEl?.value) || normalizeText(inputEl?.value);
    const selectedIds = new Set(readUpgrade().selectedProjectTaskIds || []);
    if (!project) {
      showToast("请先选择或输入目标项目名称");
      return;
    }
    if (!selectedIds.size) {
      showToast("请先勾选要调整的任务");
      return;
    }
    const tasks = readTasks();
    let count = 0;
    const next = tasks.map((task) => {
      if (!selectedIds.has(task.id)) return task;
      count += 1;
      return { ...task, project, updatedAt: new Date().toISOString() };
    });
    writeTasks(next);
    writeUpgrade({ selectedProjectTaskIds: [] });
    showToast(`已更新 ${count} 条任务归属为「${project}」`);
    dispatchRefresh();
  }

  function savePromptSettings() {
    const patch = {
      prompt: normalizeText(document.getElementById("settings-prompt")?.value) || DEFAULT_SETTINGS.prompt
    };
    writeSplitSettings(PROMPT_SETTINGS_KEY, patch);
    writeCombinedSettings(patch);
    refreshIntegrationDocs();
    showToast("Prompt 已保存");
  }

  function saveAccessSettings() {
    const patch = {
      accessEnabled: Boolean(document.getElementById("settings-access-enabled")?.checked),
      accessPassword: normalizeText(document.getElementById("settings-access-password")?.value),
      trustedIps: parseTrustedIps(document.getElementById("settings-trusted-ips")?.value)
    };
    writeSplitSettings(ACCESS_SETTINGS_KEY, patch);
    writeCombinedSettings(patch);
    refreshIntegrationDocs();
    showToast("访问控制已保存");
  }

  function saveEntrySettings() {
    const patch = {
      defaultEntryTab: normalizeText(document.getElementById("settings-default-entry-tab")?.value) || ENTRY_DEFAULTS.defaultEntryTab,
      defaultTaskStatus: normalizeStatus(document.getElementById("settings-default-task-status")?.value || ENTRY_DEFAULTS.defaultTaskStatus),
      defaultPlanScope: normalizeText(document.getElementById("settings-default-plan-scope")?.value) || ENTRY_DEFAULTS.defaultPlanScope
    };
    writeSplitSettings(ENTRY_SETTINGS_KEY, patch);
    writeCombinedSettings(patch);
    writeUpgrade({ entryTab: patch.defaultEntryTab, planScope: patch.defaultPlanScope });
    showToast("录入偏好已保存");
  }

  function readCombinedSettings() {
    return {
      ...DEFAULT_SETTINGS,
      ...ENTRY_DEFAULTS,
      ...(readJson(SETTINGS_KEY) || {}),
      ...(readJson(MODEL_SETTINGS_KEY) || {}),
      ...(readJson(PROMPT_SETTINGS_KEY) || {}),
      ...(readJson(ACCESS_SETTINGS_KEY) || {}),
      ...(readJson(ENTRY_SETTINGS_KEY) || {})
    };
  }

  function writeCombinedSettings(patch) {
    const merged = { ...readCombinedSettings(), ...patch };
    writeJson(SETTINGS_KEY, merged);
    return merged;
  }

  function writeSplitSettings(key, patch) {
    writeJson(key, { ...(readJson(key) || {}), ...patch });
  }

  function fillProjectBulkSelect() {
    const selectEl = document.getElementById("project-bulk-select");
    const inputEl = document.getElementById("project-bulk-input");
    if (!selectEl) return;
    const tasks = readTasks();
    const projects = [...new Set(tasks.filter(t => t.status !== "deleted").map(t => t.project).filter(Boolean))].sort();
    selectEl.innerHTML = `<option value="">选择目标项目</option>` + projects.map(p => `<option value="${escapeHtml(p)}"${p === currentVal ? ` selected` : ""}>${escapeHtml(p)}</option>`).join("");
    if (inputEl) inputEl.disabled = Boolean(selectEl.value);
    if (!selectEl._bound) {
      selectEl._bound = true;
      selectEl.addEventListener("change", () => { if (inputEl) inputEl.disabled = Boolean(selectEl.value); });
    }
  }

  function renderTaskStatsChips(stats, includeProjects) {
    if (typeof window.renderStatsChips === "function") return window.renderStatsChips(stats, includeProjects);
    return "";
  }
  function refreshIntegrationDocs() {
    if (typeof window.__refreshIntegrationDocs === "function") {
      window.__refreshIntegrationDocs();
    }
  }

  function startSubmissionTracker(kind) {
    const beforeIds = new Set(kind === "plan" ? readPlans().map((item) => item.id) : readTasks().map((item) => item.id));
    trackSubmission(kind, beforeIds, 0);
  }

  function trackSubmission(kind, beforeIds, step) {
    window.setTimeout(() => {
      const list = kind === "plan" ? readPlans() : readTasks();
      const newIds = list.filter((item) => !beforeIds.has(item.id)).map((item) => item.id);
      if (newIds.length) {
        rememberSubmission(kind, newIds);
        return;
      }
      if (step < 15) {
        trackSubmission(kind, beforeIds, step + 1);
      }
    }, 240);
  }

  function rememberSubmission(kind, ids) {
    writeUpgrade({
      lastSubmission: {
        kind,
        ids,
        createdAt: new Date().toISOString()
      }
    });
  }

  function readUpgrade() {
    return {
      entryKind: "task",
      entryTab: readCombinedSettings().defaultEntryTab || ENTRY_DEFAULTS.defaultEntryTab,
      planScope: readCombinedSettings().defaultPlanScope || ENTRY_DEFAULTS.defaultPlanScope,
      summaryModeOverride: "",
      lastSubmission: null,
      selectedProjectTaskIds: [],
      ...(readJson(UPGRADE_KEY) || {})
    };
  }

  function writeUpgrade(patch) {
    writeJson(UPGRADE_KEY, { ...readUpgrade(), ...patch });
  }

  function readPlans() {
    return (readJson(PLANS_KEY) || []).map(normalizePlan);
  }

  function writePlans(plans) {
    writeJson(PLANS_KEY, plans.map(normalizePlan).sort((a, b) => comparePlanItems(a, b)));
  }

  function normalizePlan(plan) {
    const upgrade = readUpgrade();
    return {
      id: plan.id || createId("plan"),
      kind: "plan",
      date: normalizeDate(plan.date || currentFocusDate()),
      scope: normalizePlanScope(plan.scope || upgrade.planScope || ENTRY_DEFAULTS.defaultPlanScope),
      project: normalizeText(plan.project) || `计划-${currentScopeLabel()}`,
      parentTitle: normalizeText(plan.parentTitle) || "默认目标",
      title: normalizeText(plan.title) || "未命名计划",
      status: normalizeStatus(plan.status || "planned"),
      priority: normalizePriority(plan.priority || "中"),
      result: normalizeText(plan.result),
      notes: normalizeText(plan.notes),
      createdAt: plan.createdAt || new Date().toISOString(),
      updatedAt: plan.updatedAt || new Date().toISOString(),
      source: normalizeText(plan.source) || "plan"
    };
  }

  function comparePlanItems(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.project !== b.project) return a.project.localeCompare(b.project, "zh-CN");
    if (a.parentTitle !== b.parentTitle) return a.parentTitle.localeCompare(b.parentTitle, "zh-CN");
    return a.title.localeCompare(b.title, "zh-CN");
  }

  function getFilteredPlans(range) {
    const search = normalizeText(document.getElementById("search-input")?.value).toLowerCase();
    const projectValue = document.getElementById("project-filter")?.value || "all";
    const statusValue = document.getElementById("status-filter")?.value || "all";
    const priorityValue = document.getElementById("priority-filter")?.value || "all";

    return readPlans()
      .filter((item) => isPlanInRange(item, range))
      .filter((item) => (projectValue === "all" ? true : item.project === projectValue))
      .filter((item) => (statusValue === "all" ? true : item.status === statusValue))
      .filter((item) => (priorityValue === "all" ? true : item.priority === priorityValue))
      .filter((item) => {
        if (!search) return true;
        return [item.project, item.parentTitle, item.title, item.result, item.notes].join(" ").toLowerCase().includes(search);
      });
  }

  function isPlanInRange(plan, range) {
    const date = normalizeDate(plan.date);
    if (range.scope === "day") return date === range.start;
    if (range.scope === "month") return date.slice(0, 7) === range.start.slice(0, 7);
    if (range.scope === "quarter") {
      return getQuarterKey(date) === getQuarterKey(range.start);
    }
    return date.slice(0, 4) === range.start.slice(0, 4);
  }

  function summarizePlans(plans) {
    return plans.reduce((acc, item) => {
      acc.total += 1;
      if (item.status === "done") acc.done += 1;
      else if (item.status === "pending") acc.pending += 1;
      else if (item.status === "delayed") acc.delayed += 1;
      else acc.planned += 1;
      acc.projectsSet.add(item.project);
      return acc;
    }, {
      total: 0,
      done: 0,
      pending: 0,
      planned: 0,
      delayed: 0,
      projectsSet: new Set(),
      get projects() {
        return this.projectsSet.size;
      }
    });
  }

  function emptyPlanStats() {
    return {
      total: 0,
      done: 0,
      pending: 0,
      planned: 0,
      delayed: 0,
      projects: 0,
      projectsSet: new Set()
    };
  }

  function renderPlanStatsChips(stats, includeProjects) {
    const chips = [
      chip(`完成 ${stats.done || 0}`, "soft"),
      chip(`进行中 ${stats.pending || 0}`, "soft"),
      chip(`待办 ${stats.planned || 0}`, "soft"),
      chip(`逾期 ${stats.delayed || 0}`, "alert")
    ];
    if (includeProjects) {
      chips.push(chip(`计划集 ${stats.projects || 0}`, "soft"));
    }
    return chips.join("");
  }

  function summarizePlanProjects(plans) {
    const counts = new Map();
    plans.forEach((item) => counts.set(item.project, (counts.get(item.project) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([project, count]) => `${project}(${count})`).join("、");
  }

  function groupPlans(plans) {
    const map = new Map();
    plans.forEach((item) => {
      const projectGroup = map.get(item.project) || { project: item.project, items: [] };
      projectGroup.items.push(item);
      map.set(item.project, projectGroup);
    });

    return [...map.values()].map((group) => {
      const parentMap = new Map();
      group.items.forEach((item) => {
        const parent = parentMap.get(item.parentTitle) || { parentTitle: item.parentTitle, items: [] };
        parent.items.push({ ...item, scopeLabel: scopeLabel(item.scope) });
        parentMap.set(item.parentTitle, parent);
      });
      return {
        project: group.project,
        stats: summarizePlans(group.items),
        parents: [...parentMap.values()].map((parent) => ({
          ...parent,
          items: parent.items.sort(comparePlanItems)
        }))
      };
    }).sort((a, b) => a.project.localeCompare(b.project, "zh-CN"));
  }

  function getFilteredSummaryTasks(range) {
    const search = normalizeText(document.getElementById("search-input")?.value).toLowerCase();
    const projectValue = document.getElementById("project-filter")?.value || "all";
    const statusValue = document.getElementById("status-filter")?.value || "all";
    const priorityValue = document.getElementById("priority-filter")?.value || "all";
    const compareDate = getSummaryFilterCompareDate(range);

    return readTasks()
      .filter((task) => !shouldHideTaskInSummary(task))
      .filter((task) => getTaskTimelineDates(task, range).length > 0)
      .filter((task) => (projectValue === "all" ? true : task.project === projectValue))
      .filter((task) => (priorityValue === "all" ? true : task.priority === priorityValue))
      .filter((task) => (statusValue === "all" ? true : getDisplayStatus(task, compareDate) === statusValue))
      .filter((task) => {
        if (!search) return true;
        return [task.project, task.title, task.plan, task.notes, task.category].join(" ").toLowerCase().includes(search);
      })
      .sort((a, b) => compareSummaryTasks(a, b, range));
  }

  function buildProjectGroups(tasks, range) {
    const grouped = new Map();
    tasks.forEach((task) => {
      const item = grouped.get(task.project) || { project: task.project, tasks: [] };
      item.tasks.push(task);
      grouped.set(task.project, item);
    });

    return [...grouped.values()].map((group) => {
      const dayMap = new Map();
      group.tasks.flatMap((task) => getTaskTimelineDates(task, range).map((date) => ({ task, date }))).sort(compareSummaryEntries).forEach((entry) => {
        const day = dayMap.get(entry.date) || { date: entry.date, items: [] };
        day.items.push(entry);
        dayMap.set(entry.date, day);
      });
      return {
        project: group.project,
        stats: summarizeTasks(group.tasks, range),
        days: [...dayMap.values()].sort((a, b) => (a.date < b.date ? 1 : -1))
      };
    }).sort((a, b) => b.stats.currentOverdue - a.stats.currentOverdue || a.project.localeCompare(b.project, "zh-CN"));
  }

  function summarizeTasks(tasks, range) {
    const stats = {
      currentOverdue: 0,
      completed: 0,
      overdueDone: 0,
      createdOpen: 0,
      projects: new Set(tasks.map((task) => task.project)).size
    };

    tasks.forEach((task) => {
      if (task.status === "done") {
        const completedDate = getEffectiveCompletedDate(task);
        if (completedDate && isDateInRange(completedDate, range.start, range.end)) {
          if (isOverdueCompletionTask(task)) stats.overdueDone += 1;
          else stats.completed += 1;
        }
        return;
      }
      if (task.status === "paused" || task.status === "abandoned") return;
      if (task.date <= todayStr() && isDateInRange(task.date, range.start, range.end)) {
        if (isTaskCurrentlyOverdue(task)) stats.currentOverdue += 1;
        else stats.createdOpen += 1;
      }
    });

    return stats;
  }

  function renderTaskStatsChips(stats, includeProjects) {
    const chips = [
      chip(`当前逾期 ${stats.currentOverdue || 0}`, "alert"),
      chip(`完成 ${stats.completed || 0}`, "soft"),
      chip(`逾期完成 ${stats.overdueDone || 0}`, "soft"),
      chip(`新增 ${stats.createdOpen || 0}`, "soft")
    ];
    if (includeProjects) chips.push(chip(`项目 ${stats.projects || 0}`, "soft"));
    return chips.join("");
  }

  function readAppState() {
    for (const key of [PRIMARY_STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
      const value = readJson(key);
      if (value?.tasks?.length || value?.focusDate) return value;
    }
    return null;
  }

  function writeTasks(tasks) {
    const appState = readAppState() || {};
    writeJson(PRIMARY_STORAGE_KEY, {
      ...appState,
      tasks: tasks.map(normalizeTask)
    });
  }

  function readTasks() {
    const appState = readAppState() || {};
    const tasks = Array.isArray(appState.tasks) ? appState.tasks : [];
    return tasks.map(normalizeTask);
  }

  function normalizeTask(task) {
    const date = normalizeDate(task.date || todayStr());
    const dueDate = normalizeDate(task.dueDate || date);
    const status = normalizeStatus(task.status || (date > todayStr() ? "planned" : "done"));
    return {
      ...task,
      id: task.id || createId("task"),
      date,
      dueDate,
      completedDate: task.completedDate ? normalizeDate(task.completedDate) : "",
      project: normalizeText(task.project) || "日常事务",
      title: normalizeText(task.title) || "未命名任务",
      status,
      priority: normalizePriority(task.priority || "中"),
      category: normalizeText(task.category) || "综合事务",
      plan: normalizeText(task.plan),
      notes: normalizeText(task.notes),
      updatedAt: task.updatedAt || new Date().toISOString()
    };
  }

  function getVisibleBucketsForDate(tasks, dateKey) {
    const active = [];
    const done = [];
    tasks.forEach((task) => {
      const phase = taskStateOnDate(task, dateKey);
      if (phase === "active") active.push(task);
      if (phase === "done") done.push(task);
    });
    return { active, done };
  }

  function taskStateOnDate(task, dateKey) {
    const day = normalizeDate(dateKey);
    const completedDate = getEffectiveCompletedDate(task);
    if (task.status === "done") return completedDate === day ? "done" : "none";
    if (task.status === "paused" || task.status === "abandoned") return "none";
    if (day > todayStr()) return task.date === day ? "active" : "none";
    if (day === todayStr()) return task.date <= day ? "active" : "none";
    return task.date === day ? "active" : "none";
  }

  function getTaskTimelineDates(task, range) {
    const dates = new Set();
    const completedDate = getEffectiveCompletedDate(task);
    if (task.status === "done") {
      if (completedDate && isDateInRange(completedDate, range.start, range.end)) dates.add(completedDate);
      return [...dates].sort();
    }
    if (task.status === "paused" || task.status === "abandoned") {
      if (isDateInRange(task.date, range.start, range.end)) dates.add(task.date);
      return [...dates].sort();
    }
    if (isDateInRange(task.date, range.start, range.end)) dates.add(task.date);
    if (task.date < todayStr() && isDateInRange(todayStr(), range.start, range.end)) dates.add(todayStr());
    return [...dates].sort();
  }

  function sortVisibleTasks(tasks, compareDate, displayDate) {
    return [...tasks].sort((a, b) => {
      const toneDiff = toneRank(getTaskTone(a, compareDate, displayDate)) - toneRank(getTaskTone(b, compareDate, displayDate));
      if (toneDiff !== 0) return toneDiff;
      const aDue = getEffectiveDueDate(a);
      const bDue = getEffectiveDueDate(b);
      if (aDue !== bDue) return aDue.localeCompare(bDue, "zh-CN");
      return priorityRank(a.priority) - priorityRank(b.priority);
    });
  }

  function sortDoneTasks(tasks) {
    return [...tasks].sort((a, b) => {
      const aDate = getEffectiveCompletedDate(a) || a.date;
      const bDate = getEffectiveCompletedDate(b) || b.date;
      if (aDate !== bDate) return aDate < bDate ? 1 : -1;
      return priorityRank(a.priority) - priorityRank(b.priority);
    });
  }

  function compareSummaryEntries(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const aTone = toneRank(getTaskTone(a.task, getEntryCompareDate(a.task, a.date), a.date));
    const bTone = toneRank(getTaskTone(b.task, getEntryCompareDate(b.task, b.date), b.date));
    if (aTone !== bTone) return aTone - bTone;
    return priorityRank(a.task.priority) - priorityRank(b.task.priority);
  }

  function compareSummaryTasks(a, b, range) {
    const aDate = getTaskSortAnchor(a, range);
    const bDate = getTaskSortAnchor(b, range);
    if (aDate !== bDate) return aDate < bDate ? 1 : -1;
    const toneDiff = toneRank(getTaskTone(a, getSummaryFilterCompareDate(range), aDate)) - toneRank(getTaskTone(b, getSummaryFilterCompareDate(range), bDate));
    if (toneDiff !== 0) return toneDiff;
    return priorityRank(a.priority) - priorityRank(b.priority);
  }

  function getTaskSortAnchor(task, range) {
    const completedDate = getEffectiveCompletedDate(task);
    if (completedDate && isDateInRange(completedDate, range.start, range.end)) return completedDate;
    if (isDateInRange(todayStr(), range.start, range.end) && !isTerminalStatus(task.status) && task.date < todayStr()) return todayStr();
    return task.date;
  }

  function getEntryDisplayStatus(task, entryDate) {
    return getDisplayStatus(task, getEntryCompareDate(task, entryDate));
  }

  function getEntryCompareDate(task, entryDate) {
    if (task.status === "done") return getEffectiveCompletedDate(task) || entryDate;
    if (entryDate > todayStr()) return entryDate;
    return todayStr();
  }

  function getDisplayStatus(task, compareDate) {
    if (task.status === "done") return "done";
    if (task.status === "paused") return "paused";
    if (task.status === "abandoned") return "abandoned";
    if (task.date > compareDate) return "planned";
    if (getEffectiveDueDate(task) < compareDate) return "delayed";
    if (task.status === "planned") return "planned";
    return "pending";
  }

  function getTaskTone(task, compareDate, displayDate) {
    if (task.status === "done") return "complete";
    if (task.status === "paused" || task.status === "abandoned") return "neutral";
    if (displayDate < todayStr()) return "overdue";
    if (getDisplayStatus(task, compareDate) === "delayed") return "overdue";
    return "active";
  }

  function isTaskCurrentlyOverdue(task) {
    return !isTerminalStatus(task.status) && task.date <= todayStr() && getEffectiveDueDate(task) < todayStr();
  }

  function isOverdueCompletionTask(task) {
    return task.status === "done" && !!getEffectiveCompletedDate(task) && getEffectiveCompletedDate(task) > getEffectiveDueDate(task);
  }

  function getEffectiveDueDate(task) {
    return normalizeDate(task.dueDate || task.date);
  }

  function getEffectiveCompletedDate(task) {
    if (task.status !== "done") return "";
    return task.completedDate ? normalizeDate(task.completedDate) : normalizeDate(task.date);
  }

  function shouldHideTaskInSummary(task) {
    const text = [task.project, task.title, task.category, task.notes, task.plan].join(" ");
    return task.category === "休假" || /请假|休假/.test(text);
  }

  function getScopeRange(scope, dateKey) {
    const focus = parseDate(dateKey || todayStr());
    if (scope === "month") {
      const start = new Date(focus.getFullYear(), focus.getMonth(), 1);
      const end = new Date(focus.getFullYear(), focus.getMonth() + 1, 0);
      return { scope, start: formatDate(start), end: formatDate(end), label: `${focus.getFullYear()}年${focus.getMonth() + 1}月` };
    }
    if (scope === "quarter") {
      const startMonth = Math.floor(focus.getMonth() / 3) * 3;
      const start = new Date(focus.getFullYear(), startMonth, 1);
      const end = new Date(focus.getFullYear(), startMonth + 3, 0);
      return { scope, start: formatDate(start), end: formatDate(end), label: `${focus.getFullYear()}年第${Math.floor(focus.getMonth() / 3) + 1}季度` };
    }
    if (scope === "year") {
      const start = new Date(focus.getFullYear(), 0, 1);
      const end = new Date(focus.getFullYear(), 11, 31);
      return { scope, start: formatDate(start), end: formatDate(end), label: `${focus.getFullYear()}年` };
    }
    const normalized = normalizeDate(dateKey || todayStr());
    return { scope: "day", start: normalized, end: normalized, label: formatExactDate(normalized) };
  }

  function getSummaryFilterCompareDate(range) {
    return range.end > todayStr() ? todayStr() : range.end;
  }

  function effectiveSummaryMode() {
    const upgrade = readUpgrade();
    return upgrade.summaryModeOverride || currentActualSummaryMode();
  }

  function currentActualSummaryMode() {
    return normalizeText(readAppState()?.summaryMode) || "date";
  }

  function currentFocusDate() {
    return normalizeDate(readAppState()?.focusDate || todayStr());
  }

  function currentScope() {
    return normalizeText(readAppState()?.scope) || "day";
  }

  function currentScopeLabel() {
    return scopeLabel(currentScope());
  }

  function isSummaryView() {
    return location.hash === "#summary";
  }

  function isEditingTask() {
    return /编辑任务/.test(normalizeText(document.getElementById("entry-modal-title")?.textContent));
  }

  function closeEntryModal() {
    document.getElementById("entry-modal")?.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  async function withBusy(button, text, task) {
    if (!button) return task();
    const original = button.textContent;
    button.disabled = true;
    button.textContent = text;
    try {
      return await task();
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  async function callModel(settings, systemPrompt, userPrompt) {
    const response = await fetch(joinBaseUrl(settings.baseUrl || DEFAULT_SETTINGS.baseUrl, "/chat/completions"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model || DEFAULT_SETTINGS.model,
        temperature: settings.temperature ?? DEFAULT_SETTINGS.temperature,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });
    if (!response.ok) throw new Error(`request-failed-${response.status}`);
    const json = await response.json();
    return json?.choices?.[0]?.message?.content || "[]";
  }

  function parseJsonArray(text) {
    const raw = String(text || "").trim().replace(/^`json\s*/i, "").replace(/^`\s*/i, "").replace(/`$/i, "").trim();
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    const jsonText = start >= 0 && end >= start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed) ? parsed : [];
  }

  function showToast(message) {
    if (typeof window.showToast === "function") {
      window.showToast(message);
      return;
    }
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 2200);
  }

  function renderTaskDatesCompactText(task) {
    return renderTaskDatesCompact(task);
  }

  function badge(text, kind) {
    return `<span class="badge badge-${kind}">${escapeHtml(text)}</span>`;
  }

  function chip(text, kind = "") {
    return `<span class="stat-chip ${kind ? `stat-chip-${kind}` : ""}">${escapeHtml(text)}</span>`;
  }

  function statusBadge(status) {
    return `<span class="badge badge-status-${status}">${escapeHtml(statusLabel(status))}</span>`;
  }

  function priorityBadge(priority) {
    const map = { 高: "high", 中: "mid", 普通: "normal" };
    return `<span class="badge badge-priority-${map[priority] || "mid"}">${escapeHtml(priority)}</span>`;
  }

  function renderTaskDatesCompactBadge(task) {
    return renderTaskDatesCompactText(task);
  }

  function formatTaskStatus(task, status) {
    if ((task.status === "done" || status === "done") && isOverdueCompletionTask(task)) return "逾期完成";
    return statusLabel(status);
  }

  function statusLabel(status) {
    return STATUS_OPTIONS.find((item) => item.value === status)?.label || "已完成";
  }

  function toneRank(tone) {
    if (tone === "overdue") return 0;
    if (tone === "active") return 1;
    if (tone === "complete") return 2;
    return 3;
  }

  function priorityRank(priority) {
    if (priority === "高") return 0;
    if (priority === "中") return 1;
    return 2;
  }

  function isTerminalStatus(status) {
    return status === "done" || status === "paused" || status === "abandoned";
  }

  function normalizeStatus(status) {
    const value = normalizeText(status);
    const map = {
      done: "done",
      已完成: "done",
      完成: "done",
      pending: "pending",
      进行中: "pending",
      planned: "planned",
      待办: "planned",
      计划: "planned",
      delayed: "delayed",
      已逾期: "delayed",
      逾期: "delayed",
      paused: "paused",
      暂停: "paused",
      abandoned: "abandoned",
      放弃: "abandoned"
    };
    return map[value] || "done";
  }

  function normalizePriority(priority) {
    const value = normalizeText(priority);
    if (["高", "高优先", "紧急", "重要"].includes(value)) return "高";
    if (["普通", "一般", "低"].includes(value)) return "普通";
    return "中";
  }

  function normalizePlanScope(scope) {
    return ["day", "month", "quarter", "year"].includes(scope) ? scope : "month";
  }

  function scopeLabel(scope) {
    if (scope === "day") return "按日";
    if (scope === "quarter") return "按季度";
    if (scope === "year") return "按年";
    return "按月";
  }

  function scopeLabelToValue(text) {
    if (/按日|日计划/.test(text)) return "day";
    if (/按季度|季度计划/.test(text)) return "quarter";
    if (/按年|年计划/.test(text)) return "year";
    return "month";
  }

  function scopeToReportLabel(scope) {
    if (scope === "month") return "月度";
    if (scope === "quarter") return "季度";
    if (scope === "year") return "年度";
    return "当日";
  }

  function parseTrustedIps(value) {
    if (Array.isArray(value)) return value.map((item) => normalizeText(item)).filter(Boolean);
    return String(value || "").split(/[;；\n\r]+/).map((item) => normalizeText(item)).filter(Boolean);
  }

  function parseDate(value) {
    const [year, month, day] = normalizeDate(value).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function normalizeDate(value) {
    if (!value) return todayStr();
    const text = normalizeText(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const loose = parseLooseDate(text);
    if (loose) return loose;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? todayStr() : formatDate(date);
  }

  function parseLooseDate(text) {
    const match = String(text || "").match(/(20\d{2})\s*[\/\-.年]\s*(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})/);
    if (!match) return "";
    return `${match[1]}-${pad(match[2])}-${pad(match[3])}`;
  }

  function formatDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function formatExactDate(dateKey) {
    const date = parseDate(dateKey);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function formatMonthLikeDate(dateKey) {
    const date = parseDate(dateKey);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function getQuarterKey(dateKey) {
    const date = parseDate(dateKey);
    return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
  }

  function todayStr() {
    return formatDate(new Date());
  }

  function isDateInRange(date, start, end) {
    return date >= start && date <= end;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function clampNumber(value, min, max, fallback) {
    if (Number.isNaN(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }

  function cleanupIndexedLine(text) {
    return cleanupText(String(text || "").replace(/^[（(【\[]?\d+[）)】\].、\s]*/, "").replace(/^[一二三四五六七八九十]+[、.\s]*/, ""));
  }

  function cleanupText(text) {
    return normalizeText(text).replace(/[；;。]+$/g, "").replace(/\s+/g, " ").trim();
  }

  function inferPriority(text) {
    const value = normalizeText(text);
    if (/(紧急|异常|故障|上线|评审|现场|出差)/.test(value)) return "高";
    if (/(需求|PRD|更新|优化|采集|核对|方案|沟通|审查)/i.test(value)) return "中";
    return "普通";
  }

  function joinBaseUrl(baseUrl, path) {
    return `${String(baseUrl || "").replace(/\/+$/, "")}${path}`;
  }

  function hideElement(el) {
    if (el) el.classList.add("hidden");
  }

  function showElement(el) {
    if (el) el.classList.remove("hidden");
  }

  function createId(prefix) {
    if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function writeJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function readJson(key) {
    try {
      const value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  function normalizeText(value) {
    return String(value || "").replace(/[\u3000]/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  init();
})();

