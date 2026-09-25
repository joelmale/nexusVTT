import { describe, expect, it } from 'vitest';

import { ashesOfVeyra, inspectFixtureIntegrity } from './index';

describe('Ashes of Veyra fixtures', () => {
  it('keeps every cross-reference and normalized map coordinate valid', () => {
    expect(inspectFixtureIntegrity()).toEqual([]);
  });

  it('contains the representative campaign breadth used by the prototype', () => {
    expect(ashesOfVeyra.acts).toHaveLength(3);
    expect(ashesOfVeyra.sessions).toHaveLength(13);
    expect(ashesOfVeyra.pins).toHaveLength(6);
    expect(
      ashesOfVeyra.sessions.find((session) => session.number === 12)?.plan,
    ).toBeDefined();
  });
});
