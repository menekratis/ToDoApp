# ToDoApp
# Norway Dashboard

A personal dashboard for planning my move from Athens, Greece to Kristiansand, Norway.

The goal of the project is to help me manage everything I need to complete before moving, track my financial readiness, and then continue helping me during the first months after arriving in Norway.

## Product goal

The application should answer three questions clearly:

1. What do I need to do next?
2. Am I financially ready for the move?
3. Am I on track for my move date?

The dashboard should feel practical and personal rather than like a generic task manager.

## Context

My planned move date is September 10, 2026.

I am moving from Athens to Kristiansand.

Before the move, I need to manage tasks such as:

- Driving licence
- Doctor appointments
- Winter clothing
- Packing and shipping my desktop PC and monitor
- Preparing documents
- Continuing software development studies
- Learning Norwegian
- Managing savings and expected move costs

After arriving in Norway, my priorities will change to things such as:

- Settling into the house
- Handling important local administration
- Finding work
- Tracking monthly expenses
- Continuing programming studies
- Continuing Norwegian practice
- Building a stable routine

## Core features

### Dashboard

The home page should provide an immediate overview of:

- Days remaining until the move
- Important tasks that need attention
- Current savings
- Savings target
- Estimated move costs
- Financial runway
- Overall preparation progress

### Tasks and goals

Users should be able to:

- Create tasks
- Edit tasks
- Complete tasks
- Delete tasks
- Assign deadlines
- Assign categories
- Mark tasks as important
- Separate pre-move and post-arrival goals

Suggested categories include:

- Documents
- Health
- Finance
- Norway
- Packing
- Learning
- Work
- Personal

The dashboard should prioritise overdue tasks and tasks with approaching deadlines.

### Financial tracking

The application should allow me to track:

- Current savings
- Savings goal
- Expected income before moving
- Expected move expenses
- Individual planned expenses
- Monthly expenses after arriving

The app should calculate useful values such as:

- Progress toward savings goal
- Estimated money remaining after move costs
- Estimated financial runway

### Move phases

The application should understand different phases of the move:

1. Pre-move
2. Arrival
3. Settling in

The interface and priorities may change depending on the current phase.

### Reminders

Tasks should support due dates and reminder information.

Real operating system or push notifications are not required for the first proof of concept, but the architecture should not make adding notifications unnecessarily difficult later.

## Proof of concept

The first version should be a functional application that I can actually use.

It should prioritise:

- Clear dashboard
- Task management
- Financial overview
- Move countdown
- Local persistence

Use local storage for the initial version.

No accounts, backend, cloud sync, or authentication are required yet.

## Technical direction

Keep the initial implementation reasonably simple.

This is also a learning project, so the code should remain understandable and organised.

Avoid introducing a large framework or complex infrastructure unless there is a strong reason.

The first proof of concept can use vanilla HTML, CSS, and JavaScript.

## Design direction

The application should feel like a focused personal command centre for a major life transition.

It should not look like a generic corporate task management dashboard.

The design can take inspiration from Nordic simplicity, but should still feel motivating and alive.

The most important information should be understandable within a few seconds of opening the application.

## Development approach

Build the product iteratively.

The first goal is not to predict every future feature.

The first goal is to create a useful version, use it in real life, identify problems, and improve it based on actual usage.

## Proof of concept implementation

The repository now contains a functional, responsive single-page application called **Northbound**. It uses only vanilla HTML, CSS, and JavaScript; there is no build step, framework, account system, or backend.

### What is included

- A dashboard with a live move countdown, automatic move phase, pre-move completion ring, prioritised tasks, financial snapshot, progress by category, and phase overview.
- Full task management: add, edit, complete, reopen, delete, search, and filter by phase, status, and category.
- Task due dates, optional reminder dates, notes, importance flags, and automatic overdue/upcoming prioritisation.
- A move-specific starting checklist covering driving licence work, health appointments, documents, packing, PC shipping, winter clothing, studies, Norwegian practice, arrival administration, budgeting, and finding work.
- Financial tracking for current savings, a savings target, expected pre-move income, individual move costs, and recurring monthly costs.
- Automatic calculations for available funds on move day, money remaining after move costs, savings progress, and estimated post-move runway.
- Editable origin, destination, move date, and planning currency.
- Automatic pre-move, arrival (first 30 days), and settling-in phases.
- Browser-local persistence after every change, plus JSON backup export and a confirmed reset action.
- Responsive layouts for desktop, tablet, and mobile, with keyboard focus states and accessible native dialogs.

