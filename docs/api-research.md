# 42 API research

## 1. Endpoints

| Endpoint | What comes back | What it feeds |
|---|---|---|
| `GET /v2/campus` | Campus list. We match on name/city `Warsaw`, or skip the call entirely with `FORTYTWO_CAMPUS_ID`. Also gives `users_count`. | Campus id, "campus members" tile |
| `GET /v2/campus/:id/locations?filter[active]=true` | Open host sessions: `user`, `host`, `begin_at`, `end_at: null` | Presence grid, "on campus now" |
| `GET /v2/campus/:id/locations?range[begin_at]=<midnight>,<now>` | Everything that started today, one page, ascending | First login of the day |
| `GET /v2/campus/:id/locations?range[begin_at]=<Sunday>,<now>` | The week's sessions — ~840 for Warsaw, 9 pages | Hall of Fame; also the 60-day backfill |
| `GET /v2/projects_users?filter[status]=finished&filter[marked]=true` | Marked project attempts: `final_mark`, `validated?`, `marked_at`, `user`, `project` | Recently-passed wall, passed today/this month |
| `GET /v2/projects_users?filter[status]=in_progress` | Open attempts | "What campus is building" bars |
| `GET /v2/cursus/:id/cursus_users?filter[campus_id]=` | Every enrolment the campus has ever had — ~575 rows for Warsaw. `level`, `grade`, `end_at`, `blackholed_at`, `user.staff?` | Level donut, average/top level, blackhole count |
| `GET /v2/blocs` → `GET /v2/blocs/:id/coalitions` | Coalition name, slug, brand colour, current score | Coalition standings |
| `GET /v2/coalitions/:id/scores` | Append-only score ledger: `value`, `created_at` | Score history chart |
| `GET /v2/coalitions/:id/coalitions_users` | `user_id`, `score`, `rank` — no user object | Top 5 per coalition |
| `GET /v2/users?filter[id]=a,b,c` | Logins and avatars, comma-separated ids in one call | Names/faces for those top 5 |

## 2. Rate limits and refresh

The budget is **2 requests/second and 1200/hour**. A full build costs about
85–95 requests, so we run it **every 30 minutes** — roughly 190/hour, comfortably
under. The forecast recomputes **once a day**, off data already in Postgres, so
it costs nothing extra.


## 3. Data quirks

**Anonymised students.** When someone leaves, 42 keeps the row but strips the
person out: the login turns into a hash and the avatar goes null. We don't filter
them, and the board doesn't break, because the fallbacks were built for missing
data generally — the name falls back through `usual_full_name` → `displayname` →
first+last → `login`, and a missing avatar renders as an initial tile rather than
a broken image. So an anonymised student shows up as a hash with a letter tile.
That's honest but ugly. It hasn't come up on the wall yet because these records
are old and every board section is windowed to recent activity. If it does, the
fix is a login-pattern filter in `transforms.ts`, not a schema change.


**Multiple versions of a project.** These are separate `project` records with
their own ids and slugs — `exam-rank-02` vs `42next-exam-rank-02`, and the same
pattern for reworked cursus projects. We never merge them:

The "what campus is building" chart groups by `project.id`, so two versions are
  two bars

## 4. When the API is down

The dashboard never reads directly from the 42 API. Instead, a background job fetches fresh data every 30 minutes and stores a complete snapshot in our database. The frontend always reads from that database.

If the API is temporarily unavailable, the job retries the request. If it still fails, the existing snapshot is left untouched. Nothing is overwritten with incomplete or empty data.

A new snapshot is only saved if the entire build succeeds. This means the database always contains the last known good state, so the dashboard continues to display valid information even during API outages.

The only effect of an outage is that the data becomes older until the next successful sync. The dashboard shows when the snapshot was last updated, making it clear how fresh the displayed data is.
