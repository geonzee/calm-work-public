# Optional online service

Booking pages, availability polls, and scoped shared projects. This is original Calm Work code under the same Polyform Noncommercial license as the rest of the repository. It uses Fastify and Prisma, and its own SQLite database. It does not use the SuperSync database.

From the repository root, after `npm ci --ignore-scripts` in this directory:

```sh
node scripts/run-online.cjs
```

The default origin is `http://127.0.0.1:4242`. The owner token stays under `output/online-service/` with mode 600.

`deploy/compose.yml` publishes `127.0.0.1:4242` only. It has no hostname. Do not publish `0.0.0.0` or attach a volume that already exists.

Provider-backed booking and SMTP are off until you set them. Personal tasks and SuperSync are a different stack. Shared workspace edits use their own records and can conflict. Offline edits stay pending until the next sync of that workspace.

Desktop Settings can open this origin after you turn Booking, Polls, and Team on. Those items stay hidden until then.
