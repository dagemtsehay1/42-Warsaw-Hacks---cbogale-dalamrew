# Technical architecture

## 1. What it is

A dashboard for a TV in the Social Space. It shows what's happening at 42 Warsaw
right now — who's on campus, what people are building, who just passed something,
how the coalitions are doing — and rotates through four screens on a loop so
there's always something new to look at when you walk past.

It is one page. There's no login, no menu, nothing to click. That's on purpose:
it's a screen on a wall, not an app somebody stands there and uses.

The four screens rotate every 20 seconds:

1. **Campus stats** — headline numbers, level distribution, what projects people
   are working on
2. **Presence** — who's here now, the attendance forecast, longest session of the
   week, first person in today
3. **Achievements** — the twenty most recent validated projects as a wall of
   faces, with fireworks behind the exam passes
4. **Coalitions** — score history for the season and the top contributors

### How to use it

 URLs:

- `/dashboard` — the board with its controls: a clock, arrows to skip screens, a
  fullscreen button. This is the one you open on a laptop to check on things.


The data refreshes itself. Every 30 minutes a background job pulls fresh numbers
from the 42 API, and the page reloads itself when the new data is due. Nobody has
to touch it.

## 2. Getting it on the TV

The whole thing is already containerised, so putting it up is two steps.

**Step one — start it.** On whatever machine hosts it:

```bash
cp .env.example .env      # fill in FORTYTWO_CLIENT_ID / SECRET
npm run docker:up
```

That builds the app image, starts Postgres, waits for it to be healthy, and boots
the app. It's live on port `27942`. The first run backfills 60 days of session
history, which takes a few minutes — `npm run docker:logs` shows the progress.

Both containers are `restart: unless-stopped`, so a power cut or a reboot brings
everything back on its own. Postgres data lives in a named volume, so restarts
don't lose the history the forecast is built on.

**Step two — Open it on browser**:

Then hit the fullscreen button once. The screen rotation and fullscreen state are
saved in localStorage, so if the display device restarts it comes back the way it
was.

A few things that make it survive being left alone for weeks:

- The page never fetches data in the browser, so there's no client-side state to
  drift or leak over a long uptime.
- If the 42 API goes down, the board keeps showing the last good snapshot and the
  header says how old it is. It doesn't go blank or throw an error page.
- The container has a healthcheck hitting the JSON endpoint every 30 seconds, so
  Docker notices if the app wedges.

## 3. Why this stack

**Next.js 16 , server components.** The 42 API secret can never reach
the browser. Server components mean the page is rendered server-side with the
data already in it — no API layer of our own to build, no token anywhere near the
client. And a browser that never fetches can't show a loading spinner on a wall.

**Postgres.** We need three things a file can't give us: snapshots that survive a
restart, 60 days of session history, and an hourly presence query that expands
each session across the hours it touches. That last one is a `generate_series`
over time ranges — the kind of thing SQL is genuinely good at.

**Raw `pg`, no ORM.** Four tables and about six queries. An ORM would be more
setup than the thing it replaces, and the one query that matters is the one an
ORM would make harder to write.

**Recharts** for the three charts, and only those. They're the one place we allow
client-side code, because Recharts measures its container in the browser — which
is what makes the charts fit whatever panel and whatever screen size they land
on. They still get their data as props from the server; a chart never fetches.

**Zustand** holds exactly three values: which screen is showing, whether rotation
is on, and how fast. Persisted to localStorage. No server state, so no React
Query and no cache layer to reason about.

**Tailwind v4.** The design is one page with a fixed layout on a known screen.
Utility classes are the shortest path there, with no runtime cost on a machine
that renders the same page forever.

**Docker Compose.** Two containers, one command. The app image is also the
worker — the same process serves pages and runs the jobs — so there's no separate
worker service to deploy or keep alive. A Postgres advisory lock stops two
instances from doubling the API traffic if one ever gets started twice.

## 4. Architecture

The write path talks to 42; the read path talks to Postgres. They never meet —
that separation is the whole design. Two humans can also write, from their
phones, and they go through Postgres like everything else.

