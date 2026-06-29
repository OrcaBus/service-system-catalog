import { describe, expect, it } from 'vitest';
import { getEnv } from '../../config/env';
import { createDynamoDbClientConfig } from '../dynamodb';

describe('createDynamoDbClientConfig', () => {
  it('uses local endpoint credentials outside production', () => {
    const env = getEnv({
      NODE_ENV: 'test',
      DYNAMODB_ENDPOINT: undefined,
    });
    const config = createDynamoDbClientConfig(env);

    expect(env.DYNAMODB_ENDPOINT).toBe('http://127.0.0.1:8001');
    expect(config.endpoint).toBe('http://127.0.0.1:8001');
    expect(config.credentials).toEqual({
      accessKeyId: 'local',
      secretAccessKey: 'local', // pragma: allowlist secret
    });
  });

  it('uses the default AWS endpoint and credential chain in production', () => {
    const env = getEnv({
      NODE_ENV: 'production',
      DYNAMODB_ENDPOINT: undefined,
    });
    const config = createDynamoDbClientConfig(env);

    expect(env.DYNAMODB_ENDPOINT).toBeUndefined();
    expect(config.endpoint).toBeUndefined();
    expect(config.credentials).toBeUndefined();
  });
});
