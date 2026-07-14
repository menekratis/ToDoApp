import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_STORAGE_KEY,
  LocalStorageStateRepository,
} from "../js/repositories/local-storage-state-repository.js";
import { CURRENT_DATA_VERSION } from "../js/state/application-state.js";

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

test("repository asynchronously loads and persists existing version 1 data", async () => {
  const legacyState = {
    version: 1,
    settings: {
      origin: "Athens",
      destination: "Kristiansand",
      moveDate: "2027-02-03",
      currency: "EUR",
    },
    finance: {
      currentSavings: 8_250,
      savingsGoal: 12_000,
      expectedIncome: 1_500,
      moveExpenses: [{ id: "travel", name: "Travel", amount: 600 }],
      monthlyExpenses: [{ id: "housing", name: "Housing", amount: 1_400 }],
    },
    tasks: [{
      id: "task-1",
      title: "Keep this task",
      category: "Documents",
      phase: "pre-move",
      dueDate: "2027-01-20",
      reminderDate: "2027-01-18",
      notes: "Existing notes must survive.",
      important: true,
      completed: false,
    }],
  };
  const storage = new MemoryStorage({
    [DEFAULT_STORAGE_KEY]: JSON.stringify(legacyState),
  });
  const repository = new LocalStorageStateRepository({
    storage,
    defaultTimezone: "Europe/Bucharest",
  });

  const loaded = await repository.load();

  assert.equal(loaded.version, CURRENT_DATA_VERSION);
  assert.equal(loaded.settings.moveDate, "2027-02-03");
  assert.equal(loaded.finance.currentSavings, 8_250);
  assert.equal(loaded.tasks[0].title, "Keep this task");
  assert.equal(loaded.tasks[0].notes, "Existing notes must survive.");
  assert.equal(loaded.tasks[0].reminderAtUtc, "2027-01-18T07:00:00.000Z");
  assert.equal(loaded.tasks[0].reminderTimezone, "Europe/Bucharest");
  assert.equal(Object.hasOwn(loaded.tasks[0], "reminderDate"), false);
  assert.equal(loaded.notificationPreferences.taskReminders, true);

  const migratedOnDisk = JSON.parse(storage.getItem(DEFAULT_STORAGE_KEY));
  assert.equal(migratedOnDisk.version, CURRENT_DATA_VERSION);
  assert.equal(migratedOnDisk.settings.moveDate, "2027-02-03");
  assert.equal(migratedOnDisk.tasks[0].id, "task-1");
});

test("repository save returns normalised state and survives a new repository instance", async () => {
  const storage = new MemoryStorage();
  const repository = new LocalStorageStateRepository({ storage, defaultTimezone: "Europe/Oslo" });
  const state = await repository.load();
  state.settings.moveDate = "2027-05-12";
  state.finance.currentSavings = 999;
  state.tasks.push({
    id: "new-task",
    title: "Persist me",
    category: "Norway",
    phase: "pre-move",
    dueDate: "2027-05-01",
    reminderDate: "2027-04-30",
    completed: false,
  });

  const saved = await repository.save(state);
  const reloaded = await new LocalStorageStateRepository({
    storage,
    defaultTimezone: "Europe/Oslo",
  }).load();

  assert.equal(saved.tasks.at(-1).reminderAtUtc, "2027-04-30T07:00:00.000Z");
  assert.equal(reloaded.settings.moveDate, "2027-05-12");
  assert.equal(reloaded.finance.currentSavings, 999);
  assert.equal(reloaded.tasks.at(-1).title, "Persist me");
  assert.equal(reloaded.tasks.at(-1).reminderTimezone, "Europe/Oslo");
});

test("repository reset creates and persists a fresh version 2 dataset", async () => {
  const storage = new MemoryStorage();
  const repository = new LocalStorageStateRepository({ storage, defaultTimezone: "UTC" });
  const resetState = await repository.reset();

  assert.equal(resetState.version, CURRENT_DATA_VERSION);
  assert.equal(resetState.settings.moveDate, "2026-09-10");
  assert.equal(JSON.parse(storage.getItem(DEFAULT_STORAGE_KEY)).version, CURRENT_DATA_VERSION);
});
