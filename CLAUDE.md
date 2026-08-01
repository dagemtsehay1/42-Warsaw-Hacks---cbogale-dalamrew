# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Note on Next.js version

`AGENTS.md` (imported by this file) claims this project uses a modified Next.js with docs at
`node_modules/next/dist/docs/` — that directory does not exist in this install. Treat that
instruction as stale/inapplicable and rely on standard Next.js 16 App Router conventions instead.

## Commands

```bash
npm run dev         # start dev server (redirects / -> /dashboard)
npm run build        # production build
npm start            # run production build
npm run lint          # eslint .
npm run typecheck     # tsc --noEmit
npm test             # vitest run (single run, CI-style)
npm run test:watch   # vitest watch mode
```

Run a single test file: `npx vitest run src/lib/snapshots/campus.test.ts`
Run tests matching a name: `npx vitest run -t "some test name"`

Test files live next to the code they cover (`*.test.ts`), picked up via `src/**/*.test.ts` (see `vitest.config.ts`). Environment is `node` (no DOM), with `@/*` aliased to `src/*`.

## Architecture

This app is a **single-page hallway TV dashboard** for 42 Warsaw — there is no login, no multi-page site, just `/dashboard` (and its shell-less twin `/dashboard/display`) rotating through three screens. The core design constraint: **the 42 Intra API secret must never reach the browser**, and the API has a tight rate limit (2 req/s, 1200 req/hour), so all API access goes through a server-side BFF with aggregation, soft-failure, and local snapshotting.

```
Browser → React Query → Next.js Route Handler (/api/campus/dashboard) → 42 API (client_credentials)
```

There is no OAuth/session layer. Every data source the dashboard needs (locations, projects_users, blocs/coalitions) is available with the app's own `client_credentials` token — no signed-in user is ever required, so `/me`, `/auth/signin`, and iron-session were removed entirely rather than kept unused.

### Layer responsibilities

- `src/lib/api/42/` — the only code allowed to talk to `api.intra.42.fr`.
  - `config.ts` — env var access (`FORTYTWO_CLIENT_ID/SECRET`, `FORTYTWO_CAMPUS_ID`, `FORTYTWO_CURSUS_ID`, etc.), `FortyTwoApiError`, and `hasFortyTwoCredentials()` which gates whether the app runs live or in mock mode.
  - `auth.ts` — `getAppAccessToken()`: the app-level `client_credentials` token, cached at module scope and shared across requests in the same server process.
  - `client.ts` — `fortyTwoFetch` (single request with retry/backoff on 401/429/5xx) and `fortyTwoFetchAllPages` (paginated fetch with a delay between pages to respect rate limits — `maxPages` bounds cost).
  - `resources.ts` — typed endpoint wrappers, deliberately minimal: `fetchActiveLocations`, `fetchEarliestLocationToday`, `fetchProjectsUsers`, `fetchCampusBlocs`, `fetchCoalitionsByBloc`, `fetchCoalitionScoreEvents`, `fetchCoalitionContributors`, `fetchUsersByIds`, `resolveWarsawCampusId`.
  - `transforms.ts` — raw 42 API shapes → this app's domain types (`src/types/campus.ts`).
  - `types.ts` — raw 42 API response shapes, trimmed to only the fields actually consumed.
