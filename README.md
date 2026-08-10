*This project has been created as part of the 42 warsaw hackathon by cbogale and dalamrew*

# 42 Warsaw Campus Dashboard

A dashboard for a TV in the Social Space. It shows what's happening at 42 Warsaw
right now and rotates through four screens on a loop, so there's always something
new when you walk past.

No login, no menu, nothing to click. It's a screen on a wall, not an app.

## What's on it

Five screens, 20 seconds each:

| Screen | Shows |
|---|---|
| **Campus stats** | Headline numbers, level distribution, what projects people are working on |
| **Presence** | Who's here now, attendance forecast, longest session of the week, first person in today |
| **Achievements** | The twenty most recent validated projects as a wall of faces — exam passes get fireworks |
| **Coalitions** | Score history for the season and the top contributors |
| **This week** | Campus events, plus who's looking for a teammate and the QR code to join them |

A sixth screen, **Notices**, appears only when bocal has uploaded a slide — with
nothing to show it stays out of the rotation rather than putting a blank panel on
the wall every cycle.

### Find a teammate

Bottom right of the "This week" screen is a QR code. Scan it, sign in with 42,
and you get a list of your in-progress projects — tap one to put your name on the
wall for it. Scan again later and the same list shows what you've added, so
taking your name down is another single tap. Listings expire after 14 days on
their own, because nobody ever comes back to tick "found someone".

It lists **all** your in-progress projects rather than filtering to group ones:
the API has no reliable flag for team size, and asking for help on a solo project
is your own business.

### Slides for bocal

`/admin` takes a 42 login and checks the `staff?` flag — no shared password to
pass around. Upload a poster and it becomes a screen in the rotation; hide or
delete it and it's gone on the next refresh.

## Running it

You need 42 API credentials first — make an app at
[Intra OAuth Applications](https://profile.intra.42.fr/oauth/applications). No
redirect URI needed; this app never does the user login flow.

```bash
cp .env.example .env      # fill in FORTYTWO_CLIENT_ID and FORTYTWO_CLIENT_SECRET
npm run docker:up         # builds the app image, starts it and Postgres
```

Open **http://localhost:27942/dashboard**.

The first boot backfills 60 days of session history, so give it a few minutes to
fill in — `npm run docker:logs` shows the progress. After that it looks after
itself: both containers restart on their own after a reboot, and the data
refreshes every 30 minutes.

For the TV, open `/dashboard/display` — same board without the controls — and hit
fullscreen once.

### Working on it locally

```bash
npm install
npm run db:up             # Postgres only
npm run dev               # http://localhost:3000
```

Don't run `npm run dev` and `npm run docker:up` at the same time. Nothing breaks
— that's what the advisory lock is for — but you'll have two schedulers logging
into one database and it gets confusing.

Without a `DATABASE_URL` the app still runs, building its data per request. You
just don't get the background jobs or the attendance forecast.

## How it works

Two paths that never meet. A background job talks to the 42 API every 30 minutes
and saves a snapshot; the page reads that snapshot. Nothing on the request path
ever calls 42.

```text
              every 30 min                     on request
42 API ─────────────────────────▶ Postgres ────────────────────▶ server HTML ──▶ TV
       (background ingest job)                (2 indexed queries,
                                               no 42 API call)
```

That's the reason the board doesn't go blank when intra is down or rate-limiting.
It keeps showing the last good data and the header says how old it is.

The browser doesn't fetch anything either. Every number arrives as server-rendered
markup. The only client-side code is the three charts, the rotation timer, the
clock, and a timer that reloads the page when fresh data is due.

Full write-up in [docs/architecture.md](docs/architecture.md).

## Attendance forecast

The "expected students" tiles and the peak hour aren't from the 42 API — no such
endpoint exists. They're fitted from the campus's own past: 60 days of host
sessions, which is 8–9 observations of each weekday.

For any given day it takes that weekday's own history (Tuesday looks nothing like
Sunday), weights recent weeks more heavily, and takes the **median** rather than
the mean so one public holiday can't drag it. Then it scales by a trend factor —
clamped to ±15% — so a piscine or a summer dip gets followed without overshooting.
The low–high range under each number is the quartiles of the same samples.

