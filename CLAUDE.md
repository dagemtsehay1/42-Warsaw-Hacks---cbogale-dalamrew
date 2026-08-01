# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Note on Next.js version

`AGENTS.md` (imported by this file) claims this project uses a modified Next.js with docs at
`node_modules/next/dist/docs/` — that directory does not exist in this install. Treat that
instruction as stale/inapplicable and rely on standard Next.js 16 App Router conventions instead.

## Commands

```bash
npm run db:up        # start the Postgres container (docker compose)
npm run dev          # start dev server (redirects / -> /dashboard)
npm run build        # production build
npm start            # run production build
npm run lint          # eslint .
npm run typecheck     # tsc --noEmit
npm test             # vitest run (single run, CI-style)
npm run test:watch   # vitest watch mode
npm run db:psql      # psql shell into the container
npm run db:down      # stop Postgres (data survives in the `pgdata` volume)
```

The app boots without Postgres (it falls back to building a payload per request),
but the background jobs and the attendance forecast need it — start it first.

Run a single test file: `npx vitest run src/lib/snapshots/campus.test.ts`
Run tests matching a name: `npx vitest run -t "some test name"`

Test files live next to the code they cover (`*.test.ts`), picked up via `src/**/*.test.ts` (see `vitest.config.ts`). Environment is `node` (no DOM), with `@/*` aliased to `src/*`.

## Architecture

This app is a **single-page hallway TV dashboard** for 42 Warsaw — there is no login, no multi-page site, just `/dashboard` (and its shell-less twin `/dashboard/display`) rotating through four screens. Two constraints shape everything: **the 42 Intra API secret must never reach the browser**, and the API is both rate-limited (2 req/s, 1200 req/hour) and occasionally down — a screen on a wall must not go blank when it is.

So the request path and the API path are separated completely:

```
                 every 30 min                     on request
42 API ──────────────────────────▶ Postgres ─────────────────────▶ Server-rendered HTML ──▶ TV
       (background ingest job)    (snapshots,   (two indexed queries,   (no data fetching
                                   sessions,     no 42 API call)         in the browser)
                                   forecasts)
```

- **Nothing on the request path calls the 42 API.** `readDashboardView()` reads the newest stored snapshot. If the 42 API is down for a day, the board keeps showing the last good data and the header says how old it is.
- **The browser only renders.** No data fetching and no query client: every value on the board arrives as server markup or as props to a client component. Client components are kept to the leaves — the three charts (recharts), the screen rotation, the clock, the fullscreen button, the live session timer, and the timer that calls `router.refresh()` when the next ingest is due (`auto-refresh.tsx`). Keep it that way — if a feature seems to need client-side *data*, it belongs in the ingest job instead.
- **The web server is also the worker.** `src/instrumentation.ts` starts the scheduler on boot, so the deployment stays a single container. Jobs take a Postgres advisory lock, so extra instances don't multiply 42 API traffic.

There is no OAuth/session layer. Every data source the dashboard needs (locations, projects_users, cursus_users, blocs/coalitions) is available with the app's own `client_credentials` token — no signed-in user is ever required, so `/me`, `/auth/signin`, and iron-session were removed entirely rather than kept unused.

### Layer responsibilities

**Jobs and storage (the write path)**

- `src/instrumentation.ts` → `src/lib/jobs/scheduler.ts` — a one-minute tick that runs what the *database* says is due, not what a timer in memory remembers: **ingest** when the last success is older than 30 minutes, **forecast** when no row exists for today (which is the "at midnight" trigger, and also catches a missed midnight after a restart). Guarded by `pg_try_advisory_lock`.
- `src/features/campus/ingest.ts` — builds the payload via `buildDashboardPayload()` and stores it in `dashboard_snapshots`. A 42 API failure throws *before* anything is written, so the previous snapshot survives; the session-history sync that follows is wrapped separately for the same reason.
- `src/features/campus/session-history.ts` — host sessions into `location_sessions`, keyed on the 42 location id. First run backfills 60 days (~7,900 rows, ~75 pages, ~3 min); later runs re-read 3 days (~2 pages) so sessions that have since closed get their `end_at`.
- `src/features/campus/forecast-job.ts` — aggregates that history in SQL (daily uniques, and per-hour presence by expanding each session over the hours it touches) and stores the outlook in `attendance_forecasts` under today's date.
- `src/lib/db/pool.ts` + `schema.sql` — a `pg` pool and idempotent DDL applied on boot. `hasDatabase()` gates the whole thing: with no `DATABASE_URL` the app still runs, minus jobs and forecasts.

**Read path**

- `src/features/campus/dashboard-repository.ts` — `readDashboardView()`: newest snapshot + today's forecast + freshness metadata (`stale`, `nextRefreshAt`). Falls back to `getInitialDashboard()` (a per-request build) when there is no database or nothing has been ingested yet, so the app is never dead on arrival.
- `src/app/dashboard/page.tsx`, `.../display/page.tsx` — server components; they hand the view straight to `CampusBoard`, which is also a server component.
- `src/app/api/campus/dashboard/route.ts` — the same view as JSON, for anything that isn't the board itself.

**42 API access**

