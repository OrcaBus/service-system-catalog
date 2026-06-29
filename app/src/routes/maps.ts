import { Hono } from 'hono';
import { formatEtag, parseIfMatchHeader } from '../lib/etag';
import type { SystemCatalogService } from '../services/systemCatalogService';
import {
  createMapSchema,
  historyParamsSchema,
  listHistoryQuerySchema,
  listMapsQuerySchema,
  mapIdParamsSchema,
  parseWithSchema,
  saveMapContentSchema,
  updateMapMetadataSchema,
} from '../validation/requests';

export type MapsRouteDependencies = {
  service: SystemCatalogService;
  getActor: () => string;
};

export function createMapsRoutes(dependencies: MapsRouteDependencies): Hono {
  const app = new Hono();

  app.get('/', async (c) => {
    const result = await dependencies.service.listMaps(
      parseWithSchema(listMapsQuerySchema, {
        status: c.req.query('status'),
        limit: c.req.query('limit'),
        cursor: c.req.query('cursor'),
        includeDeleted: c.req.query('includeDeleted'),
        userEmail: c.req.query('userEmail'),
      })
    );

    return c.json(result);
  });

  app.post('/', async (c) => {
    const map = await dependencies.service.createMap(
      parseWithSchema(createMapSchema, await c.req.json()),
      dependencies.getActor()
    );

    c.header('ETag', formatEtag(map.version));
    return c.json(map, 201);
  });

  app.get('/:mapId', async (c) => {
    const { mapId } = parseWithSchema(mapIdParamsSchema, c.req.param());
    const map = await dependencies.service.getMap(mapId);
    c.header('ETag', formatEtag(map.version));
    return c.json(map);
  });

  app.patch('/:mapId', async (c) => {
    const { mapId } = parseWithSchema(mapIdParamsSchema, c.req.param());
    const map = await dependencies.service.updateMapMetadata(
      mapId,
      parseIfMatchHeader(c.req.header('If-Match')),
      parseWithSchema(updateMapMetadataSchema, await c.req.json()),
      dependencies.getActor()
    );

    c.header('ETag', formatEtag(map.version));
    return c.json(map);
  });

  app.delete('/:mapId', async (c) => {
    const { mapId } = parseWithSchema(mapIdParamsSchema, c.req.param());
    const summary = await dependencies.service.deleteMap(
      mapId,
      parseIfMatchHeader(c.req.header('If-Match')),
      dependencies.getActor()
    );

    return c.json(summary);
  });

  app.put('/:mapId/content', async (c) => {
    const { mapId } = parseWithSchema(mapIdParamsSchema, c.req.param());
    const map = await dependencies.service.saveMapContent(
      mapId,
      parseIfMatchHeader(c.req.header('If-Match')),
      parseWithSchema(saveMapContentSchema, await c.req.json()),
      dependencies.getActor()
    );

    c.header('ETag', formatEtag(map.version));
    return c.json(map);
  });

  app.get('/:mapId/history', async (c) => {
    const { mapId } = parseWithSchema(mapIdParamsSchema, c.req.param());
    const result = await dependencies.service.getMapHistory(
      mapId,
      parseWithSchema(listHistoryQuerySchema, {
        limit: c.req.query('limit'),
        cursor: c.req.query('cursor'),
      })
    );

    return c.json(result);
  });

  app.get('/:mapId/history/:historyId', async (c) => {
    const { mapId, historyId } = parseWithSchema(historyParamsSchema, c.req.param());
    const snapshot = await dependencies.service.getMapHistorySnapshot(mapId, historyId);
    return c.json(snapshot);
  });

  return app;
}
