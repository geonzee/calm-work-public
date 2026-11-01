# Security

Report a vulnerability through [GitHub private security advisories](https://github.com/geonzee/calm-work-public/security/advisories/new). Do not open a public issue for a secret, a token, a sync setup code, or a way to reach someone else's data.

## What this repository can reach

Nothing outside the machine where you run it.

- There is no hosting token, account id, or deploy command.
- `scripts/stage-pwa.cjs` writes a local directory, `output/pwa-public`.
- `deploy/sync/compose.yml` publishes `127.0.0.1:1900` only. The database has no host port.
- `services/online` binds `127.0.0.1` unless you set `CALM_ONLINE_HOST`. The Compose file publishes `127.0.0.1:4242` only.
- Calendar sign-in uses a loopback redirect. Tokens stay in the device vault. See `docs/CALENDAR.md`.

Do not add a public port, a tunnel, a hostname, or a credential to these files. If port 1900 or 4242 is already taken, stop. Those ports may belong to a server this repository does not describe.

The example Microsoft tenant `contoso.onmicrosoft.com` is a placeholder. It is not a live directory.

Keep `.env` files, setup codes, and OAuth tokens out of git. `.gitignore` already excludes `.env` and `output/`.
