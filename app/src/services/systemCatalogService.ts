import { ConflictError, NotFoundError } from '../lib/errors';
import { buildHistoryId, slugifyMapId } from '../lib/ids';
import { mergeMapContent, normalizeMap } from '../lib/normalize';
import { buildMapSummary } from '../lib/summary';
import type {
  CreateMapRequest,
  ListHistoryParams,
  ListHistoryResult,
  ListMapsParams,
  ListMapsResult,
  MapFull,
  MapHistoryEntry,
  MapSummary,
  PersistedHistoryEntry,
  SaveMapContentRequest,
  UpdateMapMetadataRequest,
} from '../models/systemCatalog';
import type { SystemCatalogRepository } from '../repositories/types';

export class SystemCatalogService {
  constructor(private readonly repository: SystemCatalogRepository) {}

  listMaps(params: ListMapsParams): Promise<ListMapsResult> {
    return this.repository.listMaps(params);
  }

  async createMap(input: CreateMapRequest, actor: string): Promise<MapFull> {
    const now = new Date().toISOString();
    const mapId = input.mapId?.trim() || slugifyMapId(input.name);

    if (!mapId) {
      throw new ConflictError('Unable to generate a valid map identifier.');
    }

    const existing = await this.repository.getMap(mapId);
    if (existing) {
      throw new ConflictError(`Map '${mapId}' already exists.`);
    }

    const map = normalizeMap({
      mapId,
      name: input.name,
      description: input.description ?? '',
      status: input.status ?? 'draft',
      version: 1,
      isDeleted: false,
      createdBy: actor,
      createdAt: now,
      updatedBy: actor,
      updatedAt: now,
      tags: input.tags ?? {},
      nodes: [],
      groups: [],
      edges: [],
      engineColors: input.engineColors ?? {},
    });

    await this.repository.createMap(map, this.buildHistory(map, 'created', actor, 'Created map'));
    return map;
  }

  async getMap(mapId: string): Promise<MapFull> {
    const map = await this.repository.getMap(mapId);
    if (!map) {
      throw new NotFoundError(`Map '${mapId}' not found.`);
    }

    return map;
  }

  async updateMapMetadata(
    mapId: string,
    expectedVersion: number,
    patch: UpdateMapMetadataRequest,
    actor: string
  ): Promise<MapFull> {
    const current = await this.getMap(mapId);
    const nextMap = normalizeMap({
      ...current,
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.tags !== undefined && { tags: patch.tags }),
      ...(patch.isDeleted !== undefined && { isDeleted: patch.isDeleted }),
      version: current.version + 1,
      updatedBy: actor,
      updatedAt: new Date().toISOString(),
    });

    const changeType =
      patch.isDeleted === true
        ? 'soft_deleted'
        : patch.isDeleted === false && current.isDeleted
          ? 'restored'
          : 'metadata_updated';

    const summary =
      patch.isDeleted === true
        ? 'Soft-deleted map'
        : patch.isDeleted === false && current.isDeleted
          ? 'Restored map'
          : 'Updated map metadata';

    await this.repository.updateMap(
      nextMap,
      this.buildHistory(nextMap, changeType, actor, summary),
      expectedVersion
    );

    return nextMap;
  }

  async deleteMap(mapId: string, expectedVersion: number, actor: string): Promise<MapSummary> {
    const current = await this.getMap(mapId);
    const nextMap = normalizeMap({
      ...current,
      isDeleted: true,
      version: current.version + 1,
      updatedBy: actor,
      updatedAt: new Date().toISOString(),
    });

    await this.repository.updateMap(
      nextMap,
      this.buildHistory(nextMap, 'soft_deleted', actor, 'Soft-deleted map'),
      expectedVersion
    );

    return buildMapSummary(nextMap);
  }

  async saveMapContent(
    mapId: string,
    expectedVersion: number,
    content: SaveMapContentRequest,
    actor: string
  ): Promise<MapFull> {
    const current = await this.getMap(mapId);
    const nextMap = {
      ...mergeMapContent(current, content),
      version: current.version + 1,
      updatedBy: actor,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.updateMap(
      nextMap,
      this.buildHistory(nextMap, 'content_saved', actor, 'Saved map content'),
      expectedVersion
    );

    return nextMap;
  }

  getMapHistory(mapId: string, params: ListHistoryParams): Promise<ListHistoryResult> {
    return this.getMap(mapId).then(() => this.repository.getMapHistory(mapId, params));
  }

  async getMapHistorySnapshot(mapId: string, historyId: string): Promise<MapFull> {
    const snapshot = await this.repository.getMapHistorySnapshot(mapId, historyId);
    if (!snapshot) {
      throw new NotFoundError(`History snapshot '${historyId}' not found for map '${mapId}'.`);
    }

    return snapshot;
  }

  private buildHistory(
    map: MapFull,
    changeType: MapHistoryEntry['changeType'],
    actor: string,
    summary: string
  ): PersistedHistoryEntry {
    const entry: MapHistoryEntry = {
      historyId: buildHistoryId(map.updatedAt, map.version),
      mapId: map.mapId,
      version: map.version,
      changeType,
      changedBy: actor,
      changedAt: map.updatedAt,
      summary,
    };

    return {
      entry,
      snapshot: normalizeMap(map),
    };
  }
}
