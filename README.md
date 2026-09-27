# Insyx Backend

REST API for Insyx — a Science-of-Science Explorer. Built with NestJS and TypeScript. All bibliometric data is served from a Trino/Iceberg lakehouse (`insyx-database`, a separate repo maintained by a groupmate — never edited from here); this repo's own PostgreSQL is used only for the interim `users` table backing authentication.

## Technology Stack
- `NestJS` + `TypeScript` — structured backend framework, static typing
- `trino-client` — queries the `insyx-database` lakehouse (Iceberg tables) for all bibliometric data
- `TypeORM` + `PostgreSQL` — interim `users` table only, this repo's own Postgres container (not the lakehouse)
- `@nestjs/jwt` + httpOnly cookies — auth sessions; `bcryptjs` — password hashing; `google-auth-library` — Sign in with Google
- `helmet` — security headers; `@nestjs/throttler` — rate limiting
- `Swagger` — auto-generated API docs at `/api`
- `Jest` — unit and e2e tests
- `ESLint` + `Prettier` — linting and formatting
- `Docker` + `Docker Compose` — containerized local deployment

## What This Service Provides
- Bibliometric REST endpoints under `/works` (search, stats, institutions, authors, co-authors), backed by the Trino lakehouse
- Auth REST endpoints under `/auth` (register/login/logout/refresh/me, forgot/reset password, Google sign-in)
- CORS-enabled API for frontend clients, configurable via `CORS_ORIGINS`
- Rate limiting, security headers, forced HTTPS behind a reverse proxy, SQL-injection-safe query building (see [Security](#security))

## API Endpoints

### Works (lakehouse-backed)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/works/health` | Lakehouse connectivity check |
| GET | `/works/summary` | Corpus-wide summary stats |
| GET | `/works` | Paginated, searchable, sortable works list |
| GET | `/works/:id` | Single work detail (type, dates, topics/keywords, license, APC, etc.) |
| GET | `/works/:id/co-authors` | Co-authors of a given work |
| GET | `/works/:id/topics` | Scored topic assignments for a given work |
| GET | `/works/fields` | Distinct field values (for filters) |
| GET | `/works/domains` | Distinct domain values (for filters) |
| GET | `/works/export` | CSV export of the current filtered/sorted search (capped at 20k rows) |
| GET | `/works/stats/by-year` | Papers/citations by year |
| GET | `/works/stats/by-field` | Papers/citations by field |
| GET | `/works/stats/scatter` | Year-vs-citations scatter data |
| GET | `/works/stats/field-period` | Field activity across time periods |
| GET | `/works/stats/oa-ratio` | Open-access ratio by year |
| GET | `/works/authors` | Searchable, paginated author list |
| GET | `/works/authors/:authorId` | Single author detail + their works |
| GET | `/works/institutions/map` | Zoom/bbox-scoped institution map data (LOD) — currently unused by the frontend, see note below |
| GET | `/works/institutions/search` | Institution search |
| GET | `/works/institutions/:id/works` | Works for a given institution |

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create an account and start a session |
| POST | `/auth/login` | Log in and start a session |
| POST | `/auth/logout` | Clear the current session |
| POST | `/auth/refresh` | Exchange the refresh cookie for a new access token |
| GET | `/auth/me` | Who the current session belongs to (requires auth) |
| PATCH | `/auth/me` | Update name/email/affiliation and/or change password (requires auth) |
| POST | `/auth/forgot-password` | Request a password-reset link |
| POST | `/auth/reset-password` | Set a new password from a reset link, then auto-login |
| POST | `/auth/google` | Log in or register via a Google ID token |

Interactive docs available at `http://localhost:3000/api` when the server is running.

## Authentication

Sessions are stateless JWTs delivered as httpOnly cookies (never readable/settable from frontend JS, which mitigates XSS token theft):
- `access_token` — 15 minutes, path `/`
- `refresh_token` — 7 days, path scoped to `/auth/refresh` only

Users live in this repo's **own** Postgres container (the `postgres` service in `docker-compose.yml`) — an interim store, separate from `insyx-database` (the lakehouse), which is never touched. Passwords are hashed with `bcryptjs`. Google sign-in uses Google's Identity Services ID-token flow (`google-auth-library` verifies the token; no client secret is involved). Password-reset links currently just log to the server console (`MailerService`) — no real email provider is wired up yet; that's the one file to replace once one is chosen.

A user record also carries `name` and `affiliation` (both nullable, only ever set via the frontend's Account page — never collected at registration). `PATCH /auth/me` updates any of name/email/affiliation, and optionally changes the password (requires `currentPassword` unless the account has none yet, e.g. a Google-only signup setting its first password).

Required env vars (see `.env.example`): `JWT_SECRET`, `FRONTEND_URL` (used to build reset links), `GOOGLE_CLIENT_ID` (only needed for Google sign-in to actually work — see `.env.example` for how to create one).

## Security

- Rate limiting: 300 req/min globally (public read-only browsing), tightened to 5 req/min on `/auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/google`
- `helmet` security headers (CSP relaxed only for Swagger UI's own inline scripts/styles at `/api`)
- Forced HTTPS behind a reverse proxy (`x-forwarded-proto`-aware; doesn't break unproxied local dev)
- All Trino queries are built with explicit string-escaping (`trino-client` has no parameterized-query API) — covered by a dedicated SQL-injection regression suite (`works.service.spec.ts`)
- Input validation via `class-validator` DTOs on every endpoint, behind a global `ValidationPipe`
- Honeypot fields on register/login/forgot-password as basic bot mitigation

## Project Structure

```text
insyx-backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── auth/                   # register/login/logout/refresh/me, forgot/reset password, Google sign-in
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.guard.ts
│   │   ├── mailer.service.ts   # interim: logs reset links to the console, swap for a real provider later
│   │   └── dto/
│   ├── users/                  # interim `users` table — this repo's own Postgres, not the lakehouse
│   │   ├── user.entity.ts
│   │   └── users.service.ts
│   ├── works/                  # every bibliometric endpoint, backed by the Trino lakehouse
│   │   ├── works.controller.ts
│   │   ├── works.service.ts
│   │   └── dto/
│   ├── database/
│   │   └── trino.service.ts
│   ├── common/                  # force-https middleware, geo/LOD helpers, https-detection util
│   └── import-data.ts           # bulk OpenAlex JSON import into this repo's own Postgres
├── test/
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

## Run With Docker (Recommended)

Start the lakehouse stack first, from `insyx-database` (https://github.com/Good03/insyx-database):

```bash
make up
make init-schema
py -3.12 scripts/seed.py --works 500 --batch-size 250
```

From this repo's root:

```bash
docker compose up --build
```

This starts `insyx-backend` on `http://localhost:3000` and its own PostgreSQL (used only for the `users` table), and connects to Trino on the host via `http://host.docker.internal:8080`.
- Backend: `http://localhost:3000`
- PostgreSQL: `localhost:5433` (host-published port; moved off 5432, see `DB_HOST_PORT` in `.env.example`)

Rebuild backend only (DB data persists in the `postgres_data` volume and is not affected):

```bash
docker compose up --build backend
```

```bash
docker compose down
```

## Run Without Docker

```bash
npm install
npm run start:dev     # dev server with hot reload
npm run build         # compile TypeScript
npm run start:prod    # run compiled build
```

Copy `.env.example` to `.env` first and fill in real values — at minimum `JWT_SECRET`; `GOOGLE_CLIENT_ID` only matters if you want Google sign-in to actually work end to end.

## Data Utilities

### `src/import-data.ts` — bulk data import

Imports a large OpenAlex JSON export into this repo's own PostgreSQL. Built for the 100k-record AI subfield dataset (`data/ai_subfield_100k_all_columns.json`) but compatible with any export following the same schema. Not used by the running app (which reads exclusively from the Trino lakehouse via `WorksModule`) — kept for whenever that dataset is wanted again for local inspection.

What it does:
- Truncates `authors`, then `works` tables
- Reads and parses the full JSON file into memory
- Inserts works in batches of 500 using raw `pg` queries for performance
- Parses the `full_authors_info` field (semicolon-separated format) to populate the `authors` table
- Handles type coercions: string numerics → integers/floats, `"Yes"/"No"` → boolean, plain-text JSONB fields → valid JSON strings

```bash
npx ts-node src/import-data.ts
```

The JSON file is expected at `../data/ai_subfield_100k_all_columns.json` relative to the backend root. Columns not mapped to the DB schema (`funders`, `grants`, `source_host_name`, `source_issn`, `cited_by_count_int`, `embedding`) are silently skipped.

> A hand-written sample-data seed script (`seed-sample-data.ts` + two TypeORM entity files) previously lived in this repo under `data-sample/`. It's since been moved to a sibling folder outside `insyx-backend/` entirely, since nothing in the running app used it — the whole Postgres-backed Papers/Authors/Institutions stack it supported was removed as a confirmed duplicate of the Trino-lakehouse-backed `WorksModule`.

## Tests

```bash
npm run test          # unit tests — SQL-injection regression suite, DTO validation, auth service/guard, middleware
npm run test:e2e      # e2e tests
npm run test:cov      # coverage report
```

For local non-Docker backend runs against a host-based Trino, set:

```bash
$env:TRINO_HOST="http://localhost:8080"
npm run start:dev
```

## Lakehouse Demo Endpoints

Open these in a browser after the lakehouse and backend are running:

- `http://localhost:3000/works/health`
- `http://localhost:3000/works/summary`
- `http://localhost:3000/works?limit=10`
- `http://localhost:3000/works/stats/by-year`
- `http://localhost:3000/works/stats/by-field`
- `http://localhost:3000/works/institutions/map`