- `src/features/campus/dashboard-service.ts` — the aggregation root. `buildDashboardPayload()` fires **5** core API calls via `Promise.allSettled` (down from the ~8-call, deeply-paginated version this app started as), so **one failing section never breaks the whole dashboard** — failures are pushed into `payload.errors` and that section renders empty/soft-failed. The coalitions screen then adds per-coalition calls (score ledger + contributors) plus one bulk user lookup, run through `mapSequentially` — **do not parallelize these**, it trips the 2 req/s limit and returns 429s. When `hasFortyTwoCredentials()` is false, it returns `buildMockDashboard()` (zeroed data + a setup-instructions ticker) instead of throwing, so the app is always runnable without credentials.
- `src/features/campus/coalition-history.ts` — rebuilds each coalition's score across the **current season** from `/v2/coalitions/:id/scores`, an append-only ledger. The API has no "score at time T" endpoint, so history is reconstructed backwards from the current total (current minus every event after T). **Coalition scores reset between seasons and the reset is not recorded in the ledger** — the full Warsaw ledger sums to ~12x the live score, so charting it all would plot deeply negative. Points reconstructing below zero are therefore dropped (that boundary *is* the last reset), the window is clamped to what the fetched pages cover, and coalitions with no events are omitted rather than drawn flat at their current score. Unit-tested in `coalition-history.test.ts` — note day boundaries are campus-local, so tests must derive expected timestamps via `startOfDay` rather than hardcoding UTC strings.
- `src/lib/snapshots/campus.ts` — coalition scores from the 42 API are point-in-time only, so the *delta* shown in the ticker is computed by diffing `campus-latest.json` against `campus-previous.json` in `data/snapshots/` (gitignored), written at most every 30 minutes. Deltas therefore need a long-running host and reset on ephemeral deploys. The score-history **chart** does not depend on this — it comes from the API ledger (see above).
- `src/app/api/campus/dashboard/route.ts` — the only API route in the app; calls `buildDashboardPayload()` and returns JSON, using `export const dynamic = "force-dynamic"` since it's always server-fresh.
- `src/hooks/use-campus-dashboard.ts` — the only data-fetching hook, consumed by `campus-board.tsx`. Polling cadence (`staleTime`/`refetchInterval`, 30 min) is centralized in `src/lib/query/client.ts` (`DASHBOARD_STALE_MS`) — change it there, not in the hook.
- `src/stores/display-store.ts` — Zustand store, **local-only, persisted to localStorage** (`ft-warsaw-display` key). Holds exactly the screen-rotation state: `activeScreen` (one of `"presence" | "achievements" | "coalitions"`, see `DisplayScreenId` in `src/types/campus.ts`), `rotationEnabled`, `rotationIntervalMs`.
- `src/data/campus-facts.ts` — static "did you know" facts shown on the coalitions screen, no API dependency.

### The three screens

`campus-board.tsx` renders exactly one of these at a time based on `useDisplayStore().activeScreen`, auto-advancing every `rotationIntervalMs` (see `screen-rotation.tsx`):

1. **Presence** — pulse metrics header + `presence-board.tsx` (who's on campus now, who logged in first today).
2. **Achievements** — `recent-passes.tsx` + `active-projects.tsx` (recently validated projects, and which in-progress projects have the most students on them).
3. **Coalitions** — top half is `coalition-score-chart.tsx` (a recharts line chart of each coalition's real season-to-date score history reconstructed from the API ledger, with a legend — colors are each coalition's own API-provided brand color, not a reassigned categorical palette; the Y axis is fitted to the data rather than zero-based); bottom half is `top-contributors.tsx` (top 3 students by score per coalition, one column per coalition).

There is no tab/nav UI for switching screens on purpose — this is a passive display, not an app someone clicks through.

### Adding a new 42-API-backed feature

1. Add a raw-shape type in `src/lib/api/42/types.ts` if needed.
2. Add a fetch wrapper in `resources.ts` (respect pagination/rate limits — use `fortyTwoFetchAllPages` with a sane `maxPages`).
3. Add a transform in `transforms.ts` mapping to a domain type in `src/types/campus.ts`.
4. Wire it into `dashboard-service.ts` (as another `Promise.allSettled` entry, soft-failing into `errors`).
5. Update `docs/42-api-data-map.md` with the endpoint/fields/limitations — this file is the source of truth for which 42 endpoints back which feature, and documents intentional scope cuts (e.g. no campus-wide logtime leaderboard, no rank distribution — both would require substantially more API calls for a passive hallway screen).

Before adding a new API call, weigh it against the rate budget (2 req/s, 1200 req/hour) and the "is this worth another round-trip for a screen nobody interacts with" bar — this app was deliberately cut down from a multi-page site with ~8 aggregate calls to a 3-screen dashboard with 5.

## Key conventions

- Never call the 42 API directly from client components — always go through the `/api/campus/dashboard` route handler.
- Treat partial data as normal: aggregation code should soft-fail per-section (push to an `errors` array) rather than throwing, matching the existing pattern in `dashboard-service.ts`.
- Don't fabricate data to fill gaps (e.g. missing historical XP, full logtime podiums) — this is an explicit product constraint recorded in the README and `docs/42-api-data-map.md`; leave the section out rather than inventing data.
- Don't reintroduce login/session/OAuth for dashboard features — check whether the data is available via the app's `client_credentials` token first (most 42 campus-wide data is); only a genuinely personal, user-scoped feature would justify bringing auth back.
