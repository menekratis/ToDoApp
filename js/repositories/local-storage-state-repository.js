import { getSystemTimezone } from "../domain/dates.js";
import { createDefaultState, normalizeApplicationState } from "../state/application-state.js";
import { StateRepository } from "./state-repository.js";

export const DEFAULT_STORAGE_KEY = "northbound-move-dashboard-v1";

export class LocalStorageStateRepository extends StateRepository {
  constructor({
    storage = globalThis.localStorage,
    storageKey = DEFAULT_STORAGE_KEY,
    defaultTimezone = getSystemTimezone(),
  } = {}) {
    super();
    if (!storage) throw new Error("A Web Storage-compatible implementation is required");
    this.storage = storage;
    this.storageKey = storageKey;
    this.defaultTimezone = defaultTimezone;
  }

  async load() {
    const fallbackState = createDefaultState({ reminderTimezone: this.defaultTimezone });
    let stored;

    try {
      stored = this.storage.getItem(this.storageKey);
    } catch (error) {
      console.warn("Northbound could not read saved data.", error);
      return fallbackState;
    }

    if (!stored) return fallbackState;

    let parsed;
    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      console.warn("Northbound could not parse saved data.", error);
      return fallbackState;
    }

    const normalized = normalizeApplicationState(parsed, {
      defaultTimezone: this.defaultTimezone,
      fallbackState,
    });
    const serialized = JSON.stringify(normalized);

    if (serialized !== stored) {
      try {
        this.storage.setItem(this.storageKey, serialized);
      } catch (error) {
        console.warn("Northbound loaded existing data but could not persist its migration.", error);
      }
    }

    return normalized;
  }

  async save(applicationState) {
    const normalized = normalizeApplicationState(applicationState, {
      defaultTimezone: this.defaultTimezone,
    });
    this.storage.setItem(this.storageKey, JSON.stringify(normalized));
    return normalized;
  }

  async reset() {
    const freshState = createDefaultState({ reminderTimezone: this.defaultTimezone });
    this.storage.setItem(this.storageKey, JSON.stringify(freshState));
    return freshState;
  }
}