Backtested on 60 days of real Warsaw history: within **8.5% (MAPE), about 4–5
students**, and often exact on weekdays. Much worse in the first weeks after a
fresh install, when a weekday only has 3–4 samples.

It can't know about public holidays, exam days or campus events — none of those
are in any 42 endpoint, so a holiday Tuesday is forecast as an ordinary one.

## Docs

| Doc | What's in it |
|---|---|
| [Architecture](docs/architecture.md) | What it is, how to get it on a TV, stack choices, data flow diagram |
| [API research](docs/api-research.md) | Endpoints, rate-limit strategy, data quirks, outage handling |
| [42 API data map](docs/42-api-data-map.md) | Feature → endpoint mapping, field lists, and what was left out on purpose |

## Two things worth knowing

**Coalition history is reconstructed, not stored.** The API gives each coalition's
current total plus an append-only ledger of score events, so the season is rebuilt
by walking that ledger backwards. Scores are wiped between seasons and the resets
*aren't* in the ledger — the Warsaw ledger sums to roughly twelve times the live
score — so the chart starts at the last reset, found by walking back until the
running total would cross zero. Nothing is invented; a coalition whose ledger
can't be fetched is left off the chart rather than drawn flat.

**Levels, not milestones.** The stats screen bands students by whole cursus level
because the API has no milestone field anywhere, and level isn't a substitute:
Warsaw has Cadets still in the common core at level 9 while Transcenders start
around 14. "Past common core" comes from `grade`, which is authoritative. Making
up a level→milestone table would put wrong numbers on a wall.

## Config

```env
FORTYTWO_CLIENT_ID=
FORTYTWO_CLIENT_SECRET=
FORTYTWO_CURSUS_ID=21              # 42cursus
FORTYTWO_CAMPUS_ID=                # resolved automatically when empty

DATABASE_URL=postgres://ft42:ft42@localhost:26542/ft42_dashboard
POSTGRES_PORT=26542
APP_PORT=27942

CAMPUS_TIMEZONE=Europe/Warsaw      # every day/week boundary uses this

APP_PUBLIC_URL=                    # needed for the QR code and admin login
SESSION_SECRET=                    # optional; falls back to the 42 secret
```

**`APP_PUBLIC_URL` is the one that needs thought.** It has to be the address a
*phone* can open — `localhost` resolves to the phone itself, so the QR code would
go nowhere. Use the host's LAN address (`http://10.x.x.x:27942`) or a campus
hostname. Then register `<APP_PUBLIC_URL>/api/auth/callback` as a redirect URI on
your intra application; it must match exactly, port included.

Leave it unset and the board still works — the QR code and the admin login just
stay switched off.

### Day boundaries

The campus day starts at **05:00**, not midnight. "First login today" at 02:00 is
somebody finishing yesterday, not starting today, and a midnight boundary would
crown them and reset an hour later. The Hall of Fame week runs **Monday 05:00 to
Monday 05:00** for the same reason: the long sessions it exists to celebrate run
past midnight, and a 00:00 boundary would cut Sunday night's marathon in half.

The attendance forecast deliberately still counts calendar days — "how busy is
Tuesday" means all of Tuesday.

The odd ports are deliberate. 5432 is taken by any locally installed Postgres —
and when that happens the error says `password authentication failed for user
"ft42"`, which looks like a password problem but is really the wrong server
answering. 3000 is taken by every other dev server on the machine.

`DATABASE_URL` is the **host** connection string, for `npm run dev`. The
containerised app ignores it and uses the internal network instead.

Don't commit real credentials.

## Commands

```bash
npm run dev            # dev server on :3000
npm run build          # production build
npm test               # vitest
npm run lint
npm run typecheck

npm run db:up          # Postgres only, for local dev
npm run db:psql        # psql shell

npm run docker:up      # build + start everything (rerun to redeploy)
npm run docker:logs    # follow the app — ingest runs, API errors
npm run docker:down    # stop, keep images and data
npm run docker:clean   # stop and delete images (data survives)
npm run docker:nuke    # ...and the volumes too — next boot re-backfills 60 days
```

`.env` is read at container start, so credential changes just need
`npm run docker:up` — no rebuild.

