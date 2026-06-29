import { handle } from 'hono/aws-lambda';
import { createRuntimeApp } from './runtime';

const app = createRuntimeApp();

export const handler = handle(app);
