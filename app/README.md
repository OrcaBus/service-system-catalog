# SystemCatalog App

TypeScript Hono API for the SystemCatalog service. The same Hono app runs locally through `@hono/node-server` and in AWS Lambda through `hono/aws-lambda`.

## Requirements

- Node.js 24 or newer
- pnpm 11 through Corepack
- Docker with Docker Compose for DynamoDB Local and integration tests

## Commands

Run these from `app/`:

```bash
make install
make check
make test
make up
make migrate
make seed
make start
```

`make test` is self-contained: it starts DynamoDB Local, waits for it, resets the test table, runs Vitest, and tears Docker down.

For manual local development:

```bash
make up
make migrate
make seed
make dev
```

The API listens on `http://localhost:8000` by default. Swagger UI is available at `/schema/swagger-ui/`.

## Environment

- `APP_PORT`: local HTTP port, default `8000`
- `AWS_REGION`: default `ap-southeast-2`
- `DYNAMODB_TABLE_NAME`: default `SystemCatalog`
- `DYNAMODB_ENDPOINT`: optional; defaults to `http://127.0.0.1:8001` outside production and is omitted in production
- `DEFAULT_ACTOR`: default `local.dev@umccr.org`
- `OPENAPI_SPEC_PATH`: default `schema/openapi.yaml`
- `CORS_ALLOW_ORIGINS`: comma-separated browser origins allowed to call the API; defaults to `http://localhost:3000,http://127.0.0.1:3000` outside production and no origins in production
- `CORS_ALLOW_ALL_ORIGINS`: set to `true` to return `Access-Control-Allow-Origin: *`; only honored outside production

## OpenAPI Types

The app imports generated TypeScript types from `src/generated/system-catalog.openapi.d.ts`.

```bash
pnpm openapi:generate
pnpm openapi:check
```

## Node positions / layout

A map node's `position` (`{ x, y }`) is **optional**. When a node has no stored position the UI
computes the diagram layout automatically (dagre, left-to-right) from the graph edges; a stored
position is a manual override (e.g. after a user drags a node). Seed data ships without positions
so freshly seeded maps render via auto-layout.
