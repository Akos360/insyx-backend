# Insyx Backend

Backend API for the Insyx project, built with NestJS and TypeScript.

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

```bash
docker compose up --build
```

This starts `insyx-backend` on `http://localhost:3000` and connects it to Trino on `http://host.docker.internal:8080`.

Environment values are read from `.env`.

Stop containers:

```bash
docker compose down
```

## Run Without Docker
Install dependencies:

```bash
npm install
```

Run in development:

```bash
npm run start:dev
```

Build and run production:

```bash
npm run build
npm run start:prod
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
