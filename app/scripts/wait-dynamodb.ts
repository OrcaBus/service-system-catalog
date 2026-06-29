import { ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { getEnv } from '../src/config/env';
import { createDynamoDbClient } from '../src/lib/dynamodb';

const WAIT_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 1_000;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const env = getEnv();
  const client = createDynamoDbClient(env);
  const startedAt = Date.now();

  while (Date.now() - startedAt < WAIT_TIMEOUT_MS) {
    try {
      await client.send(new ListTablesCommand({ Limit: 1 }));
      console.log(`DynamoDB Local is ready at ${env.DYNAMODB_ENDPOINT}.`);
      return;
    } catch {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  throw new Error(`DynamoDB Local did not become ready within ${WAIT_TIMEOUT_MS}ms.`);
}

await main();
