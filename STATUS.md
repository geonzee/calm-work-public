# Status

Last updated: 2026-11-01.

The public tree matches the current app. Behavior is in `docs/PRODUCT.md` and `docs/DESIGN.md`. Gaps are in `docs/LIMITS.md`.

The desktop app and the phone web app cover capture, Track, Clean, Plan, Projects, Reports, local events, and optional calendar sign-in. Sync is SuperSync, run by each person. Booking, polls, and shared projects stay off until Settings turns them on, and their service stays on loopback.

No hosting account and no server address are in this repository.

1 November 2026, Codex on Linux: audited the public copy in isolation. Fixed public installation/profile collisions, vulnerable online dependencies, Compose quoting and the service test command; added contributor CI and launcher isolation checks. Fourteen architecture, eight service and two isolation tests pass; dependency audit is clean. No private profile, install, deployment or live service was touched. Evidence and next steps: `research/2026-11-01-contributor-security-audit.md`. Full upstream/UI builds, image audits and hosted CI acceptance remain open.
