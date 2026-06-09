import type {
  ListHistoryParams,
  ListHistoryResult,
  ListMapsParams,
  ListMapsResult,
  MapFull,
  PersistedHistoryEntry,
} from '../models/systemCatalog';

export interface SystemCatalogRepository {
  listMaps(params: ListMapsParams): Promise<ListMapsResult>;
  getMap(mapId: string): Promise<MapFull | null>;
  createMap(map: MapFull, history: PersistedHistoryEntry): Promise<void>;
  updateMap(map: MapFull, history: PersistedHistoryEntry, expectedVersion: number): Promise<void>;
  getMapHistory(mapId: string, params: ListHistoryParams): Promise<ListHistoryResult>;
  getMapHistorySnapshot(mapId: string, historyId: string): Promise<MapFull | null>;
}
