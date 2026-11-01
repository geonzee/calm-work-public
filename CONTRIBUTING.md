# Contributing

Calm Work is source-available for noncommercial use. See `LICENSE`.

1. Read `docs/PRODUCT.md`, `docs/DESIGN.md`, and `docs/LIMITS.md`.
2. Build and test with `docs/DEVELOP.md`. Use synthetic tasks.
3. Open a pull request against this repository. Describe the behavior you changed and the check you ran.

Do not put secrets, setup codes, or real profiles in an issue or a pull request. Report a vulnerability through [private security advisories](https://github.com/geonzee/calm-work-public/security/advisories/new).

This repository cannot deploy a site or start someone else's server. Run sync and the phone build on machines you control. `docs/DEVELOP.md` says how.

Pull requests run architecture, public installation isolation, Compose configuration and synthetic online-service checks in GitHub Actions. For service changes, run `npm ci --ignore-scripts --prefix services/online`, `npm run db:generate --prefix services/online`, then `npm test --prefix services/online`. Full UI checks still need the upstream build described in `docs/DEVELOP.md`.
