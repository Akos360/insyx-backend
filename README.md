# Insyx Backend

REST API for Insyx — a Science-of-Science Explorer. Built with NestJS and TypeScript, backed by PostgreSQL via TypeORM.

## Technology Stack

- `NestJS` — structured backend framework (modules, controllers, services)
- `TypeScript` — static typing
- `TypeORM` — ORM for PostgreSQL
- `PostgreSQL` — relational database
- `Swagger` — auto-generated API docs at `/api`
- `Jest` — unit and e2e tests
- `ESLint` + `Prettier` — linting and formatting
- `Docker` + `Docker Compose` — containerized local deployment

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/papers` | All papers |
| GET | `/papers/:id` | Single paper by OpenAlex work ID |
| GET | `/authors` | All authors with paper count |
| GET | `/authors/:authorId` | All paper records for a single author |
| GET | `/authors/paper/:paperId` | All authors for a given paper |
| POST | `/users` | Create an unverified user profile |
| GET | `/users?limit=20&offset=0` | Paginated profiles (maximum 100 per page) |
| GET | `/users/:id` | User profile by UUID |
| PATCH | `/users/:id` | Update email, display name, or avatar |
| DELETE | `/users/:id` | Delete user profile (204) |

Interactive docs available at `http://localhost:3000/api` when the server is running.

## User accounts and Google sign-in preparation

The backend runs an additive TypeORM migration on startup to create
`public.users` in `DB_NAME` (default `insyx`). The database role needs table
creation privileges for this initial migration. Existing paper/author development
synchronization is unchanged; users are excluded from synchronization and managed
by the migration. The database repository also provides the matching SQL for
fresh installations and manual upgrades. Use PostgreSQL 16 as in Docker Compose.

Create a profile:

```bash
curl -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"email":"alex@example.com","displayName":"Alex"}'
```

Emails are trimmed, lowercased, and unique. Names must contain 1–100 characters.
`avatarUrl` is optional, accepts HTTP(S) URLs, and can be cleared with `null`.
Unknown fields are rejected. Duplicate emails return 409, invalid input returns
400, and missing profiles return 404. Lists return `{ items, total, limit, offset }`.

Google sign-in itself is not implemented in this change. The nullable, unique
`google_subject` column will hold the `sub` claim from a **server-verified** Google
ID token. It is excluded from normal queries and API responses. Google recommends
using `sub`, rather than email, as the stable account identity:
[Google backend authentication guidance](https://developers.google.com/identity/sign-in/web/backend-auth).
Future authentication code must verify signature, issuer, audience, and expiry
before linking an identity, and require proof of ownership before linking an
existing email account. Never treat a profile created through `/users` as signed in.

The public DTOs cannot assign Google identity, verification, or login timestamps.
Email updates reset verification and are rejected for Google-linked accounts.
No passwords or OAuth tokens are stored. Authentication, sessions, and access
control remain future work; these user-management endpoints currently follow the
existing unauthenticated API convention and must be protected before public use.

Run the user service and HTTP tests without a database:

```bash
npm test -- --runInBand users
```

## Project Structure

```text
insyx-backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── papers/
│   │   ├── papers.module.ts
│   │   ├── papers.controller.ts
│   │   ├── papers.service.ts
│   │   └── paper.entity.ts
│   └── authors/
│       ├── authors.module.ts
│       ├── authors.controller.ts
│       ├── authors.service.ts
│       └── author.entity.ts
├── test/
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

## Run With Docker

Starts the backend and a PostgreSQL container:

```bash
docker compose up --build
```

- Backend: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

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

## Tests

```bash
npm run test          # unit tests
npm run test:e2e      # e2e tests
npm run test:cov      # coverage report
```
