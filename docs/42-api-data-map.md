# 42 API Data Map

Maps dashboard features to official 42 Intra API endpoints (`https://api.intra.42.fr/v2`).

Rate limits (default): **2 requests/second**, **1200 requests/hour**. All traffic goes through the app's own `client_credentials` token; the browser never talks to the 42 API and there is no user OAuth flow.

**Every call below happens in the background ingest job, once every 30 minutes** (`src/features/campus/ingest.ts`), never on a page load. Pages read the stored snapshot out of Postgres. One ingest costs roughly 85–95 requests, so the schedule uses ~190/hour of the 1200/hour budget; the first ingest after a fresh install adds a one-off ~75-page session backfill.

Campus resolution: `GET /v2/campus` → find name/city `Warsaw`, or `FORTYTWO_CAMPUS_ID`.
Default cursus: `FORTYTWO_CURSUS_ID` (usually `21` = 42cursus).

---

## Campus dashboard aggregate

| Field | Value |
|-------|-------|
| Feature | `/api/campus/dashboard` aggregate payload |
| Endpoints | `/v2/campus/:id/locations` (active + earliest-today + this week's sessions), `/v2/projects_users` (finished + in_progress), `/v2/blocs`, `/v2/blocs/:id/coalitions`, `/v2/cursus/:id/cursus_users` (campus stats), `/v2/coalitions/:id/coalitions_users` (one call per coalition), `/v2/users` (one bulk call for contributor profiles) |
| Transformation | See `src/features/campus/dashboard-service.ts` |
| Refresh | 30 minutes (`staleTime` + `refetchInterval`) |
| Limitations | Aggregation is rate-limit sensitive; partial failures soft-fail per section. Core sections use 5 parallel calls per refresh (1–2 pages each); `cursus_users` (6 pages for Warsaw) and the Hall of Fame's week of locations (9 pages) then run **sequentially after** that block, because riding along in the parallel burst pushes it past 2 req/s and the other sections come back 429. The coalitions screen adds one `coalitions_users` call per coalition plus a single bulk `/v2/users?filter[id]=...` call for contributor names/avatars — typically 4–5 more calls for a 3–4 coalition campus, still well under the hourly budget. |

---

## Campus stats screen

| Field | Value |
|-------|-------|
| Feature | Headline campus numbers + level distribution donut + in-progress project bar chart |
| Endpoints | `GET /v2/cursus/:cursusId/cursus_users?filter[campus_id]=…` (levels, grades, blackhole dates); `GET /v2/projects_users?filter[status]=in_progress` (already fetched for the pulse tile); `users_count` off the campus record |
| Fields | `level`, `grade`, `begin_at`, `end_at`, `blackholed_at`, `user.staff?` |
| Refresh | 30 min |
| Limitations | **The API exposes no milestone field** — not on `cursus_users`, and `/v2/projects` groups only by `difficulty`/`parent` — and level is not a stand-in for one: Warsaw has Cadets (still inside the common core) as high as level 9 while Transcenders start at 14+. The donut therefore bands students by whole cursus level rather than inventing a level→milestone table; "past common core" comes from `grade` (Transcender/Alumni), which is the one authoritative signal. Warsaw's 575 enrolment rows include years of finished, blackholed and staff records, so every number is counted off current learners only (no `end_at`, blackhole not yet passed, non-staff) — see `src/features/campus/cursus-progress.ts`. |

---

## Presence screen

| Field | Value |
|-------|-------|
| Feature | Attendance outlook + peak hour (metric row), Hall of Fame + first session today (side by side), on campus now (below) |
| Endpoint | `GET /v2/campus/:id/locations` (`filter[active]=true`) for current sessions, a single-page range query on `begin_at` for today's earliest login, and a `range[begin_at]=<Sunday>,<now>` query (9 pages for Warsaw, ~840 sessions) for the Hall of Fame week |
| Fields | `begin_at`, `end_at`, `host`, `user` |
| Refresh | 30 min |
| Derived | The "estimated tomorrow / in <day>" tiles and "peak hour today" are **not** an API feature — no 42 endpoint forecasts attendance. They are fitted locally from the same `locations` data, stored in `location_sessions` (60 days) and recomputed once a day; see the README's *Attendance forecast* section for the estimator and its measured error. "Passed today", "passed this month" and "active projects" used to sit in these tiles and were replaced by them. |
| Limitations | Host login ≠ "working on a project". Earliest login uses the first known location begin time today; a student who already logged out won't appear in the active list but is still captured by the earliest-login query. The Hall of Fame ranks the longest **single** session that *started* this week — a session that began before Sunday and ended after it is out of the window, and an unfinished session is measured to now (so it keeps growing on screen). It is not a logtime total; a campus-wide logtime leaderboard is still out of scope. |

---

## Achievements screen

| Field | Value |
|-------|-------|
| Feature | Recently passed projects — 2 × 10 portrait wall, exam ranks celebrated |
| Endpoint | `GET /v2/projects_users` — `filter[status]=finished&filter[marked]=true&sort=-marked_at` for passes, `filter[status]=in_progress` for the "Active projects" pulse tile on the presence screen |
| Fields | `user.login`, `user.image`, `project.name`, `final_mark`, `marked_at`, `status` |
| Refresh | 30 min |
| Derived | "Is this an exam?" is read off the project **slug** (`exam-rank-05`, `42next-exam-rank-02`). `/v2/projects` does carry an `exam` boolean, but the `project` object nested in `projects_users` is trimmed to `{id, name, slug, parent_id}`, and resolving the flag properly would cost one extra call per distinct project. |
| Limitations | The per-project active board was cut; the in-progress fetch now only backs the "Active projects" pulse count, which counts in-progress `projects_users` rows — inferred activity, not live IDE presence. Pagination capped to protect rate budget. |

---

## Coalitions screen

| Field | Value |
|-------|-------|
| Feature | Score history line chart (top half) + top 5 contributors per coalition (bottom half) |
| Endpoints | `GET /v2/blocs`, `GET /v2/blocs/:id/coalitions` for standings; `GET /v2/coalitions/:id/scores` (per coalition) for the score ledger behind the history chart; `GET /v2/coalitions/:id/coalitions_users` (per coalition) for contributors; `GET /v2/users?filter[id]=...` (one bulk call for every unique top-5 `user_id`) to resolve login/avatar |
| Fields | `name`, `slug`, `color`, `image_url`, `score` (coalition); `value`, `created_at` (scores); `user_id`, `score` (coalitions_users); `login`, `image` (users) |
| Refresh | 30 min |

**Score history is reconstructed, not stored.** The API exposes each coalition's *current* total plus `/v2/coalitions/:id/scores`, an append-only ledger of individual score events. `buildCoalitionScoreHistory` (`src/features/campus/coalition-history.ts`) walks that ledger backwards from the current total — the score at time T is the current score minus every event after T — producing a real daily series for the current season with no local state and nothing fabricated.

**Coalition scores are reset between seasons, and the resets are not in the ledger.** This is the single most important fact about this endpoint. The 42 Warsaw ledger goes back to June 2024 and sums to ~505,000 points, while the live score is ~42,000 — so naively charting "all of history" drives the reconstruction to roughly −463,000. The last reset is found instead by walking backwards until the running score would cross zero (mid-June 2026 at time of writing, and all three coalitions reset together). Two mechanisms enforce this:

- `fetchCoalitionScoreEvents` takes the coalition's current score and stops paging as soon as the events collected exceed it — that page is the reset boundary. This also keeps the fetch to ~10 pages instead of the ~48 a full-ledger read would need.
- `buildCoalitionScoreHistory` drops any leading points that reconstruct below zero, so a too-deep fetch still can't plot pre-reset scores.

Other API quirks worth knowing before touching this code:

- `range[created_at]` is **ignored** on `/v2/coalitions/:id/scores` (`x-total` comes back identical for a 7-day and a 30-day window). Paging with `sort=-created_at` is the only way to bound the window.
- `sort=-score` and `sort=rank` are both **rejected** by `/v2/coalitions/:id/coalitions_users` ("The score field is not sortable"), so the top 5 are sorted client-side.
- `coalitions_users` does **not** embed a user object — only `user_id` — hence the one bulk `/v2/users?filter[id]=a,b,c` lookup (comma-separated ids work).
- If a coalition's ledger can't be fetched, it is **omitted from the chart** rather than drawn: with no events to subtract it would plot as a flat line at its current score, which reads as "scored nothing all week" instead of "no data".
- These per-coalition calls run **sequentially** (`mapSequentially` in `dashboard-service.ts`); firing them in parallel trips the 2 req/s limit and returns 429s. With the season-long ledger read this puts a full dashboard build at roughly 25s (~30 API calls), which is fine at a 30-minute refresh — about 60 calls/hour against a 1200/hour budget. The score fetch also paces itself at 750ms between pages, since it is the heaviest call on the dashboard.

Coalition score *deltas* (shown in the ticker) still come from the local JSON snapshots in `data/snapshots/`.

---

## Out of scope (by design)

To keep this a focused hallway display and minimize API load, the following were deliberately cut rather than built with fabricated or misleading data:

- **Campus-wide logtime leaderboards** — per-user `locations_stats` calls would blow the rate budget for a single screen.
- **Rank distribution / average level** — required sampling the full campus user list (`/v2/campus/:id/users`, several extra pages) for a chart of secondary interest on a passive display.
- **Evaluations metric** (`/v2/scale_teams`) — often requires OAuth scopes beyond `client_credentials` and wasn't essential to the three core screens.
- **Student directory, project catalog, activity feed, rankings, and personal `/me` dashboard** — all removed along with their pages; this app is now a single rotating dashboard, not a multi-page site.
