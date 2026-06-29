# Backend Architecture

SystemCatalog is a TypeScript Hono API deployed as a Node.js Lambda behind the OrcaBus HTTP API Gateway.

## Runtime Structure

- `app/src/app.ts` creates the Hono routes and error handling.
- `app/src/runtime.ts` wires DynamoDB, repositories, services, and actor config for Lambda and local server entrypoints.
- `app/src/lambda.ts` exports the AWS Lambda handler through `hono/aws-lambda`.
- `app/src/server.ts` runs the same app locally through `@hono/node-server`.

## Infrastructure

- `SystemCatalogStatefulStack` owns the DynamoDB table.
- `SystemCatalogStatelessStack` owns the Node.js Lambda, Lambda execution role, API Gateway integration, and HTTP routes.
- The OrcaBus API Gateway default JWT authorizer protects `/api/*`; `/`, `/health`, and `/schema/*` are intentionally public.

## DynamoDB Model

One table stores map documents and history snapshots.

- Table key: `PK` string and `SK` string
- Map items: `PK = CATALOG_V1`, `SK = MAP#<mapId>`
- History items: `PK = CATALOG_V1`, `SK = HISTORY#<mapId>#<historyId>`
- `MapsByUpdatedAt`: `GSI1PK/GSI1SK` for listing maps by updated time
- `StatusIndex`: `GSI2PK/GSI2SK` for listing maps by status and updated time

Both GSIs project the lightweight map summary fields used by list endpoints.

The public `version` field is the map edit version used for ETag / If-Match concurrency. DynamoDB `MAP` and `HISTORY` items also store an internal `schemaVersion`; missing `schemaVersion` is treated as v1 for backward compatibility. A migration ledger is intentionally deferred until the first breaking item-shape change or production backfill.

## Local Development

DynamoDB Local runs through `app/docker-compose.yml`.

```bash
cd app
make install
make up
make migrate
make seed
make dev
```

`make test` starts and stops DynamoDB Local automatically.

## Contract Workflow

- Source spec: `app/schema/openapi.yaml`
- Generated types: `app/src/generated/system-catalog.openapi.d.ts`
- Check drift: `cd app && pnpm openapi:check`

The Lambda bundle includes the OpenAPI YAML so `/schema/openapi.yaml`, `/schema/openapi.json`, and `/schema/swagger-ui/` work after deployment.
