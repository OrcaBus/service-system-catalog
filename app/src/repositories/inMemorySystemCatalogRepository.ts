import { decodeCursor, encodeCursor } from '../lib/cursor';
import { ConflictError, NotFoundError, PreconditionFailedError } from '../lib/errors';
import { cloneMap } from '../lib/normalize';
import { buildMapSummary } from '../lib/summary';
import type {
  ListHistoryParams,
  ListHistoryResult,
  ListMapsParams,
  ListMapsResult,
  MapFull,
  PersistedHistoryEntry,
} from '../models/systemCatalog';
import type { SystemCatalogRepository } from './types';

type MemoryCursor = { offset: number };

export class InMemorySystemCatalogRepository implements SystemCatalogRepository {
  private readonly maps = new Map<string, MapFull>();
  private readonly history = new Map<string, PersistedHistoryEntry[]>();

  constructor(initialMaps: MapFull[] = [], initialHistory: PersistedHistoryEntry[] = []) {
    initialMaps.forEach((map) => {
      this.maps.set(map.mapId, cloneMap(map));
    });

    initialHistory.forEach((entry) => {
      this.appendHistory(entry.snapshot.mapId, entry);
    });
  }

  async listMaps(params: ListMapsParams): Promise<ListMapsResult> {
    const offset = decodeCursor<MemoryCursor>(params.cursor)?.offset ?? 0;
    const filtered = [...this.maps.values()]
      .filter((map) => (params.includeDeleted ? true : !map.isDeleted))
      .filter((map) => (params.status ? map.status === params.status : true))
      .filter((map) =>
        params.userEmail
          ? map.createdBy === params.userEmail || map.updatedBy === params.userEmail
          : true
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    const page = filtered.slice(offset, offset + params.limit);
    const nextCursor =
      offset + params.limit < filtered.length
        ? encodeCursor<MemoryCursor>({ offset: offset + params.limit })
        : null;

    return {
      maps: page.map((map) => buildMapSummary(cloneMap(map))),
      nextCursor,
    };
  }

  async getMap(mapId: string): Promise<MapFull | null> {
    const map = this.maps.get(mapId);
    return map ? cloneMap(map) : null;
  }

  async createMap(map: MapFull, history: PersistedHistoryEntry): Promise<void> {
    if (this.maps.has(map.mapId)) {
      throw new ConflictError(`Map '${map.mapId}' already exists.`);
    }

    this.maps.set(map.mapId, cloneMap(map));
    this.appendHistory(map.mapId, history);
  }

  async updateMap(
    map: MapFull,
    history: PersistedHistoryEntry,
    expectedVersion: number
  ): Promise<void> {
    const current = this.maps.get(map.mapId);
    if (!current) {
      throw new NotFoundError(`Map '${map.mapId}' not found.`);
    }

    if (current.version !== expectedVersion) {
      throw new PreconditionFailedError('Map version has changed.', current.version);
    }

    this.maps.set(map.mapId, cloneMap(map));
    this.appendHistory(map.mapId, history);
  }

  async getMapHistory(mapId: string, params: ListHistoryParams): Promise<ListHistoryResult> {
    const offset = decodeCursor<MemoryCursor>(params.cursor)?.offset ?? 0;
    const history = [...(this.history.get(mapId) ?? [])].sort((left, right) =>
      right.entry.changedAt.localeCompare(left.entry.changedAt)
    );

    const page = history.slice(offset, offset + params.limit);
    const nextCursor =
      offset + params.limit < history.length
        ? encodeCursor<MemoryCursor>({ offset: offset + params.limit })
        : null;

    return {
      entries: page.map((item) => ({ ...item.entry })),
      nextCursor,
    };
  }

  async getMapHistorySnapshot(mapId: string, historyId: string): Promise<MapFull | null> {
    const history = this.history.get(mapId) ?? [];
    const snapshot = history.find((entry) => entry.entry.historyId === historyId);
    return snapshot ? cloneMap(snapshot.snapshot) : null;
  }

  private appendHistory(mapId: string, history: PersistedHistoryEntry): void {
    this.history.set(mapId, [...(this.history.get(mapId) ?? []), structuredClone(history)]);
  }
}
