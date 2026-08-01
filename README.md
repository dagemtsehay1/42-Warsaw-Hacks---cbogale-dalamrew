# 42 Warsaw Campus Dashboard

A single-purpose hallway TV dashboard for **42 Warsaw** — built to run unattended on a 55–65″ display and show what's happening on campus right now.

![Screenshots](docs/screenshots/.gitkeep)

> Add screenshots of `/dashboard` and `/dashboard/display` under `docs/screenshots/`.

## Purpose

Everything a passerby wants to glance at, rotating automatically:

- Who is currently on campus, and who logged in first today?
- Who recently passed a project, and which projects have the most people on them right now?
- How are the coalitions competing?

## Features

- **Campus monitor** (`/dashboard`, `/dashboard/display`) rotating through four screens — Campus Stats, Presence, Achievements, Coalitions — with a scrolling ticker, fullscreen, and a 30-minute refresh
- **Survives a 42 API outage**: the API is read by a background job, never by a page load, so the wall keeps showing the last good data (with its age in the header) when intra is down or rate-limiting
- **Attendance forecast**: how many students to expect over the next three days, and the hour the campus fills up, fitted from ~60 days of the campus's own session history
- No login, no accounts: every data source is fetched with the app's own 42 API credentials (`client_credentials`), so there is nothing to sign into
- Secrets never reach the browser — and neither does any data fetching: the board is server-rendered HTML

## Stack

- Next.js 16 (App Router, server components)
- React 19 + TypeScript
- PostgreSQL 17 (Docker) via `pg`
- Recharts (the three charts, client-side; everything else is server-rendered)
- Zustand (screen rotation state only, persisted locally)
- Tailwind CSS 4
- Vitest

No client-side data layer: the board is server-rendered and the browser only ever
renders. The charts are the one client-side piece (recharts, so they resize to
their panel) and they take their data as props — nothing in the browser fetches.

## Architecture

```text
                  every 30 min                       on request
42 API ───────────────────────────▶ Postgres ──────────────────────────▶ Server-rendered HTML ──▶ TV
        (background ingest job)     (snapshots,     (two indexed queries,   (no fetching in the
                                     sessions,       no 42 API call)         browser at all)
                                     forecasts)
```

