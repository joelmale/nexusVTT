import { describe, expect, it } from 'vitest';
import {
  GENERATOR_ACTIONS,
  actionTitle,
  getQuickActions,
  getShortcutGroups,
  type GeneratorId,
} from './generatorActions';

const IDS = Object.keys(GENERATOR_ACTIONS) as GeneratorId[];

describe('generator action registry', () => {
  it.each(IDS)('%s has a unique key binding per action', (id) => {
    const seen = new Map<string, string>();
    for (const a of GENERATOR_ACTIONS[id]) {
      const binding = `${a.keyCode}:${a.shiftKey ? 'shift' : ''}`;
      expect(seen.get(binding), `${id}: ${a.id} duplicates ${seen.get(binding)}`).toBeUndefined();
      seen.set(binding, a.id);
    }
    const ids = GENERATOR_ACTIONS[id].map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(IDS)('%s has an Enter reroll and 4-6 quick buttons', (id) => {
    const reroll = GENERATOR_ACTIONS[id].find((a) => a.id === 'reroll');
    expect(reroll?.keyCode).toBe(13);
    expect(reroll?.quick).toBeDefined();
    const quick = getQuickActions(id);
    expect(quick.length).toBeGreaterThanOrEqual(4);
    expect(quick.length).toBeLessThanOrEqual(6);
    expect(getShortcutGroups(id).length).toBeGreaterThan(0);
  });

  it('keeps the reroll tooltip stable', () => {
    for (const id of IDS) {
      const reroll = GENERATOR_ACTIONS[id].find((a) => a.id === 'reroll')!;
      expect(actionTitle(reroll)).toBe('Reroll new map (Enter)');
    }
  });

  it('sends each generator its own grid and label keys', () => {
    const key = (id: GeneratorId, action: string) =>
      GENERATOR_ACTIONS[id].find((a) => a.id === action)?.keyCode;
    expect(key('dungeon', 'grid')).toBe(71); // G
    expect(key('cave', 'grid')).toBe(71); // G
    expect(key('world', 'grid')).toBe(71); // G
    expect(key('city', 'grid')).toBe(68); // D, not G (G opens a window)
    expect(key('dwelling', 'grid')).toBe(71); // G
    expect(key('world', 'labels')).toBe(76); // L, not N
    expect(key('dwelling', 'labels')).toBe(82); // R, not N
    expect(key('cave', 'tunnels')).toBe(78); // N
  });
});
