import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { useCapabilityNotice } from '@/features/capability-notice';
import { CampaignSearchDialog } from '@/features/search/CampaignSearchDialog';
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
  const [searchOpen, setSearchOpen] = useState(false);

  // Ctrl/Cmd+K opens search from anywhere in a campaign.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
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
      onSearch={() => setSearchOpen(true)}
      onSettings={() => notifyCapability('campaign.settings.open')}
      onTheme={() => notifyCapability('campaign.theme.change')}
    >
      <SectionContext.Provider value={context}>
        {children}
        <CampaignSearchDialog
          onClose={() => setSearchOpen(false)}
          open={searchOpen}
        />
      </SectionContext.Provider>
    </StudioFrame>
  );
}
