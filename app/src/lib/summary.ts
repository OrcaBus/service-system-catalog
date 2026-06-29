import type { MapFull, MapSummary } from '../models/systemCatalog';

export function buildMapSummary(map: MapFull): MapSummary {
  return {
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
    nodeCount: map.nodes.length,
    edgeCount: map.edges.length,
    tags: map.tags,
  };
}
