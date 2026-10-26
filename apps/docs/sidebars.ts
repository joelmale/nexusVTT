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
        'integrations/campaign-studio-ux-plan',
        'integrations/campaign-studio-sidecar-plan',
        'integrations/campaign-studio-session-planner-plan',
        'integrations/forge-vtt-object-integration-plan',
        'integrations/character-creation-implementation-plan',
        {
          type: 'doc',
          id: 'integrations/character-creation-review',
          label: 'Creator and Studio repair plan',
        },
        'integrations/character-creation-validation-plan',
        'integrations/character-creation-validation-evidence',
        'integrations/character-creation-manual-acceptance',
        'integrations/NEXUSCODEX_INTEGRATION',
        'integrations/INTEGRATED_SETUP',
      ],
    },
  ],
};

export default sidebars;
