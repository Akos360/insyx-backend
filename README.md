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
From the backend repository root:

```bash
docker compose up --build
```

API will be available at `http://localhost:3000`.

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
