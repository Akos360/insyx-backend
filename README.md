# Insyx Backend

REST API for Insyx — a Science-of-Science Explorer. Built with NestJS and TypeScript, backed by PostgreSQL via TypeORM.

## Technology Stack
- `Node.js`: JavaScript runtime for server-side execution.
- `NestJS`: Structured backend framework (modules, controllers, services).
- `TypeScript`: Static typing and safer refactoring.
- `Jest`: Unit and e2e test framework.
- `ESLint` + `Prettier`: Linting and formatting.
- `Docker` + `Docker Compose`: Containerized local/dev deployment.

## What This Service Provides
- REST API endpoints under `/papers`.
- Lakehouse REST API endpoints under `/works`.
- CORS-enabled API for frontend clients (`localhost:5173`, `localhost:8080` by default).
- Configurable `PORT` and `CORS_ORIGINS` via environment variables.

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

Interactive docs available at `http://localhost:3000/api` when the server is running.

## Project Structure

```text
insyx-backend/
|-- src/
|   |-- main.ts
|   |-- app.module.ts
|   |-- app.controller.ts
|   |-- app.service.ts
|   |-- database/
|   |   `-- trino.service.ts
|   |-- works/
|   |   |-- works.controller.ts
|   |   `-- works.service.ts
|   `-- papers/
|       |-- papers.module.ts
|       |-- papers.controller.ts
|       `-- papers.service.ts
|-- test/
|   |-- app.e2e-spec.ts
|   `-- jest-e2e.json
|-- Dockerfile
|-- docker-compose.yml
|-- package.json
`-- tsconfig.json
```

## Run With Docker (Recommended)
Start the lakehouse stack first from `insyx-database` (https://github.com/Good03/insyx-database):

```bash
make up
make init-schema
py -3.12 scripts/seed.py --works 500 --batch-size 250
```

From the backend repository root:
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

This starts `insyx-backend` on `http://localhost:3000` and connects it to Trino on `http://host.docker.internal:8080`.
- Backend: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

Rebuild backend only (DB data is persisted in the `postgres_data` volume and is not affected):

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

## Data Utilities

### `src/seed.ts` — sample dataset

Contains ~51 hardcoded papers and ~200 authors. Used for local development and testing before real data is available.

```bash
npx ts-node src/seed.ts
```

### `src/import-data.ts` — bulk data import

Imports a large OpenAlex JSON export into the database. Built for the 100k-record AI subfield dataset (`data/ai_subfield_100k_all_columns.json`) but compatible with any export following the same schema.

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

## Tests

```bash
npm run test          # unit tests
npm run test:e2e      # e2e tests
npm run test:cov      # coverage report
```

For local non-Docker backend runs, set:

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
- `http://localhost:3000/works/stats/by-institution`
- `http://localhost:3000/works/stats/topic-growth`
- `http://localhost:3000/works/stats/citation-age`
- `http://localhost:3000/works/{workId}/text`
- `http://localhost:3000/works/{workId}/documents`
- `http://localhost:3000/works/{workId}/provenance`
