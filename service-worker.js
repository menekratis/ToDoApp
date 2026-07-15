// Provides Northbound's versioned application shell and offline navigation fallback.

import { APP_SHELL_CACHE, APP_SHELL_PATHS } from "./js/pwa/app-shell.js";

const appShellUrls = APP_SHELL_PATHS.map((path) => new URL(path, self.registration.scope).href);
const appShellUrlSet = new Set(appShellUrls);
const offlineDocumentUrl = new URL("./index.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);
    const requests = appShellUrls.map((url) => new Request(url, { cache: "reload" }));
    await cache.addAll(requests);

    // A changed worker and cache version should become useful without waiting for every
    // installed window to close; registration code performs one controlled reload.
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith("northbound-app-shell-") && cacheName !== APP_SHELL_CACHE)
        .map((cacheName) => caches.delete(cacheName)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  if (appShellUrlSet.has(requestUrl.href)) {
    event.respondWith(cacheFirstShellFile(request));
  }
});

async function networkFirstDocument(request) {
  try {
    return await fetch(request);
  } catch {
    const cachedDocument = await caches.match(offlineDocumentUrl);
    return cachedDocument || Response.error();
  }
}

async function cacheFirstShellFile(request) {
  const cachedResponse = await caches.match(request);
  return cachedResponse || fetch(request);
}
