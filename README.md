# SystemCatalog Service

SystemCatalog is an OrcaBus service for managing architecture maps. It exposes a TypeScript Hono API through AWS Lambda and API Gateway, with DynamoDB storing map documents and history snapshots.

## Architecture

- Stateful CDK stack: `SystemCatalogStatefulStack`
  - DynamoDB table `SystemCatalogTable-<STAGE>`
  - `PK`/`SK` primary key
  - `MapsByUpdatedAt` and `StatusIndex` GSIs
  - point-in-time recovery enabled
  - prod table retained and deletion-protected

- Stateless CDK stack: `SystemCatalogStatelessStack`
  - Node.js 24 ARM64 Lambda bundled from `app/src/lambda.ts`
  - OrcaBus HTTP API Gateway integration
  - public `GET /`, `GET /health`, and `GET /schema/*`
  - authenticated `ANY /api/{proxy+}` using the OrcaBus API Gateway default authorizer

The app implementation lives in `app/`. See [app/README.md](app/README.md) and [docs/backend-architecture.md](docs/backend-architecture.md).

## Requirements

- Node.js 24 or newer
- Corepack with pnpm 11
- Docker for DynamoDB Local and app integration tests
- Python/pre-commit tooling for repository checks

## Install

```bash
corepack enable
make install
```

This is a pnpm workspace; the root install includes the `app` package.

## Development

Root CDK/tooling checks:

```bash
make check
make test
pnpm cdk-stateful synth
pnpm cdk-stateless synth
```

App checks and local server:

```bash
cd app
make check
make test
make up
make migrate
make seed
make dev
```

The local API defaults to `http://localhost:8000`; Swagger UI is at `/schema/swagger-ui`.

## Deployment

The CDK entrypoint is `bin/deploy.ts`.

```bash
pnpm cdk-stateful ls
pnpm cdk-stateless ls
pnpm cdk-stateful deploy -e OrcaBusSystemCatalogStatefulStack
pnpm cdk-stateless deploy -e OrcaBusSystemCatalogStatelessStack
```

Stage configuration is in `infrastructure/stage/config.ts`. Table names remain deterministic:

- `SystemCatalogTable-BETA`
- `SystemCatalogTable-GAMMA`
- `SystemCatalogTable-PROD`

## OpenAPI

- Spec: `app/schema/openapi.yaml`
- Generated app types: `app/src/generated/system-catalog.openapi.d.ts`

```bash
cd app
pnpm openapi:generate
pnpm openapi:check
```
