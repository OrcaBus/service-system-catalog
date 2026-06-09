import { createDynamoDbClient } from '../src/lib/dynamodb';
import { ensureTable } from '../src/lib/dynamodb-schema';
import { getEnv } from '../src/config/env';

async function main(): Promise<void> {
  const env = getEnv();
  const client = createDynamoDbClient(env);
  await ensureTable(client, env.DYNAMODB_TABLE_NAME);
  console.log(`DynamoDB table '${env.DYNAMODB_TABLE_NAME}' is ready.`);
}

await main();
