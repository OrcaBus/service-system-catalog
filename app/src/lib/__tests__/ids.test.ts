import { describe, expect, it } from 'vitest';
import { encodeCursor, decodeCursor } from '../cursor';
import { formatEtag, parseIfMatchHeader } from '../etag';
import { slugifyMapId } from '../ids';

describe('id and cursor helpers', () => {
  it('slugifies map names into stable ids', () => {
    expect(slugifyMapId(' My New Pipeline !! ')).toBe('my-new-pipeline');
  });

  it('formats and parses etags', () => {
    expect(formatEtag(5)).toBe('"5"');
    expect(parseIfMatchHeader('"5"')).toBe(5);
  });

  it('encodes and decodes cursors opaquely', () => {
    const cursor = encodeCursor({ pk: 'MAPS', sk: 'UPDATED#2026-04-22T00:00:00Z#catalog-map' });

    expect(cursor).not.toBeNull();
    expect(decodeCursor<{ pk: string; sk: string }>(cursor ?? undefined)).toEqual({
      pk: 'MAPS',
      sk: 'UPDATED#2026-04-22T00:00:00Z#catalog-map',
    });
  });
});
