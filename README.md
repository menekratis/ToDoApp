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
