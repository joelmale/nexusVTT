import { describe, expect, it } from 'vitest';

import {
  campaignEntrySchema,
  sceneTemplateSchema,
  sessionPlanSchema,
} from '../src/index';
import {
  GLASS_HARBOR_IDS,
  glassHarborBrokenLinkFixture,
  glassHarborSceneFixture,
  glassHarborSessionPlanFixture,
  glassHarborWarningFixture,
} from './prep-fixtures';

describe('campaign preparation contracts', () => {
  it('parses the Glass Harbor note and scene fixtures from unknown input', () => {
    const entry = campaignEntrySchema.parse(glassHarborWarningFixture);
    const scene = sceneTemplateSchema.parse(glassHarborSceneFixture);

    expect(entry.title).toBe("Harbormaster's Warning");
    expect(entry.visibility).toBe('dm-only');
    expect(scene.name).toBe('Glass Harbor Docks');
    expect(scene.backgroundAssetRef.target).toBe('asset');
  });

  it('pins the Glass Harbor session plan to scene and encounter revisions', () => {
    const plan = sessionPlanSchema.parse(glassHarborSessionPlanFixture);
    const sceneStep = plan.steps.find((step) => step.type === 'activate-scene');
    const encounterStep = plan.steps.find(
      (step) => step.type === 'deploy-encounter',
    );

    expect(plan.status).toBe('ready');
    expect(sceneStep).toMatchObject({
      sceneTemplateRef: {
        id: GLASS_HARBOR_IDS.harborScene,
        revision: 4,
      },
    });
    expect(encounterStep).toMatchObject({
      encounterRef: {
        id: GLASS_HARBOR_IDS.docksideEncounter,
        revision: 5,
      },
    });
  });

  it('supports explicit 2014 and 2024 rules catalog dependencies', () => {
    const plan = sessionPlanSchema.parse(glassHarborSessionPlanFixture);
    const rulesets = plan.dependencies.flatMap((dependency) =>
      dependency.target === 'rules-entity' ? [dependency.ruleset] : [],
    );

    expect(rulesets).toEqual(['2024', '2014']);
  });

  it('keeps broken-link detection separate from structural validation', () => {
    const plan = sessionPlanSchema.parse(glassHarborBrokenLinkFixture);

    expect(plan.dependencies).toContainEqual({
      target: 'campaign-object',
      campaignId: GLASS_HARBOR_IDS.campaign,
      id: GLASS_HARBOR_IDS.missingEntry,
      revision: 1,
    });
  });

  it('rejects an unpinned campaign object reference', () => {
    const fixture = structuredClone(glassHarborSessionPlanFixture);
    const record = fixture as {
      steps: Array<{ sceneTemplateRef?: { revision?: number } }>;
    };
    delete record.steps[1]?.sceneTemplateRef?.revision;

    expect(sessionPlanSchema.safeParse(fixture).success).toBe(false);
  });

  it('rejects a non-encounter definition in a deployment step', () => {
    const fixture = structuredClone(glassHarborSessionPlanFixture);
    const record = fixture as {
      steps: Array<{ encounterRef?: { kind?: string } }>;
    };
    if (record.steps[3]?.encounterRef) {
      record.steps[3].encounterRef.kind = 'monster';
    }

    expect(sessionPlanSchema.safeParse(fixture).success).toBe(false);
  });

  it('rejects invalid visibility and lighting bounds', () => {
    const entryFixture = structuredClone(glassHarborWarningFixture) as {
      visibility?: string;
    };
    const sceneFixture = structuredClone(glassHarborSceneFixture) as {
      lighting?: { darkness?: number };
    };
    entryFixture.visibility = 'public';
    if (sceneFixture.lighting) {
      sceneFixture.lighting.darkness = 1.5;
    }

    expect(campaignEntrySchema.safeParse(entryFixture).success).toBe(false);
    expect(sceneTemplateSchema.safeParse(sceneFixture).success).toBe(false);
  });

  it('rejects duplicate session plan step IDs', () => {
    const fixture = structuredClone(glassHarborSessionPlanFixture) as {
      steps: Array<{ id: string }>;
    };
    fixture.steps[1].id = fixture.steps[0].id;

    const result = sessionPlanSchema.safeParse(fixture);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Session plan step IDs must be unique',
      );
    }
  });
});
