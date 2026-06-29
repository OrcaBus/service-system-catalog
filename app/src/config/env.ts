import { z } from 'zod';

const defaultDevelopmentCorsAllowOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];

const booleanEnvSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }
  if (['0', 'false', 'no', 'off', ''].includes(normalizedValue)) {
    return false;
  }

  return value;
}, z.boolean());

const corsAllowOriginsSchema = z
  .preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    return value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }, z.array(z.string().url()).default([]))
  .transform((origins) => [...new Set(origins.map((origin) => new URL(origin).origin))]);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_PORT: z.coerce.number().int().positive().default(8000),
  AWS_REGION: z.string().min(1).default('ap-southeast-2'),
  DYNAMODB_ENDPOINT: z.string().url().optional(),
  DYNAMODB_TABLE_NAME: z.string().min(1).default('SystemCatalog'),
  DEFAULT_ACTOR: z.string().min(1).default('local.dev@umccr.org'),
  OPENAPI_SPEC_PATH: z.string().min(1).default('schema/openapi.yaml'),
  CORS_ALLOW_ALL_ORIGINS: booleanEnvSchema.default(false),
  CORS_ALLOW_ORIGINS: corsAllowOriginsSchema,
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
    CORS_ALLOW_ALL_ORIGINS: env.NODE_ENV === 'production' ? false : env.CORS_ALLOW_ALL_ORIGINS,
    CORS_ALLOW_ORIGINS:
      env.CORS_ALLOW_ORIGINS.length > 0 || env.NODE_ENV === 'production'
        ? env.CORS_ALLOW_ORIGINS
        : defaultDevelopmentCorsAllowOrigins,
    DYNAMODB_ENDPOINT:
      env.DYNAMODB_ENDPOINT ??
      (env.NODE_ENV === 'production' ? undefined : 'http://127.0.0.1:8001'),
  };

  if (!overrides) {
    cachedEnv = normalizedEnv;
  }

  return normalizedEnv;
}
