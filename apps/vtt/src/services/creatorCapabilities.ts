import type { CreationMode } from '@nexus/character-creator';

/** UI rollout only. Saved drafts/results always keep their compatible format. */
export function creatorDefaultMode(): CreationMode {
  const flags = (
    globalThis as { __NEXUS_CREATOR_FLAGS__?: { guidedDefault?: boolean } }
  ).__NEXUS_CREATOR_FLAGS__;
  return flags?.guidedDefault === true ? 'guided' : 'full';
}
