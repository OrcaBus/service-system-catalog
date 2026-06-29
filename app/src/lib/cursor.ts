import { ValidationError } from './errors';

export function encodeCursor<T extends object>(cursor: T | undefined): string | null {
  if (!cursor) {
    return null;
  }

  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor<T extends object>(cursor: string | undefined): T | undefined {
  if (!cursor) {
    return undefined;
  }

  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T;
  } catch {
    throw new ValidationError('Cursor is not valid.', [
      { path: 'cursor', message: 'Invalid cursor' },
    ]);
  }
}
