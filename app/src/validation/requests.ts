import { z, type ZodError, type ZodType } from 'zod';
import { ValidationError } from '../lib/errors';

const mapStatusSchema = z.enum(['active', 'draft', 'archived']);
const groupTypeSchema = z.enum(['infrastructure', 'ingestion', 'analysis', 'flows', 'service']);
const resourceTypeSchema = z.enum([
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
const workflowEngineSchema = z.enum([
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
const edgeTypeSchema = z.enum([
  'trigger',
  'trigger_input',
  'input_dependency',
  'event_publish',
  'event_subscribe',
  'state_change',
  'execution_request',
  'rest_call',
]);
const eventDefSchema = z.object({
  name: z.string().min(1),
  topic: z.string().optional(),
  condition: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
});

const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const mapNodeBaseSchema = z.object({
  nodeId: z.string().min(1),
  label: z.string().min(1),
  version: z.string().min(1),
  description: z.string(),
  groupIds: z.array(z.string()),
  inputEvents: z.array(eventDefSchema),
  outputEvents: z.array(eventDefSchema),
  tags: z.record(z.string(), z.string()),
  position: positionSchema,
});

const mapNodeSchema = z.discriminatedUnion('nodeType', [
  mapNodeBaseSchema.extend({
    nodeType: z.literal('resource'),
    resourceType: resourceTypeSchema,
  }),
  mapNodeBaseSchema.extend({
    nodeType: z.literal('workflow'),
    workflowEngine: workflowEngineSchema,
  }),
]);

const mapGroupSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  type: groupTypeSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  nodeIds: z.array(z.string()),
});

const mapEdgeSchema = z.object({
  edgeId: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  edgeType: edgeTypeSchema,
  label: z.string().optional(),
});

export const listMapsQuerySchema = z.object({
  status: mapStatusSchema.optional(),
  limit: z.preprocess(
    (value) => (value === undefined ? undefined : Number(value)),
    z.number().int().min(1).max(100).default(20)
  ),
  cursor: z.string().optional(),
  includeDeleted: z.preprocess(
    (value) =>
      value === undefined ? undefined : value === true || value === 'true' || value === '1',
    z.boolean().default(false)
  ),
  userEmail: z.string().email().optional(),
});

export const mapIdParamsSchema = z.object({
  mapId: z.string().min(1),
});

export const historyParamsSchema = z.object({
  mapId: z.string().min(1),
  historyId: z.string().min(1),
});

export const listHistoryQuerySchema = z.object({
  limit: z.preprocess(
    (value) => (value === undefined ? undefined : Number(value)),
    z.number().int().min(1).max(100).default(20)
  ),
  cursor: z.string().optional(),
});

export const createMapSchema = z.object({
  mapId: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: mapStatusSchema.optional(),
  tags: z.record(z.string(), z.string()).optional(),
  engineColors: z.record(z.string(), z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional(),
});

export const updateMapMetadataSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    status: mapStatusSchema.optional(),
    tags: z.record(z.string(), z.string()).optional(),
    isDeleted: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided.',
  });

export const saveMapContentSchema = z.object({
  nodes: z.array(mapNodeSchema),
  groups: z.array(mapGroupSchema),
  edges: z.array(mapEdgeSchema),
  engineColors: z.record(z.string(), z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional(),
});

export function parseWithSchema<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  throw zodToValidationError(result.error);
}

export function zodToValidationError(error: ZodError): ValidationError {
  return new ValidationError(
    'Request validation failed',
    error.issues.map((issue) => ({
      path: issue.path.join('.') || 'request',
      message: issue.message,
    }))
  );
}
