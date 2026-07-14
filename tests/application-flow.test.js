import test from "node:test";
import assert from "node:assert/strict";

import { getFinancialMetrics } from "../js/domain/finance.js";
import { getMoveStatus } from "../js/domain/move.js";
import { createReminderFields } from "../js/domain/reminders.js";
import { LocalStorageStateRepository } from "../js/repositories/local-storage-state-repository.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

test("repository-backed task create, edit, complete, reopen, and delete flow persists", async () => {
  const repository = new LocalStorageStateRepository({
    storage: new MemoryStorage(),
    defaultTimezone: "Europe/Bucharest",
  });
  let state = await repository.load();
  const originalCount = state.tasks.length;
  const task = {
    id: "flow-task",
    title: "Create this task",
    category: "Norway",
    phase: "pre-move",
    dueDate: "2026-08-20",
    ...createReminderFields("2026-08-18", { timezone: "Europe/Bucharest" }),
    notes: "Initial note",
    important: true,
    completed: false,
    createdAt: "2026-07-14T08:00:00.000Z",
    updatedAt: "2026-07-14T08:00:00.000Z",
  };

  state.tasks.push(task);
  state = await repository.save(state);
  assert.equal((await repository.load()).tasks.at(-1).title, "Create this task");

  state.tasks.at(-1).title = "Edited task";
  state = await repository.save(state);
  assert.equal((await repository.load()).tasks.at(-1).title, "Edited task");

  state.tasks.at(-1).completed = true;
  state = await repository.save(state);
  assert.equal((await repository.load()).tasks.at(-1).completed, true);

  state.tasks.at(-1).completed = false;
  state = await repository.save(state);
  assert.equal((await repository.load()).tasks.at(-1).completed, false);

  state.tasks = state.tasks.filter((item) => item.id !== task.id);
  await repository.save(state);
  assert.equal((await repository.load()).tasks.length, originalCount);
});

test("repository-backed finance and move-date changes recalculate from saved settings", async () => {
  const repository = new LocalStorageStateRepository({
    storage: new MemoryStorage(),
    defaultTimezone: "Europe/Bucharest",
  });
  let state = await repository.load();
  state.finance.currentSavings = 8_000;
  state.finance.expectedIncome = 2_500;
  state.finance.moveExpenses = [{ id: "move", name: "Move", amount: 1_500 }];
  state.finance.monthlyExpenses = [{ id: "monthly", name: "Monthly", amount: 1_800 }];
  state.settings.moveDate = "2026-07-10";
  state = await repository.save(state);

  const reloaded = await repository.load();
  assert.equal(getFinancialMetrics(reloaded.finance).runway, 5);
  assert.deepEqual(getMoveStatus(reloaded.settings.moveDate, "2026-07-14"), {
    moveDate: "2026-07-10",
    today: "2026-07-14",
    daysUntilMove: -4,
    phase: "arrival",
  });
});

test("browser entry module links successfully against the extracted modules", async () => {
  const originalDocument = globalThis.document;
  const originalLocalStorage = globalThis.localStorage;
  let domReadyHandler = null;

  globalThis.document = {
    addEventListener(type, handler) {
      if (type === "DOMContentLoaded") domReadyHandler = handler;
    },
  };
  globalThis.localStorage = new MemoryStorage();

  try {
    await import(`../script.js?module-smoke=${Date.now()}`);
    assert.equal(typeof domReadyHandler, "function");
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalLocalStorage;
  }
});
