# Northbound PWA architecture

Milestone 2 makes the existing application installable and able to reopen offline. It does not change the UI, application state schema, or localStorage repository.

## Manifest and icons

`manifest.webmanifest` gives an installing browser Northbound's name, launch URL, standalone display mode, colours, and icon choices. The regular 192 px and 512 px icons are used by launchers that preserve the full artwork. The separate maskable icon keeps the north-pointing mark inside the safe area used by launchers that crop icons into circles or other shapes.

The committed PNG files are reproducible with:

```bash
python3 scripts/generate-pwa-icons.py
```

## Service-worker responsibilities

`js/pwa/register-service-worker.js` registers the root `service-worker.js` as a module worker. PWA support is progressive enhancement: a registration failure is logged but does not stop the normal online application or local persistence.

`js/pwa/app-shell.js` is the single explicit list of files required for an offline launch. It contains the HTML entry point, stylesheet, application JavaScript modules, manifest, and installation icons. Tests verify that every listed path exists.

The worker uses two small strategies:

- Page navigations are network-first. If the network cannot be reached, the cached `index.html` is returned.
- Known app-shell assets are cache-first, so the HTML returned offline can still load its CSS and JavaScript modules.

The service worker deliberately does not cache application data. Tasks, financial values, settings, and reminder fields continue to use the `LocalStorageStateRepository` and the existing `northbound-move-dashboard-v1` key. Because localStorage belongs to the same application origin, those saved values remain available when the cached UI launches offline.

## Cache updates

The cache name in `APP_SHELL_CACHE` is versioned. Bump its `v1` suffix whenever a deployment changes cached shell files. Installation fills the new cache before the worker activates. Activation removes older Northbound shell caches while leaving unrelated caches alone.

The worker calls `skipWaiting()` and `clients.claim()` so an update is not held indefinitely by an open window. Registration bypasses the HTTP cache when checking the worker. When an already-controlled page receives the new worker, it reloads once to put the open page and cached modules on the same version. First-time installation does not force a reload.

## Local development and installation

Serve the repository over HTTP and use `http://localhost:8766`; service workers do not run when `index.html` is opened directly as a file. A production deployment must use HTTPS.

Installation controls vary by browser and operating system. After one successful visit has installed and activated the worker, Northbound can launch offline from the same origin.

## Deliberately deferred

This milestone does not request notification permission, create a Push API subscription, use VAPID keys, deliver Web Push messages, run reminder jobs, add accounts, or move data to a backend or IndexedDB.

The next notification milestone should add an explicit opt-in notification experience and prove immediate push delivery end to end: request permission only after a user action, create a Push API subscription, store that subscription in a minimal authenticated backend, and send a test push. Reliable scheduled reminders and server-side reminder jobs should follow once that delivery path is proven.
