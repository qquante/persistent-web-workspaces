# Persistent Web Workspaces

A Windows desktop application for organizing persistent browser profiles and isolated web sessions.

## Features

- Shared Zod contracts keep desktop and renderer interfaces aligned.
- Persistent profile definitions are scoped to workspaces.
- Navigation policy validates URLs and rejects privileged protocols.

## Stack

TypeScript · Electron · React · Vite · Zod · SQLite · Vitest · npm workspaces

The desktop repository uses node:sqlite for workspace/profile definitions. Browser sessions are local runtime data and are excluded.

## Getting started

Node.js >=24 and npm >=11. Run npm ci --ignore-scripts, npm run build --workspace @multi-idle/contracts, npm test, npm run typecheck and npm run lint. Electron runtime setup is a separate step before npm start.

## How it works

```text
React renderer → shared contracts and desktop bridge → workspace repository → isolated browser session
```

## Current limitations

Unit tests and type/lint checks do not establish that a packaged Windows application or every Electron session flow works. Electron installation scripts were disabled during dependency installation.

## License

No open-source license has been granted. Redistribution terms remain to be defined.
