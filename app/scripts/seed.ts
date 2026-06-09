import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { createDynamoDbClient, createDocumentClient } from '../src/lib/dynamodb';
import { getEnv } from '../src/config/env';
import type { DynamoDbMapItem, MapFull, PersistedHistoryEntry } from '../src/models/systemCatalog';
import { DynamoDbSystemCatalogRepository } from '../src/repositories/dynamoDbSystemCatalogRepository';
import { buildHistoryId } from '../src/lib/ids';
import { normalizeMap } from '../src/lib/normalize';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.resolve(scriptDir, '../fixtures/seed-data.dynamodb.json');

async function main(): Promise<void> {
  const env = getEnv();
  const client = createDynamoDbClient(env);
  const repository = new DynamoDbSystemCatalogRepository(
    createDocumentClient(client),
    env.DYNAMODB_TABLE_NAME
  );
  const rawSeed = JSON.parse(await readFile(seedPath, 'utf8')) as {
    SystemCatalog: Array<{ PutRequest: { Item: Record<string, unknown> } }>;
  };

  for (const entry of rawSeed.SystemCatalog) {
    const item = unmarshall(
      entry.PutRequest.Item as Parameters<typeof unmarshall>[0]
    ) as Partial<DynamoDbMapItem>;
    if (item.entityType !== 'MAP' || !item.mapId) {
      continue;
    }

    if (await repository.getMap(item.mapId)) {
      continue;
    }

    const map = normalizeMap({
      mapId: item.mapId,
      name: item.name ?? item.mapId,
      description: item.description ?? '',
      status: item.status ?? 'draft',
      version: item.version ?? 1,
      isDeleted: item.isDeleted ?? false,
      createdBy: item.createdBy ?? env.DEFAULT_ACTOR,
      createdAt: item.createdAt ?? new Date().toISOString(),
      updatedBy: item.updatedBy ?? env.DEFAULT_ACTOR,
      updatedAt: item.updatedAt ?? new Date().toISOString(),
      tags: item.tags ?? {},
      nodes: item.nodes ?? [],
      groups: item.groups ?? [],
      edges: item.edges ?? [],
      engineColors: item.engineColors ?? {},
    } satisfies MapFull);

    const history: PersistedHistoryEntry = {
      entry: {
        historyId: buildHistoryId(map.updatedAt, map.version),
        mapId: map.mapId,
        version: map.version,
        changeType: 'created',
        changedBy: map.updatedBy,
        changedAt: map.updatedAt,
        summary: 'Seeded map',
      },
      snapshot: map,
    };

    await repository.createMap(map, history);
  }

  console.log(`Seed data loaded into '${env.DYNAMODB_TABLE_NAME}'.`);
}

await main();
