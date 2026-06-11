import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { createFixtureHistory, createFixtureMap } from '../../lib/test-fixtures';
import { InMemorySystemCatalogRepository } from '../../repositories/inMemorySystemCatalogRepository';
import { SystemCatalogService } from '../../services/systemCatalogService';

function createTestApp({ corsAllowAllOrigins = false }: { corsAllowAllOrigins?: boolean } = {}) {
  const map = createFixtureMap();
  const repository = new InMemorySystemCatalogRepository([map], [createFixtureHistory(map)]);
  const service = new SystemCatalogService(repository);

  return createApp({
    service,
    getActor: () => 'route-test@umccr.org',
    corsAllowAllOrigins,
    corsAllowedOrigins: ['http://localhost:3000'],
  });
}

describe('app routes', () => {
  it('serves health and docs routes', async () => {
    const app = createTestApp();

    const rootResponse = await app.request('/');
    const healthResponse = await app.request('/health');
    const schemaResponse = await app.request('http://localhost:8000/schema/openapi.json');
    const docsResponse = await app.request('/schema/swagger-ui');

    expect(rootResponse.status).toBe(302);
    expect(rootResponse.headers.get('location')).toBe('/schema/swagger-ui');
    expect(healthResponse.status).toBe(200);
    expect(await healthResponse.json()).toEqual({ status: 'ok' });
    expect(schemaResponse.status).toBe(200);
    expect(
      ((await schemaResponse.json()) as { servers?: Array<{ url: string }> }).servers?.[0]?.url
    ).toBe('http://localhost:8000');
    expect(docsResponse.status).toBe(200);
    expect(await docsResponse.text()).toContain('SwaggerUIBundle');
  });

  it('serves the current request origin first in the OpenAPI servers list', async () => {
    const app = createTestApp();

    const response = await app.request('https://system-catalog.dev.umccr.org/schema/openapi.json');

    expect(response.status).toBe(200);
    expect(
      ((await response.json()) as { servers?: Array<{ url: string }> }).servers?.[0]?.url
    ).toBe('https://system-catalog.dev.umccr.org');
  });

  it('lists and retrieves maps', async () => {
    const app = createTestApp();

    const listResponse = await app.request('/api/v1/maps');
    const getResponse = await app.request('/api/v1/maps/catalog-map');

    expect(listResponse.status).toBe(200);
    expect((await listResponse.json()) as { maps: unknown[] }).toMatchObject({
      maps: [{ mapId: 'catalog-map' }],
    });
    expect(getResponse.status).toBe(200);
    expect(getResponse.headers.get('etag')).toBe('"1"');
  });

  it('handles CORS preflight requests from configured frontend origins', async () => {
    const app = createTestApp();

    const response = await app.request('/api/v1/maps', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(response.headers.get('access-control-allow-headers')).toContain('Authorization');
    expect(response.headers.get('access-control-allow-methods')).toContain('GET');
  });

  it('can allow any CORS origin when the development wildcard switch is enabled', async () => {
    const app = createTestApp({ corsAllowAllOrigins: true });

    const response = await app.request('/api/v1/maps', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('exposes ETag to configured frontend origins', async () => {
    const app = createTestApp();

    const response = await app.request('/api/v1/maps/catalog-map', {
      headers: {
        Origin: 'http://localhost:3000',
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(response.headers.get('access-control-expose-headers')).toContain('ETag');
  });

  it('creates maps without optional engineColors', async () => {
    const app = createTestApp();

    const response = await app.request('/api/v1/maps', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Minimal Map',
      }),
    });

    const payload = (await response.json()) as {
      mapId: string;
      engineColors: Record<string, string>;
    };

    expect(response.status).toBe(201);
    expect(payload.mapId).toBe('minimal-map');
    expect(payload.engineColors).toEqual({});
  });

  it('rejects nodes without their discriminated node details', async () => {
    const app = createTestApp();
    const fixture = createFixtureMap();

    const response = await app.request('/api/v1/maps/catalog-map/content', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'If-Match': '"1"',
      },
      body: JSON.stringify({
        nodes: [
          {
            ...fixture.nodes[0],
            nodeType: 'workflow',
            workflowEngine: undefined,
          },
        ],
        groups: [],
        edges: [],
      }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 412 when the version is stale', async () => {
    const app = createTestApp();

    const response = await app.request('/api/v1/maps/catalog-map', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'If-Match': '"999"',
      },
      body: JSON.stringify({
        name: 'Updated Name',
      }),
    });

    expect(response.status).toBe(412);
    expect((await response.json()) as { currentVersion: number }).toMatchObject({
      currentVersion: 1,
    });
  });

  it('saves full content and normalizes group membership', async () => {
    const app = createTestApp();
    const fixture = createFixtureMap();

    const response = await app.request('/api/v1/maps/catalog-map/content', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'If-Match': '"1"',
      },
      body: JSON.stringify({
        nodes: fixture.nodes.map((node) => ({
          ...node,
          groupIds: ['WRONG'],
        })),
        groups: [
          {
            groupId: 'SERVICES',
            name: 'Services',
            type: 'service',
            color: '#3b82f6',
            nodeIds: ['source', 'target'],
          },
        ],
        edges: fixture.edges,
        engineColors: fixture.engineColors,
      }),
    });

    const payload = (await response.json()) as {
      version: number;
      nodes: Array<{ nodeId: string; groupIds: string[] }>;
    };

    expect(response.status).toBe(200);
    expect(payload.version).toBe(2);
    expect(payload.nodes.find((node) => node.nodeId === 'target')?.groupIds).toEqual(['SERVICES']);
  });
});
