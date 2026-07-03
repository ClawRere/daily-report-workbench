const PRIMARY_STORAGE_KEY = "daily-report-workbench-v8";
const LEGACY_STORAGE_KEYS = [
  "daily-report-workbench-v7",
  "daily-report-workbench-v6",
  "daily-report-workbench-v5",
  "daily-report-workbench-v4",
  "daily-report-workbench"
];
const SETTINGS_KEY = "daily-report-settings-v2";

const CATEGORY_OPTIONS = [
  "需求沟通",
  "产品设计",
  "数据处理",
  "测试上线",
  "会议出差",
  "招聘培训",
  "行政协同",
  "AI探索",
  "综合事务",
  "休假"
];

const PRIORITY_OPTIONS = ["高", "中", "普通"];

const STATUS_OPTIONS = [
  { value: "planned", label: "待办" },
  { value: "pending", label: "进行中" },
  { value: "done", label: "已完成" },
  { value: "delayed", label: "已逾期" },
  { value: "paused", label: "任务暂停" },
  { value: "abandoned", label: "放弃任务" }
];

const SCOPE_OPTIONS = [
  { value: "day", label: "按日" },
  { value: "month", label: "按月" },
  { value: "quarter", label: "按季度" },
  { value: "year", label: "按年" }
];

const SUMMARY_MODE_OPTIONS = [
  { value: "date", label: "按日期" },
  { value: "project", label: "按项目" },
  { value: "plan", label: "按计划" }
];

const DEFAULT_SETTINGS = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4.1-mini",
  temperature: 0.2,
  prompt: [
    "你是一个中文工作日报整理助手。",
    "请把用户输入整理为严格 JSON 数组，不要输出解释、Markdown 或代码块。",
    "每个对象包含字段：date, dueDate, completedDate, project, title, status, priority, category, plan, notes。",
    "date、dueDate、completedDate 统一使用 YYYY-MM-DD；未知时可留空字符串。",
    "status 只能是：planned, pending, done, delayed, paused, abandoned。",
    "priority 只能是：高, 中, 普通。",
    "category 优先使用：需求沟通, 产品设计, 数据处理, 测试上线, 会议出差, 招聘培训, 行政协同, AI探索, 综合事务, 休假。",
    "如果明确是历史已完成工作，status 用 done，completedDate 优先等于 date。",
    "如果未明确项目，project 用日常事务；未明确等级，priority 用中；未明确分类，category 用综合事务。"
  ].join("\n")
};

const state = {
  tasks: [],
  settings: { ...DEFAULT_SETTINGS },
  activeView: location.hash === "#summary" ? "summary" : "today",
  focusDate: todayStr(),
  scope: "day",
  summaryMode: "date",
  calendarCollapsed: true,
  editingTaskId: null,
  filters: {
    search: "",
    project: "all",
    status: "all",
    priority: "all"
  }
};

const els = {};
let toastTimer = null;

init();

function init() {
  cacheElements();
  hydrate();
  setupStaticOptions();
  bindEvents();
  render();
}

function cacheElements() {
  [
    "view-nav",
    "today-view",
    "summary-view",
    "open-settings-btn",
    "export-excel-btn",
    "export-json-btn",
    "import-json-input",
    "import-excel-input",
    "calendar-card",
    "calendar-title",
    "calendar-prev-btn",
    "calendar-prev-month-btn",
    "calendar-next-btn",
    "calendar-next-month-btn",
    "calendar-today-btn",
    "calendar-toggle-btn",
    "calendar-grid",
    "today-title",
    "today-stats",
    "todo-list",
    "done-list",
    "scope-seg",
    "summary-mode-seg",
    "search-input",
    "project-filter",
    "status-filter",
    "priority-filter",
    "generate-summary-btn",
    "ai-summary-btn",
    "summary-output",
    "ppt-prompt-btn",
    "summary-stats",
    "project-summary",
    "timeline-root",
    "open-entry-btn",
    "entry-modal",
    "close-entry-btn",
    "entry-modal-title",
    "entry-modal-subtitle",
    "quick-line-input",
    "quick-line-btn",
    "quick-save-btn",
    "quick-ai-btn",
    "batch-input",
    "batch-local-btn",
    "batch-ai-btn",
    "task-form",
    "task-date",
    "task-due-date",
    "task-completed-date",
    "task-project",
    "task-title",
    "task-status",
    "task-priority",
    "task-category",
    "task-plan",
    "task-notes",
    "reset-form-btn",
    "submit-task-btn",
    "project-suggestions",
    "settings-modal",
    "close-settings-btn",
    "settings-base-url",
    "settings-api-key",
    "settings-model",
    "settings-temperature",
    "settings-prompt",
    "copy-prompt-btn",
    "test-model-btn",
    "save-settings-btn",
    "toast"
  ].forEach((id) => {
    els[camelize(id)] = document.getElementById(id);
  });
}

function hydrate() {
  const stored = readStoredAppData();
  const seed = Array.isArray(window.SEED_DATA) ? window.SEED_DATA : [];
  const sourceTasks = stored?.tasks?.length ? stored.tasks : seed;

  state.tasks = sortTasks(sourceTasks.map(normalizeTask));

  if (stored?.scope && SCOPE_OPTIONS.some((item) => item.value === stored.scope)) {
    state.scope = stored.scope;
  }

  state.focusDate = normalizeFocusDateByScope(state.scope, stored?.focusDate || state.focusDate);

  if (stored?.summaryMode && SUMMARY_MODE_OPTIONS.some((item) => item.value === stored.summaryMode)) {
    state.summaryMode = stored.summaryMode;
  }

  if (typeof stored?.calendarCollapsed === "boolean") {
    state.calendarCollapsed = stored.calendarCollapsed;
  }

  state.settings = {
    ...DEFAULT_SETTINGS,
    ...(readJson(SETTINGS_KEY) || {})
  };
}

function setupStaticOptions() {
  fillSelect(els.taskStatus, STATUS_OPTIONS, defaultStatusValueByDate(state.focusDate));
  fillSelect(els.taskPriority, PRIORITY_OPTIONS, "中");
  fillSelect(els.taskCategory, CATEGORY_OPTIONS, "综合事务");
  renderProjectSuggestions();
  fillSettingsForm();
  resetForm();
}


  window.addEventListener("daily-report-refresh", () => { state.tasks = sortTasks((readStoredAppData()?.tasks || []).map(normalizeTask)); render(); });
function bindEvents() {
  els.viewNav.addEventListener("click", handleViewSwitch);
  els.calendarPrevBtn.addEventListener("click", () => shiftCalendar(-1));
  els.calendarNextBtn.addEventListener("click", () => shiftCalendar(1));
  els.calendarPrevMonthBtn.addEventListener("click", () => shiftCalendarMonth(-1));
  els.calendarNextMonthBtn.addEventListener("click", () => shiftCalendarMonth(1));
  els.calendarTodayBtn.addEventListener("click", jumpCalendarToCurrent);
  els.calendarToggleBtn.addEventListener("click", toggleCalendarCollapse);

  els.openEntryBtn.addEventListener("click", () => openEntryModal());
  els.closeEntryBtn.addEventListener("click", closeEntryModal);
  els.entryModal.addEventListener("click", (event) => {
    if (event.target === els.entryModal) closeEntryModal();
  });

  els.openSettingsBtn.addEventListener("click", openSettingsModal);
  els.closeSettingsBtn.addEventListener("click", closeSettingsModal);
  els.settingsModal.addEventListener("click", (event) => {
    if (event.target === els.settingsModal) closeSettingsModal();
  });

  els.quickLineBtn.addEventListener("click", handleQuickParseToForm);
  els.quickSaveBtn.addEventListener("click", handleQuickDirectSave);
  els.quickAiBtn.addEventListener("click", handleQuickAiParse);
  els.batchLocalBtn.addEventListener("click", handleBatchLocalWrite);
  els.batchAiBtn.addEventListener("click", handleBatchAiWrite);

  els.taskForm.addEventListener("submit", submitTaskForm);
  els.resetFormBtn.addEventListener("click", resetForm);
  els.taskStatus.addEventListener("change", syncTaskDateFields);
  els.taskDate.addEventListener("change", syncTaskDateFields);

  els.todoList.addEventListener("click", handleTaskActionClick);
  els.doneList.addEventListener("click", handleTaskActionClick);
  els.timelineRoot.addEventListener("click", handleTaskActionClick);

  els.scopeSeg.addEventListener("click", (event) => {
    const button = event.target.closest(".seg-btn");
    if (!button) return;
    if (button.dataset.scope === state.scope) return;
    state.scope = button.dataset.scope;
    state.focusDate = normalizeFocusDateByScope(state.scope, state.focusDate);
    render();
  });

  els.summaryModeSeg.addEventListener("click", (event) => {
    const button = event.target.closest(".seg-btn");
    if (!button) return;
    if (button.dataset.mode === state.summaryMode) return;
    state.summaryMode = button.dataset.mode;
    renderSummary();
    persistAppData();
  });

  [els.searchInput, els.projectFilter, els.statusFilter, els.priorityFilter].forEach((element) => {
    element.addEventListener("input", updateFilters);
    element.addEventListener("change", updateFilters);
  });

  els.generateSummaryBtn.addEventListener("click", generateSummaryText);
  els.aiSummaryBtn.addEventListener("click", generateAiSummaryReport);
  els.pptPromptBtn.addEventListener("click", generatePptOutlinePrompt);
  els.exportExcelBtn.addEventListener("click", exportExcel);
  els.exportJsonBtn.addEventListener("click", exportJson);
  els.importJsonInput.addEventListener("change", importJson);
  els.importExcelInput.addEventListener("change", importExcel);

  els.copyPromptBtn.addEventListener("click", copyPrompt);
  els.testModelBtn.addEventListener("click", testModelConnection);
  els.saveSettingsBtn.addEventListener("click", saveSettings);

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleGlobalKeydown);
  window.addEventListener("hashchange", syncHashView);
}

