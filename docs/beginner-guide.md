# Beginner Guide

This repository has two parts:

- `app/`: the SystemCatalog HTTP API written with Hono and TypeScript
- `infrastructure/`: AWS CDK stacks that deploy DynamoDB, Lambda, and API Gateway

## Request Flow

1. A client calls the OrcaBus API Gateway.
2. Public routes (`/`, `/health`, `/schema/*`) go straight to the Lambda.
3. API routes under `/api/*` use the OrcaBus default JWT authorizer.
4. API Gateway invokes the Node.js Lambda handler from `app/src/lambda.ts`.
5. The Hono app calls the service and DynamoDB repository.
6. DynamoDB stores map documents and history snapshots in one table.

## Files To Read First

- `app/src/app.ts`: Hono route assembly and error handling
- `app/src/runtime.ts`: runtime dependency wiring
- `app/src/routes/maps.ts`: map API routes
- `app/src/repositories/dynamoDbSystemCatalogRepository.ts`: DynamoDB access patterns
- `infrastructure/stage/stateful-stack.ts`: DynamoDB table definition
- `infrastructure/stage/stateless-stack.ts`: Lambda and API Gateway definition

## Local Development

```bash
make install
cd app
make test
make up
make migrate
make seed
make dev
```

Open `http://localhost:8000/schema/swagger-ui` to inspect the API.

## Deployment Shape

- The stateful pipeline deploys `SystemCatalogStatefulStack` to beta, gamma, and prod.
- The stateless pipeline deploys `SystemCatalogStatelessStack` to beta, gamma, and prod.
- Stage-specific settings live in `infrastructure/stage/config.ts`.