Financial values intentionally start at zero so the dashboard does not present invented personal figures. The starter expense rows are prompts to fill in with real estimates.

## Run locally

No installation is required. Serve the directory with any static file server so browser storage behaves consistently. For example:

```bash
python3 -m http.server 8766
```

Then open `http://localhost:8766`.

Because the application now uses native ES modules, run it through a local server rather than opening `index.html` as a file.

## Data and privacy

All application data is stored under the `northbound-move-dashboard-v1` key in the current browser's `localStorage`. It never leaves the device. Clearing browser storage removes the data, so use **Move plan -> Export backup** before clearing data or changing devices.

The exported JSON is intended as a safety copy for this proof of concept. Import is a sensible follow-up feature, but is not included yet.

## Verification completed

The proof of concept was checked with:

- JavaScript syntax validation.
- HTML parsing and repository whitespace checks.
- Local HTTP checks for the HTML, stylesheet, script, responsive rules, and persistence code.
- Executable flow tests covering task add/edit/complete/reopen/delete, savings updates, move and monthly expenses, runway calculations, move-plan changes, and persistence after reloading saved state.

## Project structure

```text
index.html                              Application structure, forms, and dialogs
style.css                               Nordic-inspired responsive design
script.js                               UI rendering and asynchronous event handlers
js/domain/dates.js                      Date-only, timezone, and UTC conversion logic
js/domain/finance.js                    Financial totals and runway calculations
js/domain/move.js                       Move countdown and phase rules
js/domain/tasks.js                      Due status and priority ordering
js/domain/reminders.js                  Reminder creation and legacy normalisation
js/repositories/state-repository.js     Repository contract
js/repositories/local-storage-state-repository.js
                                        Current localStorage implementation
js/state/application-state.js           Versioned defaults and state normalisation
tests/                                  Domain, repository, and flow tests
package.json                            Native ES module and test configuration
```

## Milestone 1 architecture

### Domain modules

Calculations no longer depend on the DOM, global application state, or storage. The UI passes the configured move date, current date, tasks, or finance data into small pure functions and renders their results. September 10, 2026 exists only as the seeded move date in `js/state/application-state.js`; changing `state.settings.moveDate` immediately changes the countdown, phase, and phase dates.

### Repository abstraction

`StateRepository` defines asynchronous `load()`, `save()`, and `reset()` operations. The UI keeps an in-memory state for rendering but reaches persistence only through `LocalStorageStateRepository`. A future API-backed repository can implement the same methods without replacing the task, finance, or move-plan UI.

The localStorage key remains `northbound-move-dashboard-v1` so existing browser data is found automatically.

### State version 2 and reminder migration

On load, the local repository normalises existing data to schema version 2 and writes the normalised value back to the same storage key. Existing settings, task IDs, notes, completion state, financial values, and expense rows are preserved.

Tasks now use:

```text
reminderAtUtc       Precise ISO-8601 UTC timestamp, or null
reminderTimezone    IANA timezone such as Europe/Bucharest, or null
```

A valid legacy `reminderDate` is converted to 09:00 in the browser's IANA timezone. The conversion uses the timezone rules for that date, including daylight-saving time. Already precise timestamps are retained, including their time, when the current date-only form is saved without changing the reminder date. An unrecognised legacy value is kept in `reminderDate` for manual recovery rather than discarded.

Version 2 also seeds notification preferences for future task reminders, overdue-important reminders, move milestones, financial warnings, preparation warnings, default timezone/time, and quiet hours. These preferences remain data structures only; milestone 2 adds the offline PWA shell, but no notification delivery, permission prompt, push subscription, or backend.

## Tests

Run the dependency-free Node test suite with:

```bash
npm test
```

The suite covers date-only and DST behaviour, financial runway, move-phase boundaries, configurable move dates, task due status and sorting, reminder normalisation, localStorage migration, repository persistence, task CRUD, finance updates, the browser entry module graph, manifest validity, app-shell paths, service-worker offline behaviour, and the preserved dialog and layout contracts.

Milestone 2's PWA design and cache-update rules are documented in `docs/pwa.md`.
