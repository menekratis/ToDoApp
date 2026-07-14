import {
  dateOnlyFromUtc,
  getSystemTimezone,
  isValidDateOnly,
  isValidTimezone,
  zonedDateTimeToUtc,
} from "./dates.js";

export const LEGACY_REMINDER_TIME = "09:00";

export function createReminderFields(dateOnly, {
  timezone = getSystemTimezone(),
  time = LEGACY_REMINDER_TIME,
  existingTask = null,
} = {}) {
  if (!dateOnly) return { reminderAtUtc: null, reminderTimezone: null };
  if (!isValidDateOnly(dateOnly)) throw new TypeError("Reminder dates must use YYYY-MM-DD");

  const safeTimezone = isValidTimezone(timezone) ? timezone : "UTC";
  if (hasValidReminder(existingTask)) {
    const existingTimezone = isValidTimezone(existingTask.reminderTimezone)
      ? existingTask.reminderTimezone
      : safeTimezone;
    if (dateOnlyFromUtc(existingTask.reminderAtUtc, existingTimezone) === dateOnly) {
      return {
        reminderAtUtc: new Date(existingTask.reminderAtUtc).toISOString(),
        reminderTimezone: existingTimezone,
      };
    }
  }

  return {
    reminderAtUtc: zonedDateTimeToUtc(dateOnly, time, safeTimezone),
    reminderTimezone: safeTimezone,
  };
}

export function normalizeTaskReminder(task, { defaultTimezone = getSystemTimezone() } = {}) {
  const normalized = { ...task };
  const safeDefaultTimezone = isValidTimezone(defaultTimezone) ? defaultTimezone : "UTC";

  if (hasValidReminder(task)) {
    normalized.reminderAtUtc = new Date(task.reminderAtUtc).toISOString();
    normalized.reminderTimezone = isValidTimezone(task.reminderTimezone)
      ? task.reminderTimezone
      : safeDefaultTimezone;
    delete normalized.reminderDate;
    return normalized;
  }

  if (isValidDateOnly(task?.reminderDate)) {
    Object.assign(normalized, createReminderFields(task.reminderDate, {
      timezone: isValidTimezone(task.reminderTimezone) ? task.reminderTimezone : safeDefaultTimezone,
    }));
    delete normalized.reminderDate;
    return normalized;
  }

  normalized.reminderAtUtc = null;
  normalized.reminderTimezone = null;
  // Preserve an unrecognised legacy value for manual recovery rather than silently deleting it.
  if (!task?.reminderDate) delete normalized.reminderDate;
  return normalized;
}

export function getReminderDateForInput(task, fallbackTimezone = getSystemTimezone()) {
  if (hasValidReminder(task)) {
    const timezone = isValidTimezone(task.reminderTimezone) ? task.reminderTimezone : fallbackTimezone;
    return dateOnlyFromUtc(task.reminderAtUtc, timezone);
  }
  return isValidDateOnly(task?.reminderDate) ? task.reminderDate : "";
}

export function hasValidReminder(task) {
  if (!task?.reminderAtUtc) return false;
  return !Number.isNaN(new Date(task.reminderAtUtc).getTime());
}
