import type {
  MapEdge,
  MapFull,
  MapGroup,
  MapNode,
  SaveMapContentRequest,
} from '../models/systemCatalog';
import { ValidationError } from './errors';

export function normalizeMap(map: MapFull): MapFull {
  assertUniqueIds(
    map.nodes.map((node) => node.nodeId),
    'nodes'
  );
  assertUniqueIds(
    map.groups.map((group) => group.groupId),
    'groups'
  );
  assertUniqueIds(
    map.edges.map((edge) => edge.edgeId),
    'edges'
  );

  const validNodeIds = new Set(map.nodes.map((node) => node.nodeId));
  const normalizedGroups = map.groups.map((group) => normalizeGroup(group, validNodeIds));
  const memberships = new Map<string, string[]>();

  normalizedGroups.forEach((group) => {
    group.nodeIds.forEach((nodeId) => {
      memberships.set(nodeId, [...(memberships.get(nodeId) ?? []), group.groupId]);
    });
  });

  map.edges.forEach((edge) => {
    if (!validNodeIds.has(edge.source) || !validNodeIds.has(edge.target)) {
      throw new ValidationError('Edge references an unknown node.', [
        {
          path: `edges.${edge.edgeId}`,
          message: `Edge ${edge.edgeId} must reference existing source and target nodes.`,
        },
      ]);
    }
  });

  const normalizedNodes = map.nodes.map((node) => ({
    ...node,
    groupIds: memberships.get(node.nodeId) ?? [],
  }));

  return {
    ...map,
    nodes: normalizedNodes,
    groups: normalizedGroups,
    edges: map.edges,
    engineColors: map.engineColors ?? {},
  };
}

export function mergeMapContent(currentMap: MapFull, content: SaveMapContentRequest): MapFull {
  return normalizeMap({
    ...currentMap,
    nodes: content.nodes,
    groups: content.groups,
    edges: content.edges,
    engineColors: content.engineColors ?? currentMap.engineColors,
  });
}

function normalizeGroup(group: MapGroup, validNodeIds: Set<string>): MapGroup {
  const uniqueNodeIds = [...new Set(group.nodeIds)];

  uniqueNodeIds.forEach((nodeId) => {
    if (!validNodeIds.has(nodeId)) {
      throw new ValidationError('Group references an unknown node.', [
        {
          path: `groups.${group.groupId}`,
          message: `Group ${group.groupId} includes unknown node ${nodeId}.`,
        },
      ]);
    }
  });

  return {
    ...group,
    nodeIds: uniqueNodeIds,
  };
}

function assertUniqueIds(ids: string[], path: string): void {
  const seen = new Set<string>();

  ids.forEach((id) => {
    if (seen.has(id)) {
      throw new ValidationError(`Duplicate ${path} identifier detected.`, [
        { path, message: `Duplicate identifier ${id}.` },
      ]);
    }

    seen.add(id);
  });
}

export function cloneMap(map: MapFull): MapFull {
  return structuredClone(map);
}

export function cloneEdges(edges: MapEdge[]): MapEdge[] {
  return structuredClone(edges);
}

export function cloneNodes(nodes: MapNode[]): MapNode[] {
  return structuredClone(nodes);
}
