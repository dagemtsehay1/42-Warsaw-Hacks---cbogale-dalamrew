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

- **Campus monitor** (`/dashboard`, `/dashboard/display`) rotating through four screens — Campus Stats, Presence, Achievements, Coalitions — with a scrolling ticker, fullscreen, and 30-minute auto-refresh
- No login, no accounts: every data source is fetched with the app's own 42 API credentials (`client_credentials`), so there is nothing to sign into
- Secure server-side 42 API client (secrets never exposed to the browser)

## Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- TanStack React Query
- Zustand (screen rotation state only, persisted locally)
- Tailwind CSS 4
- Vitest

## Architecture

```text
Browser → React Query → Next.js BFF (/api/campus/dashboard) → 42 API (client_credentials)
```

There is no OAuth or session layer — the dashboard only ever needs the app's own client-credentials token, never a signed-in user's.

See [docs/42-api-data-map.md](docs/42-api-data-map.md) for feature → endpoint mapping and limitations.

## 42 API setup

1. Create an application at [Intra OAuth Applications](https://profile.intra.42.fr/oauth/applications)
2. Copy the Client ID / Secret into `.env.local` — no redirect URI is needed since the dashboard never performs the user OAuth flow

## Environment variables

Copy `.env.example` to `.env.local`:

```env
FORTYTWO_CLIENT_ID=
FORTYTWO_CLIENT_SECRET=
FORTYTWO_API_BASE_URL=https://api.intra.42.fr
FORTYTWO_CAMPUS_ID=
FORTYTWO_CURSUS_ID=21
```

Never commit real credentials.

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

- Dashboard queries use **30 minute** `staleTime` + `refetchInterval`
- Manual refresh is available outside display mode
- Cached data remains visible during reconnect / API errors
- Header shows `Last updated HH:MM` and a subtle refreshing/reconnecting state

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
