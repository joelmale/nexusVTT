import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  platformSidebar: [
    'index',
    'dependency-policy',
    {
      type: 'category',
      label: 'Architecture and operations',
      items: [
        'private-admin-control-plane',
        'control-api-adr',
        'control-plane-runbook',
        'observability-runbook',
        'object-models-and-data-flow',
        'ci-cd-pipelines',
        'ci-test-catalog',
        'operations/ci-cd-optimization-plan',
      ],
    },
    {
      type: 'category',
      label: 'Integrations',
      items: [
        'integrations/character-creation',
        'integrations/character-creation-remaining-tranches',
        'integrations/campaign-studio-sidecar-plan',
        'integrations/campaign-studio-completeness-audit',
        'integrations/source-of-truth-audit',
        'integrations/NEXUSCODEX_INTEGRATION',
        {
          type: 'category',
          label: 'Archive',
          collapsed: true,
          items: [
            'integrations/archive/forge-vtt-object-integration-plan',
            'integrations/archive/campaign-studio-ux-plan',
            'integrations/archive/campaign-studio-session-planner-plan',
            'integrations/archive/character-creation-implementation-plan',
            {
              type: 'doc',
              id: 'integrations/archive/character-creation-review',
              label: 'Creator and Studio repair plan',
            },
            'integrations/archive/character-creation-validation-plan',
            'integrations/archive/character-creation-validation-evidence',
            'integrations/archive/character-creation-tranches-1-3-evidence',
            'integrations/archive/character-creation-docs-coverage',
            'integrations/archive/character-creation-manual-acceptance',
            'integrations/archive/character-creation-t08-checklist',
          ],
        },
      ],
    },
  ],
};

export default sidebars;
