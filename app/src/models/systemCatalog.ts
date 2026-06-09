import type { components } from '../generated/system-catalog.openapi.d.ts';

export type MapStatus = components['schemas']['MapStatus'];
export type MapNodeType = components['schemas']['MapNodeType'];
export type MapEdgeType = components['schemas']['MapEdgeType'];
export type GroupType = components['schemas']['GroupType'];
export type HistoryChangeType = components['schemas']['HistoryChangeType'];
export type EventDef = components['schemas']['EventDef'];
export type MapNode = components['schemas']['MapNode'];
export type MapGroup = components['schemas']['MapGroup'];
export type MapEdge = components['schemas']['MapEdge'];
export type MapSummary = components['schemas']['MapSummary'];
export type MapFull = components['schemas']['MapFull'];
export type MapHistoryEntry = components['schemas']['MapHistoryEntry'];
export type CreateMapRequest = components['schemas']['CreateMapRequest'];
export type UpdateMapMetadataRequest = components['schemas']['UpdateMapMetadataRequest'];
export type SaveMapContentRequest = components['schemas']['SaveMapContentRequest'];

export type ListMapsResult = {
  maps: MapSummary[];
  nextCursor: string | null;
};

export type ListHistoryResult = {
  entries: MapHistoryEntry[];
  nextCursor: string | null;
};

export type ListMapsParams = {
  status?: MapStatus;
  limit: number;
  cursor?: string;
  includeDeleted: boolean;
};

export type ListHistoryParams = {
  limit: number;
  cursor?: string;
};

export type PersistedHistoryEntry = {
  entry: MapHistoryEntry;
  snapshot: MapFull;
};

export interface DynamoDbMapItem {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  GSI2PK: string;
  GSI2SK: string;
  entityType: 'MAP';
  schemaVersion?: number;
  mapId: string;
  name: string;
  description: string;
  status: MapStatus;
  version: number;
  isDeleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  tags: Record<string, string>;
  nodeCount: number;
  edgeCount: number;
  nodes: MapNode[];
  groups: MapGroup[];
  edges: MapEdge[];
  engineColors: Record<string, string>;
}

export interface DynamoDbHistoryItem {
  PK: string;
  SK: string;
  entityType: 'HISTORY';
  schemaVersion?: number;
  historyId: string;
  mapId: string;
  version: number;
  changeType: HistoryChangeType;
  changedBy: string;
  changedAt: string;
  summary: string;
  snapshot: MapFull;
}
