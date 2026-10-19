# Persistent Web Workspaces

A Windows desktop application for organizing persistent browser profiles and isolated web sessions.

![review](https://img.shields.io/badge/review-private-374151) ![primary](https://img.shields.io/badge/primary-TypeScript-2563EB) [![LinkedIn](https://img.shields.io/badge/LinkedIn-Douglas%20Silva-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/douglas-silva-data-analyst/)

[Overview](#overview) · [Architecture](#architecture) · [Setup](#setup) · [Validation](#validation) · [Roadmap](#roadmap) · [Review notes](docs/REVIEW.md)

## Overview

- Shared Zod contracts keep desktop and renderer interfaces aligned.
- Persistent profile definitions are scoped to workspaces.
- Navigation policy validates URLs and rejects privileged protocols.

**Technology:** TypeScript · Electron · React · Vite · Zod · SQLite · Vitest · npm workspaces

**Persistence and data:** The desktop repository uses node:sqlite for workspace/profile definitions. Browser sessions are local runtime data and are excluded.

## Architecture

```text
React renderer → shared contracts and desktop bridge → workspace repository → isolated browser session
```

| Location | Review focus |
| --- | --- |
| [`apps/desktop/src/main/repository.ts`](apps/desktop/src/main/repository.ts) | Source/configuration inspected for scope and structure |
| [`apps/desktop/src/main/url-policy.ts`](apps/desktop/src/main/url-policy.ts) | Source/configuration inspected for scope and structure |
| [`packages/contracts/src/index.ts`](packages/contracts/src/index.ts) | Source/configuration inspected for scope and structure |
| [`package.json`](package.json) | Source/configuration inspected for scope and structure |

Internal package and module names are retained where changing them would affect imports or compatibility. This descriptive repository name does not imply a completed package/API migration.

## Setup

Node.js >=24 and npm >=11. Run npm ci --ignore-scripts, npm run build --workspace @multi-idle/contracts, npm test, npm run typecheck and npm run lint. Electron runtime setup is a separate step before npm start.

Start from an isolated environment. Use `.env.example` when present and inspect the configuration loader: an example file is not necessarily loaded automatically. Runtime databases, real account sessions and private credentials are not bundled. Live integration prerequisites are separate from local tests.

## Validation

Static parsing checked 0 Python files and 4 strict JSON files. Python syntax errors: 0; JSON errors: 0. No functional test/build result is claimed for this preparation. Separately verified: 7 Vitest tests passed; shared-contract build, TypeScript checks and Oxlint passed. Electron GUI/packaging was not exercised.

Available test scripts are inventoried in [the review notes](docs/REVIEW.md). Choose offline checks before operating any integration.

These results apply to the selected checks on the preparation copy. They do not establish deployment readiness, full coverage, live provider availability or measured performance. CI definitions, when present under `docs/ci-templates/`, are inactive review templates; no remote CI badge is claimed.

## Limits and current status

Unit tests and type/lint checks do not establish that a packaged Windows application or every Electron session flow works. Electron installation scripts were disabled during dependency installation.

This private snapshot is for code and portfolio review. Generated runtime material and unreviewed binary assets may be excluded. [Review notes](docs/REVIEW.md) record preparation scope, findings and outstanding validation.

## Roadmap

- [ ] Validate the Electron runtime and profile lifecycle in a manual Windows smoke test.
- [ ] Add a reproducible packaging workflow.
- [ ] Document session backup, deletion and recovery behavior.

## History and attribution

No recoverable original Git history was verified for this snapshot. Import and preparation commits use their actual current dates; filesystem timestamps are not treated as development dates.

No open-source license is granted by this preparation. A license and attribution review is required before public redistribution.

## Maintainer and feedback

Douglas de Oliveira Silva · [GitHub](https://github.com/qquante) · [LinkedIn](https://www.linkedin.com/in/douglas-silva-data-analyst/)

For this private review, report reproducible issues with a minimal fixture and the exact check output. Keep account data, credentials and generated sensitive reports out of issues and commits. Existing contribution guidelines apply where present.

**Topics:** `typescript`, `electron`, `react`, `sqlite`, `desktop-app`, `browser-profiles`, `vite`
