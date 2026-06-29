import { serve, type Http2Bindings, type HttpBindings } from '@hono/node-server';
import { getEnv, type AppEnv } from './config/env';
import { createDynamoDbClient } from './lib/dynamodb';
import { ensureTable } from './lib/dynamodb-schema';
import { createRuntimeApp } from './runtime';

type RequestBindings = HttpBindings | Http2Bindings;

const monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Local development startup migration.
 *
 * For this service, migration means ensuring the DynamoDB table exists before the
 * HTTP server accepts requests, similar to Django's `migrate` step before
 * `runserver`.
 */
async function runMigrations(env: AppEnv): Promise<void> {
  console.log('Running migrations...');

  const client = createDynamoDbClient(env);

  try {
    await ensureTable(client, env.DYNAMODB_TABLE_NAME);
    console.log(`DynamoDB table '${env.DYNAMODB_TABLE_NAME}' is ready.`);
  } finally {
    client.destroy();
  }
}

/**
 * Formats access log timestamps in the Django development-server style.
 */
function formatAccessLogDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = monthNames[date.getMonth()] ?? '???';
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Normalizes Node's local IPv6 loopback and IPv4-mapped addresses for friendlier
 * local development logs.
 */
function getRemoteAddress(bindings: RequestBindings): string {
  const remoteAddress = bindings.incoming.socket.remoteAddress;

  if (!remoteAddress) {
    return '-';
  }

  const normalizedAddress = remoteAddress.replace(/^::ffff:/, '');

  return normalizedAddress === '::1' ? '127.0.0.1' : normalizedAddress;
}

/**
 * Prints one local development access log line after each request completes.
 *
 * Example output:
 * 127.0.0.1 - - [29/Jun/2026 13:01:01] "GET /schema/swagger-ui/ HTTP/1.1" 200 7ms
 * 127.0.0.1 - - [29/Jun/2026 13:01:01] "GET /.well-known/appspecific/com.chrome.devtools.json HTTP/1.1" 404 4ms
 * 127.0.0.1 - - [29/Jun/2026 13:01:02] "GET /schema/openapi.json HTTP/1.1" 200 57ms
 * 127.0.0.1 - - [29/Jun/2026 13:01:32] "GET /api/v1/maps?limit=20&includeDeleted=false HTTP/1.1" 200 86ms
 * 127.0.0.1 - - [29/Jun/2026 13:01:47] "GET /api/v1/maps/umccr-production/history?limit=20 HTTP/1.1" 200 74ms
 * 127.0.0.1 - - [29/Jun/2026 13:01:58] "GET /health HTTP/1.1" 200 1ms
 */
function logApiCall(
  request: Request,
  bindings: RequestBindings,
  status: number,
  elapsedMs: number
): void {
  const url = new URL(request.url);
  const path = `${url.pathname}${url.search}`;
  const httpVersion = 'httpVersion' in bindings.incoming ? bindings.incoming.httpVersion : '1.1';

  console.log(
    `${getRemoteAddress(bindings)} - - [${formatAccessLogDate(new Date())}] ` +
      `"${request.method} ${path} HTTP/${httpVersion}" ${status} ${elapsedMs}ms`
  );
}

/**
 * Local development entrypoint used by `pnpm start`, `pnpm dev`, and
 * `make start`.
 */
async function main(): Promise<void> {
  const env = getEnv();
  await runMigrations(env);

  const app = createRuntimeApp(env);

  serve(
    {
      fetch: async (request, bindings) => {
        const startedAt = Date.now();

        try {
          const response = await app.fetch(request, bindings);
          logApiCall(request, bindings, response.status, Date.now() - startedAt);
          return response;
        } catch (error) {
          logApiCall(request, bindings, 500, Date.now() - startedAt);
          throw error;
        }
      },
      port: env.APP_PORT,
    },
    (info) => {
      const localUrl = `http://localhost:${info.port}`;
      console.log(`SystemCatalog API listening on ${localUrl}`);
      console.log(`Swagger UI: ${localUrl}/schema/swagger-ui/`);
    }
  );
}

await main().catch((error: unknown) => {
  console.error('Failed to start SystemCatalog API.');
  console.error(error);
  process.exitCode = 1;
});
