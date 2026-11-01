# Development

Node.js 22 or newer. Upstream is fetched by the build into ignored `output/`. Do not commit `output/`, `node_modules/`, or `.env`.

## Architecture checks

```sh
npm ci --ignore-scripts
npm test
```

## Desktop

```sh
./scripts/build-core.sh
./scripts/launch-core.sh
```

`launch-core.sh` uses `output/core-profile`. That profile is disposable. Do not point a check at a profile you use every day.

`scripts/install-app.sh` copies a finished Linux build to `~/.local/opt/calm-work-public/releases/` and points `current` at it. If `current` already exists, the script stops unless `CALM_WORK_REPLACE_DAILY=1`. It does not read or write `~/.local/share/calm-work-public`.

`scripts/install-linux-launcher.py` installs a user launcher, a desktop entry, and the icon. The launcher keeps `--password-store=gnome-libsecret`.

Quit the app and open it again to load a replaced build.

## Phone build

`scripts/stage-pwa.cjs` writes `output/pwa-public`. It does not upload, and it does not read a token. Serve that directory locally when you want to click through the phone build. `scripts/verify-ios-pwa.cjs` and `scripts/verify-pwa-shell.cjs` can take a local `--url`.

## Sync

`deploy/sync` is a new local SuperSync server: its own Compose project, network, and volume. The app port is `127.0.0.1:1900`. Postgres has no host port.

```sh
cd deploy/sync
cp .env.example .env
# set POSTGRES_PASSWORD, JWT_SECRET, CORS_ORIGINS, and ALLOWED_EMAILS
docker compose up -d
curl -fsS http://127.0.0.1:1900/health
```

If port 1900 is already taken, stop. Do not point this file at containers or volumes that already exist. Do not change the published port to `0.0.0.0`.

`RUN_MIGRATIONS_ON_STARTUP` is on so a new database gets its schema. Set `ALLOWED_EMAILS` before anything other than your own machine can reach the port. An empty allowlist lets any email that can reach the server register.

Leave SMTP empty until you want signup mail. Do not commit `.env` or a setup code.

The sync checks need a server you started and a throwaway setup code:

```sh
CALM_SYNC_SERVER=http://127.0.0.1:1900 CALM_SYNC_CODE_FILE=/tmp/calm-test-code.txt node scripts/verify-sync-pwa.cjs
```

## Booking, polls, and shared projects

`services/online` is a separate stack. From the repository root, after `npm ci --ignore-scripts` inside `services/online`:

```sh
node scripts/run-online.cjs
```

The default origin is `http://127.0.0.1:4242`. The owner token is written under `output/online-service/` with mode 600. `services/online/deploy/compose.yml` publishes `127.0.0.1:4242` only.

## UI checks

Most `scripts/verify-*.cjs` checks open `apps/desktop/ui/keyboard-review.html` or the built app. They need the upstream `node_modules` from `./scripts/build-core.sh` when they launch Electron or the browser. Calendar unit checks do not:

```sh
node --test scripts/verify-calendar-oauth.cjs scripts/verify-calendar-mirror.cjs
```

Use synthetic tasks. A check that needs a live calendar or a live sync server must use an account and a server you created for that run.

The public launcher is `calm-work-public`, with its own empty profile at `~/.local/share/calm-work-public`. It does not register the daily app’s URL handler. Do not set `CALM_WORK_PROFILE` or `CALM_WORK_APP` to a daily installation when evaluating this copy.
