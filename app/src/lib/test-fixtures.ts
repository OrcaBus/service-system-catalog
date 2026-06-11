import { normalizeMap } from './normalize';
import type { MapFull, PersistedHistoryEntry } from '../models/systemCatalog';
import { buildHistoryId } from './ids';

export function createFixtureMap(overrides: Partial<MapFull> = {}): MapFull {
  return normalizeMap({
    mapId: 'catalog-map',
    name: 'Catalog Map',
    description: 'Fixture map',
    status: 'draft',
    version: 1,
    isDeleted: false,
    createdBy: 'tester@umccr.org',
    createdAt: '2026-04-22T00:00:00Z',
    updatedBy: 'tester@umccr.org',
    updatedAt: '2026-04-22T00:00:00Z',
    tags: { team: 'platform' },
    nodes: [
      {
        nodeId: 'source',
        nodeType: 'workflow',
        workflowEngine: 'ICA',
        label: 'Source',
        version: 'v1.0.0',
        description: 'Source node',
        groupIds: [],
        inputEvents: [],
        outputEvents: [],
        tags: {},
        // No position: exercises the optional/auto-layout path.
      },
      {
        nodeId: 'target',
        nodeType: 'resource',
        resourceType: 'rest_api_service',
        label: 'Target',
        version: 'v2.0.0',
        description: 'Target node',
        groupIds: [],
        inputEvents: [],
        outputEvents: [],
        tags: {},
        position: { x: 200, y: 120 },
      },
    ],
    groups: [
      {
        groupId: 'SERVICES',
        name: 'Services',
        type: 'service',
        color: '#3b82f6',
        nodeIds: ['source'],
      },
    ],
    edges: [
      {
        edgeId: 'e-source-target-rest_call',
        source: 'source',
        target: 'target',
        edgeType: 'rest_call',
      },
    ],
    engineColors: {
      ICA: '#06b6d4',
      AWS: '#ff9900',
    },
    ...overrides,
  });
}

export function createFixtureHistory(map: MapFull): PersistedHistoryEntry {
  return {
    entry: {
      historyId: buildHistoryId(map.updatedAt, map.version),
      mapId: map.mapId,
      version: map.version,
      changeType: 'created',
      changedBy: map.updatedBy,
      changedAt: map.updatedAt,
      summary: 'Created map',
    },
    snapshot: map,
  };
}