function handleViewSwitch(event) {
  const button = event.target.closest(".nav-btn");
  if (!button) return;

  state.activeView = button.dataset.view;

  if (state.activeView === "today") {
    state.focusDate = todayStr();
    location.hash = "#today";
  } else {
    state.focusDate = normalizeFocusDateByScope(state.scope, state.focusDate);
    location.hash = "#summary";
  }

  render();
}

function syncHashView() {
  state.activeView = location.hash === "#summary" ? "summary" : "today";
  if (state.activeView === "today") {
    state.focusDate = todayStr();
  } else {
    state.focusDate = normalizeFocusDateByScope(state.scope, state.focusDate);
  }
  render();
}

function toggleCalendarCollapse() {
  if (state.activeView === "summary" && state.scope !== "day") return;
  state.calendarCollapsed = !state.calendarCollapsed;
  renderCalendar();
  persistAppData();
}

function handleDocumentClick(event) {
  if (
    !state.calendarCollapsed &&
    els.calendarCard &&
    !els.calendarCard.contains(event.target) &&
    !isAnyModalOpen()
  ) {
    state.calendarCollapsed = true;
    renderCalendar();
    persistAppData();
  }
}

function handleGlobalKeydown(event) {
  if (event.key !== "Escape") return;
  if (!els.entryModal.classList.contains("hidden")) closeEntryModal();
  if (!els.settingsModal.classList.contains("hidden")) closeSettingsModal();
}

function updateFilters() {
  state.filters.search = els.searchInput.value.trim();
  state.filters.project = els.projectFilter.value;
  state.filters.status = els.statusFilter.value;
  state.filters.priority = els.priorityFilter.value;
  renderSummary();
  persistAppData();
}

function render() {
  renderTopNav();
  renderCalendar();

  els.todayView.classList.toggle("hidden", state.activeView !== "today");
  els.summaryView.classList.toggle("hidden", state.activeView !== "summary");

  renderToday();
  renderSummary();
  persistAppData();
}

function renderTopNav() {
  els.viewNav.querySelectorAll(".nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.activeView);
  });
}

function renderCalendar() {
  const usePeriodPicker = state.activeView === "summary" && state.scope !== "day";

  els.calendarGrid.className = "calendar-grid";
  els.calendarToggleBtn.classList.toggle("hidden", usePeriodPicker);
  els.calendarPrevMonthBtn.classList.toggle("hidden", usePeriodPicker);
  els.calendarNextMonthBtn.classList.toggle("hidden", usePeriodPicker);

  if (usePeriodPicker) {
    renderPeriodPicker();
    return;
  }

  renderDayCalendar();
}

function renderDayCalendar() {
  const focus = parseDate(state.focusDate);
  const cells = ["一", "二", "三", "四", "五", "六", "日"].map(
    (weekday) => `<div class="cal-weekday">${weekday}</div>`
  );

  els.calendarGrid.classList.toggle("collapsed", state.calendarCollapsed);
  els.calendarTitle.textContent = `${focus.getFullYear()}年 ${focus.getMonth() + 1}月`;
  els.calendarTodayBtn.textContent = "今天";
  els.calendarToggleBtn.textContent = state.calendarCollapsed ? "展开日历" : "收起日历";

  if (state.calendarCollapsed) {
    const weekStart = getWeekStart(focus);
    for (let index = 0; index < 7; index += 1) {
      cells.push(renderDayCell(addDays(weekStart, index), focus));
    }
  } else {
    const monthStart = new Date(focus.getFullYear(), focus.getMonth(), 1);
    const gridStart = getWeekStart(monthStart);
    for (let index = 0; index < 42; index += 1) {
      cells.push(renderDayCell(addDays(gridStart, index), focus));
    }
  }

  els.calendarGrid.innerHTML = cells.join("");
  els.calendarGrid.querySelectorAll(".cal-day").forEach((button) => {
    button.addEventListener("click", () => {
      state.focusDate = button.dataset.date;
      render();
    });
  });
}

function renderPeriodPicker() {
  const focus = parseDate(state.focusDate);
  const year = focus.getFullYear();
  let items = [];

  els.calendarGrid.classList.add("period-grid");

  if (state.scope === "month") {
    els.calendarTitle.textContent = `${year}年 · 月份选择`;
    els.calendarTodayBtn.textContent = "本月";
    items = Array.from({ length: 12 }, (_, index) => {
      const date = `${year}-${pad(index + 1)}-01`;
      return {
        label: `${index + 1}月`,
        date,
        active: state.focusDate === date,
        stats: getScopeStats("month", date)
      };
    });
  } else if (state.scope === "quarter") {
    els.calendarTitle.textContent = `${year}年 · 季度选择`;
    els.calendarTodayBtn.textContent = "本季度";
    items = Array.from({ length: 4 }, (_, index) => {
      const date = `${year}-${pad(index * 3 + 1)}-01`;
      return {
        label: `第${index + 1}季度`,
        date,
        active: state.focusDate === date,
        stats: getScopeStats("quarter", date)
      };
    });
  } else {
    els.calendarGrid.classList.add("year-grid");
    els.calendarTitle.textContent = "年份选择";
    els.calendarTodayBtn.textContent = "今年";
    const startYear = year - 5;
    items = Array.from({ length: 12 }, (_, index) => {
      const itemYear = startYear + index;
      const date = `${itemYear}-01-01`;
      return {
        label: `${itemYear}年`,
        date,
        active: state.focusDate === date,
        stats: getScopeStats("year", date)
      };
    });
  }

  els.calendarGrid.innerHTML = items.map(renderPeriodButton).join("");
  els.calendarGrid.querySelectorAll(".period-btn").forEach((button) => {
    button.addEventListener("click", () => {
      state.focusDate = button.dataset.date;
      render();
    });
  });
}

function renderPeriodButton(item) {
  const statsText = formatStatsCompact(item.stats);
  const toneClass = item.stats.tone ? `period-${item.stats.tone}` : "period-empty";

  return `
    <button type="button" class="period-btn ${toneClass} ${item.active ? "active" : ""}" data-date="${item.date}">
      <span class="period-label">${item.label}</span>
      <span class="period-stats">${statsText}</span>
    </button>
  `;
}

function renderDayCell(date, focusMonth) {
  const dateKey = formatDate(date);
  const stats = getDayStats(dateKey);
  const muted = date.getMonth() !== focusMonth.getMonth();
  const active = dateKey === state.focusDate;
  const classes = ["cal-day"];

  if (muted) classes.push("muted");
  if (active) classes.push("active");
  classes.push(stats.tone ? `tone-${stats.tone}` : "cal-day-empty");

  return `
    <button type="button" class="${classes.join(" ")}" data-date="${dateKey}">
      <span class="cal-day-top">
        <span>${date.getDate()}</span>
      </span>
      <span class="cal-day-stats">${formatStatsCompact(stats)}</span>
    </button>
  `;
}

function shiftCalendar(offset) {
  const focus = parseDate(state.focusDate);

  if (state.activeView !== "summary" || state.scope === "day") {
    state.focusDate = formatDate(addDays(focus, offset));
    render();
    return;
  }

  if (state.scope === "month") {
    state.focusDate = formatDate(new Date(focus.getFullYear(), focus.getMonth() + offset, 1));
  } else if (state.scope === "quarter") {
    state.focusDate = normalizeFocusDateByScope("quarter", formatDate(new Date(focus.getFullYear(), focus.getMonth() + offset * 3, 1)));
  } else {
    state.focusDate = formatDate(new Date(focus.getFullYear() + offset, 0, 1));
  }

  render();
}

function shiftCalendarMonth(offset) {
  state.focusDate = formatDate(addMonthsClamped(parseDate(state.focusDate), offset));
  render();
}

function jumpCalendarToCurrent() {
  state.focusDate = normalizeFocusDateByScope(
    state.activeView === "summary" ? state.scope : "day",
    todayStr()
  );
  render();
}

function renderToday() {
  const displayDate = normalizeDate(state.focusDate);
  const compareDate = getTaskCompareDate(displayDate);
  const buckets = getVisibleBucketsForDate(displayDate);
  const activeTasks = sortVisibleTasks(buckets.active, compareDate, displayDate);
  const doneTasks = sortDoneTasks(buckets.done);

  els.todayTitle.textContent = `${formatLongDate(displayDate)} · 每日记录`;

  if (displayDate > todayStr()) {
    els.todayStats.innerHTML = [
      chip(`计划 ${activeTasks.length}`, "soft"),
      chip(`完成 ${doneTasks.length}`, "soft")
    ].join("");
  } else {
    els.todayStats.innerHTML = renderStatsChips(getDayStats(displayDate));
  }

  els.todoList.innerHTML = activeTasks.length
    ? activeTasks
        .map((task) => renderTaskCard(task, { displayDate, compareDate, showActions: true }))
        .join("")
    : '<div class="empty">这一天没有待办 / 跟进事项</div>';

  els.doneList.innerHTML = doneTasks.length
    ? doneTasks
        .map((task) => renderTaskCard(task, { displayDate, compareDate, showActions: true }))
        .join("")
    : '<div class="empty">这一天还没有完成记录</div>';
}