```
   WRITE PATH (background, every 30 min)          READ PATH (on request)
   ══════════════════════════════════════         ══════════════════════

   ┌──────────────────┐
   │  42 Intra API    │  2 req/s, 1200/hr
   │  api.intra.42.fr │
   └────────┬─────────┘
            │ ~90 requests
            ▼
   ┌──────────────────────────────┐
   │  ingest job                  │
   │  build payload → snapshot    │
   │  + events, prune listings    │
   │  (nothing written on failure)│
   └────────┬─────────────────────┘
            │                                  ┌─────────────────┐
            ▼                                  │  TV browser     │
   ┌────────────────────────┐                  │  /display       │
   │      Postgres          │                  └────────┬────────┘
   │                        │                           │ GET
   │  dashboard_snapshots   │◀──────────────────────────┤
   │  location_sessions     │   5 indexed queries       │
   │  attendance_forecasts  │──────────────────────────▶│
   │  campus_events         │   server-rendered HTML    │
   │  teammate_requests     │                  ┌────────▼────────┐
   │  slides                │                  │ 5–6 screens     │
   │  job_runs              │                  │ rotate every    │
   └────────▲──────▲────────┘                  │ 20s, no fetch   │
            │      │                           └─────────────────┘
            │      │ server actions
            │      │ (42 login required)
            │      │
            │   ┌──┴──────────────────┐
            │   │  phone / laptop     │
            │   │  /teammate  /admin  │  ← QR code on the wall
            │   └─────────────────────┘
            │ reads history
   ┌────────┴─────────────┐
   │  forecast job        │
   │  once a day          │
   └──────────────────────┘

   ── both jobs run inside the app container ──
      scheduler ticks every 60s, asks the DB what's due,
      takes a Postgres advisory lock before running
```

### The third path: people

The teammate board and the admin page are the only places anything other than the
ingest job writes. Both sit behind a 42 login:

- **`/teammate`** — any student. The session says who you are; the form only says
  *which project*, so no request shape can list or remove somebody else.
- **`/admin`** — the `staff?` flag off `/v2/me`. No shared password to circulate,
  and it tracks staffing changes on its own. Every server action re-checks it,
  because hiding the UI is presentation and a server action is a public endpoint.

The cookie is signed (HMAC), not encrypted — none of it is secret, your login and
avatar are on the wall already; it only has to be unforgeable. There is no session
table: a login costs one 42 API call and every request after it costs none.

Student writes land in Postgres and the board picks them up on its next render,
so a student can watch their own name appear from across the room. That is the
one place the 30-minute cadence would have felt broken, which is why events,
teammates and slides are read live alongside the snapshot rather than baked into
it.

### What happens each cycle

**Every 30 minutes.** The scheduler notices an ingest is due. It calls the 42 API
— five requests in parallel, then the heavy ones one at a time so we stay under
2 req/s — assembles the whole payload in memory, and only then writes it as a
single snapshot row. If anything fails partway through, nothing is written and
the previous snapshot stays put. Then it syncs the last three days of host
sessions into the history table.

**Once a day.** The forecast job reads 60 days of session history straight out of
Postgres, works out expected attendance for today and the next three days, and
stores it. No API calls. It runs on the first tick after midnight, and because
"has it run today?" is a database question rather than a timer, a restart at
3am doesn't skip it.

**On every page load.** Two indexed queries: newest snapshot, today's forecast.
That's it. No 42 API call, ever, on this path. It's the same whether one TV is
watching or twenty.

**In the browser.** A timer calls `router.refresh()` when the next ingest is due,
which re-runs the page on the server and streams new markup down. The browser
holds no copy of the campus data and runs no fetching logic — it just renders
what it's given and switches between four screens it already has.

### The containers

| Container | What it does | Port | Restart |
|---|---|---|---|
| `ft-warsaw-app` | Serves the board **and** runs both jobs | `27942 → 3000` | `unless-stopped` |
| `ft-warsaw-postgres` | Snapshots, session history, forecasts | `26542 → 5432` | `unless-stopped` |

Ports are deliberately odd. 5432 collides with a locally installed Postgres —
which fails confusingly, because the wrong server answers and rejects the login —
and 3000 collides with every other dev server on the machine.

| Volume | Holds | Survives |
|---|---|---|
| `pgdata` | Everything in Postgres | `docker:down`, `docker:clean` |
| `snapshots` | JSON files for the coalition score deltas in the ticker | same |

`npm run docker:nuke` removes the volumes too, which means the next boot
re-backfills 60 days of history from scratch.
