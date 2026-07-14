import test from "node:test";
import assert from "node:assert/strict";

import {
  dateOnlyFromUtc,
  differenceInDays,
  offsetDate,
  zonedDateTimeToUtc,
} from "../js/domain/dates.js";
import { getFinancialMetrics } from "../js/domain/finance.js";
import { getMovePhase, getMoveStatus } from "../js/domain/move.js";
import {
  createReminderFields,
  getReminderDateForInput,
  normalizeTaskReminder,
} from "../js/domain/reminders.js";
import { getTaskDueStatus, sortTasksByPriority } from "../js/domain/tasks.js";
import { createDefaultState } from "../js/state/application-state.js";

test("financial metrics calculate move balance and runway", () => {
  const metrics = getFinancialMetrics({
    currentSavings: 8_000,
    expectedIncome: 2_500,
    moveExpenses: [{ amount: 1_000 }, { amount: 500 }],
    monthlyExpenses: [{ amount: 1_200 }, { amount: 600 }],
  });

  assert.deepEqual(metrics, {
    moveCosts: 1_500,
    monthlyCosts: 1_800,
    availableByMove: 10_500,
    remainingAfterMove: 9_000,
    runway: 5,
  });
});

test("financial runway handles missing monthly costs and a funding gap", () => {
  assert.equal(getFinancialMetrics({ currentSavings: 100 }).runway, null);
  assert.equal(getFinancialMetrics({
    currentSavings: 100,
    moveExpenses: [{ amount: 200 }],
    monthlyExpenses: [{ amount: 50 }],
  }).runway, 0);
});

test("date-only differences ignore daylight-saving clock changes", () => {
  assert.equal(differenceInDays("2026-03-28", "2026-03-30"), 2);
  assert.equal(differenceInDays("2028-02-28", "2028-03-01"), 2);
  assert.equal(offsetDate("2026-12-31", 1), "2027-01-01");
});

test("move phase boundaries derive from the supplied move date", () => {
  assert.equal(getMovePhase("2026-09-10", "2026-09-09"), "pre-move");
  assert.equal(getMovePhase("2026-09-10", "2026-09-10"), "arrival");
  assert.equal(getMovePhase("2026-09-10", "2026-10-10"), "arrival");
  assert.equal(getMovePhase("2026-09-10", "2026-10-11"), "settling");
});

test("changing the configured move date changes countdown and phase", () => {
  const today = "2026-07-14";
  const original = getMoveStatus("2026-09-10", today);
  const changed = getMoveStatus("2026-07-10", today);

  assert.equal(original.daysUntilMove, 58);
  assert.equal(original.phase, "pre-move");
  assert.equal(changed.daysUntilMove, -4);
  assert.equal(changed.phase, "arrival");
});

test("seed task dates are derived from the configurable seed move date", () => {
  const first = createDefaultState({ moveDate: "2026-09-10", reminderTimezone: "UTC" });
  const changed = createDefaultState({ moveDate: "2027-01-20", reminderTimezone: "UTC" });

  assert.equal(first.settings.moveDate, "2026-09-10");
  assert.equal(changed.settings.moveDate, "2027-01-20");
  assert.notEqual(first.tasks[0].dueDate, changed.tasks[0].dueDate);
  assert.equal(changed.tasks[0].dueDate, offsetDate("2027-01-20", -52));
});

test("task due status distinguishes overdue, today, soon, scheduled, and complete", () => {
  const today = "2026-07-14";
  assert.equal(getTaskDueStatus({}, today).key, "none");
  assert.deepEqual(getTaskDueStatus({ dueDate: "2026-07-12" }, today), {
    key: "overdue",
    daysUntilDue: -2,
  });
  assert.equal(getTaskDueStatus({ dueDate: today }, today).key, "today");
  assert.equal(getTaskDueStatus({ dueDate: "2026-07-20" }, today).key, "soon");
  assert.equal(getTaskDueStatus({ dueDate: "2026-07-22" }, today).key, "scheduled");
  assert.equal(getTaskDueStatus({ dueDate: "2026-07-12", completed: true }, today).key, "complete");
});

test("task priority puts overdue and today before important, future, and completed work", () => {
  const today = "2026-07-14";
  const tasks = [
    { id: "complete", dueDate: "2026-07-01", completed: true },
    { id: "future", dueDate: "2026-08-01", completed: false },
    { id: "important", dueDate: "2026-08-02", important: true, completed: false },
    { id: "today", dueDate: today, completed: false },
    { id: "overdue", dueDate: "2026-07-10", completed: false },
  ];

  assert.deepEqual(
    sortTasksByPriority(tasks, today).map((task) => task.id),
    ["overdue", "today", "important", "future", "complete"],
  );
});

test("legacy reminder dates normalise to 09:00 in their IANA timezone", () => {
  const winter = normalizeTaskReminder(
    { id: "winter", reminderDate: "2026-01-15" },
    { defaultTimezone: "Europe/Bucharest" },
  );
  const summer = normalizeTaskReminder(
    { id: "summer", reminderDate: "2026-07-15" },
    { defaultTimezone: "Europe/Bucharest" },
  );

  assert.equal(winter.reminderAtUtc, "2026-01-15T07:00:00.000Z");
  assert.equal(summer.reminderAtUtc, "2026-07-15T06:00:00.000Z");
  assert.equal(winter.reminderTimezone, "Europe/Bucharest");
  assert.equal(Object.hasOwn(winter, "reminderDate"), false);
});

test("precise reminder timestamps survive date-only UI edits", () => {
  const existing = {
    reminderAtUtc: "2026-07-15T15:45:00.000Z",
    reminderTimezone: "Europe/Oslo",
  };

  const unchanged = createReminderFields("2026-07-15", {
    timezone: "Europe/Oslo",
    existingTask: existing,
  });

  assert.deepEqual(unchanged, existing);
  assert.equal(getReminderDateForInput(existing), "2026-07-15");
});

test("timezone conversion round-trips across DST seasons", () => {
  const winter = zonedDateTimeToUtc("2026-01-15", "09:00", "Europe/Oslo");
  const summer = zonedDateTimeToUtc("2026-07-15", "09:00", "Europe/Oslo");

  assert.equal(winter, "2026-01-15T08:00:00.000Z");
  assert.equal(summer, "2026-07-15T07:00:00.000Z");
  assert.equal(dateOnlyFromUtc(winter, "Europe/Oslo"), "2026-01-15");
  assert.equal(dateOnlyFromUtc(summer, "Europe/Oslo"), "2026-07-15");
});

test("unrecognised legacy reminder values are retained for manual recovery", () => {
  const task = normalizeTaskReminder({ id: "legacy", reminderDate: "after lunch someday" });
  assert.equal(task.reminderDate, "after lunch someday");
  assert.equal(task.reminderAtUtc, null);
  assert.equal(task.reminderTimezone, null);
});