function renderSummary() {
  renderScopeButtons();
  renderSummaryModeButtons();
  renderSummaryFilters();

  const range = getScopeRange(state.scope, state.focusDate);
  const tasks = getFilteredSummaryTasks(range);
  const overview = summarizeTasks(tasks, range);

  els.projectSummary.classList.toggle("hidden", state.summaryMode !== "project");
  els.timelineRoot.classList.toggle("hidden", state.summaryMode !== "date");

  const planSummaryEl = document.getElementById("plan-summary");
  if (planSummaryEl) planSummaryEl.classList.toggle("hidden", state.summaryMode !== "plan");

  if (state.summaryMode === "project") {
    els.summaryStats.innerHTML = renderStatsChips(overview, true);
    renderProjectSummary(tasks, range);
  } else if (state.summaryMode === "plan") {
    // plan summary stats are rendered by upgrade-v3.js
  } else {
    els.summaryStats.innerHTML = renderStatsChips(overview, true);
    renderSummaryTimeline(tasks, range);
  }
}

function renderScopeButtons() {
  els.scopeSeg.innerHTML = SCOPE_OPTIONS.map((item) => {
    return `<button type="button" class="seg-btn ${state.scope === item.value ? "active" : ""}" data-scope="${item.value}">${item.label}</button>`;
  }).join("");
}

function renderSummaryModeButtons() {
  els.summaryModeSeg.innerHTML = SUMMARY_MODE_OPTIONS.map((item) => {
    return `<button type="button" class="seg-btn ${state.summaryMode === item.value ? "active" : ""}" data-mode="${item.value}">${item.label}</button>`;
  }).join("");
}

function renderSummaryFilters() {
  const projects = uniqueSummaryProjects();

  fillSelect(
    els.projectFilter,
    [{ value: "all", label: "全部项目" }, ...projects.map((project) => ({ value: project, label: project }))],
    state.filters.project
  );
  fillSelect(els.statusFilter, [{ value: "all", label: "全部状态" }, ...STATUS_OPTIONS], state.filters.status);
  fillSelect(els.priorityFilter, [{ value: "all", label: "全部等级" }, ...PRIORITY_OPTIONS], state.filters.priority);

  if (!["all", ...projects].includes(state.filters.project)) {
    state.filters.project = "all";
    els.projectFilter.value = "all";
  }
}

function renderProjectSummary(tasks, range) {
  if (!tasks.length) {
    els.projectSummary.innerHTML = '<div class="empty">当前筛选条件下没有项目记录</div>';
    return;
  }

  const cards = buildProjectGroups(tasks, range)
    .map((group) => {
      const datesHtml = group.days.length
        ? group.days
            .map((day) => {
              const lines = day.items
                .map((item) => {
                  const displayStatus = getEntryDisplayStatus(item.task, item.date);
                  const overdueTag = displayStatus === "delayed" || (item.task.status === "done" && isOverdueCompletionTask(item.task))
                    ? badge("逾期", "overdue-tag") : "";
                  return `
                    <div class="project-line">
                      <span class="project-line-title">${escapeHtml(item.task.title)}</span>
                      <span class="project-line-meta">
                        ${statusBadge(displayStatus)}
                        ${priorityBadge(item.task.priority)}
                        ${overdueTag}
                      </span>
                    </div>
                  `;
                })
                .join("");

              return `
                <section class="project-day">
                  <div class="project-day-title">${escapeHtml(formatProjectDayLabel(day.date, state.scope))}</div>
                  <div class="project-day-list">${lines}</div>
                </section>
              `;
            })
            .join("")
        : '<div class="empty">暂无记录</div>';

      return `
        <article class="project-card">
          <div class="project-card-head">
            <div class="project-name">${escapeHtml(group.project)}</div>
            <div class="project-stats">${renderStatsChips(group.stats, true)}</div>
          </div>
          <div class="project-card-body">${datesHtml}</div>
        </article>
      `;
    })
    .join("");

  els.projectSummary.innerHTML = cards;
}

