import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AppError, PreconditionFailedError, ValidationError } from './lib/errors';
import { createHealthRoutes } from './routes/health';
import { createMapsRoutes, type MapsRouteDependencies } from './routes/maps';
import { createSchemaRoutes } from './routes/schema';

export type AppDependencies = MapsRouteDependencies & {
  corsAllowAllOrigins: boolean;
  corsAllowedOrigins: string[];
};

type AppErrorStatus = 400 | 404 | 409 | 412;

const corsAllowMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const corsAllowHeaders = ['Authorization', 'Content-Type', 'If-Match'];
const corsExposeHeaders = ['ETag'];

function createCorsOriginResolver(allowedOrigins: readonly string[]) {
  const allowedOriginSet = new Set(allowedOrigins);
  return (origin: string) => (allowedOriginSet.has(origin) ? origin : null);
}

export function createApp(dependencies: AppDependencies): Hono {
  const app = new Hono();

  // Keep app-level CORS enabled in all environments.
  // In API Gateway deployments, gateway preflight handling takes precedence.
  // In standalone local development, Hono serves CORS for frontend clients.
  app.use(
    '/api/*',
    cors({
      origin: dependencies.corsAllowAllOrigins
        ? '*'
        : createCorsOriginResolver(dependencies.corsAllowedOrigins),
      allowMethods: corsAllowMethods,
      allowHeaders: corsAllowHeaders,
      exposeHeaders: corsExposeHeaders,
      maxAge: 86400,
    })
  );

  app.onError((error, c) => {
    if (error instanceof AppError) {
      if (error instanceof ValidationError) {
        return c.json(
          {
            error: 'VALIDATION_ERROR',
            message: error.message,
            details: error.details,
          },
          error.statusCode as AppErrorStatus
        );
      }

      return c.json(
        {
          error: error.code,
          message: error.message,
          ...(error instanceof PreconditionFailedError && error.currentVersion !== undefined
            ? { currentVersion: error.currentVersion }
            : {}),
        },
        error.statusCode as AppErrorStatus
      );
    }

    console.error(error);
    return c.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Unexpected server error',
      },
      500
    );
  });

  app.notFound((c) => {
    return c.json(
      {
        error: 'NOT_FOUND',
        message: 'Resource not found',
      },
      404
    );
  });

  app.get('/', (c) => c.redirect('/schema/swagger-ui/'));
  app.route('/', createHealthRoutes());
  app.route('/', createSchemaRoutes());
  app.route('/api/v1/maps', createMapsRoutes(dependencies));

  return app;
}
