import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { APP_SHELL_CACHE, APP_SHELL_PATHS } from "../js/pwa/app-shell.js";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));

test("web app manifest contains install metadata and valid PNG icons", async () => {
  const manifest = JSON.parse(await readProjectFile("manifest.webmanifest"));

  assert.equal(manifest.id, "./");
  assert.equal(manifest.name, "Northbound — Norway Move Dashboard");
  assert.equal(manifest.short_name, "Northbound");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#153d3b");
  assert.equal(manifest.background_color, "#f3f1e8");

  const expectedIcons = new Map([
    ["icons/icon-192.png", [192, 192, "any"]],
    ["icons/icon-512.png", [512, 512, "any"]],
    ["icons/icon-maskable-512.png", [512, 512, "maskable"]],
  ]);
  assert.equal(manifest.icons.length, expectedIcons.size);

  for (const icon of manifest.icons) {
    const expected = expectedIcons.get(icon.src);
    assert.ok(expected, `Unexpected manifest icon: ${icon.src}`);
    assert.equal(icon.sizes, `${expected[0]}x${expected[1]}`);
    assert.equal(icon.type, "image/png");
    assert.equal(icon.purpose, expected[2]);

    const png = await readFile(path.join(PROJECT_ROOT, icon.src));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), expected[0]);
    assert.equal(png.readUInt32BE(20), expected[1]);
  }
});

test("the versioned application shell lists every required offline file", async () => {
  const requiredPaths = [
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
  ];

  assert.match(APP_SHELL_CACHE, /^northbound-app-shell-v\d+$/);
  assert.deepEqual(APP_SHELL_PATHS, requiredPaths);
  assert.equal(new Set(APP_SHELL_PATHS).size, APP_SHELL_PATHS.length);

  for (const shellPath of APP_SHELL_PATHS) {
    const filePath = shellPath === "./" ? "index.html" : shellPath.replace(/^\.\//, "");
    await access(path.join(PROJECT_ROOT, filePath));
  }
});

test("service worker uses controlled install, activation, and offline strategies", async () => {
  const worker = await readProjectFile("service-worker.js");
  const registration = await readProjectFile("js/pwa/register-service-worker.js");

  assert.match(worker, /cache\.addAll/);
  assert.match(worker, /self\.skipWaiting\(\)/);
  assert.match(worker, /self\.clients\.claim\(\)/);
  assert.match(worker, /request\.mode === "navigate"/);
  assert.match(worker, /caches\.match\(offlineDocumentUrl\)/);
  assert.match(registration, /register\("\.\/service-worker\.js"/);
  assert.match(registration, /scope: "\.\/"/);
  assert.match(registration, /type: "module"/);
  assert.match(registration, /updateViaCache: "none"/);
  assert.match(registration, /controllerchange/);
});

test("manual UI simplification and dialog validation contracts remain intact", async () => {
  const html = await readProjectFile("index.html");
  const script = await readProjectFile("script.js");
  const styles = await readProjectFile("style.css");

  assert.equal((html.match(/id="quickAddTask"/g) || []).length, 1);
  assert.doesNotMatch(html, /id="addTaskFromPage"/);

  const topbar = sectionBefore(html, '<div class="topbar-actions">', "</header>");
  assert.match(topbar, /id="editPlanFromPage"/);
  assert.match(topbar, /id="quickAddTask"/);

  const taskIntroduction = sectionBefore(html, 'id="tasksView"', '<div class="task-stats"');
  const financeIntroduction = sectionBefore(html, 'id="financesView"', '<div class="finance-hero-grid"');
  const planIntroduction = sectionBefore(html, 'id="planView"', '<section class="phase-timeline"');
  assert.doesNotMatch(taskIntroduction, /<h[1-6]\b/);
  assert.doesNotMatch(financeIntroduction, /<h[1-6]\b/);
  assert.match(financeIntroduction, /id="currencyBadge"/);
  assert.doesNotMatch(planIntroduction, /<h[1-6]\b/);
  assert.match(planIntroduction, /id="planRouteSummary"/);
  assert.doesNotMatch(styles, /\.finance-input-panel\s*\{\s*grid-row:\s*span\s+2/);

  const cancelButtons = html.match(/<button\b[^>]*\bvalue="cancel"[^>]*>/g) || [];
  assert.ok(cancelButtons.length > 0);
  cancelButtons.forEach((button) => assert.match(button, /\bformnovalidate\b/));

  const saveButtons = html.match(/<button\b[^>]*\bvalue="default"[^>]*>/g) || [];
  assert.ok(saveButtons.length > 0);
  saveButtons.forEach((button) => assert.doesNotMatch(button, /\bformnovalidate\b/));
  ["taskForm", "expenseForm", "planForm", "financeOverviewForm"].forEach((formName) => {
    assert.match(script, new RegExp(`elements\\.${formName}\\.reportValidity\\(\\)`));
  });
});

function readProjectFile(relativePath) {
  return readFile(path.join(PROJECT_ROOT, relativePath), "utf8");
}

function sectionBefore(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}
