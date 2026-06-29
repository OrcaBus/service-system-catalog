import { DynamoDBClient, type DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { AppEnv } from '../config/env';

export function createDynamoDbClientConfig(env: AppEnv): DynamoDBClientConfig {
  return {
    region: env.AWS_REGION,
    ...(env.DYNAMODB_ENDPOINT
      ? {
          endpoint: env.DYNAMODB_ENDPOINT,
          credentials: {
            accessKeyId: 'local',
            secretAccessKey: 'local', // pragma: allowlist secret
          },
        }
      : {}),
  };
}

export function createDynamoDbClient(env: AppEnv): DynamoDBClient {
  return new DynamoDBClient(createDynamoDbClientConfig(env));
}

export function createDocumentClient(client: DynamoDBClient): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });
}
