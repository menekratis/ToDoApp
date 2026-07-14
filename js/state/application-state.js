import { getSystemTimezone, isValidTimezone, offsetDate } from "../domain/dates.js";
import {
  createReminderFields,
  LEGACY_REMINDER_TIME,
  normalizeTaskReminder,
} from "../domain/reminders.js";

export const CURRENT_DATA_VERSION = 2;
export const SEEDED_MOVE_DATE = "2026-09-10";

export function createDefaultNotificationPreferences(reminderTimezone = getSystemTimezone()) {
  return {
    taskReminders: true,
    overdueImportantTasks: true,
    moveMilestones: true,
    financialWarnings: true,
    preparationWarnings: true,
    defaultReminderTime: LEGACY_REMINDER_TIME,
    defaultReminderTimezone: reminderTimezone,
    quietHours: {
      enabled: false,
      start: "22:00",
      end: "08:00",
    },
  };
}

export function createDefaultState({
  moveDate = SEEDED_MOVE_DATE,
  reminderTimezone = getSystemTimezone(),
  now = new Date(),
} = {}) {
  const createdAt = now.toISOString();
  const task = (title, category, phase, dueOffset, important, notes) => {
    const dueDate = offsetDate(moveDate, dueOffset);
    const reminderDate = dueOffset < 0 ? offsetDate(moveDate, dueOffset - 3) : "";
    return {
      id: createId(),
      title,
      category,
      phase,
      dueDate,
      ...createReminderFields(reminderDate, { timezone: reminderTimezone }),
      important,
      notes,
      completed: false,
      createdAt,
      updatedAt: createdAt,
    };
  };

  return {
    version: CURRENT_DATA_VERSION,
    settings: {
      origin: "Athens",
      destination: "Kristiansand",
      moveDate,
      currency: "EUR",
    },
    notificationPreferences: createDefaultNotificationPreferences(reminderTimezone),
    finance: {
      currentSavings: 0,
      savingsGoal: 0,
      expectedIncome: 0,
      moveExpenses: [
        { id: createId(), name: "Travel and luggage", amount: 0 },
        { id: createId(), name: "PC and monitor shipping", amount: 0 },
        { id: createId(), name: "Winter clothing", amount: 0 },
        { id: createId(), name: "Documents and fees", amount: 0 },
      ],
      monthlyExpenses: [
        { id: createId(), name: "Housing", amount: 0 },
        { id: createId(), name: "Food and groceries", amount: 0 },
        { id: createId(), name: "Transport", amount: 0 },
        { id: createId(), name: "Other essentials", amount: 0 },
      ],
    },
    tasks: [
      task("Complete driving licence requirements", "Documents", "pre-move", -52, true, "Confirm every remaining step and collect the required paperwork."),
      task("Book final doctor and dental appointments", "Health", "pre-move", -42, true, "Leave enough time for follow-ups and prescription copies."),
      task("Gather and scan essential documents", "Documents", "pre-move", -34, true, "Keep paper originals together and save a secure digital copy."),
      task("Confirm PC and monitor shipping plan", "Packing", "pre-move", -27, true, "Compare safe packing, insurance, tracking, and delivery timing."),
      task("Buy Norway-ready winter layers", "Personal", "pre-move", -18, false, "Prioritise waterproof outerwear and practical layers."),
      task("Finish the full packing checklist", "Packing", "pre-move", -14, true, "Separate carry-on essentials from shipped items."),
      task("Complete current software study milestone", "Learning", "pre-move", -10, false, "Choose one achievable milestone to finish before moving."),
      task("Keep a weekly Norwegian practice streak", "Learning", "pre-move", -7, false, "Focus on useful phrases for travel, shopping, and administration."),
      task("Prepare the move-day document folder", "Documents", "pre-move", -4, true, "Include travel details, ID, address, contacts, and essential records."),
      task("Settle the essential rooms first", "Personal", "arrival", 3, true, "Start with sleeping, bathroom, kitchen, and a small work area."),
      task("Complete the local administration checklist", "Norway", "arrival", 6, true, "List the registrations and services that apply to your situation."),
      task("Set up the first monthly budget", "Finance", "arrival", 9, true, "Replace estimates with the first real costs you observe."),
      task("Update CV and begin the job search routine", "Work", "settling", 24, true, "Create a repeatable weekly plan for applications and networking."),
      task("Build a stable study and language routine", "Learning", "settling", 36, false, "Keep the routine small enough to survive busy weeks."),
    ],
  };
}

export function normalizeApplicationState(candidate, {
  defaultTimezone = getSystemTimezone(),
  fallbackState = createDefaultState({ reminderTimezone: defaultTimezone }),
} = {}) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const sourceFinance = objectOrEmpty(source.finance);
  const sourceSettings = objectOrEmpty(source.settings);
  const sourcePreferences = objectOrEmpty(source.notificationPreferences);
  const sourceQuietHours = objectOrEmpty(sourcePreferences.quietHours);
  const defaultPreferences = createDefaultNotificationPreferences(defaultTimezone);
  const preferenceTimezone = isValidTimezone(sourcePreferences.defaultReminderTimezone)
    ? sourcePreferences.defaultReminderTimezone
    : defaultTimezone;

  return {
    ...source,
    version: CURRENT_DATA_VERSION,
    settings: {
      ...fallbackState.settings,
      ...sourceSettings,
    },
    notificationPreferences: {
      ...defaultPreferences,
      ...sourcePreferences,
      defaultReminderTimezone: preferenceTimezone,
      quietHours: {
        ...defaultPreferences.quietHours,
        ...sourceQuietHours,
      },
    },
    finance: {
      ...fallbackState.finance,
      ...sourceFinance,
      moveExpenses: Array.isArray(sourceFinance.moveExpenses)
        ? sourceFinance.moveExpenses.map((expense) => ({ ...expense }))
        : fallbackState.finance.moveExpenses,
      monthlyExpenses: Array.isArray(sourceFinance.monthlyExpenses)
        ? sourceFinance.monthlyExpenses.map((expense) => ({ ...expense }))
        : fallbackState.finance.monthlyExpenses,
    },
    tasks: Array.isArray(source.tasks)
      ? source.tasks.map((task) => normalizeTaskReminder(task, { defaultTimezone: preferenceTimezone }))
      : fallbackState.tasks,
  };
}

function objectOrEmpty(value) {
  return value && typeof value === "object" ? value : {};
}

function createId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
