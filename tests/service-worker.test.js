import test from "node:test";
import assert from "node:assert/strict";

import { APP_SHELL_CACHE, APP_SHELL_PATHS } from "../js/pwa/app-shell.js";

test("service worker precaches the shell and serves it when the network is offline", async () => {
  const listeners = new Map();
  const cacheStores = new Map([
    ["northbound-app-shell-v0", new Map()],
    ["unrelated-cache", new Map()],
  ]);
  let skipWaitingCalls = 0;
  let claimCalls = 0;

  class TestRequest {
    constructor(url, options = {}) {
      this.url = String(url);
      this.cache = options.cache;
      this.method = options.method || "GET";
      this.mode = options.mode || "cors";
    }
  }

  class TestResponse {
    constructor(body) {
      this.body = body;
    }

    async text() {
      return this.body;
    }

    static error() {
      return new TestResponse("error");
    }
  }

  const fakeCaches = {
    async open(name) {
      if (!cacheStores.has(name)) cacheStores.set(name, new Map());
      const entries = cacheStores.get(name);
      return {
        async addAll(requests) {
          requests.forEach((request) => {
            entries.set(request.url, new TestResponse(`cached:${request.url}`));
          });
        },
      };
    },
    async keys() {
      return [...cacheStores.keys()];
    },
    async delete(name) {
      return cacheStores.delete(name);
    },
    async match(request) {
      const url = typeof request === "string" ? request : request.url;
      for (const entries of cacheStores.values()) {
        if (entries.has(url)) return entries.get(url);
      }
      return undefined;
    },
  };

  const globals = ["self", "caches", "fetch", "Request", "Response"];
  const originalDescriptors = new Map(
    globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );

  Object.defineProperties(globalThis, {
    self: {
      configurable: true,
      value: {
        registration: { scope: "https://northbound.test/" },
        location: { origin: "https://northbound.test" },
        clients: { async claim() { claimCalls += 1; } },
        addEventListener(type, listener) { listeners.set(type, listener); },
        async skipWaiting() { skipWaitingCalls += 1; },
      },
    },
    caches: { configurable: true, value: fakeCaches },
    fetch: {
      configurable: true,
      writable: true,
      value: async (request) => new TestResponse(`network:${request.url}`),
    },
    Request: { configurable: true, value: TestRequest },
    Response: { configurable: true, value: TestResponse },
  });

  try {
    await import(`../service-worker.js?test=${Date.now()}`);

    await runExtendableEvent(listeners.get("install"));
    assert.equal(skipWaitingCalls, 1);
    assert.equal(cacheStores.get(APP_SHELL_CACHE).size, APP_SHELL_PATHS.length);

    await runExtendableEvent(listeners.get("activate"));
    assert.equal(claimCalls, 1);
    assert.equal(cacheStores.has("northbound-app-shell-v0"), false);
    assert.equal(cacheStores.has("unrelated-cache"), true);

    globalThis.fetch = async () => {
      throw new Error("offline");
    };

    const offlineDocument = await runFetchEvent(listeners.get("fetch"), {
      method: "GET",
      mode: "navigate",
      url: "https://northbound.test/tasks",
    });
    assert.equal(await offlineDocument.text(), "cached:https://northbound.test/index.html");

    const offlineModule = await runFetchEvent(listeners.get("fetch"), {
      method: "GET",
      mode: "cors",
      url: "https://northbound.test/js/domain/tasks.js",
    });
    assert.equal(await offlineModule.text(), "cached:https://northbound.test/js/domain/tasks.js");
  } finally {
    originalDescriptors.forEach((descriptor, name) => {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    });
  }
});

async function runExtendableEvent(listener) {
  assert.equal(typeof listener, "function");
  let completion;
  listener({ waitUntil(promise) { completion = promise; } });
  await completion;
}

async function runFetchEvent(listener, request) {
  assert.equal(typeof listener, "function");
  let response;
  listener({ request, respondWith(promise) { response = promise; } });
  assert.ok(response, `No response was provided for ${request.url}`);
  return response;
}
