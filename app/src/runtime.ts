import { createApp } from './app';
import { getEnv, type AppEnv } from './config/env';
import { createDynamoDbClient, createDocumentClient } from './lib/dynamodb';
import { DynamoDbSystemCatalogRepository } from './repositories/dynamoDbSystemCatalogRepository';
import { SystemCatalogService } from './services/systemCatalogService';

export function createRuntimeApp(env: AppEnv = getEnv()) {
  const client = createDynamoDbClient(env);
  const documentClient = createDocumentClient(client);
  const repository = new DynamoDbSystemCatalogRepository(documentClient, env.DYNAMODB_TABLE_NAME);

  return createApp({
    service: new SystemCatalogService(repository),
    getActor: () => env.DEFAULT_ACTOR,
    corsAllowAllOrigins: env.CORS_ALLOW_ALL_ORIGINS,
    corsAllowedOrigins: env.CORS_ALLOW_ORIGINS,
  });
}
