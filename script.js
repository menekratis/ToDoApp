"use strict";

import {
  dateOnlyToLocalDate,
  getSystemTimezone,
  offsetDate,
  dateOnlyInTimezone,
} from "./js/domain/dates.js";
import { getFinancialMetrics, toNonNegativeAmount as toAmount } from "./js/domain/finance.js";
import { getMovePhase, getMoveStatus } from "./js/domain/move.js";
import { createReminderFields, getReminderDateForInput } from "./js/domain/reminders.js";
import { compareTasksByPriority, getTaskDueStatus } from "./js/domain/tasks.js";
import { LocalStorageStateRepository } from "./js/repositories/local-storage-state-repository.js";

const CATEGORIES = ["Documents", "Health", "Finance", "Norway", "Packing", "Learning", "Work", "Personal"];
const PHASES = {
  "pre-move": {
    label: "Pre-move",
    shortLabel: "Pre-move",
    description: "Prepare the essentials and leave Athens with a clear head.",
  },
  arrival: {
    label: "Arrival",
    shortLabel: "Arrival",
    description: "Handle the first practical steps and make the new place functional.",
  },
  settling: {
    label: "Settling in",
    shortLabel: "Settling",
    description: "Build routines, find work, and create a stable base in Norway.",
  },
};

const ICONS = {
  check: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 12 3 3 7-7" /></svg>',
  edit: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Zm10-12 3 3" /></svg>',
  trash: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>',
};

let state;
const repository = new LocalStorageStateRepository();
const deviceTimezone = getSystemTimezone();
let activeView = "dashboard";
let selectedPlanPhase = "pre-move";
let pendingConfirmation = null;
let toastTimer = null;

const elements = {};

document.addEventListener("DOMContentLoaded", () => void init());

async function init() {
  cacheElements();
  populateCategoryControls();
  state = await repository.load();
  bindEvents();

  const requestedView = window.location.hash.replace("#", "");
  if (["dashboard", "tasks", "finances", "plan"].includes(requestedView)) {
    activeView = requestedView;
  }

  renderAll();
  setView(activeView, false);
}

function cacheElements() {
  const ids = [
    "todayLabel", "pageTitle", "phasePill", "countdownNumber", "countdownUnit", "heroOrigin",
    "heroDestination", "countdownDate", "heroProgressRing", "heroProgressValue", "heroProgressCaption",
    "dashboardPriorities", "dashboardAvailable", "dashboardSavingsMeter", "dashboardSavings",
    "dashboardTarget", "dashboardMoveCosts", "dashboardRemaining", "dashboardRunway", "completedTaskCount",
    "categoryProgress", "phasePreview", "taskStats", "taskSearch", "phaseFilter", "statusFilter",
    "categoryFilter", "taskList", "currencyBadge", "financeMetrics", "financeOverviewForm", "currentSavings",
    "savingsGoal", "expectedIncome", "moveExpenseList", "moveExpenseTotal", "monthlyExpenseList",
    "monthlyExpenseTotal", "runwayMonths", "runwayExplanation", "planRouteSummary", "phaseTimeline",
    "planPhaseTabs", "phaseChecklistHeading", "phaseTaskList", "taskDialog", "taskForm", "taskDialogTitle",
    "taskId", "taskTitle", "taskCategory", "taskPhase", "taskDueDate", "taskReminderDate", "taskNotes",
    "taskImportant", "expenseDialog", "expenseForm", "expenseDialogEyebrow", "expenseDialogTitle",
    "expenseId", "expenseType", "expenseName", "expenseAmount", "planDialog", "planForm", "planOrigin",
    "planDestination", "planMoveDate", "planCurrency", "confirmDialog", "confirmTitle", "confirmMessage",
    "confirmAction", "toast",
  ];

  ids.forEach((id) => {
    elements[id] = document.getElementById(id);
  });
}

