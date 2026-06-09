import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import {
  CATALOG_PARTITION_KEY,
  CURRENT_ITEM_SCHEMA_VERSION,
  HISTORY_PREFIX,
  MAP_GSI_PARTITION_KEY,
  MAP_PREFIX,
} from '../config/constants';
import { decodeCursor, encodeCursor } from '../lib/cursor';
import { NotFoundError, PreconditionFailedError } from '../lib/errors';
import { cloneMap } from '../lib/normalize';
import type {
  DynamoDbHistoryItem,
  DynamoDbMapItem,
  ListHistoryParams,
  ListHistoryResult,
  ListMapsParams,
  ListMapsResult,
  MapFull,
  MapSummary,
  PersistedHistoryEntry,
} from '../models/systemCatalog';
import type { SystemCatalogRepository } from './types';

type DynamoDbMapSummaryItem = Omit<DynamoDbMapItem, 'nodes' | 'groups' | 'edges' | 'engineColors'>;

export class DynamoDbSystemCatalogRepository implements SystemCatalogRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async listMaps(params: ListMapsParams): Promise<ListMapsResult> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: params.status ? 'StatusIndex' : 'MapsByUpdatedAt',
        KeyConditionExpression: params.status ? 'GSI2PK = :partitionKey' : 'GSI1PK = :partitionKey',
        ExpressionAttributeValues: {
          ':partitionKey': params.status ? `STATUS#${params.status}` : MAP_GSI_PARTITION_KEY,
          ':notDeleted': false,
        },
        FilterExpression: params.includeDeleted ? undefined : 'isDeleted = :notDeleted',
        Limit: params.limit,
        ScanIndexForward: false,
        ExclusiveStartKey: decodeCursor<Record<string, unknown>>(params.cursor),
      })
    );

    return {
      maps: (response.Items ?? []).map((item) =>
        this.mapItemToMapSummary(item as DynamoDbMapSummaryItem)
      ),
      nextCursor: encodeCursor(response.LastEvaluatedKey),
    };
  }

  async getMap(mapId: string): Promise<MapFull | null> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: CATALOG_PARTITION_KEY,
          SK: `${MAP_PREFIX}${mapId}`,
        },
      })
    );

    return response.Item ? this.mapItemToMapFull(response.Item as DynamoDbMapItem) : null;
  }

  async createMap(map: MapFull, history: PersistedHistoryEntry): Promise<void> {
    await this.client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.tableName,
              Item: this.mapFullToItem(map),
              ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: this.historyToItem(history),
            },
          },
        ],
      })
    );
  }

  async updateMap(
    map: MapFull,
    history: PersistedHistoryEntry,
    expectedVersion: number
  ): Promise<void> {
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: this.mapFullToItem(map),
                ConditionExpression: 'attribute_exists(PK) AND #version = :expectedVersion',
                ExpressionAttributeNames: {
                  '#version': 'version',
                },
                ExpressionAttributeValues: {
                  ':expectedVersion': expectedVersion,
                },
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: this.historyToItem(history),
              },
            },
          ],
        })
      );
    } catch (error) {
      const current = await this.getMap(map.mapId);
      if (!current) {
        throw new NotFoundError(`Map '${map.mapId}' not found.`);
      }

      if (current.version !== expectedVersion) {
        throw new PreconditionFailedError('Map version has changed.', current.version);
      }

      throw error;
    }
  }

  async getMapHistory(mapId: string, params: ListHistoryParams): Promise<ListHistoryResult> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :historyPrefix)',
        ExpressionAttributeValues: {
          ':pk': CATALOG_PARTITION_KEY,
          ':historyPrefix': `${HISTORY_PREFIX}${mapId}#`,
        },
        Limit: params.limit,
        ScanIndexForward: false,
        ExclusiveStartKey: decodeCursor<Record<string, unknown>>(params.cursor),
      })
    );

    return {
      entries: (response.Items ?? []).map((item) =>
        this.historyItemToEntry(item as DynamoDbHistoryItem)
      ),
      nextCursor: encodeCursor(response.LastEvaluatedKey),
    };
  }

  async getMapHistorySnapshot(mapId: string, historyId: string): Promise<MapFull | null> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: CATALOG_PARTITION_KEY,
          SK: `${HISTORY_PREFIX}${mapId}#${historyId}`,
        },
      })
    );

    return response.Item ? cloneMap((response.Item as DynamoDbHistoryItem).snapshot) : null;
  }

  private mapFullToItem(map: MapFull): DynamoDbMapItem {
    return {
      PK: CATALOG_PARTITION_KEY,
      SK: `${MAP_PREFIX}${map.mapId}`,
      GSI1PK: MAP_GSI_PARTITION_KEY,
      GSI1SK: `UPDATED#${map.updatedAt}#${map.mapId}`,
      GSI2PK: `STATUS#${map.status}`,
      GSI2SK: `UPDATED#${map.updatedAt}#${map.mapId}`,
      entityType: 'MAP',
      schemaVersion: CURRENT_ITEM_SCHEMA_VERSION,
      mapId: map.mapId,
      name: map.name,
      description: map.description,
      status: map.status,
      version: map.version,
      isDeleted: map.isDeleted,
      createdBy: map.createdBy,
      createdAt: map.createdAt,
      updatedBy: map.updatedBy,
      updatedAt: map.updatedAt,
      tags: map.tags,
      nodeCount: map.nodes.length,
      edgeCount: map.edges.length,
      nodes: map.nodes,
      groups: map.groups,
      edges: map.edges,
      engineColors: map.engineColors,
    };
  }

  private mapItemToMapSummary(item: DynamoDbMapSummaryItem): MapSummary {
    return {
      mapId: item.mapId,
      name: item.name,
      description: item.description,
      status: item.status,
      version: item.version,
      isDeleted: item.isDeleted,
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      updatedBy: item.updatedBy,
      updatedAt: item.updatedAt,
      nodeCount: item.nodeCount,
      edgeCount: item.edgeCount,
      tags: item.tags,
    };
  }

  private mapItemToMapFull(item: DynamoDbMapItem): MapFull {
    return {
      mapId: item.mapId,
      name: item.name,
      description: item.description,
      status: item.status,
      version: item.version,
      isDeleted: item.isDeleted,
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      updatedBy: item.updatedBy,
      updatedAt: item.updatedAt,
      tags: item.tags,
      nodes: item.nodes,
      groups: item.groups,
      edges: item.edges,
      engineColors: item.engineColors,
    };
  }

  private historyToItem(history: PersistedHistoryEntry): DynamoDbHistoryItem {
    return {
      PK: CATALOG_PARTITION_KEY,
      SK: `${HISTORY_PREFIX}${history.entry.mapId}#${history.entry.historyId}`,
      entityType: 'HISTORY',
      schemaVersion: CURRENT_ITEM_SCHEMA_VERSION,
      historyId: history.entry.historyId,
      mapId: history.entry.mapId,
      version: history.entry.version,
      changeType: history.entry.changeType,
      changedBy: history.entry.changedBy,
      changedAt: history.entry.changedAt,
      summary: history.entry.summary,
      snapshot: cloneMap(history.snapshot),
    };
  }

  private historyItemToEntry(item: DynamoDbHistoryItem): PersistedHistoryEntry['entry'] {
    return {
      historyId: item.historyId,
      mapId: item.mapId,
      version: item.version,
      changeType: item.changeType,
      changedBy: item.changedBy,
      changedAt: item.changedAt,
      summary: item.summary,
    };
  }
}
