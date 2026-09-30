import { useMemo, type ReactNode } from 'react';

import { useCapabilityNotice } from '@/features/capability-notice';
import { StudioFrame } from '@/features/studio-shell/StudioFrame';

import { SectionContext } from './SectionContext';
import { useBundleStore } from './useBundleStore';

interface SectionRouteProps {
  /** Section name, used for the page context label. */
  title?: string;
  children: ReactNode;
}

/**
 * Wraps a section page in the Studio frame, resolves the campaign bundle for
 * the current route, and renders loading / unavailable states. Children read
 * the bundle with `useSectionBundle()`.
 */
export function SectionRoute({ title, children }: SectionRouteProps) {
  const { notifyCapability } = useCapabilityNotice();
  const state = useBundleStore();
  const context = useMemo(
    () =>
      state.status === 'ready'
        ? {
            bundle: state.store.bundle,
            basePath: state.basePath,
            store: state.store,
            exampleSlug: state.exampleSlug,
          }
        : null,
    [state],
  );

  if (
    state.status === 'loading' ||
    (state.status === 'ready' && state.store.status === 'loading')
  ) {
    return <main aria-busy="true">Loading campaign…</main>;
  }

  if (state.status === 'missing' || !context) {
    const unknownSlug =
      state.status === 'missing' && state.reason === 'unknown-slug';
    return (
      <StudioFrame onCapability={notifyCapability}>
        <main>
          <h1>
            {unknownSlug
              ? 'Example campaign unavailable'
              : 'Campaign unavailable'}
          </h1>
          <p>
            {unknownSlug
              ? 'This fixture is not available in the current build.'
              : ((state.status === 'missing' && state.message) ??
                'This campaign was deleted, is inaccessible, or does not exist.')}
          </p>
        </main>
      </StudioFrame>
    );
  }

  const campaignName = context.bundle.catalog.campaign.name;
  return (
    <StudioFrame
      contextLabel={title ? `${campaignName} · ${title}` : campaignName}
      onCapability={notifyCapability}
      onSearch={() => notifyCapability('campaign.search')}
      onSettings={() => notifyCapability('campaign.settings.open')}
      onTheme={() => notifyCapability('campaign.theme.change')}
    >
      <SectionContext.Provider value={context}>
        {children}
      </SectionContext.Provider>
    </StudioFrame>
  );
}