function renderSummaryTimeline(tasks, range) {
  const entries = buildSummaryEntries(tasks, range);

  if (!entries.length) {
    els.timelineRoot.innerHTML = '<div class="empty">当前筛选条件下没有记录</div>';
    return;
  }

  const groups = groupSummaryEntries(entries, state.scope);
  els.timelineRoot.innerHTML = groups
    .map((group) => {
      return `
        <section class="group">
          <div class="group-head">
            <span>${escapeHtml(group.label)}</span>
            <span>${group.items.length} 条</span>
          </div>
          <div class="group-body">
            ${group.items
              .map((item) => {
                return renderTaskCard(item.task, {
                  displayDate: item.date,
                  compareDate: getEntryCompareDate(item.task, item.date),
                  showActions: false
                });
              })
              .join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

function renderTaskCard(task, options = {}) {
  const displayDate = options.displayDate || state.focusDate;
  const compareDate = options.compareDate || getEntryCompareDate(task, displayDate);
  const tone = getTaskTone(task, compareDate, displayDate) || "active";
  const displayStatus = getDisplayStatus(task, compareDate);
  const showActions = options.showActions !== false;
  const overdueDays = displayStatus === "delayed" ? diffDays(getEffectiveDueDate(task), compareDate) : 0;
  const completedOverdue = isOverdueCompletionTask(task);

  const meta = [
    badge(task.project, "project"),
    statusBadge(displayStatus),
    priorityBadge(task.priority),
    badge(task.category, "category")
  ];

  if (overdueDays > 0) {
    meta.push(badge(`延期 ${overdueDays} 天`, "overdue-tag"));
  }
  if (completedOverdue) {
    meta.push(badge("延期完成", "overdue-tag"));
  }

  const actions = showActions ? buildTaskActions(task).join("") : "";

  return `
    <article class="task-card task-${tone} ${showActions ? "" : "task-card-summary"} ${task.restored ? "task-restored" : ""}">
      <div class="task-main">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">${meta.join("")}</div>
        <div class="task-dates">${renderTaskDates(task)}</div>
        ${renderTaskNote(task)}
      </div>
      ${showActions ? `<div class="task-actions">${actions}</div>` : ""}
    </article>
  `;
}

function renderTaskDates(task) {
  const date = task.date || "";
  const dueDate = task.dueDate || date;
  const completedDate = task.completedDate || "";
  if (completedDate && date && dueDate && date === dueDate && date === completedDate) {
    return badge(`完成 ${completedDate}`, "completed");
  }
  const items = [badge(`录入 ${date}`, "date")];
  if (dueDate && dueDate !== date) items.push(badge(`计划 ${dueDate}`, "due"));
  if (completedDate) items.push(badge(`完成 ${completedDate}`, "completed"));
  return items.join("");
}

function renderTaskNote(task) {
  const nl2br = (text) => escapeHtml(text).replace(/\\n/g, "<br>");
  const parts = [];
  if (task.plan) parts.push(`计划：${nl2br(task.plan)}`);
  if (task.notes) parts.push(`备注：${nl2br(task.notes)}`);
  return parts.length ? `<div class="task-note">${parts.join("<br>")}</div>` : "";
}

function buildTaskActions(task) {
  if (task.status === "done" || task.status === "paused" || task.status === "abandoned") {
    return [
      actionButton("restore", "恢复", task.id),
      actionButton("edit", "编辑", task.id),
      actionButton("delete", "删除", task.id, true)
    ];
  }

  return [
    actionButton("done", "标记完成", task.id),
    actionButton("pending", "进行中", task.id),
    actionButton("planned", "待办", task.id),
    actionButton("paused", "暂停", task.id),
    actionButton("abandoned", "放弃", task.id),
    actionButton("edit", "编辑", task.id),
    actionButton("delete", "删除", task.id, true)
  ];
}

function handleTaskActionClick(event) {
  const button = event.target.closest("[data-task-action]");
  if (!button) return;

  const { taskAction, taskId } = button.dataset;
  if (!taskId) return;

  if (taskAction === "edit") {
    editTask(taskId);
    return;
  }

  if (taskAction === "delete") {
    deleteTask(taskId);
    return;
  }

  if (taskAction === "restore") {
    updateTaskStatus(taskId, defaultOpenStatusForTask(findTask(taskId)));
    return;
  }

  updateTaskStatus(taskId, taskAction);
}

function editTask(taskId) {
  const task = findTask(taskId);
  if (!task) return;

  state.editingTaskId = taskId;
  els.entryModalTitle.textContent = "编辑任务";
  els.entryModalSubtitle.textContent = "可修改日期、完成日期、状态、备注后保存";
  fillFormForEdit(task);
  openEntryModal(true);
}

function deleteTask(taskId) {
  const task = findTask(taskId);
  if (!task) return;
  if (!window.confirm(`确认删除"${task.title}"？（可从批量恢复恢复）`)) return;
  state.tasks = state.tasks.map((item) => item.id !== taskId ? item : { ...item, status: "deleted", originalStatus: item.status, updatedAt: new Date().toISOString() });
  render();
  showToast("任务已删除");
}

function updateTaskStatus(taskId, nextStatus) {
  const task = findTask(taskId);
  if (!task) return;

  const completedDate = nextStatus === "done" ? getActionCompletedDate() : "";
  const next = normalizeTask({
    ...task,
    status: sanitizeManualStatus(nextStatus, task, todayStr(), true),
    completedDate,
    updatedAt: new Date().toISOString()
  });

  state.tasks = sortTasks(state.tasks.map((item) => (item.id === taskId ? next : item)));
  render();
  showToast(`已更新为${statusLabel(getDisplayStatus(next, todayStr()))}`);
}

function fillFormForEdit(task) {
  els.taskDate.value = task.date;
  els.taskDueDate.value = task.dueDate || task.date;
  els.taskCompletedDate.value = task.completedDate || "";
  els.taskProject.value = task.project;
  els.taskTitle.value = task.title;
  els.taskStatus.value = task.status;
  els.taskPriority.value = task.priority;
  els.taskCategory.value = task.category;
  els.taskPlan.value = task.plan || "";
  els.taskNotes.value = task.notes || "";
  syncTaskDateFields();
}

function resetForm() {
  state.editingTaskId = null;
  els.entryModalTitle.textContent = "新增任务 / 补录";
  els.entryModalSubtitle.textContent = "支持一句话录入、按规则批量写入，也支持逐项填写";

  const defaultDate = normalizeDate(state.focusDate || todayStr());
  const status = defaultStatusValueByDate(defaultDate);

  els.taskDate.value = defaultDate;
  els.taskDueDate.value = defaultDate;
  els.taskCompletedDate.value = status === "done" ? defaultDate : "";
  els.taskProject.value = "";
  els.taskTitle.value = "";
  els.taskStatus.value = status;
  els.taskPriority.value = "中";
  els.taskCategory.value = "综合事务";
  els.taskPlan.value = "";
  els.taskNotes.value = "";
  syncTaskDateFields();
}

function syncTaskDateFields() {
  if (!els.taskDueDate.value) {
    els.taskDueDate.value = els.taskDate.value || state.focusDate;
  }

  if (els.taskStatus.value === "done") {
    if (!els.taskCompletedDate.value) {
      els.taskCompletedDate.value = els.taskDate.value || state.focusDate;
    }
  } else {
    els.taskCompletedDate.value = "";
  }
}

function submitTaskForm(event) {
  event.preventDefault();

  const task = collectTaskFormData();
  if (!task) return;

  if (state.editingTaskId) {
    state.tasks = sortTasks(state.tasks.map((item) => (item.id === state.editingTaskId ? task : item)));
    showToast("任务已更新");
  } else {
    state.tasks = sortTasks([...state.tasks, task]);
    showToast("任务已保存");
  }

  state.focusDate = normalizeFocusDateByScope(state.scope, task.date);
  renderProjectSuggestions();
  render();
  closeEntryModal();
  resetForm();
}

function collectTaskFormData() {
  const original = state.editingTaskId ? findTask(state.editingTaskId) : null;
  const date = normalizeDate(els.taskDate.value || state.focusDate);
  const dueDate = normalizeDate(els.taskDueDate.value || date);
  let completedDate = normalizeOptionalDate(els.taskCompletedDate.value);
  let status = els.taskStatus.value;

  if (status === "done" && !completedDate) {
    completedDate = date;
  }

  if (status !== "done") {
    completedDate = "";
  }

  status = sanitizeManualStatus(status, { date, dueDate, completedDate }, todayStr(), true);

  const title = cleanupTitle(els.taskTitle.value);
  const project = normalizeProjectName(els.taskProject.value) || extractProject(title);

  if (!title) {
    showToast("请填写任务事项");
    return null;
  }

  if (!project) {
    showToast("请填写项目");
    return null;
  }

  return normalizeTask({
    ...original,
    id: original?.id || createId(),
    date,
    dueDate,
    completedDate,
    project,
    title,
    status,
    priority: normalizePriority(els.taskPriority.value),
    category: normalizeCategory(els.taskCategory.value),
    plan: normalizeText(els.taskPlan.value),
    notes: normalizeText(els.taskNotes.value),
    source: original?.source || "manual",
    createdAt: original?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function sanitizeManualStatus(status, taskLike, compareDate, showHint = false) {
  if (status !== "delayed") return status;

  if (getEffectiveDueDate(taskLike) <= compareDate) return "delayed";

  if (showHint) {
    showToast("未到计划完成日期，已改为待办 / 进行中");
  }

  return normalizeDate(taskLike.date) > compareDate ? "planned" : "pending";
}

function openEntryModal(keepForm = false) {
  if (!keepForm && !state.editingTaskId) resetForm();
  els.entryModal.classList.remove("hidden");
  syncModalLock(true);
}

function closeEntryModal() {
  els.entryModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  syncModalLock();
  state.editingTaskId = null;
}

function openSettingsModal() {
  fillSettingsForm();
  els.settingsModal.classList.remove("hidden");
  syncModalLock(true);
}

function closeSettingsModal() {
  els.settingsModal.classList.add("hidden");
  syncModalLock();
}

function fillSettingsForm() {
  els.settingsBaseUrl.value = state.settings.baseUrl || DEFAULT_SETTINGS.baseUrl;
  els.settingsApiKey.value = state.settings.apiKey || "";
  els.settingsModel.value = state.settings.model || DEFAULT_SETTINGS.model;
  els.settingsTemperature.value = state.settings.temperature ?? DEFAULT_SETTINGS.temperature;
  els.settingsPrompt.value = state.settings.prompt || DEFAULT_SETTINGS.prompt;
  if (window.__fillAccessSettingsForm) window.__fillAccessSettingsForm();
}

function saveSettings() {
  const storedSettings = readJson(SETTINGS_KEY) || {};
  state.settings = {
    ...storedSettings,
    baseUrl: normalizeText(els.settingsBaseUrl.value) || DEFAULT_SETTINGS.baseUrl,
    apiKey: normalizeText(els.settingsApiKey.value),
    model: normalizeText(els.settingsModel.value) || DEFAULT_SETTINGS.model,
    temperature: clampNumber(Number(els.settingsTemperature.value), 0, 2, DEFAULT_SETTINGS.temperature),
    prompt: normalizeText(els.settingsPrompt.value) || DEFAULT_SETTINGS.prompt
  };

  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  if (window.__refreshIntegrationDocs) window.__refreshIntegrationDocs();
  closeSettingsModal();
  showToast("设置已保存");
}

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(els.settingsPrompt.value || DEFAULT_SETTINGS.prompt);
    showToast("Prompt 已复制");
  } catch {
    showToast("复制失败，请手动复制");
  }
}

async function testModelConnection(event) {
  const button = event.currentTarget;
  const tempSettings = {
    baseUrl: normalizeText(els.settingsBaseUrl.value) || DEFAULT_SETTINGS.baseUrl,
    apiKey: normalizeText(els.settingsApiKey.value),
    model: normalizeText(els.settingsModel.value) || DEFAULT_SETTINGS.model,
    temperature: clampNumber(Number(els.settingsTemperature.value), 0, 2, DEFAULT_SETTINGS.temperature),
    prompt: normalizeText(els.settingsPrompt.value) || DEFAULT_SETTINGS.prompt
  };

  if (!tempSettings.apiKey) {
    showToast("请先填写 API Key");
    return;
  }

  await withBusy(button, "测试中...", async () => {
    try {
      await callModel(tempSettings, "请只返回空 JSON 数组：[]");
      showToast("模型连接正常");
    } catch (error) {
      console.error(error);
      showToast("模型测试失败，请检查接口配置");
    }
  });
}

function handleQuickParseToForm() {
  const text = normalizeText(els.quickLineInput.value);
  if (!text) {
    showToast("请先输入一句话内容");
    return;
  }

  const task = parseNaturalTask(text, { fallbackDate: state.focusDate, source: "quick-line" });
  state.editingTaskId = null;
  fillFormForEdit(task);
  els.entryModalTitle.textContent = "新增任务 / 补录";
  els.entryModalSubtitle.textContent = "已从一句话解析到表单，可继续调整后保存";
  showToast("已解析到表单");
}

function handleQuickDirectSave() {
  const text = normalizeText(els.quickLineInput.value);
  if (!text) {
    showToast("请先输入一句话内容");
    return;
  }

  const tasks = parseBatchInput(text, "quick-line");
  if (!tasks.length) {
    showToast("没有识别到可写入任务");
    return;
  }

  addTasks(tasks, { merge: true, focusLastDate: true });
  render();
  showToast(`已直接写入 ${tasks.length} 条任务`);
}

async function handleQuickAiParse(event) {
  const text = normalizeText(els.quickLineInput.value);
  if (!text) {
    showToast("请先输入一句话内容");
    return;
  }

  await withBusy(event.currentTarget, "解析中...", async () => {
    try {
      const tasks = await parseWithAI(text, "quick-ai");
      if (!tasks.length) {
        showToast("AI 未返回可写入内容");
        return;
      }
      state.editingTaskId = null;
      fillFormForEdit(tasks[0]);
      els.entryModalTitle.textContent = "新增任务 / 补录";
      els.entryModalSubtitle.textContent = "已从 AI 解析到表单，可继续调整后保存";
      showToast("AI 解析完成");
    } catch (error) {
      console.error(error);
      showToast("AI 解析失败，请检查设置或网络");
    }
  });
}

function handleBatchLocalWrite() {
  const text = normalizeText(els.batchInput.value);
  if (!text) {
    showToast("请先粘贴批量内容");
    return;
  }

  const tasks = parseBatchInput(text, "batch-local");
  if (!tasks.length) {
    showToast("没有识别到可写入任务");
    return;
  }

  addTasks(tasks, { merge: true, focusLastDate: true });
  render();
  showToast(`已写入 ${tasks.length} 条任务`);
}

async function handleBatchAiWrite(event) {
  const text = normalizeText(els.batchInput.value);
  if (!text) {
    showToast("请先粘贴批量内容");
    return;
  }

  await withBusy(event.currentTarget, "写入中...", async () => {
    try {
      const tasks = await parseWithAI(text, "batch-ai");
      if (!tasks.length) {
        showToast("AI 未返回可写入内容");
        return;
      }
      addTasks(tasks, { merge: true, focusLastDate: true });
      render();
      showToast(`AI 已写入 ${tasks.length} 条任务`);
    } catch (error) {
      console.error(error);
      showToast("AI 批量写入失败，请检查设置或网络");
    }
  });
}

async function parseWithAI(text, source) {
  if (!state.settings.apiKey) {
    throw new Error("missing-api-key");
  }

  const content = await callModel(state.settings, text);
  const parsed = parseJsonArrayFromString(content);
  return parsed.map((item) =>
    normalizeTask({
      ...item,
      source,
      date: item.date || state.focusDate,
      dueDate: item.dueDate || item.date || state.focusDate,
      completedDate: item.completedDate || ""
    })
  );
}

async function callModel(settings, text) {
  const response = await fetch(joinBaseUrl(settings.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: settings.temperature,
      messages: [
        { role: "system", content: settings.prompt },
        { role: "user", content: text }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`request-failed-${response.status}`);
  }

  const json = await response.json();
  return json?.choices?.[0]?.message?.content || "[]";
}

function parseBatchInput(text, source = "batch-local") {
  const lines = String(text || "").split(/\r?\n/);
  const tasks = [];
  let currentDate = state.focusDate;

  lines.forEach((line) => {
    const rawLine = normalizeText(line);
    if (!rawLine) return;

    const pureDate = parsePureDateLine(rawLine);
    if (pureDate) {
      currentDate = pureDate;
      return;
    }

    const prefixedDate = parseDatePrefixLine(rawLine);
    if (prefixedDate) {
      currentDate = prefixedDate.date || currentDate;
      if (prefixedDate.rest) {
        splitBatchSegments(prefixedDate.rest).forEach((segment) => {
          tasks.push(parseNaturalTask(segment, { fallbackDate: currentDate, source }));
        });
      }
      return;
    }

    splitBatchSegments(rawLine).forEach((segment) => {
      tasks.push(parseNaturalTask(segment, { fallbackDate: currentDate, source }));
    });
  });

  return tasks.filter(Boolean);
}

function splitBatchSegments(line) {
  const normalized = normalizeText(line)
    .replace(/\s+/g, " ")
    .replace(/[；;]+/g, "；")
    .trim();

  return normalized
    .split(/[；]/)
    .map((item) => cleanupBatchLine(item))
    .filter(Boolean);
}

function parseNaturalTask(text, options = {}) {
  const extractedDate = extractDateFromText(text);
  const statusResult = extractMappedValue(extractedDate.rest, getStatusKeywordMap());
  const priorityResult = extractMappedValue(statusResult.rest, getPriorityKeywordMap());
  const categoryResult = extractMappedValue(priorityResult.rest, getCategoryKeywordMap());

  const date = extractedDate.date || normalizeDate(options.fallbackDate || state.focusDate);
  const title = cleanupTitle(categoryResult.rest) || cleanupTitle(extractedDate.rest) || "未命名任务";
  const status = normalizeStatus(statusResult.value || defaultStatusValueByDate(date));
  const dueDate = date;

  return normalizeTask({
    id: createId(),
    date,
    dueDate,
    completedDate: status === "done" ? date : "",
    project: extractProject(title),
    title,
    status,
    priority: normalizePriority(priorityResult.value || inferPriority(title)),
    category: normalizeCategory(categoryResult.value || inferCategory(title)),
    plan: "",
    notes: "",
    source: options.source || "natural",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function addTasks(tasks, options = {}) {
  const normalized = tasks.map(normalizeTask);

  if (!options.merge) {
    state.tasks = sortTasks([...state.tasks, ...normalized]);
  } else {
    const map = new Map(state.tasks.map((task) => [fingerprint(task), task]));
    normalized.forEach((task) => {
      const key = fingerprint(task);
      const existing = map.get(key);
      map.set(key, existing ? normalizeTask({ ...existing, ...task, id: existing.id }) : task);
    });
    state.tasks = sortTasks([...map.values()]);
  }

  renderProjectSuggestions();

  if (options.focusLastDate && normalized.length) {
    const lastTask = [...normalized].sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1);
    state.focusDate = normalizeFocusDateByScope(state.scope, lastTask?.date || state.focusDate);
  }
}

function findTask(taskId) {
  return state.tasks.find((task) => task.id === taskId) || null;
}

function getVisibleBucketsForDate(dateKey) {
  const active = [];
  const done = [];

  state.tasks.forEach((task) => {
    const phase = taskStateOnDate(task, dateKey);
    if (task.status === "deleted") return;
    if (phase === "done") done.push(task);
    if (phase === "active") active.push(task);
  });

  return { active, done };
}

function taskStateOnDate(task, dateKey) {
  const day = normalizeDate(dateKey);
  const completedDate = getEffectiveCompletedDate(task);

  if (task.status === "done") {
    return completedDate === day ? "done" : "none";
  }

  if (task.status === "paused" || task.status === "abandoned") {
    return "none";
  }

  if (day > todayStr()) {
    return task.date === day ? "active" : "none";
  }

  if (day === todayStr()) {
    return task.date <= day ? "active" : "none";
  }

  return task.date === day ? "active" : "none";
}

function getDayStats(dateKey) {
  const day = normalizeDate(dateKey);
  if (day > todayStr()) {
    return createEmptyStats();
  }

  const stats = createEmptyStats();

  state.tasks.forEach((task) => {
    if (task.status === "done") {
      const completedDate = getEffectiveCompletedDate(task);
      if (completedDate === day) {
        if (isOverdueCompletionTask(task)) {
          stats.overdueDone += 1;
        } else {
          stats.completed += 1;
        }
      }
      return;
    }

    if (task.status === "paused" || task.status === "abandoned") {
      return;
    }

    if (day === todayStr()) {
      if (task.date <= day) {
        if (isTaskCurrentlyOverdue(task)) {
          stats.currentOverdue += 1;
        } else if (task.date === day) {
          stats.createdOpen += 1;
        }
      }
      return;
    }

    if (task.date === day) {
      if (isTaskCurrentlyOverdue(task)) {
        stats.currentOverdue += 1;
      } else {
        stats.createdOpen += 1;
      }
    }
  });

  return finalizeStats(stats, { day });
}

function getScopeStats(scope, dateKey) {
  const range = getScopeRange(scope, dateKey);
  const stats = createEmptyStats();

  if (range.start > todayStr()) {
    return finalizeStats(stats, { range });
  }

  state.tasks.forEach((task) => {
    if (shouldHideTaskInSummary(task)) return;

    if (task.status === "done") {
      const completedDate = getEffectiveCompletedDate(task);
      if (completedDate && isDateInRange(completedDate, range.start, range.end)) {
        if (isOverdueCompletionTask(task)) {
          stats.overdueDone += 1;
        } else {
          stats.completed += 1;
        }
      }
      return;
    }

    if (task.status === "paused" || task.status === "abandoned") {
      return;
    }

    if (task.date <= todayStr() && isDateInRange(task.date, range.start, range.end)) {
      if (isTaskCurrentlyOverdue(task)) {
        stats.currentOverdue += 1;
      } else {
        stats.createdOpen += 1;
      }
    }
  });

  return finalizeStats(stats, { range });
}

function createEmptyStats() {
  return {
    currentOverdue: 0,
    completed: 0,
    overdueDone: 0,
    createdOpen: 0,
    total: 0,
    tone: "",
    projects: 0
  };
}

function finalizeStats(stats, context = {}) {
  const next = {
    ...stats,
    total: stats.currentOverdue + stats.completed + stats.overdueDone + stats.createdOpen
  };

  if (context.day) {
    next.tone = resolveDayTone(next, context.day);
  } else if (context.range) {
    next.tone = resolveRangeTone(next, context.range);
  }

  return next;
}

function resolveDayTone(stats, day) {
  if (day > todayStr()) return "";
  if (stats.currentOverdue > 0) return "overdue";
  if (stats.createdOpen > 0) return day === todayStr() ? "active" : "overdue";
  if (stats.completed > 0 || stats.overdueDone > 0) return "complete";
  return "";
}

function resolveRangeTone(stats, range) {
  if (range.start > todayStr()) return "";
  if (stats.currentOverdue > 0) return "overdue";
  if (stats.createdOpen > 0) {
    return isDateInRange(todayStr(), range.start, range.end) ? "active" : "overdue";
  }
  if (stats.completed > 0 || stats.overdueDone > 0) return "complete";
  return "";
}

function getTaskTone(task, compareDate, displayDate = compareDate) {
  if (task.status === "done") return "complete";
  if (task.status === "paused" || task.status === "abandoned") return "";
  if (displayDate < todayStr()) return "overdue";
  if (getDisplayStatus(task, compareDate) === "delayed") return "overdue";
  return "active";
}

function isTaskCurrentlyOverdue(task) {
  if (isTerminalStatus(task.status)) return false;
  return task.date <= todayStr() && getEffectiveDueDate(task) < todayStr();
}

function isOverdueCompletionTask(task) {
  if (task.status !== "done") return false;
  const completedDate = getEffectiveCompletedDate(task);
  return Boolean(completedDate && completedDate > getEffectiveDueDate(task));
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

function getEntryDisplayStatus(task, entryDate) {
  return getDisplayStatus(task, getEntryCompareDate(task, entryDate));
}

function getEntryCompareDate(task, entryDate) {
  if (task.status === "done") {
    return getEffectiveCompletedDate(task) || entryDate;
  }
  if (entryDate > todayStr()) {
    return entryDate;
  }
  return todayStr();
}

function getTaskCompareDate(displayDate) {
  return displayDate > todayStr() ? displayDate : todayStr();
}

function getFilteredSummaryTasks(range) {
  const search = state.filters.search.toLowerCase();

  return state.tasks
    .filter((task) => !shouldHideTaskInSummary(task))
    .filter((task) => isTaskRelevantToRange(task, range))
    .filter((task) => {
      if (state.filters.project !== "all" && task.project !== state.filters.project) return false;
      if (state.filters.priority !== "all" && task.priority !== state.filters.priority) return false;
      if (state.filters.status !== "all") {
        const displayStatus = getDisplayStatus(task, getSummaryFilterCompareDate(range));
        if (displayStatus !== state.filters.status) return false;
      }
      if (!search) return true;

      const haystack = [task.project, task.title, task.plan, task.notes, task.category].join(" ").toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) => compareSummaryTasks(a, b, range));
}

function isTaskRelevantToRange(task, range) {
  return getTaskTimelineDates(task, range).length > 0;
}

function shouldHideTaskInSummary(task) {
  const text = [task.project, task.title, task.category, task.notes, task.plan].join(" ");
  return task.category === "休假" || /请假|休假/.test(text);
}

function summarizeTasks(tasks, range) {
  const stats = createEmptyStats();
  stats.projects = new Set(tasks.map((task) => task.project)).size;

  tasks.forEach((task) => {
    if (task.status === "done") {
      const completedDate = getEffectiveCompletedDate(task);
      if (completedDate && isDateInRange(completedDate, range.start, range.end)) {
        if (isOverdueCompletionTask(task)) {
          stats.overdueDone += 1;
        } else {
          stats.completed += 1;
        }
      }
      return;
    }

    if (task.status === "paused" || task.status === "abandoned") {
      return;
    }

    if (task.date <= todayStr() && isDateInRange(task.date, range.start, range.end)) {
      if (isTaskCurrentlyOverdue(task)) {
        stats.currentOverdue += 1;
      } else {
        stats.createdOpen += 1;
      }
    }
  });

  return finalizeStats(stats, { range });
}

function generateSummaryText() {
  const range = getScopeRange(state.scope, state.focusDate);
  const tasks = getFilteredSummaryTasks(range);
  const summary = summarizeTasks(tasks, range);
  const projectLine = summarizeTopProjects(tasks);

  els.summaryOutput.value = [
    `${range.label}：当前逾期 ${summary.currentOverdue} 条，完成 ${summary.completed} 条，逾期完成 ${summary.overdueDone} 条，新增未完成 ${summary.createdOpen} 条。`,
    `共涉及 ${summary.projects} 个项目。`,
    projectLine
  ]
    .filter(Boolean)
    .join("\n");
}

function summarizeTopProjects(tasks) {
  if (!tasks.length) return "";

  const counts = new Map();
  tasks.forEach((task) => {
    counts.set(task.project, (counts.get(task.project) || 0) + 1);
  });

  return `主要项目：${[...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([project, count]) => `${project}(${count})`)
    .join("、")}`;
}

function buildSummaryEntries(tasks, range) {
  return tasks
    .flatMap((task) => getTaskTimelineDates(task, range).map((date) => ({ task, date })))
    .sort(compareSummaryEntries);
}

function groupSummaryEntries(entries, scope) {
  const groups = new Map();

  entries.forEach((entry) => {
    const key = getSummaryGroupKey(entry.date, scope);
    const label = getSummaryGroupLabel(key, scope);
    const group = groups.get(key) || { key, label, items: [] };
    group.items.push(entry);
    groups.set(key, group);
  });

  return [...groups.values()]
    .sort((a, b) => (a.key < b.key ? 1 : -1))
    .map((group) => ({
      ...group,
      items: group.items.sort(compareSummaryEntries)
    }));
}

function buildProjectGroups(tasks, range) {
  const grouped = new Map();

  tasks.forEach((task) => {
    const item = grouped.get(task.project) || { project: task.project, tasks: [] };
    item.tasks.push(task);
    grouped.set(task.project, item);
  });

  return [...grouped.values()]
    .map((group) => {
      const entries = buildSummaryEntries(group.tasks, range);
      const dayMap = new Map();

      entries.forEach((entry) => {
        const day = dayMap.get(entry.date) || { date: entry.date, items: [] };
        day.items.push(entry);
        dayMap.set(entry.date, day);
      });

      return {
        project: group.project,
        stats: summarizeTasks(group.tasks, range),
        days: [...dayMap.values()]
          .sort((a, b) => (a.date < b.date ? 1 : -1))
          .map((day) => ({
            ...day,
            items: day.items.sort(compareSummaryEntries)
          }))
      };
    })
    .sort((a, b) => {
      const aScore = a.stats.currentOverdue * 1000 + a.stats.completed + a.stats.overdueDone + a.stats.createdOpen;
      const bScore = b.stats.currentOverdue * 1000 + b.stats.completed + b.stats.overdueDone + b.stats.createdOpen;
      if (aScore !== bScore) return bScore - aScore;
      return a.project.localeCompare(b.project, "zh-CN");
    });
}

function getTaskTimelineDates(task, range) {
  const dates = new Set();
  const completedDate = getEffectiveCompletedDate(task);

  if (task.status === "done") {
    if (completedDate && isDateInRange(completedDate, range.start, range.end)) {
      dates.add(completedDate);
    }
    return [...dates].sort();
  }

  if (task.status === "paused" || task.status === "abandoned") {
    if (isDateInRange(task.date, range.start, range.end)) {
      dates.add(task.date);
    }
    return [...dates].sort();
  }

  if (isDateInRange(task.date, range.start, range.end)) {
    dates.add(task.date);
  }

  if (task.date < todayStr() && isDateInRange(todayStr(), range.start, range.end)) {
    dates.add(todayStr());
  }

  return [...dates].sort();
}

function getSummaryGroupKey(dateKey, scope) {
  if (scope === "quarter" || scope === "year") {
    return dateKey.slice(0, 7);
  }
  return dateKey;
}

function getSummaryGroupLabel(key, scope) {
  if ((scope === "quarter" || scope === "year") && /^\d{4}-\d{2}$/.test(key)) {
    const [year, month] = key.split("-");
    return `${year}年 ${Number(month)}月`;
  }
  return formatLongDate(key);
}

function formatProjectDayLabel(dateKey, scope) {
  if (scope === "quarter" || scope === "year") {
    const [year, month] = dateKey.split("-");
    return `${year}年${Number(month)}月`;
  }
  return formatLongDate(dateKey);
}

function compareSummaryEntries(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;

  const toneDiff = toneRank(getTaskTone(a.task, getEntryCompareDate(a.task, a.date), a.date)) - toneRank(
    getTaskTone(b.task, getEntryCompareDate(b.task, b.date), b.date)
  );
  if (toneDiff !== 0) return toneDiff;

  const priorityDiff = priorityRank(a.task.priority) - priorityRank(b.task.priority);
  if (priorityDiff !== 0) return priorityDiff;

  return a.task.title.localeCompare(b.task.title, "zh-CN");
}

function compareSummaryTasks(a, b, range) {
  const aDate = getTaskSortAnchor(a, range);
  const bDate = getTaskSortAnchor(b, range);
  if (aDate !== bDate) return aDate < bDate ? 1 : -1;

  const toneDiff = toneRank(getTaskTone(a, getSummaryFilterCompareDate(range), aDate)) - toneRank(
    getTaskTone(b, getSummaryFilterCompareDate(range), bDate)
  );
  if (toneDiff !== 0) return toneDiff;

  const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDiff !== 0) return priorityDiff;

  return a.title.localeCompare(b.title, "zh-CN");
}

function getTaskSortAnchor(task, range) {
  const completedDate = getEffectiveCompletedDate(task);
  if (completedDate && isDateInRange(completedDate, range.start, range.end)) {
    return completedDate;
  }
  if (isDateInRange(todayStr(), range.start, range.end) && !isTerminalStatus(task.status) && task.date < todayStr()) {
    return todayStr();
  }
  return task.date;
}

function getSummaryFilterCompareDate(range) {
  return range.end > todayStr() ? todayStr() : range.end;
}

function sortVisibleTasks(tasks, compareDate, displayDate) {
  return [...tasks].sort((a, b) => {
    const toneDiff = toneRank(getTaskTone(a, compareDate, displayDate)) - toneRank(getTaskTone(b, compareDate, displayDate));
    if (toneDiff !== 0) return toneDiff;

    const aDue = getEffectiveDueDate(a);
    const bDue = getEffectiveDueDate(b);
    if (aDue !== bDue) return aDue.localeCompare(bDue, "zh-CN");

    const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDiff !== 0) return priorityDiff;

    return a.date.localeCompare(b.date, "zh-CN");
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

function exportJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    focusDate: state.focusDate,
    scope: state.scope,
    summaryMode: state.summaryMode,
    tasks: state.tasks
  };

  downloadFile(`日报记录-${todayStr()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function exportExcel() {
  if (typeof XLSX === "undefined") {
    showToast("当前页面未加载 Excel 导出组件");
    return;
  }

  const rows = state.tasks.map((task) => ({
    录入日期: task.date,
    计划完成日期: task.dueDate || "",
    实际完成日期: task.completedDate || "",
    项目: task.project,
    任务事项: task.title,
    完成情况: statusLabel(getDisplayStatus(task, todayStr())),
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
  showToast("Excel 已导出");
}

async function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    if (!Array.isArray(payload.tasks)) throw new Error("invalid-json");

    addTasks(payload.tasks, { merge: true });
    if (payload.scope && SCOPE_OPTIONS.some((item) => item.value === payload.scope)) {
      state.scope = payload.scope;
    }
    if (payload.focusDate) {
      state.focusDate = normalizeFocusDateByScope(state.scope, payload.focusDate);
    }
    if (payload.summaryMode && SUMMARY_MODE_OPTIONS.some((item) => item.value === payload.summaryMode)) {
      state.summaryMode = payload.summaryMode;
    }

    render();
    showToast(`JSON 已导入 ${payload.tasks.length} 条任务`);
  } catch (error) {
    console.error(error);
    showToast("JSON 导入失败，请检查文件格式");
  }

  event.target.value = "";
}

async function importExcel(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (typeof XLSX === "undefined") {
    showToast("当前页面未加载 Excel 解析组件");
    return;
  }

  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
    const tasks = parseExcelRows(rows);

    if (!tasks.length) {
      showToast("Excel 中没有识别到可导入任务");
      return;
    }

    addTasks(tasks, { merge: true, focusLastDate: true });
    render();
    showToast(`Excel 已导入 ${tasks.length} 条任务`);
  } catch (error) {
    console.error(error);
    showToast("Excel 导入失败，请检查内容格式");
  }

  event.target.value = "";
}

function parseExcelRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];

  const header = rows[0].map((cell) => normalizeText(cell));
  const hasHeader = header.some((cell) => cell.includes("日期")) && header.some((cell) => cell.includes("任务"));

  if (hasHeader) {
    const headerMap = {
      date: findHeaderIndex(header, ["录入日期", "日期"]),
      dueDate: findHeaderIndex(header, ["计划完成日期", "计划日期", "截止日期"]),
      completedDate: findHeaderIndex(header, ["实际完成日期", "完成日期"]),
      project: findHeaderIndex(header, ["项目"]),
      title: findHeaderIndex(header, ["任务事项", "任务", "事项"]),
      status: findHeaderIndex(header, ["完成情况", "状态"]),
      priority: findHeaderIndex(header, ["等级", "优先"]),
      category: findHeaderIndex(header, ["分类"]),
      plan: findHeaderIndex(header, ["计划说明", "计划"]),
      notes: findHeaderIndex(header, ["备注"])
    };

    return rows.slice(1).flatMap((row) => {
      const date = normalizeExcelDate(row[headerMap.date]);
      const title = cleanupTitle(row[headerMap.title]);
      if (!date || !title) return [];

      return [
        normalizeTask({
          id: createId(),
          date,
          dueDate: normalizeExcelDate(row[headerMap.dueDate]) || date,
          completedDate: normalizeExcelDate(row[headerMap.completedDate]) || "",
          project: normalizeProjectName(row[headerMap.project]) || extractProject(title),
          title,
          status: normalizeStatus(row[headerMap.status] || defaultStatusValueByDate(date)),
          priority: normalizePriority(row[headerMap.priority] || inferPriority(title)),
          category: normalizeCategory(row[headerMap.category] || inferCategory(title)),
          plan: normalizeText(row[headerMap.plan] || ""),
          notes: normalizeText(row[headerMap.notes] || ""),
          source: "excel-import",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      ];
    });
  }

  const tasks = [];

  rows.forEach((row) => {
    const date = normalizeExcelDate(row[0]);
    if (!date) return;

    const rest = row.slice(1).map((cell) => normalizeText(cell)).filter(Boolean);
    if (!rest.length) return;

    if (rest.length >= 2 && rest[0].length <= 20) {
      tasks.push(
        normalizeTask({
          id: createId(),
          date,
          dueDate: date,
          completedDate: defaultStatusValueByDate(date) === "done" ? date : "",
          project: normalizeProjectName(rest[0]) || extractProject(rest[1]),
          title: cleanupTitle(rest[1]),
          status: normalizeStatus(rest[2] || defaultStatusValueByDate(date)),
          priority: normalizePriority(rest[3] || inferPriority(rest[1])),
          category: normalizeCategory(rest[4] || inferCategory(rest[1])),
          plan: normalizeText(rest[5] || ""),
          notes: normalizeText(rest[6] || ""),
          source: "excel-import",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      );
      return;
    }

    splitBatchSegments(rest.join("；")).forEach((title) => {
      tasks.push(parseNaturalTask(title, { source: "excel-import", fallbackDate: date }));
    });
  });

  return tasks;
}

function findHeaderIndex(header, aliases) {
  return header.findIndex((cell) => aliases.some((alias) => cell.includes(alias)));
}

function normalizeTask(task) {
  const date = normalizeDate(task.date);
  const dueDate = normalizeDate(task.dueDate || date);
  let status = normalizeStatus(task.status || defaultStatusValueByDate(date));
  let completedDate = normalizeOptionalDate(task.completedDate);

  if (status === "done" && !completedDate) {
    completedDate = date;
  }

  if (status !== "done") {
    completedDate = "";
  }

  if (status === "delayed" && dueDate > todayStr()) {
    status = date > todayStr() ? "planned" : "pending";
  }

  const title = cleanupTitle(task.title) || "未命名任务";

  return {
    id: task.id || createId(),
    date,
    dueDate,
    completedDate,
    project: normalizeProjectName(task.project) || extractProject(title),
    title,
    status,
    priority: normalizePriority(task.priority || inferPriority(title)),
    category: normalizeCategory(task.category || inferCategory(title)),
    plan: normalizeText(task.plan),
    notes: normalizeText(task.notes),
    source: task.source || "manual",
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || new Date().toISOString()
  };
}

function normalizeDate(value) {
  if (!value) return todayStr();

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const loose = parseLooseDate(trimmed);
    if (loose) return loose;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? todayStr() : formatDate(date);
}

function normalizeOptionalDate(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const loose = parseLooseDate(trimmed);
    if (loose) return loose;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : formatDate(date);
}

function normalizeExcelDate(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    const base = new Date(Date.UTC(1899, 11, 30));
    return formatDate(new Date(base.getTime() + value * 86400000));
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate(value);
  }
  return parseLooseDate(String(value).trim());
}

function parseLooseDate(text) {
  if (!text) return "";
  const match = String(text).match(/(20\d{2})\s*[\/\-.年]\s*(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${pad(match[2])}-${pad(match[3])}`;
}

function parsePureDateLine(line) {
  const normalized = normalizeText(line).replace(/[：:]/g, "").trim();
  return /^20\d{2}[\/\-.年]\d{1,2}[\/\-.月]\d{1,2}日?$/.test(normalized) ? parseLooseDate(normalized) : "";
}

function parseDatePrefixLine(line) {
  const match = normalizeText(line).match(/^(20\d{2}[\/\-.年]\d{1,2}[\/\-.月]\d{1,2}日?)(.*)$/);
  if (!match) return null;
  return {
    date: parseLooseDate(match[1]),
    rest: cleanupBatchLine(match[2])
  };
}

function extractDateFromText(text) {
  let rest = normalizeText(text);
  let date = "";

  const keywordDate = [
    { keyword: "今天", value: todayStr() },
    { keyword: "昨日", value: formatDate(addDays(new Date(), -1)) },
    { keyword: "昨天", value: formatDate(addDays(new Date(), -1)) },
    { keyword: "明天", value: formatDate(addDays(new Date(), 1)) }
  ].find((item) => rest.includes(item.keyword));

  if (keywordDate) {
    date = keywordDate.value;
    rest = rest.replace(keywordDate.keyword, " ");
  }

  const match = rest.match(/(20\d{2}\s*[\/\-.年]\s*\d{1,2}\s*[\/\-.月]\s*\d{1,2}日?)/);
  if (match) {
    date = parseLooseDate(match[1]);
    rest = rest.replace(match[1], " ");
  }

  return { date, rest: cleanupTitle(rest) };
}

function normalizeStatus(value) {
  if (STATUS_OPTIONS.some((item) => item.value === value)) return value;
  const label = normalizeText(value);
  return getStatusKeywordMap()[label] || "done";
}

function normalizePriority(value) {
  const text = normalizeText(value);
  if (PRIORITY_OPTIONS.includes(text)) return text;
  if (["高优先", "高优先级", "紧急", "重要", "高"].includes(text)) return "高";
  if (["低", "低优先", "一般", "普通"].includes(text)) return "普通";
  return "中";
}

function normalizeCategory(value) {
  const text = normalizeText(value);
  if (CATEGORY_OPTIONS.includes(text)) return text;
  return inferCategory(text);
}

function defaultStatusValueByDate(date) {
  return date > todayStr() ? "planned" : "done";
}

function getStatusKeywordMap() {
  return {
    已完成: "done",
    完成: "done",
    done: "done",
    进行中: "pending",
    跟进中: "pending",
    处理中: "pending",
    待办: "planned",
    计划: "planned",
    计划中: "planned",
    已逾期: "delayed",
    逾期: "delayed",
    延期: "delayed",
    暂停: "paused",
    任务暂停: "paused",
    放弃: "abandoned",
    放弃任务: "abandoned"
  };
}

function getPriorityKeywordMap() {
  return {
    高优先: "高",
    高优先级: "高",
    紧急: "高",
    重要: "高",
    高: "高",
    中优先: "中",
    中: "中",
    普通: "普通",
    一般: "普通",
    低: "普通"
  };
}

function getCategoryKeywordMap() {
  return Object.fromEntries(CATEGORY_OPTIONS.map((item) => [item, item]));
}

function extractMappedValue(text, map) {
  let rest = normalizeText(text);
  let value = "";

  Object.keys(map)
    .sort((a, b) => b.length - a.length)
    .some((keyword) => {
      if (!keyword) return false;
      const pattern = new RegExp(`(^|[\\s,，、；;])${escapeRegex(keyword)}(?=$|[\\s,，、；;])`, "i");
      if (!pattern.test(rest)) return false;
      value = map[keyword];
      rest = rest.replace(pattern, " ");
      return true;
    });

  return { value, rest: cleanupTitle(rest) };
}

function extractProject(text) {
  const cleaned = normalizeText(text);
  if (!cleaned) return "日常事务";

  const projects = uniqueProjects().sort((a, b) => b.length - a.length).filter(Boolean);
  const lower = cleaned.toLowerCase();
  const existing = projects.find((project) => lower.includes(project.toLowerCase()));
  if (existing) return existing;

  const match = cleaned.match(/^([\u4e00-\u9fa5A-Za-z0-9-]{2,12}?)(?:项目|客户|抖音|社媒|数据|需求|问题|反馈|组织|汇报|出差|专业版|样式|投放|活动|采集|脚本|代码|方案|流程|材料|统计|架构|体验官|团购)/);
  if (match) return normalizeProjectName(match[1]);

  const english = cleaned.match(/^([A-Za-z][A-Za-z0-9-]{2,})\b/);
  if (english) return normalizeProjectName(english[1]);

  return "日常事务";
}

function normalizeProjectName(value) {
  const text = normalizeText(value).replace(/[；;，,、]+$/g, "");
  if (!text) return "";

  const existing = uniqueProjects().find((item) => item.toLowerCase() === text.toLowerCase());
  return existing || text;
}

function inferCategory(text) {
  const value = normalizeText(text);
  if (/(出差|现场|差旅|航班)/.test(value)) return "会议出差";
  if (/(面试|实习生|培训|入职|招聘)/.test(value)) return "招聘培训";
  if (/(报销|发票|付款|行政|汇报|总结|交接)/.test(value)) return "行政协同";
  if (/(需求|沟通|评审|确认|对接|会议)/.test(value)) return "需求沟通";
  if (/(prd|原型|设计|文档|方案|流程|架构)/i.test(value)) return "产品设计";
  if (/(测试|上线|验证|排查|审查)/.test(value)) return "测试上线";
  if (/(数据|看板|BI|采集|脚本|核对|统计|报表|分析)/i.test(value)) return "数据处理";
  if (/(AI|自动化|模型|智能)/i.test(value)) return "AI探索";
  if (/(休假|请假)/.test(value)) return "休假";
  return "综合事务";
}

function inferPriority(text) {
  const value = normalizeText(text);
  if (/(紧急|异常|故障|上线|评审|现场|出差)/.test(value)) return "高";
  if (/(需求|PRD|更新|优化|采集|核对|方案|沟通|审查)/i.test(value)) return "中";
  return "普通";
}

function cleanupBatchLine(text) {
  return normalizeText(text)
    .replace(/^[（(【\[]?\d+[）)】\].、\s]*/, "")
    .replace(/^[一二三四五六七八九十]+[、.\s]*/, "")
    .replace(/[；;。]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupTitle(text) {
  return normalizeText(text)
    .replace(/[：:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueProjects() {
  return [...new Set(["日常事务", ...state.tasks.map((task) => task.project).filter(Boolean)])].sort((a, b) =>
    a.localeCompare(b, "zh-CN")
  );
}

function uniqueSummaryProjects() {
  return [...new Set(state.tasks.filter((task) => !shouldHideTaskInSummary(task)).map((task) => task.project).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "zh-CN")
  );
}

function renderProjectSuggestions() {
  els.projectSuggestions.innerHTML = uniqueProjects()
    .map((project) => `<option value="${escapeHtml(project)}"></option>`)
    .join("");
}

function persistAppData() {
  window.localStorage.setItem(
    PRIMARY_STORAGE_KEY,
    JSON.stringify({
      tasks: state.tasks,
      focusDate: state.focusDate,
      scope: state.scope,
      summaryMode: state.summaryMode,
      calendarCollapsed: state.calendarCollapsed
    })
  );
}

function readStoredAppData() {
  const keys = [PRIMARY_STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
  for (const key of keys) {
    const value = readJson(key);
    if (value?.tasks?.length) return value;
  }
  return null;
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

function getScopeRange(scope, dateKey) {
  const focus = parseDate(normalizeFocusDateByScope(scope, dateKey));

  if (scope === "month") {
    const start = new Date(focus.getFullYear(), focus.getMonth(), 1);
    const end = new Date(focus.getFullYear(), focus.getMonth() + 1, 0);
    return {
      scope,
      start: formatDate(start),
      end: formatDate(end),
      label: `${focus.getFullYear()}年${focus.getMonth() + 1}月`
    };
  }

  if (scope === "quarter") {
    const startMonth = Math.floor(focus.getMonth() / 3) * 3;
    const start = new Date(focus.getFullYear(), startMonth, 1);
    const end = new Date(focus.getFullYear(), startMonth + 3, 0);
    return {
      scope,
      start: formatDate(start),
      end: formatDate(end),
      label: `${focus.getFullYear()}年第${Math.floor(focus.getMonth() / 3) + 1}季度`
    };
  }

  if (scope === "year") {
    const start = new Date(focus.getFullYear(), 0, 1);
    const end = new Date(focus.getFullYear(), 11, 31);
    return {
      scope,
      start: formatDate(start),
      end: formatDate(end),
      label: `${focus.getFullYear()}年`
    };
  }

  return {
    scope,
    start: normalizeDate(dateKey),
    end: normalizeDate(dateKey),
    label: formatLongDate(normalizeDate(dateKey))
  };
}

function normalizeFocusDateByScope(scope, dateKey) {
  const date = parseDate(dateKey || todayStr());
  if (scope === "month") {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
  }
  if (scope === "quarter") {
    return `${date.getFullYear()}-${pad(Math.floor(date.getMonth() / 3) * 3 + 1)}-01`;
  }
  if (scope === "year") {
    return `${date.getFullYear()}-01-01`;
  }
  return formatDate(date);
}

function getWeekStart(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy;
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function addMonthsClamped(date, months) {
  const year = date.getFullYear();
  const month = date.getMonth() + months;
  const target = new Date(year, month, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
}

function parseDate(value) {
  const [year, month, day] = normalizeDate(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayStr() {
  return formatDate(new Date());
}

function formatLongDate(dateStr) {
  const date = parseDate(dateStr);
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
}

function getEffectiveDueDate(task) {
  return normalizeDate(task.dueDate || task.date);
}

function getEffectiveCompletedDate(task) {
  if (task.status !== "done") return "";
  return normalizeOptionalDate(task.completedDate || task.date);
}

function getActionCompletedDate() {
  if (state.activeView === "today") {
    return state.focusDate > todayStr() ? todayStr() : state.focusDate;
  }
  return todayStr();
}

function isTerminalStatus(status) {
  return status === "done" || status === "paused" || status === "abandoned";
}

function isDateInRange(date, start, end) {
  return date >= start && date <= end;
}

function diffDays(start, end) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  return Math.max(0, Math.round((endDate - startDate) / 86400000));
}

function renderStatsChips(stats, includeProjectCount = false) {
  const chips = [
    chip(`当前逾期 ${stats.currentOverdue}`, "alert"),
    chip(`完成 ${stats.completed}`, "soft"),
    chip(`逾期完成 ${stats.overdueDone}`, "soft"),
    chip(`新增 ${stats.createdOpen}`, "soft")
  ];

  if (includeProjectCount) {
    chips.push(chip(`项目 ${stats.projects || 0}`, "soft"));
  }

  return chips.join("");
}

function formatStatsCompact(stats) {
  if (!stats.total) return "";
  return `${stats.currentOverdue}/${stats.completed}/${stats.overdueDone}/${stats.createdOpen}`;
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

function actionButton(action, label, taskId, danger = false) {
  return `<button type="button" class="action-link ${danger ? "delete" : ""}" data-task-action="${action}" data-task-id="${taskId}">${label}</button>`;
}

function fillSelect(select, options, defaultValue) {
  const items = options.map((item) => (typeof item === "string" ? { value: item, label: item } : item));
  select.innerHTML = items
    .map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`)
    .join("");
  select.value = items.some((item) => item.value === defaultValue) ? defaultValue : items[0]?.value || "";
}

function statusLabel(value) {
  const match = STATUS_OPTIONS.find((item) => item.value === value);
  return match ? match.label : "已完成";
}

function defaultOpenStatusForTask(task) {
  if (!task) return "pending";
  return task.date > todayStr() ? "planned" : "pending";
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
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  toastTimer = window.setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 2200);
}

async function withBusy(button, text, task) {
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

function joinBaseUrl(baseUrl, path) {
  return `${String(baseUrl).replace(/\/+$/, "")}${path}`;
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function fingerprint(task) {
  return [
    normalizeDate(task.date),
    normalizeProjectName(task.project).toLowerCase(),
    cleanupTitle(task.title).toLowerCase(),
    getEffectiveDueDate(task)
  ].join("__");
}

function readJson(key) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
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

function isAnyModalOpen() {
  return !els.entryModal.classList.contains("hidden") || !els.settingsModal.classList.contains("hidden");
}

function syncModalLock(forceOpen = false) {
  const shouldLock = forceOpen || isAnyModalOpen();
  document.body.classList.toggle("modal-open", shouldLock);
}

function normalizeText(value) {
  return String(value || "").replace(/[\u3000]/g, " ").trim();
}

function clampNumber(value, min, max, fallback) {
  if (Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function camelize(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

