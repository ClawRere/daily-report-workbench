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

  const STATUS_LABELS = {
    planned: "待办",
    pending: "进行中",
    done: "已完成",
    delayed: "已逾期",
    paused: "任务暂停",
    abandoned: "放弃任务"
  };

  let scheduled = false;

  function start() {
    bindCustomActions();
    scheduleRefresh();

    document.addEventListener("click", scheduleRefresh, true);
    document.addEventListener("input", scheduleRefresh, true);
    document.addEventListener("change", scheduleRefresh, true);
    window.addEventListener("hashchange", scheduleRefresh);
  }

  function bindCustomActions() {
    window.__generateAiSummaryReportImpl = async (event) => {
      const context = getAiSummaryContext();
      if (!context) return;

      const settings = readJson(SETTINGS_KEY) || {};
      if (!String(settings.apiKey || "").trim()) {
        showToast("请先在设置中填写 API Key");
        return;
      }

      const button = event?.currentTarget || document.getElementById("ai-summary-btn");
      await withBusy(button, "生成中...", async () => {
        try {
          const aiText = await callFreeformModel(
            settings,
            [
              "你是中文工作汇报助手。",
              "请根据给定工作记录输出简洁、专业、可直接汇报的中文内容。",
              "不要编造信息。",
              "输出结构固定为：一、本期概览；二、重点项目推进；三、关键成果；四、风险与逾期项；五、下一阶段建议；六、PPT大纲。"
            ].join("\n"),
            buildAiSummaryUserPrompt(context)
          );

          getSummaryOutput().value = [
            "【AI总结】",
            String(aiText || "").trim(),
            "",
            "【PPT提示词】",
            buildPptPromptText(context)
          ]
            .filter(Boolean)
            .join("\n");

          showToast("AI总结已生成");
        } catch (error) {
          console.error(error);
          showToast("AI总结生成失败，请检查模型设置或网络");
        }
      });
    };

    window.__generatePptOutlinePromptImpl = () => {
      const context = getAiSummaryContext();
      if (!context) return;
      getSummaryOutput().value = buildPptPromptText(context);
      showToast("PPT提示词已生成");
    };
  }

  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(() => {
      scheduled = false;
      refreshProjectSummary();
    }, 0);
  }

  function refreshProjectSummary() {
    if (location.hash !== "#summary") return;

    const state = readAppState();
    if (!state || state.summaryMode !== "project") return;

    const root = document.getElementById("project-summary");
    if (!root || root.classList.contains("hidden")) return;

    const range = getScopeRange(state.scope || "day", state.focusDate || todayStr());
    const tasks = getFilteredSummaryTasks(state, range);

    if (!tasks.length) {
      root.innerHTML = '<div class="empty">当前筛选条件下没有项目记录</div>';
      return;
    }

    const groups = buildProjectGroups(tasks, range);
    root.innerHTML = groups
      .map((group) => {
        const rows = group.days
          .flatMap((day) =>
            day.items.map((item, index) => {
              const displayStatus = getEntryDisplayStatus(item.task, item.date);
              const statusText = formatProjectStatusText(item.task, displayStatus);
              const dateLabel = index === 0 ? formatExactDate(day.date) : "";
              const overdueClass = statusText === "逾期完成" || displayStatus === "delayed" ? " project-line-overdue" : "";

              return `
                <div class="project-line">
                  <span class="project-line-date ${dateLabel ? "" : "blank"}">${escapeHtml(dateLabel)}</span>
                  <span class="project-line-title">${escapeHtml(item.task.title)}</span>
                  <span class="project-line-status${overdueClass}">${escapeHtml(statusText)}</span>
                  <span class="project-line-priority">${escapeHtml(item.task.priority || "中")}</span>
                </div>
              `;
            })
          )
          .join("");

        return `
          <article class="project-card">
            <div class="project-card-head">
              <div class="project-name">${escapeHtml(group.project)}</div>
              <div class="project-stats">${renderStatsChips(group.stats, true)}</div>
            </div>
            <div class="project-card-body project-card-body-compact">
              <div class="project-line-head">
                <span>日期</span>
                <span>事务</span>
                <span>完成情况</span>
                <span>紧急程度</span>
              </div>
              <div class="project-day-list project-day-list-compact">${rows || '<div class="empty">暂无记录</div>'}</div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function getAiSummaryContext() {
    const state = readAppState();
    if (!state) return null;

    if ((state.scope || "day") === "day") {
      showToast("AI总结支持按月、按季度、按年");
      return null;
    }

    const range = getScopeRange(state.scope, state.focusDate || todayStr());
    const tasks = getFilteredSummaryTasks(state, range);
    if (!tasks.length) {
      showToast("当前范围没有可汇总内容");
      return null;
    }

    return {
      state,
      range,
      tasks,
      overview: summarizeTasks(tasks, range)
    };
  }

  function buildAiSummaryUserPrompt(context) {
    const { range, tasks, overview } = context;
    return [
      `汇报周期：${range.label}`,
      `统计数据：当前逾期 ${overview.currentOverdue}，已完成 ${overview.completed}，逾期完成 ${overview.overdueDone}，新增未完成 ${overview.createdOpen}，涉及项目 ${overview.projects}`,
      "请输出：",
      "1. 本期概览：3-5条。",
      "2. 重点项目推进：按项目归纳。",
      "3. 关键成果：突出交付或解决事项。",
      "4. 风险与逾期项：单列说明。",
      "5. 下一阶段建议：给出下一步重点。",
      "6. PPT大纲：输出 6-8 页，每页给标题和 2-3 条要点。",
      "要求用中文，不要表格，不要编造信息。",
      "",
      "原始任务记录：",
      buildTaskDigestText(tasks, range)
    ].join("\n");
  }

  function buildPptPromptText(context) {
    const { state, range, tasks, overview } = context;
    return [
      `请基于以下工作记录，生成一份《${range.label}${getReportTypeLabel(state.scope)}工作汇报》PPT大纲。`,
      "要求：",
      "1. 使用中文，适合管理层汇报。",
      "2. 页数控制在 6-10 页。",
      "3. 先给整套目录，再给每页标题与 2-4 条要点。",
      "4. 重点突出项目推进、完成成果、逾期风险、后续计划。",
      "5. 不要编造数据，不要写空话。",
      "",
      `统计信息：当前逾期 ${overview.currentOverdue}，已完成 ${overview.completed}，逾期完成 ${overview.overdueDone}，新增未完成 ${overview.createdOpen}，涉及项目 ${overview.projects}`,
      "",
      "工作记录：",
      buildTaskDigestText(tasks, range)
    ].join("\n");
  }

  function buildTaskDigestText(tasks, range) {
    const compareDate = getSummaryFilterCompareDate(range);
    return tasks
      .map((task) => {
        const displayStatus = getDisplayStatus(task, compareDate);
        const statusText = formatProjectStatusText(task, displayStatus);
        const parts = [
          `项目：${task.project}`,
          `录入日期：${formatExactDate(task.date)}`,
          `计划完成：${task.dueDate ? formatExactDate(task.dueDate) : "-"}`,
          `实际完成：${task.completedDate ? formatExactDate(task.completedDate) : "-"}`,
          `完成情况：${statusText}`,
          `紧急程度：${task.priority}`,
          `事务：${task.title}`
        ];

        if (task.plan) parts.push(`计划说明：${task.plan}`);
        if (task.notes) parts.push(`备注：${task.notes}`);

        return `- ${parts.join(" | ")}`;
      })
      .join("\n");
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

  function buildSummaryEntries(tasks, range) {
    return tasks
      .flatMap((task) => getTaskTimelineDates(task, range).map((date) => ({ task, date })))
      .sort(compareSummaryEntries);
  }

  function getFilteredSummaryTasks(state, range) {
    const searchInput = document.getElementById("search-input");
    const projectFilter = document.getElementById("project-filter");
    const statusFilter = document.getElementById("status-filter");
    const priorityFilter = document.getElementById("priority-filter");

    const search = String(searchInput?.value || "").trim().toLowerCase();
    const projectValue = projectFilter?.value || "all";
    const statusValue = statusFilter?.value || "all";
    const priorityValue = priorityFilter?.value || "all";
    const compareDate = getSummaryFilterCompareDate(range);

    return (state.tasks || [])
      .map(normalizeTask)
      .filter((task) => !shouldHideTaskInSummary(task))
      .filter((task) => isTaskRelevantToRange(task, range))
      .filter((task) => (projectValue === "all" ? true : task.project === projectValue))
      .filter((task) => (priorityValue === "all" ? true : task.priority === priorityValue))
      .filter((task) => (statusValue === "all" ? true : getDisplayStatus(task, compareDate) === statusValue))
      .filter((task) => {
        if (!search) return true;
        return [task.project, task.title, task.plan, task.notes, task.category].join(" ").toLowerCase().includes(search);
      })
      .sort((a, b) => compareSummaryTasks(a, b, range));
  }

  function summarizeTasks(tasks, range) {
    const stats = {
      currentOverdue: 0,
      completed: 0,
      overdueDone: 0,
      createdOpen: 0,
      total: 0,
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

    stats.total = stats.currentOverdue + stats.completed + stats.overdueDone + stats.createdOpen;
    return stats;
  }

  function renderStatsChips(stats, includeProjectCount) {
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

  function compareSummaryEntries(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;

    const aStatus = getEntryDisplayStatus(a.task, a.date);
    const bStatus = getEntryDisplayStatus(b.task, b.date);
    const toneDiff = toneRank(getToneByStatus(a.task, aStatus)) - toneRank(getToneByStatus(b.task, bStatus));
    if (toneDiff !== 0) return toneDiff;

    const priorityDiff = priorityRank(a.task.priority) - priorityRank(b.task.priority);
    if (priorityDiff !== 0) return priorityDiff;

    return a.task.title.localeCompare(b.task.title, "zh-CN");
  }

  function compareSummaryTasks(a, b, range) {
    const aDate = getTaskSortAnchor(a, range);
    const bDate = getTaskSortAnchor(b, range);
    if (aDate !== bDate) return aDate < bDate ? 1 : -1;

    const toneDiff = toneRank(getToneByStatus(a, getDisplayStatus(a, getSummaryFilterCompareDate(range)))) - toneRank(
      getToneByStatus(b, getDisplayStatus(b, getSummaryFilterCompareDate(range)))
    );
    if (toneDiff !== 0) return toneDiff;

    const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDiff !== 0) return priorityDiff;

    return a.title.localeCompare(b.title, "zh-CN");
  }

  function getTaskSortAnchor(task, range) {
    const completedDate = getEffectiveCompletedDate(task);
    if (completedDate && isDateInRange(completedDate, range.start, range.end)) return completedDate;
    if (isDateInRange(todayStr(), range.start, range.end) && !isTerminalStatus(task.status) && task.date < todayStr()) return todayStr();
    return task.date;
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

  function isTaskRelevantToRange(task, range) {
    return getTaskTimelineDates(task, range).length > 0;
  }

  function shouldHideTaskInSummary(task) {
    const text = [task.project, task.title, task.category, task.notes, task.plan].join(" ");
    return task.category === "休假" || /请假|休假/.test(text);
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

  function isTaskCurrentlyOverdue(task) {
    if (isTerminalStatus(task.status)) return false;
    return task.date <= todayStr() && getEffectiveDueDate(task) < todayStr();
  }

  function isOverdueCompletionTask(task) {
    if (task.status !== "done") return false;
    const completedDate = getEffectiveCompletedDate(task);
    return Boolean(completedDate && completedDate > getEffectiveDueDate(task));
  }

  function getEffectiveDueDate(task) {
    return normalizeDate(task.dueDate || task.date);
  }

  function getEffectiveCompletedDate(task) {
    if (task.status !== "done") return "";
    return normalizeDate(task.completedDate || task.date);
  }

  function normalizeTask(task) {
    return {
      ...task,
      date: normalizeDate(task.date),
      dueDate: normalizeDate(task.dueDate || task.date),
      completedDate: task.completedDate ? normalizeDate(task.completedDate) : "",
      project: normalizeText(task.project) || "日常事务",
      title: normalizeText(task.title) || "未命名任务",
      status: normalizeText(task.status) || "done",
      priority: normalizeText(task.priority) || "中",
      category: normalizeText(task.category) || "综合事务",
      plan: normalizeText(task.plan),
      notes: normalizeText(task.notes)
    };
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
      return { scope, start: formatDate(start), end: formatDate(end), label: `${focus.getFullYear()}年` };
    }

    const normalized = normalizeDate(dateKey || todayStr());
    return { scope: "day", start: normalized, end: normalized, label: formatExactDate(normalized) };
  }

  function getSummaryFilterCompareDate(range) {
    return range.end > todayStr() ? todayStr() : range.end;
  }

  function getReportTypeLabel(scope) {
    if (scope === "month") return "月度";
    if (scope === "quarter") return "季度";
    return "年度";
  }

  function readAppState() {
    const stored = readStoredAppData();
    if (!stored) return null;
    return {
      tasks: Array.isArray(stored.tasks) ? stored.tasks : [],
      focusDate: stored.focusDate || todayStr(),
      scope: stored.scope || "day",
      summaryMode: stored.summaryMode || "date"
    };
  }

  function readStoredAppData() {
    for (const key of [PRIMARY_STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
      const value = readJson(key);
      if (value?.tasks?.length || value?.focusDate) return value;
    }
    return null;
  }

  function readJson(key) {
    try {
      const value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  async function callFreeformModel(settings, systemPrompt, userPrompt) {
    const response = await fetch(joinBaseUrl(settings.baseUrl || "https://api.openai.com/v1", "/chat/completions"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model || "gpt-4.1-mini",
        temperature: Number.isFinite(Number(settings.temperature)) ? Number(settings.temperature) : 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`request-failed-${response.status}`);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (Array.isArray(content)) return content.map((item) => item?.text || "").join("");
    return typeof content === "string" ? content : "";
  }

  function withBusy(button, text, task) {
    if (!button) return task();
    const original = button.textContent;
    button.disabled = true;
    button.textContent = text;
    return Promise.resolve(task()).finally(() => {
      button.disabled = false;
      button.textContent = original;
    });
  }

  function getSummaryOutput() {
    return document.getElementById("summary-output");
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 2200);
  }

  function chip(text, kind) {
    return `<span class="stat-chip ${kind ? `stat-chip-${kind}` : ""}">${escapeHtml(text)}</span>`;
  }

  function formatProjectStatusText(task, displayStatus) {
    if (task.status === "done" && isOverdueCompletionTask(task)) return "逾期完成";
    return STATUS_LABELS[displayStatus] || STATUS_LABELS.done;
  }

  function getToneByStatus(task, status) {
    if (task.status === "done") return "complete";
    if (status === "delayed") return "overdue";
    return "active";
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

  function isDateInRange(date, start, end) {
    return date >= start && date <= end;
  }

  function normalizeDate(value) {
    if (!value) return todayStr();
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) return String(value).trim();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? todayStr() : formatDate(date);
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

  function formatExactDate(dateStr) {
    const date = parseDate(dateStr);
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
  }

  function joinBaseUrl(baseUrl, path) {
    return `${String(baseUrl).replace(/\/+$/, "")}${path}`;
  }

  function normalizeText(value) {
    return String(value || "").replace(/[\u3000]/g, " ").trim();
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
