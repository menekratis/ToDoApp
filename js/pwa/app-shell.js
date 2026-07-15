// Defines the versioned static files that make Northbound launchable offline.

export const APP_SHELL_CACHE = "northbound-app-shell-v1";

export const APP_SHELL_PATHS = Object.freeze([
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.webmanifest",
  "./js/domain/dates.js",
  "./js/domain/finance.js",
  "./js/domain/move.js",
  "./js/domain/reminders.js",
  "./js/domain/tasks.js",
  "./js/pwa/app-shell.js",
  "./js/pwa/register-service-worker.js",
  "./js/repositories/local-storage-state-repository.js",
  "./js/repositories/state-repository.js",
  "./js/state/application-state.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
]);
