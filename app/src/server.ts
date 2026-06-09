import { serve } from '@hono/node-server';
import { getEnv } from './config/env';
import { createRuntimeApp } from './runtime';

const env = getEnv();
const app = createRuntimeApp(env);

serve(
  {
    fetch: app.fetch,
    port: env.APP_PORT,
  },
  (info) => {
    console.log(`SystemCatalog API listening on http://localhost:${info.port}`);
  }
);
