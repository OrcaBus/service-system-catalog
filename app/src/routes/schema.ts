import { Hono } from 'hono';
import { getOpenApiJson, getOpenApiYaml, getSwaggerUiHtml } from '../lib/docs';

function getFirstForwardedValue(value: string | null): string | undefined {
  return value
    ?.split(',')
    .map((item) => item.trim())
    .find((item) => item.length > 0);
}

function getRequestOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const forwardedProto = getFirstForwardedValue(request.headers.get('x-forwarded-proto'));
  const forwardedHost = getFirstForwardedValue(request.headers.get('x-forwarded-host'));
  const protocol = (forwardedProto ?? requestUrl.protocol).replace(/:$/, '');
  const host = forwardedHost ?? request.headers.get('host') ?? requestUrl.host;

  return `${protocol}://${host}`;
}

export function createSchemaRoutes(): Hono {
  const app = new Hono();

  app.get('/schema/openapi.yaml', async (c) => {
    return c.body(await getOpenApiYaml(getRequestOrigin(c.req.raw)), 200, {
      'content-type': 'application/yaml; charset=utf-8',
    });
  });

  app.get('/schema/openapi.json', async (c) => {
    return c.json(await getOpenApiJson(getRequestOrigin(c.req.raw)));
  });

  app.get('/schema/swagger-ui', (c) => {
    return c.html(getSwaggerUiHtml());
  });

  return app;
}