Two background jobs run inside the web server (started by `src/instrumentation.ts`,
guarded by a Postgres advisory lock so extra instances don't multiply API traffic):

| Job | When | What it does |
|-----|------|--------------|
| `ingest` | every 30 min | Builds the whole dashboard payload from the 42 API and stores it. On failure nothing is written, so the previous snapshot stays on screen. Also syncs host sessions (60-day backfill on first run, ~3 days after that). |
| `forecast` | once per campus-local day (first tick after midnight) | Recomputes the attendance outlook from the stored session history and stores it under today's date, so the numbers on the wall are fixed for the whole day. |

There is no OAuth or session layer — the dashboard only ever needs the app's own client-credentials token, never a signed-in user's.

See [docs/42-api-data-map.md](docs/42-api-data-map.md) for feature → endpoint mapping and limitations.

## Setup

1. Create an application at [Intra OAuth Applications](https://profile.intra.42.fr/oauth/applications) — no redirect URI is needed, the dashboard never performs the user OAuth flow.
2. `cp .env.example .env` and fill in the Client ID / Secret.
3. `npm run db:up` — starts PostgreSQL in Docker (`docker-compose.yml`). If port 5432 is taken, change `POSTGRES_PORT` **and** the port in `DATABASE_URL`.
4. `npm install && npm run dev`.

The schema is applied automatically on boot, and the first ingest starts
immediately: expect the board to be empty for a minute or two while the 60-day
session backfill runs (~7,900 sessions, ~3 minutes), then to fill in on its own.

Without `DATABASE_URL` the app still runs — it falls back to building the payload
per request — but there are no jobs and no attendance forecast.

## Environment variables

```env
FORTYTWO_CLIENT_ID=
FORTYTWO_CLIENT_SECRET=
FORTYTWO_API_BASE_URL=https://api.intra.42.fr
FORTYTWO_CAMPUS_ID=
FORTYTWO_CURSUS_ID=21

DATABASE_URL=postgres://ft42:ft42@localhost:5432/ft42_dashboard
POSTGRES_USER=ft42
POSTGRES_PASSWORD=ft42
POSTGRES_DB=ft42_dashboard
POSTGRES_PORT=5432

CAMPUS_TIMEZONE=Europe/Warsaw
```

Never commit real credentials.

## Attendance forecast

The presence screen's three "estimated" tiles and the peak hour are fitted from
`location_sessions` — ~60 days of the campus's own host sessions, which is 8–9
observations of every weekday. For a given day the estimator takes that weekday's
own history (Tuesday looks nothing like Sunday), weights it towards the recent
weeks (0.8 per week back), takes the **median** rather than the mean so one public
holiday can't drag it, and scales it by a within-weekday trend factor clamped to
±15% so a piscine or a summer dip is followed without overshooting. The
low–high hint under each number is the weighted quartiles of the same samples.

Backtested against 60 days of real Warsaw history — forecasting each of the last
21 days using only the days before it — the estimator lands within **8.5% (MAPE),
about 4–5 students**, and is frequently exact on weekdays. Accuracy is much worse
in the first weeks after a fresh install, when a weekday has only 3–4 samples.

It cannot know about public holidays, exam days or campus events: none of those
are in any 42 endpoint, so a holiday Tuesday is forecast as a normal Tuesday.

## Installation

```bash
npm install
cp .env.example .env.local
# fill in FORTYTWO_CLIENT_ID / FORTYTWO_CLIENT_SECRET
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (redirects to `/dashboard`).

## Build / production

```bash
npm run build
npm start
```

For a wall display, open `/dashboard/display` in a dedicated browser profile and use Fullscreen (or OS kiosk mode).

## Dashboard display mode

| Route | Behavior |
|-------|----------|
| `/dashboard` | Same monitor, with a manual refresh button |
| `/dashboard/display` | Shell-less presentation mode for a dedicated kiosk browser |

Both rotate through the same four screens (Campus Stats, Presence, Achievements, Coalitions) every 20 seconds. Rotation state is stored locally via Zustand persistence.

## Fullscreen mode

The Fullscreen control uses the browser Fullscreen API. If unavailable, it falls back to `/dashboard/display`.

## Data refresh strategy

- The ingest job pulls the 42 API every **30 minutes** and stores a snapshot
- The board reloads itself just after the next ingest is due (`router.refresh()`, so the server re-renders and the browser swaps in new markup — it never fetches data itself)
- A failed ingest changes nothing on screen: the previous snapshot is still what gets served
- Header shows `Last updated HH:MM`, plus a warning when the newest snapshot is older than an hour or came back with soft-failed sections
- Manual refresh outside display mode re-renders from the stored snapshot; it does **not** hit the 42 API

## Coalition score history

The coalition line chart is built from real 42 data: the API exposes each coalition's current total plus `/v2/coalitions/:id/scores`, an append-only ledger of individual score events, so the whole season is reconstructed by walking that ledger backwards from the current score.

Coalition scores are wiped between seasons and those resets are *not* written to the ledger — the Warsaw ledger reaches back to 2024 and sums to roughly twelve times the live score. The chart therefore starts at the last reset, found by walking back until the running score would cross zero. No local history file is involved and no points are invented; if the ledger doesn't cover a coalition, that series is left off the chart rather than drawn flat.

## Cursus levels, not milestones

The Campus Stats screen bands students by whole cursus level rather than by common-core milestone. The intra API has no milestone field — neither `cursus_users` nor `/v2/projects` (which groups only by `difficulty`/`parent`) exposes one — and level can't stand in for it: Warsaw currently has Cadets still inside the common core as high as level 9, against Transcenders starting at 14. Inventing a level→milestone table would put wrong numbers on the wall, so the chart shows the measure the API actually publishes; "past common core" is taken from `grade` (Transcender/Alumni), which is authoritative.

## Snapshots

Coalition score *deltas* (shown in the ticker) are computed from JSON snapshots in `data/snapshots/` (gitignored), written at most every 30 minutes on successful dashboard refresh. This is intended for a long-running campus host; ephemeral serverless filesystems will not retain them across deploys. The history chart above does not depend on these.

## API limitations

- Default 42 rate limit: **2 req/s**, **1200 req/hour** — the dashboard is deliberately scoped to a handful of calls per refresh to stay well under this
- Full campus-wide logtime leaderboards, rank distributions, and per-user evaluation stats are intentionally out of scope (too expensive per user, or not worth the extra API load for a hallway screen)
- Historical XP charts are not fabricated

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm test
```

## License

Private hackathon project unless otherwise specified.