- `src/lib/api/42/` — the only code allowed to talk to `api.intra.42.fr`, and now only ever reached from a job.
  - `config.ts` — env var access (`FORTYTWO_CLIENT_ID/SECRET`, `FORTYTWO_CAMPUS_ID`, `FORTYTWO_CURSUS_ID`, etc.), `FortyTwoApiError`, and `hasFortyTwoCredentials()` which gates whether the app runs live or in mock mode.
  - `auth.ts` — `getAppAccessToken()`: the app-level `client_credentials` token, cached at module scope and shared across requests in the same server process.
  - `client.ts` — `fortyTwoFetch` (single request with retry/backoff on 401/429/5xx) and `fortyTwoFetchAllPages` (paginated fetch with a delay between pages to respect rate limits — `maxPages` bounds cost).
  - `resources.ts` — typed endpoint wrappers, deliberately minimal: `fetchActiveLocations`, `fetchEarliestLocationToday`, `fetchProjectsUsers`, `fetchCampusBlocs`, `fetchCampusCursusUsers`, `fetchCoalitionsByBloc`, `fetchCoalitionScoreEvents`, `fetchCoalitionContributors`, `fetchUsersByIds`, `resolveWarsawCampusId`.
  - `transforms.ts` — raw 42 API shapes → this app's domain types (`src/types/campus.ts`).
  - `types.ts` — raw 42 API response shapes, trimmed to only the fields actually consumed.
- `src/features/campus/dashboard-service.ts` — the aggregation root. `buildDashboardPayload()` fires **5** core API calls via `Promise.allSettled` (down from the ~8-call, deeply-paginated version this app started as), so **one failing section never breaks the whole dashboard** — failures are pushed into `payload.errors` and that section renders empty/soft-failed. It then fetches `cursus_users` for the campus-stats screen **sequentially after** that block (measured: as a 6th parallel entry its own 6 pages push the burst past 2 req/s and the blocs call comes back 429). The coalitions screen then adds per-coalition calls (score ledger + contributors) plus one bulk user lookup, run through `mapSequentially` — **do not parallelize these**, it trips the 2 req/s limit and returns 429s. When `hasFortyTwoCredentials()` is false, it returns `buildMockDashboard()` (zeroed data + a setup-instructions ticker) instead of throwing, so the app is always runnable without credentials.
- `src/features/campus/sessions.ts` — the Hall of Fame's week (Sunday → now, campus-local via `startOfWeek(..., { weekStartsOn: 0 })`) and `pickTopSession()`, the longest single session in it. Open sessions are measured to *now*, so a student still at a host can take the crown mid-week and the card keeps counting between refreshes; ties break on the earlier start so the record doesn't flip. Unit-tested in `sessions.test.ts`.
- `src/features/campus/cursus-progress.ts` — turns `/v2/cursus/:id/cursus_users` into the campus-stats numbers. Two things worth knowing before touching it: (1) the endpoint returns *every* enrolment the campus ever had (Warsaw: 575 rows, mostly finished/blackholed/staff), so `currentLearners()` narrows it and everything is counted off that; (2) **intra exposes no milestone field anywhere in the API**, and level is not a proxy for one — Warsaw has Cadets still in the common core at level 9 while Transcenders start at 14 — so the chart bands by whole level and "past common core" comes from `grade`. Unit-tested in `cursus-progress.test.ts`.
- `src/features/campus/coalition-history.ts` — rebuilds each coalition's score across the **current season** from `/v2/coalitions/:id/scores`, an append-only ledger. The API has no "score at time T" endpoint, so history is reconstructed backwards from the current total (current minus every event after T). **Coalition scores reset between seasons and the reset is not recorded in the ledger** — the full Warsaw ledger sums to ~12x the live score, so charting it all would plot deeply negative. Points reconstructing below zero are therefore dropped (that boundary *is* the last reset), the window is clamped to what the fetched pages cover, and coalitions with no events are omitted rather than drawn flat at their current score. Unit-tested in `coalition-history.test.ts` — note day boundaries are campus-local, so tests must derive expected timestamps via `startOfDay` rather than hardcoding UTC strings.
- `src/lib/snapshots/campus.ts` — coalition scores from the 42 API are point-in-time only, so the *delta* shown in the ticker is computed by diffing `campus-latest.json` against `campus-previous.json` in `data/snapshots/` (gitignored), written at most every 30 minutes. Deltas therefore need a long-running host and reset on ephemeral deploys. The score-history **chart** does not depend on this — it comes from the API ledger (see above).
- `src/features/campus/attendance-forecast.ts` — the estimator behind the presence screen's three "estimated" tiles and the peak hour: same-weekday samples, recency-weighted (0.8/week) **median** (not mean — one public holiday would drag a mean 20%), scaled by a within-weekday trend factor clamped to ±15%, with the weighted quartiles as the displayed range. Backtested on 60 days of real Warsaw history: **MAPE 8.5%, mean absolute error ~4.5 students** over the last 21 days; errors are much larger in the first weeks after a fresh install, when a weekday has only 3–4 samples. `forecastAttendance()` takes an options bag purely so the parameters can be swept against real history again. Unit-tested in `attendance-forecast.test.ts`.
- `src/features/campus/campus-time.ts` — `campusToday()` / `campusTimezone()`. Every day boundary on this board is campus-local (`CAMPUS_TIMEZONE`, default `Europe/Warsaw`), including the SQL that buckets sessions into days and hours.
- `src/lib/dashboard-config.ts` — `INGEST_INTERVAL_MS` (30 min) is the one cadence knob: the scheduler, the client's reload timer and the staleness banner all derive from it.
- `src/stores/display-store.ts` — Zustand store, **local-only, persisted to localStorage** (`ft-warsaw-display` key). Holds exactly the screen-rotation state: `activeScreen` (one of `"stats" | "presence" | "achievements" | "coalitions"`, see `DisplayScreenId` in `src/types/campus.ts`), `rotationEnabled`, `rotationIntervalMs`.
- `src/data/campus-facts.ts` — static "did you know" facts shown on the coalitions screen, no API dependency.

