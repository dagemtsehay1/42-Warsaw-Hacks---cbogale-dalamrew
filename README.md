# 42 Warsaw Campus Dashboard

A rotating campus display with student milestones, presence, achievements,
coalition scores, events, teammate requests, and notices.

Created for the 42 Warsaw hackathon by **cbogale** and **dalamrew**.

## Deploy with Docker

### 1. Prepare the project

Install Docker with Docker Compose, start Docker, and open a terminal in this
project's folder. Docker runs both the app and PostgreSQL; no local Node.js
installation is needed for this deployment.

Copy `.env.example` to `.env` if you do not already have one.

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**macOS / Linux:**

```bash
cp .env.example .env
```

### 2. Configure credentials and the app address

Edit `.env`:

1. Create an application at [42 Intra OAuth Applications](https://profile.intra.42.fr/oauth/applications)
   and fill in `FORTYTWO_CLIENT_ID` and `FORTYTWO_CLIENT_SECRET`.
2. Set `APP_PUBLIC_URL` to the address campus computers and phones will use,
   for example `http://192.168.1.50:27942`. Replace the example IP with your server's
   LAN IP or hostname. Use this same address when opening the admin page.
3. Register that address followed by `/api/auth/callback` as a redirect URI in
   the 42 application. For the example above, enter
   `http://192.168.1.50:27942/api/auth/callback`. The scheme, host, port, and path
   must match. Leave `FORTYTWO_REDIRECT_URI` blank for the normal setup.
4. Fill in the five Pace settings: `OIDC_OP_URL`, `OIDC_RP_CLIENT_ID`,
   `OIDC_RP_CLIENT_SECRET`, `USER_LOGIN`, and `USER_PASSWORD`. Obtain these from
   your staff/Keycloak administrator for the intended campus. They are separate
   from the Intra credentials. The app uses the `staff-42` realm.
5. Choose a PostgreSQL password in `POSTGRES_PASSWORD` before the first start.
   Keep `APP_MODE=production` for staff-only admin access. The remaining defaults
   work for the standard deployment.

Keep `.env` private. All variables are explained in the tables below.

### 3. Start the app

```bash
docker compose up -d --build
```

If Node.js and npm are installed, you can also run `npm run docker:up` from
the project folder. It runs the same Docker command.

The app creates its database tables automatically. The first sync can take a few
minutes while it loads campus data, milestone pages, and session history.

Check the containers and follow the app logs:

```bash
docker compose ps
docker compose logs -f app
```

Press `Ctrl+C` to stop following logs; the app continues running.

### 4. Open the dashboard

Open `http://localhost:27942/dashboard` on the server, or use `APP_PUBLIC_URL`
from another device. Campus devices must be able to reach the server on
`APP_PORT` (default `27942`).

For the TV, open `/dashboard/display` and use the browser's fullscreen mode.
To manage content, open `/admin` and sign in with a 42 staff account.

## Available URLs

Append these paths to `APP_PUBLIC_URL`. The links below use the default local
Docker address; local development uses port `3000`.

| URL | Purpose | Access |
| --- | --- | --- |
| [/](http://localhost:27942/) | Redirects to the dashboard. | Public |
| [/dashboard](http://localhost:27942/dashboard) | Dashboard with screen and display controls. | Public |
| [/dashboard/display](http://localhost:27942/dashboard/display) | TV display with controls hidden. | Public |
| [/admin](http://localhost:27942/admin) | Manage theme, slides, and teammate posts. | 42 staff login |
| [/teammate](http://localhost:27942/teammate) | Add or remove your own project teammate requests. | 42 login |
| [/api/campus/dashboard](http://localhost:27942/api/campus/dashboard) | Dashboard data as JSON. | Public |
| `/api/auth/callback` | OAuth return URL to register in the 42 application; used automatically during login. | Login flow |

## Admin controls

| Section | What you can do |
| --- | --- |
| Appearance | Choose the shared theme: Default, Sunset, Emerald, or Ocean Violet. |
| Slides & notices | Upload an image with an optional title, preview slides, show or hide them, and delete them. |
| Teammate board | Review active teammate requests and remove posts. Students manage their own requests at `/teammate`. |

Slides support **PNG, JPEG, WebP, and GIF**, up to **4 MB** each. A landscape
16:9 image fits the TV best. The Notices screen appears when an active slide
exists. Refresh the dashboard to see saved theme and slide changes immediately,
or wait for its automatic refresh.

API credentials and sync settings are configured in `.env`. Campus statistics
and milestone counts update automatically.

## Environment variables

Blank optional settings use the fallback described below. Defaults match
[.env.example](.env.example).

### App and login

| Variable | Value / example | Description |
| --- | --- | --- |
| `APP_PUBLIC_URL` | `http://192.168.1.50:27942` | Set to the app's external base address, without a page path. Used for login redirects and the teammate QR code. Use an address reachable by campus devices. |
| `APP_PORT` | `27942` | Host port for the Docker app. Update the public URL and registered callback if you change it. |
| `APP_MODE` | `production` | Restricts admin to 42 staff. `development` allows any signed-in 42 user into admin; use it only for local testing. |
| `CAMPUS_TIMEZONE` | `Europe/Warsaw` | Campus timezone for daily schedules and date calculations. Docker also sets the app's system timezone to this value. |
| `SESSION_SECRET` | Blank, or a long random secret | Optional key for signing login cookies. Falls back to `FORTYTWO_CLIENT_SECRET`. Changing the signing key invalidates existing sessions. |

### PostgreSQL

| Variable | Value / example | Description |
| --- | --- | --- |
| `POSTGRES_USER` | `ft42` | Database user created by Docker on first initialization. |
| `POSTGRES_PASSWORD` | `ft42` | Example database password. Choose your own before the first deployment. |
| `POSTGRES_DB` | `ft42_dashboard` | Database name created by Docker on first initialization. |
| `POSTGRES_PORT` | `26542` | Host port for PostgreSQL, used by local development and database tools. |
| `DATABASE_URL` | `postgres://ft42:ft42@localhost:26542/ft42_dashboard` | Connection string when running outside Docker. Match the user, password, port, and database above. Compose generates the app's internal connection string automatically. |

Changing initialization values in `.env` does not update an existing PostgreSQL
user, password, or database. For local development, URL-encode special characters
in the password portion of `DATABASE_URL`. The supplied Compose file inserts
`POSTGRES_PASSWORD` directly into a connection URL, so a long random
letters-and-numbers password works without additional URL escaping.

### 42 Intra

| Variable | Value / example | Description |
| --- | --- | --- |
| `FORTYTWO_CLIENT_ID` | Your application's client ID | Required for campus data and 42 login. |
| `FORTYTWO_CLIENT_SECRET` | Your application's client secret | Required for campus data and 42 login; also signs sessions if `SESSION_SECRET` is blank. |
| `FORTYTWO_API_BASE_URL` | `https://api.intra.42.fr` | Base URL for the Intra API and OAuth endpoints. Keep the default for normal use. |
| `FORTYTWO_CAMPUS_ID` | Blank, or a campus ID | Optional campus override. Blank resolves the Warsaw campus automatically. |
| `FORTYTWO_CURSUS_ID` | `21` | Cursus used for campus statistics and projects; `21` is 42cursus. |
| `FORTYTWO_REDIRECT_URI` | Blank | Optional full callback URL override. Normally derived from `APP_PUBLIC_URL` plus `/api/auth/callback`. If set, it must point to that route and match the registered 42 redirect URI. |

### Pace milestones

| Variable | Value / example | Description |
| --- | --- | --- |
| `OIDC_OP_URL` | Your Keycloak base URL | Required for milestones. Include any base path your provider uses, but omit `/realms/...`; the app appends the `staff-42` token endpoint. |
| `OIDC_RP_CLIENT_ID` | Your Keycloak client ID | Required client for the Pace password-grant login. |
| `OIDC_RP_CLIENT_SECRET` | Your Keycloak client secret | Required secret for that client. |
| `USER_LOGIN` | Your staff username | Required account with access to the intended campus's Pace data. |
| `USER_PASSWORD` | That account's password | Required for the Keycloak password grant. |
| `PACE_URL` | `https://pace-system.42.fr/api/v1` | Pace API base URL. The app appends `/milestones` and fetches all pages. |

### Optional tests

| Variable | Value / example | Description |
| --- | --- | --- |
| `MILESTONES_TEST_DATABASE_URL` | Blank, or a PostgreSQL connection string | Enables milestone SQL integration tests. Set it in the shell running `npm test`; Vitest does not automatically load `.env`. Tests use connection-local temporary tables. Blank skips these tests. |

Docker and Next.js manage their own internal runtime variables; they do not need
to be added to `.env`.

## Automatic updates

| Data | Schedule |
| --- | --- |
| Campus data, events, and session history | On startup when due, then every 30 minutes. |
| Pace milestones | On the first startup, then the first scheduler tick after campus-local midnight. |
| Attendance forecast | Once per campus-local calendar day, using stored session history. |

The scheduler checks every minute and catches up after downtime. Milestones
count each Pace user once, using their highest record ID as the latest milestone,
including unvalidated records. Failed milestone syncs keep the last successful
data and retry on the next tick. Without Pace credentials, the milestone chart
stays empty until data has been synced.

## Stop, update, and troubleshoot

| Task | Command |
| --- | --- |
| View status | `docker compose ps` |
| Follow app logs | `docker compose logs -f app` |
| Stop containers and keep stored data | `docker compose down` |
| Start again | `docker compose up -d` |
| Deploy updated source code | `docker compose up -d --build` |
| Apply `.env` changes | `docker compose up -d` |

PostgreSQL data and uploaded slides survive normal container stops and rebuilds.
`docker compose down -v` deletes the stored data.

## npm Docker shortcuts

With Node.js and npm installed, run these from the project folder:

| Command | What it does |
| --- | --- |
| `npm run docker:up` | Builds the app image and starts the app and PostgreSQL in the background. Use it for the first deployment or after code changes. |
| `npm run docker:down` | Stops and removes the containers and network. Keeps database data and uploaded slides. |
| `npm run docker:clean` | Stops and removes containers, locally built images, and orphan containers. Keeps data volumes, including the database and uploaded slides. |
| `npm run docker:logs` | Follows app logs. Press `Ctrl+C` to exit the logs without stopping the app. |

After `docker:down` or `docker:clean`, run `npm run docker:up` to start again.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Dashboard is empty after startup | Allow a few minutes, then check app logs and Intra credentials. |
| Milestones are empty | Check all five Pace credentials and look for `milestones` errors in app logs. |
| Login rejects the redirect URL | Match `APP_PUBLIC_URL` and the registered callback exactly, including the port. Check any `FORTYTWO_REDIRECT_URI` override. |
| QR code or login sends phones to localhost | Set `APP_PUBLIC_URL` to the server's LAN address or hostname and apply `.env` changes. |
| Admin access is denied | Sign in with a 42 staff account. |
| Local app cannot connect to PostgreSQL | Check `DATABASE_URL`, `POSTGRES_PORT`, and whether the database container is running. |

## Local development

Use Node.js 22 and Docker. Complete the `.env` setup above, set
`APP_PUBLIC_URL=http://localhost:3000`, and register
`http://localhost:3000/api/auth/callback` in your 42 application. Update
`DATABASE_URL` if you changed the database credentials or host port.

```bash
npm ci
docker compose up -d postgres
npm run dev
```

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard).
Use the server's LAN address instead of localhost when testing with phones.
Set `APP_MODE=development` only if you need to test admin with a non-staff account.

```bash
npm test
npm run typecheck
npm run lint
```

For implementation details, see [Architecture](docs/architecture.md)
and [API research](docs/api-research.md).