function populateCategoryControls() {
  const options = CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join("");
  elements.taskCategory.innerHTML = options;
  elements.categoryFilter.insertAdjacentHTML("beforeend", options);
}

function bindEvents() {
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.viewTarget));
  });

  document.querySelectorAll("[data-view-link]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.viewLink));
  });

  ["quickAddTask", "addTaskFromPage"].forEach((id) => {
    document.getElementById(id).addEventListener("click", () => openTaskDialog());
  });

  ["openPlanSettings", "editPlanFromPage"].forEach((id) => {
    document.getElementById(id).addEventListener("click", openPlanDialog);
  });

  elements.taskForm.addEventListener("submit", handleTaskSubmit);
  elements.expenseForm.addEventListener("submit", handleExpenseSubmit);
  elements.planForm.addEventListener("submit", handlePlanSubmit);
  elements.financeOverviewForm.addEventListener("submit", handleFinanceSubmit);

  document.getElementById("addMoveExpense").addEventListener("click", () => openExpenseDialog("move"));
  document.getElementById("addMonthlyExpense").addEventListener("click", () => openExpenseDialog("monthly"));

  [elements.taskSearch, elements.phaseFilter, elements.statusFilter, elements.categoryFilter].forEach((control) => {
    control.addEventListener(control.tagName === "INPUT" ? "input" : "change", renderTasksView);
  });

  document.querySelector("main").addEventListener("click", handleMainAction);

  elements.planPhaseTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-plan-phase]");
    if (!button) return;
    selectedPlanPhase = button.dataset.planPhase;
    renderPlanView();
  });

  document.getElementById("exportData").addEventListener("click", exportData);
  document.getElementById("resetData").addEventListener("click", requestReset);

  elements.confirmDialog.addEventListener("close", async () => {
    if (elements.confirmDialog.returnValue === "confirm" && pendingConfirmation) {
      const action = pendingConfirmation;
      pendingConfirmation = null;
      try {
        await action();
      } catch (error) {
        console.error("Northbound could not complete the requested action.", error);
        showToast("That action could not be completed.");
      }
    } else {
      pendingConfirmation = null;
    }
  });

  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close("cancel");
    });
  });

  window.addEventListener("hashchange", () => {
    const view = window.location.hash.replace("#", "");
    if (["dashboard", "tasks", "finances", "plan"].includes(view) && view !== activeView) {
      setView(view, false);
    }
  });
}

async function persistState(message) {
  try {
    state = await repository.save(state);
    if (message) showToast(message);
    return true;
  } catch (error) {
    console.error("Northbound could not save data.", error);
    showToast("This change could not be saved on this device.");
    return false;
  }
}

function renderAll() {
  renderHeader();
  renderDashboard();
  renderTasksView();
  renderFinanceView();
  renderPlanView();
}

function renderHeader() {
  const now = new Date();
  elements.todayLabel.textContent = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  elements.phasePill.textContent = `${PHASES[getCurrentPhase()].label} phase`;
  updatePageTitle();
}

function updatePageTitle() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const titles = {
    dashboard: `${greeting} — here’s the plan`,
    tasks: "Tasks",
    finances: "Finances",
    plan: "Move plan",
  };
  elements.pageTitle.textContent = titles[activeView];
  document.title = activeView === "dashboard" ? "Northbound — Norway move dashboard" : `${titles[activeView]} — Northbound`;
}