### The four screens

`campus-board.tsx` renders **all four** on the server and hands them to `screen-switcher.tsx`, the client component that shows one at a time based on `useDisplayStore().activeScreen`, auto-advancing every `rotationIntervalMs` (see `screen-rotation.tsx`). Switching screens therefore costs nothing — no fetch, no re-render of the data.

1. **Campus stats** — five headline metrics + `level-distribution-chart.tsx` (donut of students per cursus level band) and `active-projects-chart.tsx` (horizontal bars, students registered per in-progress project). Chart colors come from `src/lib/charts/palette.ts`: an ordinal one-hue ramp validated against the panel surface, not a categorical palette — the level bands are a scale, not eight unrelated categories.
2. **Presence** — "On campus" now, then the three-day attendance outlook and the peak hour (`forecast-metrics.tsx`, read from `attendance_forecasts`); below that `presence-board.tsx`: two honour cards side by side on top (`hall-of-fame.tsx` = the longest single host session since Sunday, `featured-student.tsx` = first login today), with the "on campus now" grid below them.
3. **Achievements** — `recent-passes.tsx` (recently validated projects), full width.
4. **Coalitions** — top half is `coalition-score-chart.tsx` (each coalition's real season-to-date score history reconstructed from the API ledger, with a legend — colors are each coalition's own API-provided brand color, not a reassigned categorical palette; the Y axis is fitted to the data rather than zero-based); bottom half is `top-contributors.tsx` (top 5 students by score per coalition, one column per coalition).

**The three charts are client components (recharts); everything around them is server-rendered.** They are the deliberate exception to the server-first rule — recharts measures its container in the browser, so the charts fit whatever panel they land in. They still take their data as props from the server: a chart never fetches. Keep new charts to the same shape (`"use client"` leaf, data in via props), and keep everything that isn't a chart on the server.

There is no tab/nav UI for switching screens on purpose — this is a passive display, not an app someone clicks through.

### Adding a new 42-API-backed feature

1. Add a raw-shape type in `src/lib/api/42/types.ts` if needed.
2. Add a fetch wrapper in `resources.ts` (respect pagination/rate limits — use `fortyTwoFetchAllPages` with a sane `maxPages`).
3. Add a transform in `transforms.ts` mapping to a domain type in `src/types/campus.ts`.
4. Wire it into `dashboard-service.ts` (as another `Promise.allSettled` entry, soft-failing into `errors`). It runs inside the ingest job, so it costs latency in a background job, never in a page load.
5. It reaches the screen through the stored payload — nothing else to wire, since the board renders `DashboardPayload` straight from the snapshot. **Bump the payload shape carefully**: an old snapshot may still be in the table after a deploy, so read defensively or accept that the first ingest fixes it.
6. Update `docs/42-api-data-map.md` with the endpoint/fields/limitations — this file is the source of truth for which 42 endpoints back which feature, and documents intentional scope cuts (e.g. no campus-wide logtime leaderboard, no rank distribution — both would require substantially more API calls for a passive hallway screen).

Before adding a new API call, weigh it against the rate budget (2 req/s, 1200 req/hour) and the "is this worth another round-trip for a screen nobody interacts with" bar — this app was deliberately cut down from a multi-page site with ~8 aggregate calls to a 3-screen dashboard with 5.

## Key conventions

- **The browser never fetches campus data.** No client-side data fetching, no `useEffect` loading. Client components render props; they never go and get anything. If a screen needs something new, the ingest job computes it and the server passes it down.
- Never call the 42 API from the request path (page render or route handler) — only from a job. A slow or 429ing API must never be able to slow down or blank the wall display.
- Treat partial data as normal: aggregation code should soft-fail per-section (push to an `errors` array) rather than throwing, matching the existing pattern in `dashboard-service.ts`.
- Don't fabricate data to fill gaps (e.g. missing historical XP, full logtime podiums) — this is an explicit product constraint recorded in the README and `docs/42-api-data-map.md`; leave the section out rather than inventing data.
- Don't reintroduce login/session/OAuth for dashboard features — check whether the data is available via the app's `client_credentials` token first (most 42 campus-wide data is); only a genuinely personal, user-scoped feature would justify bringing auth back.
