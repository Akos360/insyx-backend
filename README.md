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

Interactive docs available at `http://localhost:3000/api` when the server is running.

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
