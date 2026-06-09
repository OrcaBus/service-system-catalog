import { describe, expect, it } from 'vitest';
import { normalizeMap } from '../normalize';
import { createFixtureMap } from '../test-fixtures';

describe('normalizeMap', () => {
  it('rebuilds node groupIds from canonical group membership', () => {
    const map = normalizeMap(
      createFixtureMap({
        nodes: createFixtureMap().nodes.map((node) => ({
          ...node,
          groupIds: ['WRONG'],
        })),
      })
    );

    expect(map.nodes.find((node) => node.nodeId === 'source')?.groupIds).toEqual(['SERVICES']);
    expect(map.nodes.find((node) => node.nodeId === 'target')?.groupIds).toEqual([]);
  });

  it('rejects dangling edge references', () => {
    expect(() =>
      normalizeMap(
        createFixtureMap({
          edges: [
            {
              edgeId: 'e-source-missing-rest_call',
              source: 'source',
              target: 'missing',
              edgeType: 'rest_call',
            },
          ],
        })
      )
    ).toThrowError(/unknown node/i);
  });
});
