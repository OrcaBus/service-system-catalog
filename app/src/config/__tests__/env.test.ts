import { describe, expect, it } from 'vitest';
import { getEnv } from '../env';

describe('getEnv CORS configuration', () => {
  it('allows the local frontend origins outside production by default', () => {
    const env = getEnv({
      NODE_ENV: 'test',
      CORS_ALLOW_ORIGINS: undefined,
    });

    expect(env.CORS_ALLOW_ORIGINS).toEqual(['http://localhost:3000', 'http://127.0.0.1:3000']);
  });

  it('parses, normalizes, and deduplicates configured origins', () => {
    const env = getEnv({
      CORS_ALLOW_ORIGINS:
        'http://localhost:3000/, https://ui.dev.umccr.org/path, http://localhost:3000',
    });

    expect(env.CORS_ALLOW_ORIGINS).toEqual(['http://localhost:3000', 'https://ui.dev.umccr.org']);
  });

  it('does not allow cross-origin browser calls by default in production', () => {
    const env = getEnv({
      NODE_ENV: 'production',
      CORS_ALLOW_ORIGINS: undefined,
    });

    expect(env.CORS_ALLOW_ORIGINS).toEqual([]);
  });

  it('allows wildcard CORS outside production when explicitly enabled', () => {
    const env = getEnv({
      NODE_ENV: 'test',
      CORS_ALLOW_ALL_ORIGINS: 'true',
    });

    expect(env.CORS_ALLOW_ALL_ORIGINS).toBe(true);
  });

  it('does not allow wildcard CORS in production', () => {
    const env = getEnv({
      NODE_ENV: 'production',
      CORS_ALLOW_ALL_ORIGINS: 'true',
    });

    expect(env.CORS_ALLOW_ALL_ORIGINS).toBe(false);
  });
});
