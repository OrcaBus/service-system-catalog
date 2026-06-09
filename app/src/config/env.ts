import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_PORT: z.coerce.number().int().positive().default(8000),
  AWS_REGION: z.string().min(1).default('ap-southeast-2'),
  DYNAMODB_ENDPOINT: z.string().url().optional(),
  DYNAMODB_TABLE_NAME: z.string().min(1).default('SystemCatalog'),
  DEFAULT_ACTOR: z.string().min(1).default('local.dev@umccr.org'),
  OPENAPI_SPEC_PATH: z.string().min(1).default('schema/openapi.yaml'),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(overrides?: Partial<NodeJS.ProcessEnv>): AppEnv {
  if (!overrides && cachedEnv) {
    return cachedEnv;
  }

  const env = envSchema.parse({
    ...process.env,
    ...overrides,
  });
  const normalizedEnv = {
    ...env,
    DYNAMODB_ENDPOINT:
      env.DYNAMODB_ENDPOINT ??
      (env.NODE_ENV === 'production' ? undefined : 'http://127.0.0.1:8001'),
  };

  if (!overrides) {
    cachedEnv = normalizedEnv;
  }

  return normalizedEnv;
}
