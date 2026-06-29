import type {
  MapEdge,
  MapFull,
  MapGroup,
  MapNode,
  ResourceType,
  SaveMapContentRequest,
  WorkflowEngine,
} from '../models/systemCatalog';
import { ValidationError } from './errors';

type LegacyNodeType =
  | 'pipeline'
  | 'aws_lambda'
  | 'aws_eks'
  | 'aws_step_function'
  | 'aws_event_bridge'
  | 'aws_batch'
  | 'aws_s3'
  | 'aws_sqs'
  | 'aws_sns'
  | 'external_service'
  | 'ica_pipeline'
  | 'rest_api_service'
  | 'execution_service';

type NodeLike = Omit<MapNode, 'nodeType'> & {
  nodeType: MapNode['nodeType'] | LegacyNodeType | string;
  engine?: string;
  resourceType?: ResourceType;
  workflowEngine?: WorkflowEngine | string;
};

const RESOURCE_TYPES = new Set<ResourceType>([
  'aws_lambda',
  'aws_api_gateway',
  'aws_sqs',
  'aws_event_bridge',
  'aws_s3',
  'aws_sns',
  'aws_step_function',
  'aws_batch',
  'aws_ecs',
  'aws_eks',
  'aws_dynamodb',
  'aws_rds',
  'rest_api_service',
  'execution_service',
  'external_service',
  'other',
]);

const WORKFLOW_ENGINES = new Set<WorkflowEngine>([
  'ICA',
  'SEQERA',
  'AWS_BATCH',
  'AWS_ECS',
  'AWS_EKS',
  'BASESPACE',
  'PIERIAN',
  'ON_PREM',
  'OTHER',
]);

const LEGACY_RESOURCE_TYPE_MAP: Record<string, ResourceType> = {
  aws_lambda: 'aws_lambda',
  aws_eks: 'aws_eks',
  aws_step_function: 'aws_step_function',
  aws_event_bridge: 'aws_event_bridge',
  aws_batch: 'aws_batch',
  aws_s3: 'aws_s3',
  aws_sqs: 'aws_sqs',
  aws_sns: 'aws_sns',
  external_service: 'external_service',
  rest_api_service: 'rest_api_service',
  execution_service: 'execution_service',
};

const LEGACY_WORKFLOW_NODE_TYPES = new Set(['pipeline', 'ica_pipeline']);

export function normalizeMap(map: MapFull): MapFull {
  const normalizedInputNodes = (map.nodes as NodeLike[]).map(normalizeNode);

  assertUniqueIds(
    normalizedInputNodes.map((node) => node.nodeId),
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

  const validNodeIds = new Set(normalizedInputNodes.map((node) => node.nodeId));
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

  const normalizedNodes = normalizedInputNodes.map((node) => ({
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

function normalizeNode(node: NodeLike): MapNode {
  const { engine: _engine, resourceType, workflowEngine, ...baseNode } = node;

  if (baseNode.nodeType === 'resource') {
    return {
      ...baseNode,
      nodeType: 'resource',
      resourceType: normalizeResourceType(resourceType ?? _engine ?? node.nodeType),
    };
  }

  if (baseNode.nodeType === 'workflow') {
    return {
      ...baseNode,
      nodeType: 'workflow',
      workflowEngine: normalizeWorkflowEngine(workflowEngine ?? _engine),
    };
  }

  if (LEGACY_WORKFLOW_NODE_TYPES.has(baseNode.nodeType)) {
    return {
      ...baseNode,
      nodeType: 'workflow',
      workflowEngine: normalizeWorkflowEngine(workflowEngine ?? _engine),
    };
  }

  return {
    ...baseNode,
    nodeType: 'resource',
    resourceType: normalizeResourceType(resourceType ?? baseNode.nodeType),
  };
}

function normalizeResourceType(value: unknown): ResourceType {
  if (typeof value === 'string') {
    const mapped = LEGACY_RESOURCE_TYPE_MAP[value] ?? value;
    if (RESOURCE_TYPES.has(mapped as ResourceType)) {
      return mapped as ResourceType;
    }
  }

  return 'other';
}

function normalizeWorkflowEngine(value: unknown): WorkflowEngine {
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase().replace(/[- ]+/g, '_');
    if (WORKFLOW_ENGINES.has(normalized as WorkflowEngine)) {
      return normalized as WorkflowEngine;
    }
  }

  return 'OTHER';
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
  return normalizeMap(structuredClone(map));
}

export function cloneEdges(edges: MapEdge[]): MapEdge[] {
  return structuredClone(edges);
}

export function cloneNodes(nodes: MapNode[]): MapNode[] {
  return structuredClone(nodes);
}
