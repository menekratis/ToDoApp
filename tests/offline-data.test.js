import test from "node:test";
import assert from "node:assert/strict";

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

test("locally stored tasks and financial data remain readable without network access", async () => {
  const storage = new MemoryStorage();
  const repository = new LocalStorageStateRepository({ storage, defaultTimezone: "Europe/Bucharest" });
  const state = await repository.load();

  state.tasks.push({
    id: "offline-task",
    title: "Available offline",
    category: "Norway",
    phase: "pre-move",
    dueDate: "2026-08-20",
    reminderAtUtc: null,
    reminderTimezone: null,
    completed: false,
  });
  state.finance.currentSavings = 7_500;
  state.finance.expectedIncome = 1_250;
  await repository.save(state);

  const reloadedOffline = await new LocalStorageStateRepository({
    storage,
    defaultTimezone: "Europe/Bucharest",
  }).load();

  assert.equal(reloadedOffline.tasks.at(-1).title, "Available offline");
  assert.equal(reloadedOffline.finance.currentSavings, 7_500);
  assert.equal(reloadedOffline.finance.expectedIncome, 1_250);
});