function setView(view, updateHash = true) {
  activeView = view;
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("is-active", section.dataset.view === view);
  });
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    const active = button.dataset.viewTarget === view;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  updatePageTitle();
  if (updateHash && window.location.hash !== `#${view}`) history.pushState(null, "", `#${view}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDashboard() {
  const moveDate = state.settings.moveDate;
  const moveStatus = getMoveStatus(moveDate, currentDateOnly());
  const daysToMove = moveStatus.daysUntilMove;
  const preMoveTasks = state.tasks.filter((task) => task.phase === "pre-move");
  const preMoveCompleted = preMoveTasks.filter((task) => task.completed).length;
  const readiness = percentage(preMoveCompleted, preMoveTasks.length);

  if (daysToMove > 0) {
    elements.countdownNumber.textContent = daysToMove;
    elements.countdownUnit.textContent = daysToMove === 1 ? "day to go" : "days to go";
  } else if (daysToMove === 0) {
    elements.countdownNumber.textContent = "Today";
    elements.countdownUnit.textContent = "move day";
  } else {
    elements.countdownNumber.textContent = Math.abs(daysToMove);
    elements.countdownUnit.textContent = Math.abs(daysToMove) === 1 ? "day in Norway" : "days in Norway";
  }

  elements.heroOrigin.textContent = state.settings.origin;
  elements.heroDestination.textContent = state.settings.destination;
  elements.countdownDate.textContent = `Moving ${formatDate(moveDate, "long")}`;
  elements.heroProgressRing.style.setProperty("--progress", `${readiness}%`);
  elements.heroProgressValue.textContent = `${readiness}%`;
  elements.heroProgressCaption.textContent = readiness === 100
    ? "Your pre-move checklist is complete."
    : `${preMoveCompleted} of ${preMoveTasks.length} pre-move tasks complete.`;

  renderDashboardPriorities();
  renderDashboardFinances();
  renderCategoryProgress();
  renderPhasePreview();
}

function renderDashboardPriorities() {
  const currentPhase = getCurrentPhase();
  const candidates = state.tasks
    .filter((task) => !task.completed)
    .filter((task) => task.phase === currentPhase || getDueInfo(task).key === "overdue" || task.important)
    .sort(compareTaskPriority)
    .slice(0, 5);

  if (!candidates.length) {
    elements.dashboardPriorities.innerHTML = emptyState("✓", "Nothing urgent", "Your priority list is clear. Add a task when you are ready.");
    return;
  }

  elements.dashboardPriorities.innerHTML = candidates.map((task) => priorityTaskHTML(task)).join("");
}

function renderDashboardFinances() {
  const metrics = getFinancialMetrics(state.finance);
  elements.dashboardAvailable.textContent = formatMoney(metrics.availableByMove);
  elements.dashboardSavings.textContent = formatMoney(state.finance.currentSavings);
  elements.dashboardTarget.textContent = state.finance.savingsGoal > 0 ? formatMoney(state.finance.savingsGoal) : "Not set";
  elements.dashboardMoveCosts.textContent = formatMoney(metrics.moveCosts);
  elements.dashboardRemaining.textContent = formatMoney(metrics.remainingAfterMove);

  const savingsPercent = percentage(state.finance.currentSavings, state.finance.savingsGoal);
  elements.dashboardSavingsMeter.style.setProperty("--value", `${savingsPercent}%`);

  if (metrics.monthlyCosts <= 0) {
    elements.dashboardRunway.innerHTML = "Add your expected monthly living costs to calculate a runway.";
  } else if (metrics.remainingAfterMove <= 0) {
    const gap = Math.abs(metrics.remainingAfterMove);
    elements.dashboardRunway.innerHTML = `The current plan is <strong>${escapeHTML(formatMoney(gap))} short</strong> before monthly costs.`;
  } else {
    elements.dashboardRunway.innerHTML = `<strong>${formatRunway(metrics.runway)} months</strong> of estimated runway after moving.`;
  }
}

function renderCategoryProgress() {
  const relevantTasks = state.tasks.filter((task) => task.phase === "pre-move");
  const grouped = CATEGORIES.map((category) => {
    const tasks = relevantTasks.filter((task) => task.category === category);
    return { category, total: tasks.length, complete: tasks.filter((task) => task.completed).length };
  }).filter((group) => group.total > 0);

  elements.completedTaskCount.textContent = `${relevantTasks.filter((task) => task.completed).length}/${relevantTasks.length} complete`;
  elements.categoryProgress.innerHTML = grouped.map((group) => `
    <div class="category-progress-row">
      <span>${escapeHTML(group.category)}</span>
      <div class="meter"><i style="--value: ${percentage(group.complete, group.total)}%"></i></div>
      <small>${group.complete}/${group.total}</small>
    </div>
  `).join("");
}

function renderPhasePreview() {
  const currentPhase = getCurrentPhase();
  elements.phasePreview.innerHTML = Object.entries(PHASES).map(([key, phase], index) => {
    const tasks = state.tasks.filter((task) => task.phase === key);
    const open = tasks.filter((task) => !task.completed).length;
    return `
      <div class="phase-preview-item ${key === currentPhase ? "is-current" : ""}">
        <span class="phase-preview-marker">${index + 1}</span>
        <span><strong>${phase.label}</strong><small>${phasePreviewDate(key)}</small></span>
        <span class="phase-preview-count">${open} open</span>
      </div>
    `;
  }).join("");
}

function renderTasksView() {
  const openTasks = state.tasks.filter((task) => !task.completed);
  const overdue = openTasks.filter((task) => getDueInfo(task).key === "overdue").length;
  const important = openTasks.filter((task) => task.important).length;
  const completed = state.tasks.filter((task) => task.completed).length;

  elements.taskStats.innerHTML = [
    ["Open tasks", openTasks.length, ""],
    ["Overdue", overdue, overdue ? "is-alert" : ""],
    ["Important", important, ""],
    ["Completed", completed, ""],
  ].map(([label, value, className]) => `<div class="task-stat ${className}"><span>${label}</span><strong>${value}</strong></div>`).join("");

  const query = elements.taskSearch.value.trim().toLowerCase();
  const phase = elements.phaseFilter.value;
  const status = elements.statusFilter.value;
  const category = elements.categoryFilter.value;

  const filtered = state.tasks.filter((task) => {
    const matchesQuery = !query || `${task.title} ${task.notes || ""}`.toLowerCase().includes(query);
    const matchesPhase = phase === "all" || task.phase === phase;
    const matchesCategory = category === "all" || task.category === category;
    const dueKey = getDueInfo(task).key;
    const matchesStatus = status === "all"
      || (status === "open" && !task.completed)
      || (status === "completed" && task.completed)
      || (status === "overdue" && !task.completed && dueKey === "overdue");
    return matchesQuery && matchesPhase && matchesCategory && matchesStatus;
  }).sort(compareTaskPriority);

  elements.taskList.innerHTML = filtered.length
    ? filtered.map((task) => fullTaskHTML(task)).join("")
    : emptyState("○", "No matching tasks", "Try changing a filter or add a new task.");
}

function renderFinanceView() {
  const metrics = getFinancialMetrics(state.finance);
  const goalPercent = percentage(state.finance.currentSavings, state.finance.savingsGoal);
  const remainingText = metrics.remainingAfterMove < 0
    ? `${formatMoney(Math.abs(metrics.remainingAfterMove))} gap to cover`
    : "before ongoing living costs";

  elements.currencyBadge.textContent = `${state.settings.currency} planning currency`;
  document.querySelectorAll("[data-currency-symbol]").forEach((node) => {
    node.textContent = currencySymbol(state.settings.currency);
  });

  elements.financeMetrics.innerHTML = `
    <article class="finance-metric is-dark"><span>Saved now</span><strong>${formatMoney(state.finance.currentSavings)}</strong><small>${state.finance.savingsGoal > 0 ? `${goalPercent}% of your target` : "Set a target to track progress"}</small></article>
    <article class="finance-metric"><span>Available by move day</span><strong>${formatMoney(metrics.availableByMove)}</strong><small>Current savings + expected income</small></article>
    <article class="finance-metric"><span>Planned move costs</span><strong>${formatMoney(metrics.moveCosts)}</strong><small>${state.finance.moveExpenses.length} expense estimates</small></article>
    <article class="finance-metric"><span>After move costs</span><strong>${formatMoney(metrics.remainingAfterMove)}</strong><small>${remainingText}</small></article>
  `;

  elements.currentSavings.value = numberInputValue(state.finance.currentSavings);
  elements.savingsGoal.value = numberInputValue(state.finance.savingsGoal);
  elements.expectedIncome.value = numberInputValue(state.finance.expectedIncome);

  renderExpenseList("move");
  renderExpenseList("monthly");

  elements.moveExpenseTotal.textContent = formatMoney(metrics.moveCosts);
  elements.monthlyExpenseTotal.textContent = formatMoney(metrics.monthlyCosts);

  if (metrics.monthlyCosts <= 0) {
    elements.runwayMonths.textContent = "—";
    elements.runwayExplanation.textContent = "Add monthly cost estimates to calculate how long the remaining move fund could last.";
  } else {
    elements.runwayMonths.textContent = formatRunway(metrics.runway);
    elements.runwayExplanation.textContent = metrics.remainingAfterMove > 0
      ? `${formatMoney(metrics.remainingAfterMove)} remaining ÷ ${formatMoney(metrics.monthlyCosts)} estimated per month.`
      : "The current available amount does not yet cover all planned move costs.";
  }
}

function renderExpenseList(type) {
  const isMove = type === "move";
  const list = isMove ? state.finance.moveExpenses : state.finance.monthlyExpenses;
  const container = isMove ? elements.moveExpenseList : elements.monthlyExpenseList;

  if (!list.length) {
    container.innerHTML = emptyState("+", `No ${isMove ? "move" : "monthly"} expenses`, "Add an estimate when you know it.");
    return;
  }

  container.innerHTML = list.map((expense) => `
    <div class="expense-item">
      <span>${escapeHTML(expense.name)}</span>
      <strong>${escapeHTML(formatMoney(expense.amount))}</strong>
      <div class="expense-actions">
        <button class="task-action" type="button" data-action="edit-expense" data-expense-type="${type}" data-id="${escapeAttribute(expense.id)}" aria-label="Edit ${escapeAttribute(expense.name)}">${ICONS.edit}</button>
        <button class="task-action is-delete" type="button" data-action="delete-expense" data-expense-type="${type}" data-id="${escapeAttribute(expense.id)}" aria-label="Delete ${escapeAttribute(expense.name)}">${ICONS.trash}</button>
      </div>
    </div>
  `).join("");
}

function renderPlanView() {
  const currentPhase = getCurrentPhase();
  elements.planRouteSummary.textContent = `${state.settings.origin} to ${state.settings.destination} on ${formatDate(state.settings.moveDate, "long")}.`;

  elements.phaseTimeline.innerHTML = Object.entries(PHASES).map(([key, phase], index) => {
    const tasks = state.tasks.filter((task) => task.phase === key);
    const complete = tasks.filter((task) => task.completed).length;
    return `
      <article class="phase-card ${key === currentPhase ? "is-current" : ""}">
        <span class="phase-number">${index + 1}</span>
        <h3>${phase.label}</h3>
        <p>${phase.description}</p>
        <div class="phase-card-footer"><span>${phasePreviewDate(key)}</span><strong>${complete}/${tasks.length} done</strong></div>
      </article>
    `;
  }).join("");

  elements.planPhaseTabs.querySelectorAll("[data-plan-phase]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.planPhase === selectedPlanPhase);
  });
  elements.phaseChecklistHeading.textContent = PHASES[selectedPlanPhase].label;

  const phaseTasks = state.tasks.filter((task) => task.phase === selectedPlanPhase).sort(compareTaskPriority);
  elements.phaseTaskList.innerHTML = phaseTasks.length
    ? phaseTasks.map((task) => fullTaskHTML(task)).join("")
    : emptyState("○", "No tasks in this phase", "Add a task and assign it to this move phase.");
}

function priorityTaskHTML(task) {
  const due = getDueInfo(task);
  return `
    <article class="priority-item ${task.completed ? "is-completed" : ""}">
      <button class="task-complete-button" type="button" data-action="toggle-task" data-id="${escapeAttribute(task.id)}" aria-label="Mark ${escapeAttribute(task.title)} complete">${ICONS.check}</button>
      <div class="task-body">
        <div class="task-title-row"><span class="task-title">${escapeHTML(task.title)}</span>${task.important ? '<span class="important-dot" title="Important"></span>' : ""}</div>
        <div class="task-meta"><span class="category-tag" data-category="${escapeAttribute(task.category)}">${escapeHTML(task.category)}</span>${due.text ? `<span class="due-${due.key}">${escapeHTML(due.text)}</span>` : ""}</div>
      </div>
      <button class="task-action" type="button" data-action="edit-task" data-id="${escapeAttribute(task.id)}" aria-label="Edit ${escapeAttribute(task.title)}"><span class="priority-chevron">›</span></button>
    </article>
  `;
}

function fullTaskHTML(task) {
  const due = getDueInfo(task);
  const reminderDate = getReminderDateForInput(task, deviceTimezone);
  const reminder = reminderDate ? `<span>Reminder ${formatDate(reminderDate, "short")}</span>` : "";
  return `
    <article class="task-item ${task.completed ? "is-completed" : ""}">
      <button class="task-complete-button" type="button" data-action="toggle-task" data-id="${escapeAttribute(task.id)}" aria-label="${task.completed ? "Reopen" : "Complete"} ${escapeAttribute(task.title)}">${ICONS.check}</button>
      <div class="task-body">
        <div class="task-title-row"><span class="task-title">${escapeHTML(task.title)}</span>${task.important ? '<span class="important-dot" title="Important"></span>' : ""}</div>
        ${task.notes ? `<p class="task-note">${escapeHTML(task.notes)}</p>` : ""}
        <div class="task-meta">
          <span class="category-tag" data-category="${escapeAttribute(task.category)}">${escapeHTML(task.category)}</span>
          <span>${PHASES[task.phase]?.shortLabel || "Move task"}</span>
          ${due.text ? `<span class="due-${due.key}">${escapeHTML(due.text)}</span>` : ""}
          ${reminder}
        </div>
      </div>
      <div class="task-item-actions">
        <button class="task-action" type="button" data-action="edit-task" data-id="${escapeAttribute(task.id)}" aria-label="Edit ${escapeAttribute(task.title)}">${ICONS.edit}</button>
        <button class="task-action is-delete" type="button" data-action="delete-task" data-id="${escapeAttribute(task.id)}" aria-label="Delete ${escapeAttribute(task.title)}">${ICONS.trash}</button>
      </div>
    </article>
  `;
}

function emptyState(icon, title, message) {
  return `<div class="empty-state"><span class="empty-state-icon" aria-hidden="true">${icon}</span><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p></div>`;
}

function handleMainAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id, expenseType } = button.dataset;
  if (action === "toggle-task") toggleTask(id);
  if (action === "edit-task") openTaskDialog(id);
  if (action === "delete-task") requestTaskDelete(id);
  if (action === "edit-expense") openExpenseDialog(expenseType, id);
  if (action === "delete-expense") requestExpenseDelete(expenseType, id);
}

function openTaskDialog(taskId = "") {
  elements.taskForm.reset();
  elements.taskId.value = "";
  elements.taskPhase.value = getCurrentPhase();
  elements.taskCategory.value = "Documents";
  elements.taskDialogTitle.textContent = "Add a task";

  if (taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    elements.taskDialogTitle.textContent = "Edit task";
    elements.taskId.value = task.id;
    elements.taskTitle.value = task.title;
    elements.taskCategory.value = task.category;
    elements.taskPhase.value = task.phase;
    elements.taskDueDate.value = task.dueDate || "";
    elements.taskReminderDate.value = getReminderDateForInput(task, deviceTimezone);
    elements.taskNotes.value = task.notes || "";
    elements.taskImportant.checked = Boolean(task.important);
  }

  elements.taskDialog.showModal();
  requestAnimationFrame(() => elements.taskTitle.focus());
}

async function handleTaskSubmit(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  if (!elements.taskForm.reportValidity()) return;

  const id = elements.taskId.value;
  const existing = state.tasks.find((task) => task.id === id);
  const now = new Date().toISOString();
  const taskData = {
    title: elements.taskTitle.value.trim(),
    category: elements.taskCategory.value,
    phase: elements.taskPhase.value,
    dueDate: elements.taskDueDate.value,
    ...createReminderFields(elements.taskReminderDate.value, {
      timezone: existing?.reminderTimezone
        || state.notificationPreferences.defaultReminderTimezone
        || deviceTimezone,
      existingTask: existing,
    }),
    notes: elements.taskNotes.value.trim(),
    important: elements.taskImportant.checked,
    updatedAt: now,
  };

  if (existing) {
    Object.assign(existing, taskData);
    await persistState("Task updated");
  } else {
    state.tasks.push({
      id: createId(),
      completed: false,
      createdAt: now,
      ...taskData,
    });
    await persistState("Task added");
  }

  elements.taskDialog.close();
  renderAll();
}

async function toggleTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  task.completed = !task.completed;
  task.updatedAt = new Date().toISOString();
  await persistState(task.completed ? "Task completed" : "Task reopened");
  renderAll();
}

function requestTaskDelete(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  openConfirmation(
    "Delete this task?",
    `“${task.title}” will be permanently removed from this device.`,
    "Delete task",
    async () => {
      state.tasks = state.tasks.filter((item) => item.id !== taskId);
      await persistState("Task deleted");
      renderAll();
    },
  );
}

async function handleFinanceSubmit(event) {
  event.preventDefault();
  if (!elements.financeOverviewForm.reportValidity()) return;
  state.finance.currentSavings = toAmount(elements.currentSavings.value);
  state.finance.savingsGoal = toAmount(elements.savingsGoal.value);
  state.finance.expectedIncome = toAmount(elements.expectedIncome.value);
  await persistState("Savings plan updated");
  renderAll();
}

function openExpenseDialog(type, expenseId = "") {
  const isMove = type === "move";
  const list = isMove ? state.finance.moveExpenses : state.finance.monthlyExpenses;
  const expense = list.find((item) => item.id === expenseId);

  elements.expenseForm.reset();
  elements.expenseId.value = expenseId;
  elements.expenseType.value = type;
  elements.expenseDialogEyebrow.textContent = isMove ? "One-off move cost" : "Monthly living cost";
  elements.expenseDialogTitle.textContent = expense ? "Edit expense" : "Add expense";

  if (expense) {
    elements.expenseName.value = expense.name;
    elements.expenseAmount.value = numberInputValue(expense.amount);
  }

  elements.expenseDialog.showModal();
  requestAnimationFrame(() => elements.expenseName.focus());
}

async function handleExpenseSubmit(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  if (!elements.expenseForm.reportValidity()) return;

  const type = elements.expenseType.value;
  const list = type === "move" ? state.finance.moveExpenses : state.finance.monthlyExpenses;
  const existing = list.find((item) => item.id === elements.expenseId.value);
  const data = { name: elements.expenseName.value.trim(), amount: toAmount(elements.expenseAmount.value) };

  if (existing) Object.assign(existing, data);
  else list.push({ id: createId(), ...data });

  await persistState(existing ? "Expense updated" : "Expense added");
  elements.expenseDialog.close();
  renderAll();
}

function requestExpenseDelete(type, expenseId) {
  const key = type === "move" ? "moveExpenses" : "monthlyExpenses";
  const expense = state.finance[key].find((item) => item.id === expenseId);
  if (!expense) return;
  openConfirmation(
    "Delete this estimate?",
    `“${expense.name}” will be removed from your financial plan.`,
    "Delete expense",
    async () => {
      state.finance[key] = state.finance[key].filter((item) => item.id !== expenseId);
      await persistState("Expense deleted");
      renderAll();
    },
  );
}

function openPlanDialog() {
  elements.planOrigin.value = state.settings.origin;
  elements.planDestination.value = state.settings.destination;
  elements.planMoveDate.value = state.settings.moveDate;
  elements.planCurrency.value = state.settings.currency;
  elements.planDialog.showModal();
}

async function handlePlanSubmit(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  if (!elements.planForm.reportValidity()) return;

  state.settings.origin = elements.planOrigin.value.trim();
  state.settings.destination = elements.planDestination.value.trim();
  state.settings.moveDate = elements.planMoveDate.value;
  state.settings.currency = elements.planCurrency.value;
  await persistState("Move plan updated");
  elements.planDialog.close();
  renderAll();
}

function openConfirmation(title, message, actionLabel, onConfirm) {
  pendingConfirmation = onConfirm;
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  elements.confirmAction.textContent = actionLabel;
  elements.confirmDialog.showModal();
}

function requestReset() {
  openConfirmation(
    "Reset Northbound?",
    "All tasks, financial figures, and move-plan changes on this device will be replaced with the starting checklist.",
    "Reset everything",
    async () => {
      state = await repository.reset();
      elements.taskSearch.value = "";
      elements.phaseFilter.value = "all";
      elements.statusFilter.value = "open";
      elements.categoryFilter.value = "all";
      showToast("Northbound has been reset");
      renderAll();
    },
  );
}

function exportData() {
  const dateStamp = currentDateOnly();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `northbound-backup-${dateStamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Backup exported");
}

function getCurrentPhase() {
  return getMovePhase(state.settings.moveDate, currentDateOnly());
}

function phasePreviewDate(phase) {
  if (phase === "pre-move") return `Now – ${formatDate(state.settings.moveDate, "short")}`;
  if (phase === "arrival") return `${formatDate(state.settings.moveDate, "short")} – first 30 days`;
  return `From ${formatDate(offsetDate(state.settings.moveDate, 31), "short")}`;
}

function getDueInfo(task) {
  const status = getTaskDueStatus(task, currentDateOnly());
  if (status.key === "none") return { ...status, text: "" };
  if (status.key === "complete") {
    return { ...status, text: `Completed · due ${formatDate(task.dueDate, "short")}` };
  }
  if (status.key === "overdue") return { ...status, text: `${Math.abs(status.daysUntilDue)}d overdue` };
  if (status.key === "today") return { ...status, text: "Due today" };
  if (status.daysUntilDue === 1) return { ...status, text: "Due tomorrow" };
  if (status.key === "soon") return { ...status, text: `Due in ${status.daysUntilDue} days` };
  return { ...status, text: `Due ${formatDate(task.dueDate, "short")}` };
}

function compareTaskPriority(a, b) {
  return compareTasksByPriority(a, b, currentDateOnly());
}

function formatDate(value, style = "short") {
  if (!value) return "";
  const date = dateOnlyToLocalDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const options = style === "long"
    ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
    : { day: "numeric", month: "short", year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined };
  return new Intl.DateTimeFormat("en-GB", options).format(date);
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: state.settings.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatRunway(value) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value > 99) return "99+";
  return value.toFixed(1).replace(".0", "");
}

function currencySymbol(currency) {
  const parts = new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0);
  return parts.find((part) => part.type === "currency")?.value || currency;
}

function percentage(value, total) {
  const safeValue = Number(value) || 0;
  const safeTotal = Number(total) || 0;
  if (safeTotal <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((safeValue / safeTotal) * 100)));
}


function numberInputValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : "0";
}

function currentDateOnly() {
  return dateOnlyInTimezone(new Date(), deviceTimezone);
}

function createId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}

function escapeAttribute(value) {
  return escapeHTML(value);
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
}
