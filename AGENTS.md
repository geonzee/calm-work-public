# Working on Calm Work

This file is for people and agents changing this repository. Read it before editing.

## What is true

- Product behavior is `docs/PRODUCT.md`, `docs/DESIGN.md`, and `docs/CALENDAR.md`.
- Gaps are `docs/LIMITS.md`. Do not treat a missing feature as a bug to invent around.
- The interface source is `apps/desktop/ui/`. The desktop and phone apps load that renderer.
- Build and test steps are `docs/DEVELOP.md`.
- Original Calm Work code is Polyform Noncommercial 1.0.0. Super Productivity stays MIT. See `LICENSE` and `THIRD_PARTY.md`.

## Data

- Use synthetic tasks and a disposable profile under `output/`.
- Do not open, copy, or modify a profile outside this checkout.
- Do not commit secrets, sync setup codes, OAuth tokens, client secrets, or env files.

## Infrastructure

This repository does not contain a hosting account, an API token, a server address, or a deploy command. Keep it that way.

- Do not deploy. `scripts/stage-pwa.cjs` only writes `output/pwa-public` on the local machine.
- Do not look for tokens, account ids, SSH config, or env files outside this repository.
- Do not SSH, and do not contact a machine that is not described in this repository.
- `deploy/sync/compose.yml` starts a new local sync server on `127.0.0.1:1900`. If that port is already in use, stop. Do not attach the file to existing containers or volumes.
- `services/online` listens on `127.0.0.1:4242` by default. Do not publish either service on a public address from this checkout.
- `scripts/install-app.sh` refuses to replace an existing install unless `CALM_WORK_REPLACE_DAILY=1`. It never writes the profile directory.

## Changes

- Keep the Super Productivity pin in `upstream.json`. Fetch upstream at build time. Do not vendor it.
- A change to task, time, or calendar behavior needs the matching check under `scripts/verify-*.cjs`, or a clear note in `docs/LIMITS.md` when no check exists yet.
- Do not copy Rallly or other third-party application code into this repository. See `THIRD_PARTY.md`.
