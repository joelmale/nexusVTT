import { createContext, useContext } from 'react';

import type { CampaignFixtureBundle } from '@/demo/fixture-registry';

import type { BundleStore } from './bundleStore';

export interface SectionContextValue {
  bundle: CampaignFixtureBundle;
  /** `/demo/<slug>` or `/campaigns/<encoded id>`; prefix every link with it. */
  basePath: string;
  /** Read-only for fixtures; server-backed for real campaigns. */
  store: BundleStore;
  /** Set on example (`/demo/:slug`) pages. */
  exampleSlug?: string;
}

export const SectionContext = createContext<SectionContextValue | null>(null);

/** Bundle and basePath for the section being rendered inside `SectionRoute`. */
export function useSectionBundle(): SectionContextValue {
  const value = useContext(SectionContext);
  if (!value) {
    throw new Error('useSectionBundle must be used inside SectionRoute.');
  }
  return value;
}

/** The `BundleStore` (editable flag, updateItem, addItem, reload). */
export function useSectionStore(): BundleStore {
  return useSectionBundle().store;
}
