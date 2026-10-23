import { beforeEach, describe, expect, it } from 'vitest';
import {
  recordRevealedHandout,
  useHandoutFeedStore,
} from '@/stores/handoutFeedStore';

describe('handoutFeedStore', () => {
  beforeEach(() => useHandoutFeedStore.getState().reset());

  it('records a handout with an image and spotlights it', () => {
    recordRevealedHandout({
      commandId: 'cmd-1',
      title: 'Harbor Map',
      url: '/users/u1/harbor.webp',
    });
    const state = useHandoutFeedStore.getState();
    expect(state.handouts[0]).toMatchObject({
      id: 'cmd-1',
      title: 'Harbor Map',
      url: '/users/u1/harbor.webp',
    });
    expect(state.spotlightId).toBe('cmd-1');
  });

  it('keeps title-only handouts out of the spotlight', () => {
    recordRevealedHandout({ commandId: 'cmd-2', title: 'Letter' });
    expect(useHandoutFeedStore.getState().spotlightId).toBeNull();
  });

  it('rejects off-origin urls and defaults missing fields', () => {
    recordRevealedHandout({ url: '//evil.test/x.png' });
    recordRevealedHandout({ url: 'https://evil.test/x.png', commandId: 'c3' });
    const [latest, previous] = useHandoutFeedStore.getState().handouts;
    expect(latest).toMatchObject({ id: 'c3', title: 'Handout' });
    expect(latest.url).toBeUndefined();
    expect(previous.id).toMatch(/^handout-/);
    expect(previous.url).toBeUndefined();
  });

  it('ignores malformed payloads, de-duplicates and caps the list', () => {
    recordRevealedHandout(null);
    expect(useHandoutFeedStore.getState().handouts).toHaveLength(0);

    for (let i = 0; i < 25; i += 1) {
      recordRevealedHandout({ commandId: `c${i}`, title: `H${i}` });
    }
    recordRevealedHandout({ commandId: 'c24', title: 'H24 again' });
    const { handouts } = useHandoutFeedStore.getState();
    expect(handouts).toHaveLength(20);
    expect(handouts.filter((h) => h.id === 'c24')).toHaveLength(1);
  });

  it('opens and dismisses the spotlight', () => {
    useHandoutFeedStore.getState().openSpotlight('x');
    expect(useHandoutFeedStore.getState().spotlightId).toBe('x');
    useHandoutFeedStore.getState().dismissSpotlight();
    expect(useHandoutFeedStore.getState().spotlightId).toBeNull();
  });
});
