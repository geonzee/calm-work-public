# Sync server

A new local SuperSync server for Calm Work. Its Compose project is `calm-work-sync`. It does not share a network, a volume, or a database with `services/online`.

The file has no hostname. The published port is `127.0.0.1:1900`. Postgres has no host port. The app container is limited to 768 MB. Postgres is limited to 512 MB.

If port 1900 is already taken, stop. Do not attach this file to containers or volumes that already exist, and do not publish the port on `0.0.0.0`.

## Start

```sh
cd deploy/sync
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD, JWT_SECRET, CORS_ORIGINS, and ALLOWED_EMAILS
docker compose up -d
curl -fsS http://127.0.0.1:1900/health
```

`RUN_MIGRATIONS_ON_STARTUP` is on so a new database gets its schema. Set `ALLOWED_EMAILS` before any proxy can reach the port. An empty allowlist lets any email that can reach the server register.

When another device must connect, put your own HTTPS proxy in front of port 1900. Set `PUBLIC_URL` to that HTTPS origin, and set `CORS_ORIGINS` to the exact origin of your web app.

The image is `ghcr.io/super-productivity/supersync:v19.2.0`, the same release as `upstream.json`.

Do not commit `.env`. Do not copy a setup code into a pull request.
