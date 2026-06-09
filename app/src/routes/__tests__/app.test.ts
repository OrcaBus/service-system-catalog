import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { createFixtureHistory, createFixtureMap } from '../../lib/test-fixtures';
import { InMemorySystemCatalogRepository } from '../../repositories/inMemorySystemCatalogRepository';
import { SystemCatalogService } from '../../services/systemCatalogService';

function createTestApp() {
  const map = createFixtureMap();
  const repository = new InMemorySystemCatalogRepository([map], [createFixtureHistory(map)]);
  const service = new SystemCatalogService(repository);

  return createApp({
    service,
    getActor: () => 'route-test@umccr.org',
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
