import { readFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { getEnv } from '../config/env';

let cachedYaml: string | null = null;
let cachedJson: unknown = null;

type OpenApiDocument = Record<string, unknown> & {
  servers?: unknown[];
};

type OpenApiServer = Record<string, unknown> & {
  url: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOpenApiServer(value: unknown): value is OpenApiServer {
  return isRecord(value) && typeof value.url === 'string';
}

function normalizeServerUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function withCurrentServer(document: unknown, serverUrl: string): unknown {
  if (!isRecord(document)) {
    return document;
  }

  const openApiDocument = document as OpenApiDocument;
  const servers = Array.isArray(openApiDocument.servers)
    ? openApiDocument.servers.filter(isOpenApiServer)
    : [];
  const normalizedServerUrl = normalizeServerUrl(serverUrl);
  const matchingServer = servers.find(
    (server) => normalizeServerUrl(server.url) === normalizedServerUrl
  );
  const currentServer = matchingServer ?? {
    url: serverUrl,
    description: 'Current server',
  };
  const remainingServers = servers.filter(
    (server) => normalizeServerUrl(server.url) !== normalizedServerUrl
  );

  return {
    ...openApiDocument,
    servers: [currentServer, ...remainingServers],
  };
}

export async function getOpenApiYaml(serverUrl?: string): Promise<string> {
  if (cachedYaml) {
    return serverUrl ? YAML.stringify(await getOpenApiJson(serverUrl)) : cachedYaml;
  }

  cachedYaml = await readFile(path.resolve(getEnv().OPENAPI_SPEC_PATH), 'utf8');
  return serverUrl ? YAML.stringify(await getOpenApiJson(serverUrl)) : cachedYaml;
}

export async function getOpenApiJson(serverUrl?: string): Promise<unknown> {
  if (cachedJson) {
    return serverUrl ? withCurrentServer(cachedJson, serverUrl) : cachedJson;
  }

  cachedJson = YAML.parse(await getOpenApiYaml());
  return serverUrl ? withCurrentServer(cachedJson, serverUrl) : cachedJson;
}

export function getSwaggerUiHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>SystemCatalog API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/schema/openapi.json',
        dom_id: '#swagger-ui'
      });
    </script>
  </body>
</html>`;
}
