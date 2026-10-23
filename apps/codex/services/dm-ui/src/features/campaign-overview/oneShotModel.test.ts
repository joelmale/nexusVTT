import { describe, expect, it } from 'vitest';
import { getFixtureBundle } from '@/demo/fixture-registry';
import {
  buildOneShotModel,
  formatDuration,
  DEFAULT_TARGET_BUDGET_MINUTES,
} from './oneShotModel';

describe('oneShotModel', () => {
  it('formats durations in hours and minutes', () => {
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(215)).toBe('3h 35m');
    expect(formatDuration(240)).toBe('4h');
  });

  it('detects isOneShot from bundle campaign mode', () => {
    const baseBundle = getFixtureBundle('ashes-of-veyra')!;
    const campaignBundle = {
      ...baseBundle,
      campaign: { ...baseBundle.campaign, mode: 'campaign' as const },
    };
    const oneShotBundle = {
      ...baseBundle,
      campaign: { ...baseBundle.campaign, mode: 'one-shot' as const },
    };

    expect(buildOneShotModel(campaignBundle).isOneShot).toBe(false);
    expect(buildOneShotModel(oneShotBundle).isOneShot).toBe(true);
  });

  it('generates a default structured scaffolding when session has no steps', () => {
    const baseBundle = getFixtureBundle('ashes-of-veyra')!;
    const emptySessionBundle = {
      ...baseBundle,
      campaign: { ...baseBundle.campaign, mode: 'one-shot' as const },
      sessions: [
        {
          ...baseBundle.sessions[0],
          plan: {
            ...baseBundle.sessions[0].plan!,
            steps: [],
          },
        },
      ],
    };

    const model = buildOneShotModel(emptySessionBundle);
    expect(model.hook.title).toBe('Call to Adventure (The Hook)');
    expect(model.scenes).toHaveLength(3);
    expect(model.scenes.map((s) => s.kind)).toEqual([
      'exploration',
      'combat',
      'puzzle',
    ]);
    expect(model.climax.title).toBe('The Showdown (Climax)');
    expect(model.rewards.title).toBe('Resolution, Treasure & Epilogue');
    expect(model.sceneCountStatus).toBe('ideal');
  });

  it('handles sessions with 1 or 2 steps gracefully', () => {
    const baseBundle = getFixtureBundle('ashes-of-veyra')!;
    const singleStepBundle = {
      ...baseBundle,
      campaign: { ...baseBundle.campaign, mode: 'one-shot' as const },
      sessions: [
        {
          ...baseBundle.sessions[0],
          plan: {
            ...baseBundle.sessions[0].plan!,
            steps: [
              {
                id: 's1',
                order: 1,
                title: 'Only Step',
                kind: 'scene',
                durationMinutes: 30,
              },
            ],
          },
        },
      ],
    };

    const singleModel = buildOneShotModel(singleStepBundle);
    expect(singleModel.hook.title).toBe('Only Step');
    expect(singleModel.scenes).toHaveLength(0);
    expect(singleModel.sceneCountStatus).toBe('few');

    const twoStepBundle = {
      ...baseBundle,
      campaign: { ...baseBundle.campaign, mode: 'one-shot' as const },
      sessions: [
        {
          ...baseBundle.sessions[0],
          plan: {
            ...baseBundle.sessions[0].plan!,
            steps: [
              {
                id: 's1',
                order: 1,
                title: 'Hook Step',
                kind: 'recap',
                durationMinutes: 20,
              },
              {
                id: 's2',
                order: 2,
                title: 'Climax Step',
                kind: 'encounter',
                durationMinutes: 60,
              },
            ],
          },
        },
      ],
    };

    const twoModel = buildOneShotModel(twoStepBundle);
    expect(twoModel.hook.title).toBe('Hook Step');
    expect(twoModel.climax.title).toBe('Climax Step');
    expect(twoModel.scenes).toHaveLength(0);
  });

  it('correctly parses 4+ steps when the last step is an epilogue/reward', () => {
    const baseBundle = getFixtureBundle('ashes-of-veyra')!;
    const fourStepBundle = {
      ...baseBundle,
      campaign: { ...baseBundle.campaign, mode: 'one-shot' as const },
      sessions: [
        {
          ...baseBundle.sessions[0],
          plan: {
            ...baseBundle.sessions[0].plan!,
            steps: [
              {
                id: 's1',
                order: 1,
                title: 'Tavern Rumors',
                kind: 'social',
                durationMinutes: 25,
              },
              {
                id: 's2',
                order: 2,
                title: 'Dungeon Crawl',
                kind: 'exploration',
                durationMinutes: 45,
              },
              {
                id: 's3',
                order: 3,
                title: 'Dragon Boss',
                kind: 'combat',
                durationMinutes: 70,
              },
              {
                id: 's4',
                order: 4,
                title: 'Rewards and Epilogue',
                kind: 'closing',
                durationMinutes: 20,
              },
            ],
          },
        },
      ],
    };

    const model = buildOneShotModel(fourStepBundle);
    expect(model.hook.title).toBe('Tavern Rumors');
    expect(model.scenes).toHaveLength(1);
    expect(model.scenes[0].title).toBe('Dungeon Crawl');
    expect(model.climax.title).toBe('Dragon Boss');
    expect(model.rewards.title).toBe('Rewards and Epilogue');
  });

  it('evaluates scene count status (few, ideal, many)', () => {
    const baseBundle = getFixtureBundle('ashes-of-veyra')!;
    const makeSteps = (sceneCount: number) => {
      const steps = [
        { id: 'hook', order: 1, title: 'Hook', kind: 'hook', durationMinutes: 20 },
      ];
      for (let i = 1; i <= sceneCount; i++) {
        steps.push({
          id: `scene-${i}`,
          order: i + 1,
          title: `Scene ${i}`,
          kind: 'scene',
          durationMinutes: 30,
        });
      }
      steps.push({
        id: 'climax',
        order: sceneCount + 2,
        title: 'Climax',
        kind: 'combat',
        durationMinutes: 50,
      });
      return steps;
    };

    // Few (< 3 scenes)
    const fewBundle = {
      ...baseBundle,
      sessions: [
        {
          ...baseBundle.sessions[0],
          plan: { ...baseBundle.sessions[0].plan!, steps: makeSteps(2) },
        },
      ],
    };
    expect(buildOneShotModel(fewBundle).sceneCountStatus).toBe('few');

    // Ideal (3 - 5 scenes)
    const idealBundle = {
      ...baseBundle,
      sessions: [
        {
          ...baseBundle.sessions[0],
          plan: { ...baseBundle.sessions[0].plan!, steps: makeSteps(4) },
        },
      ],
    };
    expect(buildOneShotModel(idealBundle).sceneCountStatus).toBe('ideal');

    // Many (> 5 scenes)
    const manyBundle = {
      ...baseBundle,
      sessions: [
        {
          ...baseBundle.sessions[0],
          plan: { ...baseBundle.sessions[0].plan!, steps: makeSteps(6) },
        },
      ],
    };
    expect(buildOneShotModel(manyBundle).sceneCountStatus).toBe('many');
  });

  it('evaluates pacing status (under, balanced, over)', () => {
    const baseBundle = getFixtureBundle('ashes-of-veyra')!;
    const makeBundleWithDuration = (totalMinutes: number) => {
      return {
        ...baseBundle,
        sessions: [
          {
            ...baseBundle.sessions[0],
            plan: {
              ...baseBundle.sessions[0].plan!,
              steps: [
                { id: 'h', order: 1, title: 'H', kind: 'h', durationMinutes: 20 },
                {
                  id: 's',
                  order: 2,
                  title: 'S',
                  kind: 's',
                  durationMinutes: Math.max(0, totalMinutes - 95),
                },
                { id: 'c', order: 3, title: 'C', kind: 'c', durationMinutes: 60 },
                { id: 'r', order: 4, title: 'Reward Resolution', kind: 'r', durationMinutes: 15 },
              ],
            },
          },
        ],
      };
    };

    // Under budget (< 75% of 240m = < 180m)
    const underModel = buildOneShotModel(makeBundleWithDuration(150), 240);
    expect(underModel.pacingStatus).toBe('under');
    expect(underModel.pacingStatusMessage).toContain('Under budget');

    // Balanced (180m - 276m)
    const balancedModel = buildOneShotModel(makeBundleWithDuration(230), 240);
    expect(balancedModel.pacingStatus).toBe('balanced');
    expect(balancedModel.pacingStatusMessage).toContain('Balanced pacing');

    // Over budget (> 115% of 240m = > 276m)
    const overModel = buildOneShotModel(makeBundleWithDuration(310), 240);
    expect(overModel.pacingStatus).toBe('over');
    expect(overModel.pacingStatusMessage).toContain('Over budget');
  });

  it('calculates pacing segments and proportional percentages accurately', () => {
    const baseBundle = getFixtureBundle('ashes-of-veyra')!;
    const model = buildOneShotModel(baseBundle);

    expect(model.segments.length).toBeGreaterThanOrEqual(3);
    const sumPercentage = model.segments.reduce((acc, s) => acc + s.percentage, 0);
    expect(Math.round(sumPercentage)).toBe(100);
  });
});
