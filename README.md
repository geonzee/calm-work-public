# Calm Work

Local-first tasks, time tracking, and planning. The desktop app and the phone web app share one Super Productivity base, pinned at v19.2.0. Sync, calendars, booking, polls, and shared projects are optional.

Original Calm Work code is [Polyform Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0). Super Productivity stays MIT. See [third-party notes](THIRD_PARTY.md).

Repository: https://github.com/geonzee/calm-work-public

## Read this first

- [Product](docs/PRODUCT.md): what the app is and how the pieces fit
- [Design](docs/DESIGN.md): the current screens and interaction rules
- [Calendars](docs/CALENDAR.md): optional Google, Microsoft 365, and CalDAV connections
- [Limits](docs/LIMITS.md): what is not built, and known gaps
- [Development](docs/DEVELOP.md): build, test, and run a server you own
- [Agent rules](AGENTS.md): how people and coding agents should work in this repository

## Checks

Node.js 22 or newer.

```sh
npm ci --ignore-scripts
npm test
```

That checks the architecture contracts. It does not build the desktop app or contact a calendar.

```sh
./scripts/build-core.sh
./scripts/launch-core.sh
```

`launch-core.sh` uses a disposable profile under `output/`. Use synthetic tasks.

This repository has no hosting account and no server address. Do not add either.
