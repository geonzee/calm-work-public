# Product

Calm Work is a local-first app for deciding what to do, planning when to do it, recording the time actually spent, and reviewing the result. Tasks, projects, calendar blocks, and reports are one workflow.

The useful core is capture, organize, plan, track, review. Someone who only needs personal tasks and tracking gets that without booking, polls, or team features in the way.

Desktop is the full app, including a tray menu. The phone is the same web build, installed to the home screen. It favors capture, the list, and tracking.

## Stack

The app is a thin overlay on Super Productivity v19.2.0, commit `466a426700e7402f8628bc80ce499d3de6160dbb`. The pin is `upstream.json`. The build downloads that checkout into ignored `output/upstream`. It is not vendored here.

The screen is `apps/desktop/ui/`. `scripts/prepare-reviewed-renderer.cjs` copies it into the upstream app. `apps/desktop/calm-shell/runtime/runtime-controller.js` connects that screen to the real task, project, and session stores. There is no second task database.

Optional sync is the upstream SuperSync server. Optional booking, polls, and shared projects are `services/online`, with their own database.

## What works without an account

- Capture a task, including project, date, time, estimate, and repeat.
- Clean holds unfinished tasks with no project. Giving a task a project removes it from Clean.
- Track shows today and is where a session starts on desktop.
- Plan places tasks on a rolling seven-day calendar and keeps local events.
- Projects group the same tasks. They do not start tracking.
- Reports compare estimates with recorded time and can export CSV or JSON.
- Work survives quit and reopen. It stays usable offline.

## Optional pieces

Turn these on only when you want them. Disabled features stay out of the navigation.

- Sync with a SuperSync server you run. A device joins by pasting one setup code.
- Google Calendar, Microsoft 365, and CalDAV, including iCloud. See `CALENDAR.md`.
- Booking, polls, and shared projects. Settings reveals them. The service is `services/online` and listens on loopback until you choose otherwise.

## Time

An estimate is a plan. Recorded time is what was actually tracked. Reports never show an estimate as recorded time. When both exist, recorded time is the time that counts.

A task has one calendar block. The estimate draws it. Editing it on Plan replaces the estimate. Tracking replaces both and is the only block. Completing a task that was only planned stores that interval. Reopening a task restores the open estimate and keeps the history in Reports.

Pauses are not focused time. The calendar still shows the wall-clock start and end.
