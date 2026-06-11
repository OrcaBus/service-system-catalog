import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CATALOG_PARTITION_KEY,
  CURRENT_ITEM_SCHEMA_VERSION,
  HISTORY_PREFIX,
  MAP_GSI_PARTITION_KEY,
  MAP_PREFIX,
} from '../../config/constants';
import { getEnv } from '../../config/env';
import { createDynamoDbClient, createDocumentClient } from '../../lib/dynamodb';
import { deleteTableIfExists, ensureTable } from '../../lib/dynamodb-schema';
import { createFixtureMap } from '../../lib/test-fixtures';
import { DynamoDbSystemCatalogRepository } from '../dynamoDbSystemCatalogRepository';
import { SystemCatalogService } from '../../services/systemCatalogService';

const env = getEnv({
  NODE_ENV: 'test',
  DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME ?? 'SystemCatalogTest',
  DYNAMODB_ENDPOINT: process.env.DYNAMODB_ENDPOINT ?? 'http://127.0.0.1:8001',
  DEFAULT_ACTOR: 'integration-test@umccr.org',
});

const client = createDynamoDbClient(env);
const documentClient = createDocumentClient(client);
const repository = new DynamoDbSystemCatalogRepository(documentClient, env.DYNAMODB_TABLE_NAME);
const service = new SystemCatalogService(repository);

describe('DynamoDbSystemCatalogRepository integration', () => {
  beforeAll(async () => {
    await ensureTable(client, env.DYNAMODB_TABLE_NAME);
  });

  beforeEach(async () => {
    await deleteTableIfExists(client, env.DYNAMODB_TABLE_NAME);
    await ensureTable(client, env.DYNAMODB_TABLE_NAME);
  });

  afterAll(async () => {
    await deleteTableIfExists(client, env.DYNAMODB_TABLE_NAME);
  });

  it('creates and lists maps', async () => {
    const created = await service.createMap(
      {
        name: 'Integration Map',
        description: 'Created in integration test',
        status: 'active',
      },
      env.DEFAULT_ACTOR
    );

    const list = await service.listMaps({
      limit: 20,
      includeDeleted: false,
    });

    expect(created.mapId).toBe('integration-map');
    expect(list.maps).toHaveLength(1);
    expect(list.maps[0]?.mapId).toBe('integration-map');

    const rawMap = await documentClient.send(
      new GetCommand({
        TableName: env.DYNAMODB_TABLE_NAME,
        Key: {
          PK: CATALOG_PARTITION_KEY,
          SK: `${MAP_PREFIX}${created.mapId}`,
        },
      })
    );
    const rawHistory = await documentClient.send(
      new QueryCommand({
        TableName: env.DYNAMODB_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :historyPrefix)',
        ExpressionAttributeValues: {
          ':pk': CATALOG_PARTITION_KEY,
          ':historyPrefix': `${HISTORY_PREFIX}${created.mapId}#`,
        },
      })
    );

    expect(rawMap.Item?.schemaVersion).toBe(CURRENT_ITEM_SCHEMA_VERSION);
    expect(rawHistory.Items?.[0]?.schemaVersion).toBe(CURRENT_ITEM_SCHEMA_VERSION);
  });

  it('persists content saves and history snapshots', async () => {
    const created = await service.createMap(
      {
        name: 'History Map',
      },
      env.DEFAULT_ACTOR
    );

    const fixture = createFixtureMap({
      mapId: created.mapId,
      name: created.name,
      description: created.description,
      status: created.status,
      version: created.version,
      isDeleted: created.isDeleted,
      createdBy: created.createdBy,
      createdAt: created.createdAt,
      updatedBy: created.updatedBy,
      updatedAt: created.updatedAt,
      tags: created.tags,
      engineColors: created.engineColors,
    });

    const saved = await service.saveMapContent(
      created.mapId,
      created.version,
      {
        nodes: fixture.nodes,
        groups: [
          {
            groupId: 'SERVICES',
            name: 'Services',
            type: 'service',
            color: '#3b82f6',
            nodeIds: ['source', 'target'],
          },
        ],
        edges: fixture.edges,
        engineColors: fixture.engineColors,
      },
      env.DEFAULT_ACTOR
    );

    const history = await service.getMapHistory(created.mapId, { limit: 20 });
    const snapshot = await service.getMapHistorySnapshot(
      created.mapId,
      history.entries[0]!.historyId
    );

    expect(saved.version).toBe(2);
    expect(history.entries.length).toBe(2);
    expect(snapshot.nodes.find((node) => node.nodeId === 'target')?.groupIds).toEqual(['SERVICES']);

    const rawMap = await documentClient.send(
      new GetCommand({
        TableName: env.DYNAMODB_TABLE_NAME,
        Key: {
          PK: CATALOG_PARTITION_KEY,
          SK: `${MAP_PREFIX}${created.mapId}`,
        },
      })
    );
    const rawHistory = await documentClient.send(
      new GetCommand({
        TableName: env.DYNAMODB_TABLE_NAME,
        Key: {
          PK: CATALOG_PARTITION_KEY,
          SK: `${HISTORY_PREFIX}${created.mapId}#${history.entries[0]!.historyId}`,
        },
      })
    );

    expect(rawMap.Item?.schemaVersion).toBe(CURRENT_ITEM_SCHEMA_VERSION);
    expect(rawHistory.Item?.schemaVersion).toBe(CURRENT_ITEM_SCHEMA_VERSION);
  });

  it('reads legacy map items without schemaVersion as schema version 1', async () => {
    const legacyMap = createFixtureMap({
      mapId: 'legacy-map',
      name: 'Legacy Map',
      updatedAt: '2026-04-23T00:00:00Z',
    });

    await documentClient.send(
      new PutCommand({
        TableName: env.DYNAMODB_TABLE_NAME,
        Item: {
          PK: CATALOG_PARTITION_KEY,
          SK: `${MAP_PREFIX}${legacyMap.mapId}`,
          GSI1PK: MAP_GSI_PARTITION_KEY,
          GSI1SK: `UPDATED#${legacyMap.updatedAt}#${legacyMap.mapId}`,
          GSI2PK: `STATUS#${legacyMap.status}`,
          GSI2SK: `UPDATED#${legacyMap.updatedAt}#${legacyMap.mapId}`,
          entityType: 'MAP',
          mapId: legacyMap.mapId,
          name: legacyMap.name,
          description: legacyMap.description,
          status: legacyMap.status,
          version: legacyMap.version,
          isDeleted: legacyMap.isDeleted,
          createdBy: legacyMap.createdBy,
          createdAt: legacyMap.createdAt,
          updatedBy: legacyMap.updatedBy,
          updatedAt: legacyMap.updatedAt,
          tags: legacyMap.tags,
          nodeCount: legacyMap.nodes.length,
          edgeCount: legacyMap.edges.length,
          nodes: legacyMap.nodes,
          groups: legacyMap.groups,
          edges: legacyMap.edges,
          engineColors: legacyMap.engineColors,
        },
      })
    );

    const read = await service.getMap(legacyMap.mapId);

    expect(read.mapId).toBe(legacyMap.mapId);
    expect(read.version).toBe(1);
    expect(read.nodes[0]).toMatchObject({ nodeType: 'workflow', workflowEngine: 'ICA' });
    expect(read.nodes[1]).toMatchObject({ nodeType: 'resource', resourceType: 'rest_api_service' });
    expect(read.nodes[0]).not.toHaveProperty('engine');
    expect(read).not.toHaveProperty('schemaVersion');
  });
});
