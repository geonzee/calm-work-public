# Public contribution and security audit

Reviewed 1 November 2026 by Codex on the Linux development machine. Scope: the public repository, in an isolated checkout. The private checkout and profiles were not changed. No deployment, installation, live account connection or container startup was performed.

## Assessment

A useful early source-available project, with deliberate local-first boundaries, synthetic tests, capability checks, origin checks, rate limiting, encrypted calendar storage and a pinned upstream. It is ready for scoped contributions after these fixes, but this review is not a full security certification or desktop acceptance test. PolyForm Noncommercial restricts commercial use; do not describe the project as OSI open source.

## Findings and fixes

- High impact isolation defect: the installed public launcher defaulted to the same binary and profile as the daily private app. Public installation now uses calm-work-public paths, its own desktop entry and icon, and does not claim the daily URL handler. Environment overrides remain explicit escape hatches. Nothing was installed.
- Dependency advisories: the online service used affected Fastify, Nodemailer and fast-uri versions. Updated Fastify to 5.12.7, Nodemailer to 10.3.1 and both transitive fast-uri copies through the lockfile. The subsequent npm registry audit reports zero known vulnerabilities; that does not establish absence of flaws.
- Invalid sync Compose YAML: nested quotes broke the PostgreSQL health check. Corrected quoting, restored the missing .env.example required by the setup instructions, and validated Compose configuration without starting containers.
- Broken contributor command: npm test inside services/online resolved Prisma paths twice. Its script now runs tests from the repository root, where existing fixtures expect to run.
- Missing automated contributor gate: added a read-only-permission GitHub workflow for architecture contracts, public installation separation, Compose configuration and online service tests. Hosted execution remains to be observed after push.
- Misleading security wording: replaced the claim that the app cannot reach outside its machine with the actual configured network boundaries.

## Verification

- npm run verify: 14 architecture tests and TypeScript checks passed.
- Online service: all eight tests passed, including booking races, ACLs, replay, revocation, OAuth, email and proxy rate limits, using disposable synthetic data.
- Public launcher: both regression tests passed. They evaluate path defaults without installing or opening a profile.
- Shell syntax and YAML parsing passed. Docker Compose configuration passed without daemon operations.
- Targeted tracked-tree scan found none of the known personal email, tenant, host, business or home-path identifiers from the private copy. Public commit authors use a GitHub noreply address. This was a targeted scan, not an exhaustive credential detector.

## Remaining work

- Build the pinned Angular/Electron runtime from scratch and run the UI, PWA, native IPC and calendar regression suites in CI before claiming full release acceptance. Root verification covers contracts, not the complete app.
- Add cross-platform install tests and evaluate separate browser origins for public PWA trials. Browser storage is origin-scoped, so serving a trial over the daily app's origin would share storage regardless of repository separation.
- Review upgrades of the pinned upstream and sync image separately. The service dependency audit does not cover Electron, the downloaded upstream dependency tree or container images.
- Large runtime/controller and renderer files increase review cost. Extract modules incrementally with behavior tests rather than changing product behavior during cleanup.
- Enable branch protection and private vulnerability reporting in GitHub settings if not already enabled. This audit did not change repository settings.

## Advisory evidence

Source: npm registry audit, accessed 1 November 2026 directly through npm, not through project accounts or Hermes. Representative owning GitHub advisory records:

- https://github.com/advisories/GHSA-389g-gv7q-r4x8
- https://github.com/advisories/GHSA-w74x-v6f9-j3xg
- https://github.com/advisories/GHSA-39m8-27wv-hr27

The registry reported three affected packages before patching and zero afterwards. Findings above distinguish verified checks from remaining acceptance work.
